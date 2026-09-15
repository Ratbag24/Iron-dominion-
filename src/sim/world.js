// The simulation world: entities, players, and the fixed-step tick that drives
// every subsystem in a defined order.

import { GameMap } from './map.js';
import { Pathfinder } from './pathfinder.js';
import { SpatialGrid } from '../core/grid.js';
import { getDef, FACTIONS, rosterOf, BUILD_CELL } from './defs.js';
import { makeRng } from '../core/rng.js';
import { clamp, dist } from '../core/math.js';
import { updateOrders } from './orders.js';
import { runEconomy, settleEconomy } from './economy.js';
import { applyConstruction } from './construction.js';
import { updateMovement } from './movement.js';
import { updateCombat } from './combat.js';
import { updateProjectiles } from './projectiles.js';
import { FogMap } from './fog.js';
import { AIPlayer } from './ai.js';
import { updateCreep, applyCreepEffects } from './creep.js';

/** How much health a converted unit keeps. */
export const CONVERT_HP = 0.4;

export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export const PLAYER_COLORS = [
  { primary: '#4aa3ff', dark: '#1b4f86', light: '#a8d3ff', name: 'Blue' },
  { primary: '#ff5a4a', dark: '#8c2a1e', light: '#ffb2a8', name: 'Red' },
  { primary: '#5ddc7a', dark: '#1f6b36', light: '#b6f2c6', name: 'Green' },
  { primary: '#d98cff', dark: '#6a2f8c', light: '#ecc6ff', name: 'Violet' },
];

let nextEntityId = 1;

export class Player {
  constructor(index, opts) {
    this.index = index;
    this.name = opts.name || 'Player ' + (index + 1);
    this.faction = opts.faction || 'vanguard';
    this.team = opts.team !== undefined ? opts.team : index;
    this.isAI = !!opts.isAI;
    this.aiLevel = opts.aiLevel || 'normal';
    this.color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    this.metal = 1000;
    this.energy = 1000;
    this.metalStorage = 1000;
    this.energyStorage = 1000;

    // Per-second rates, recomputed every tick for the HUD.
    this.metalIncome = 0;
    this.energyIncome = 0;
    this.metalDrain = 0;
    this.energyDrain = 0;
    this.metalReclaim = 0;
    this.buildPowerUsed = 0;

    // Stall ratios in [0,1]; 1 means every builder is running at full speed.
    this.metalRatio = 1;
    this.energyRatio = 1;

    this.defeated = false;
    this.stats = { built: 0, lost: 0, killed: 0, metalProduced: 0, metalReclaimed: 0 };
  }

  get factionDef() {
    return FACTIONS[this.faction];
  }

  /** Slot -> definition id for this player's faction. */
  get roster() {
    return rosterOf(this.faction);
  }
}

export class World {
  constructor(opts = {}) {
    this.seed = (opts.seed !== undefined ? opts.seed : 12345) >>> 0;
    this.rng = makeRng(this.seed ^ 0x51ed2701);
    this.map = new GameMap({ seed: this.seed, width: opts.width, height: opts.height });
    this.pathfinder = new Pathfinder(this.map);
    this.grid = new SpatialGrid(this.map.width, this.map.height, 96);

    this.entities = [];
    this.byId = new Map();
    this.wrecks = [];
    this.projectiles = [];
    /** Transient visual events drained by the renderer each frame. */
    this.effects = [];

    this.time = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.winner = -1;
    this.commanderEnds = opts.commanderEnds !== undefined ? opts.commanderEnds : true;

    this.windStrength = 0.5;

    this.players = (opts.players || [
      { name: 'Commander', faction: 'vanguard' },
      { name: 'Legion AI', faction: 'legion', isAI: true },
    ]).map((p, i) => new Player(i, p));

    this.fog = this.players.map(() => new FogMap(this.map));

    /** Build jobs registered this tick, grouped in the construction phase. */
    this.buildJobs = [];

    this._queryBuf = [];
    // Start positions must exist before the AI reads them.
    this._spawnStart(opts);
    this.ais = this.players.map((p) => (p.isAI ? new AIPlayer(this, p) : null));
  }

  _spawnStart(opts) {
    const starts = this.map.startPositions;
    this.players.forEach((p, i) => {
      const s = starts[i % starts.length];
      const roster = rosterOf(p.faction);
      const com = this.spawn(roster.commander, i, s.x, s.y, { complete: true });
      p.startX = s.x;
      p.startY = s.y;
      p.commanderId = com.id;
      if (opts.startUnits) {
        for (let k = 0; k < opts.startUnits; k++) {
          const a = (k / opts.startUnits) * Math.PI * 2;
          this.spawn(roster.builder, i, s.x + Math.cos(a) * 70, s.y + Math.sin(a) * 70, { complete: true });
        }
      }
      this.fog[i].revealCircle(s.x, s.y, 700);
    });
  }

  // ------------------------------------------------------------- entities

  spawn(defId, playerIndex, x, y, opts = {}) {
    const player = this.players[playerIndex];
    const def = getDef(defId, player.faction);
    const isBuilding = def.kind === 'building';

    let cx = 0;
    let cy = 0;
    if (isBuilding) {
      const snapped = this.map.snapFootprint(x, y, def.footprint);
      cx = snapped.cx;
      cy = snapped.cy;
      x = snapped.x;
      y = snapped.y;
    }

    const e = {
      id: nextEntityId++,
      defId,
      def,
      player: playerIndex,
      x, y,
      cx, cy,
      heading: opts.heading !== undefined ? opts.heading : (isBuilding ? -Math.PI / 2 : this.rng.range(0, Math.PI * 2)),
      radius: def.radius,
      isBuilding,
      alive: true,

      maxHp: def.hp,
      speedScale: 1,
      hp: opts.complete === false ? Math.max(1, def.hp * 0.05) : def.hp,
      underConstruction: opts.complete === false,
      buildProgress: opts.complete === false ? 0 : 1,
      buildPowerApplied: 0,

      vx: 0, vy: 0, speed: 0,
      path: null,
      pathIndex: 0,
      pathPending: false,
      moveGoal: null,
      stuckTimer: 0,
      lastX: x, lastY: y,

      orders: [],
      activeJob: null,

      weapons: (def.weapons || []).map((w) => ({
        def: w, cooldown: this.rng.range(0, w.reload), targetId: 0, aim: 0, lastFire: -99,
      })),
      turretAngle: 0,
      targetId: 0,
      lastDamageTime: -99,
      lastAttackerId: 0,

      factoryQueue: [],
      factoryProgress: 0,
      rally: null,

      metalSpot: null,
      selected: false,
      idleSince: 0,
    };

    if (def.needsMetalSpot) {
      const spot = this.map.metalSpotNear(x, y, BUILD_CELL * 2);
      if (spot) {
        spot.taken = true;
        spot.ownerId = e.id;
        e.metalSpot = spot;
        e.x = spot.x;
        e.y = spot.y;
        const snapped = this.map.snapFootprint(spot.x, spot.y, def.footprint);
        e.cx = snapped.cx;
        e.cy = snapped.cy;
        e.x = snapped.x;
        e.y = snapped.y;
      }
    }

    if (isBuilding) {
      this.map.setBlocked(e.cx, e.cy, def.footprint, 1);
    }

    this.entities.push(e);
    this.byId.set(e.id, e);
    // A converted unit was not built, and counting it as built would make the
    // hive's production look like it out-produced everyone.
    if (opts.complete !== false && !opts.converted) player.stats.built++;
    return e;
  }

  get(id) {
    const e = this.byId.get(id);
    return e && e.alive ? e : null;
  }

  isEnemy(a, b) {
    return this.players[a.player].team !== this.players[b.player].team;
  }

  addEffect(fx) {
    fx.t = this.time;
    this.effects.push(fx);
    if (this.effects.length > 900) this.effects.splice(0, this.effects.length - 900);
  }

  /**
   * `infect` is the chance, in [0, 1], that a killing blow takes the unit
   * rather than leaving a wreck. It rides in from the weapon that fired.
   */
  damage(target, amount, attacker, infect = 0) {
    if (!target.alive || amount <= 0) return;
    // Things still being built take extra damage, as in BAR: nanoframes are
    // fragile, which is what makes raiding construction worthwhile.
    if (target.underConstruction) amount *= 1.6;
    target.hp -= amount;
    target.lastDamageTime = this.time;
    if (attacker) target.lastAttackerId = attacker.id;
    if (target.hp <= 0) this.kill(target, attacker, infect);
  }

  kill(e, killer, infect = 0) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;

    const player = this.players[e.player];
    player.stats.lost++;
    if (killer) this.players[killer.player].stats.killed++;

    if (this._convert(e, killer, infect)) return;

    if (e.isBuilding) {
      this.map.setBlocked(e.cx, e.cy, e.def.footprint, 0);
      if (e.metalSpot) {
        e.metalSpot.taken = false;
        e.metalSpot.ownerId = -1;
      }
    }

    const wreckMetal = e.def.wreckMetal || 0;
    if (wreckMetal > 0) {
      this.wrecks.push({
        id: nextEntityId++,
        x: e.x, y: e.y,
        defId: e.defId,
        faction: e.def.faction,
        radius: e.radius,
        metal: wreckMetal,
        metalLeft: wreckMetal,
        reclaimTime: Math.max(120, e.def.buildTime * 0.35),
        reclaimProgress: 0,
        isBuilding: e.isBuilding,
        heading: e.heading,
      });
      if (this.wrecks.length > 600) this.wrecks.shift();
    }

    const size = e.isBuilding ? e.def.footprintPx * 0.9 : e.radius * 3.4;
    this.addEffect({ type: 'explosion', x: e.x, y: e.y, size, big: e.isBuilding || e.def.hp > 2000 });

    if (this.commanderEnds && e.def.isCommander) {
      this.addEffect({ type: 'explosion', x: e.x, y: e.y, size: 420, big: true, nuke: true });
      // A dying commander takes its surroundings with it.
      this.grid.query(e.x, e.y, 260, this._queryBuf);
      for (const other of this._queryBuf) {
        if (other === e || !other.alive) continue;
        const d = dist(e.x, e.y, other.x, other.y);
        if (d < 260) this.damage(other, 2200 * (1 - d / 260), e);
      }
      player.defeated = true;
    }
  }

  /**
   * Take a killed unit for the killer's side instead of leaving a wreck.
   *
   * Only mobile units, and never a commander: a hive that could eat the thing
   * the match is decided by would decide it on one lucky bite. The unit keeps
   * its own definition - a captured tank is still a tank, and still shoots
   * what a tank shoots - which also means it does not inherit the teeth that
   * took it. Conversion stops with the unit that was converted.
   */
  _convert(e, killer, infect) {
    if (!(infect > 0) || !killer || !killer.alive) return false;
    if (e.isBuilding || e.def.isCommander || !e.def.speed) return false;
    if (!this.isEnemy(e, killer)) return false;
    if (this.rng() >= infect) return false;

    const taken = this.spawn(e.defId, killer.player, e.x, e.y, {
      complete: true, heading: e.heading, converted: true,
    });
    // It comes over wounded. Taking a unit whole would make trading into the
    // hive strictly worse than not fighting at all.
    taken.hp = Math.max(1, taken.maxHp * CONVERT_HP);
    this.players[killer.player].stats.converted =
      (this.players[killer.player].stats.converted || 0) + 1;

    this.addEffect({
      type: 'convert', x: e.x, y: e.y, player: killer.player,
      size: e.radius * 3.2,
    });
    return true;
  }

  /** Every living entity of a player, optionally filtered by definition id. */
  unitsOf(playerIndex, defId) {
    const out = [];
    for (const e of this.entities) {
      if (!e.alive || e.player !== playerIndex) continue;
      if (defId && e.defId !== defId) continue;
      out.push(e);
    }
    return out;
  }

  // ----------------------------------------------------------------- tick

  tick(dt = SIM_DT) {
    if (this.gameOver) return;
    this.time += dt;
    this.tickCount++;

    // Wind drifts slowly, so turbine output rises and falls over a match.
    this.windStrength = 0.5 + 0.5 * Math.sin(this.time * 0.055) * Math.cos(this.time * 0.017 + 1.3);
    this.windStrength = clamp(this.windStrength * 0.5 + 0.5, 0.05, 1);

    this.pathfinder.beginTick();

    this.grid.clear();
    for (const e of this.entities) {
      if (e.alive) this.grid.insert(e);
    }

    for (let i = 0; i < this.ais.length; i++) {
      if (this.ais[i] && !this.players[i].defeated) this.ais[i].update(dt);
    }

    this.buildJobs.length = 0;
    for (const e of this.entities) {
      if (e.alive) updateOrders(this, e, dt);
    }

    runEconomy(this, dt);
    applyConstruction(this, dt);
    settleEconomy(this, dt);
    applyCreepEffects(this, dt);
    updateMovement(this, dt);
    updateCombat(this, dt);
    updateCreep(this, dt);
    updateProjectiles(this, dt);

    this.pathfinder.processRequests();

    this._cleanup();

    if ((this.tickCount & 3) === 0) {
      for (let i = 0; i < this.players.length; i++) this._updateFog(i);
    }

    this._checkVictory();
  }

  _updateFog(playerIndex) {
    const fog = this.fog[playerIndex];
    fog.beginFrame();
    const team = this.players[playerIndex].team;
    for (const e of this.entities) {
      if (!e.alive || this.players[e.player].team !== team) continue;
      fog.revealCircle(e.x, e.y, e.def.los || 200);
      if (e.def.radar) fog.revealRadar(e.x, e.y, e.def.radar);
    }
    // Remember enemy structures we can currently see, and forget the ones we
    // can now see are gone.
    const liveIds = new Set();
    for (const e of this.entities) {
      if (!e.alive || !e.isBuilding) continue;
      if (this.players[e.player].team === team) continue;
      liveIds.add(e.id);
      if (fog.isVisible(e.x, e.y)) fog.remember(e);
    }
    fog.forgetGone(liveIds);
  }

  _cleanup() {
    let write = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.alive) {
        this.entities[write++] = e;
      } else {
        this.byId.delete(e.id);
      }
    }
    this.entities.length = write;

    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      if (this.wrecks[i].metalLeft <= 0.01) this.wrecks.splice(i, 1);
    }
  }

  _checkVictory() {
    const alive = new Set();
    for (const e of this.entities) {
      if (e.alive && !this.players[e.player].defeated) alive.add(this.players[e.player].team);
    }
    for (const p of this.players) {
      if (p.defeated) continue;
      if (this.commanderEnds) {
        const com = this.get(p.commanderId);
        if (!com) p.defeated = true;
      } else if (!alive.has(p.team)) {
        p.defeated = true;
      }
    }
    const liveTeams = new Set(this.players.filter((p) => !p.defeated).map((p) => p.team));
    if (liveTeams.size <= 1) {
      this.gameOver = true;
      this.winner = liveTeams.size === 1 ? [...liveTeams][0] : -1;
    }
  }
}
