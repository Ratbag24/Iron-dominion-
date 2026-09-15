// Skirmish AI.
//
// It plays the same game you do: claim metal spots, keep energy ahead of
// demand, get a factory up, keep builders busy, and push with waves that grow
// as the match goes on. It has no extra vision and pays the same costs; the
// only handicap is an income multiplier chosen by the difficulty setting.

import { getDef, rosterOf, DEFS } from './defs.js';
import { canBuildHere } from './orders.js';
import { dist } from '../core/math.js';

const LEVELS = {
  easy: {
    think: 0.75, income: 0.85, builders: 2, waveBase: 6, waveGrowth: 1 / 120,
    maxWave: 24, techTime: 660, defenceTime: 300, airTime: 600,
    barracksTime: 150,
  },
  normal: {
    think: 0.5, income: 1.0, builders: 4, waveBase: 8, waveGrowth: 1 / 90,
    maxWave: 34, techTime: 480, defenceTime: 220, airTime: 420,
    barracksTime: 105,
  },
  hard: {
    think: 0.35, income: 1.2, builders: 6, waveBase: 10, waveGrowth: 1 / 70,
    maxWave: 48, techTime: 380, defenceTime: 160, airTime: 320,
    barracksTime: 75,
  },
};

export class AIPlayer {
  constructor(world, player) {
    this.world = world;
    this.player = player;
    this.cfg = LEVELS[player.aiLevel] || LEVELS.normal;
    player.incomeMultiplier = this.cfg.income;

    // Everything below is written against roster slots, never definition ids,
    // so the same build order drives any faction.
    this.R = rosterOf(player.faction);

    this.baseX = player.startX;
    this.baseY = player.startY;

    const enemy = world.players.find((p) => p.team !== player.team);
    this.enemyX = enemy ? enemy.startX : world.map.width - this.baseX;
    this.enemyY = enemy ? enemy.startY : world.map.height - this.baseY;

    const toEnemy = Math.atan2(this.enemyY - this.baseY, this.enemyX - this.baseX);
    this.stageX = this.baseX + Math.cos(toEnemy) * 320;
    this.stageY = this.baseY + Math.sin(toEnemy) * 320;

    this.timer = world.rng() * this.cfg.think;
    this.attacking = false;
    this.defendUntil = 0;
    this.defendX = 0;
    this.defendY = 0;
    this.energyStallTime = 0;
    this.metalWasteTime = 0;
    // How many enemy aircraft we have laid eyes on, which is what drives the
    // decision to pay for anti-air at all.
    this.airSeen = 0;
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.cfg.think;
    this.think(this.cfg.think);
  }

  think(dt) {
    const w = this.world;
    const p = this.player;

    const own = w.unitsOf(p.index);
    const counts = {};
    const builders = [];
    const factories = [];
    const army = [];

    for (const e of own) {
      counts[e.defId] = (counts[e.defId] || 0) + (e.underConstruction ? 0 : 1);
      if (e.underConstruction) {
        counts[e.defId + '_wip'] = (counts[e.defId + '_wip'] || 0) + 1;
        continue;
      }
      if (e.def.factory) factories.push(e);
      else if (e.def.buildPower && !e.def.assistOnly) builders.push(e);
      if (e.weapons.length > 0 && e.def.speed && !e.def.isCommander) army.push(e);
    }
    this.counts = counts;

    // Count what is flying against us, from what we can currently see.
    let flying = 0;
    for (const other of w.entities) {
      if (!other.alive || other.def.layer !== 'air') continue;
      if (w.players[other.player].team === p.team) continue;
      if (!w.fog[p.index].isVisible(other.x, other.y)) continue;
      flying++;
    }
    this.airSeen = Math.max(flying, this.airSeen * 0.985);

    if (p.stalling && p.stalling.energy) this.energyStallTime += dt;
    else this.energyStallTime = Math.max(0, this.energyStallTime - dt * 0.5);
    if (p.metalWasted > 0.5) this.metalWasteTime += dt;
    else this.metalWasteTime = Math.max(0, this.metalWasteTime - dt * 0.5);

    this.manageBuilders(builders, counts);
    this.manageFactories(factories, counts);
    this.manageArmy(army);
  }

  // ------------------------------------------------------------- building

  manageBuilders(builders, counts) {
    const w = this.world;
    for (const b of builders) {
      // Hard energy stall with a builder tied up on something it cannot pay
      // for: drop a solar collector first. Solar is the only structure that
      // costs no energy to build, so it is always affordable.
      if (b.orders.length > 0) {
        const order = b.orders[0];
        const stalled = this.player.energyRatio < 0.25 && this.energyStallTime > 2;
        if (stalled && order.type === 'build' && order.defId !== this.R.energy) {
          const spot = this.findBuildSpot(this.R.energy, b);
          if (spot) {
            b.orders.unshift({
              type: 'build', defId: this.R.energy,
              x: spot.x, y: spot.y, cx: spot.cx, cy: spot.cy,
            });
            this.energyStallTime = 0;
          }
        }
        continue;
      }

      // Work down the priority list. A structure we cannot place right now
      // must not block everything below it, which is what happens if we only
      // ever consider the single top choice.
      const wants = this.buildPriorities(counts, b);
      for (const want of wants) {
        const spot = this.findBuildSpot(want, b);
        if (!spot) continue;
        b.orders.push({
          type: 'build', defId: want,
          x: spot.x, y: spot.y, cx: spot.cx, cy: spot.cy,
        });
        // Count it immediately so two builders do not start the same thing.
        counts[want + '_wip'] = (counts[want + '_wip'] || 0) + 1;
        break;
      }
    }
  }

  /** Structures this builder should consider, best first. */
  buildPriorities(counts, builder) {
    const w = this.world;
    const p = this.player;
    const time = w.time;
    const n = (id) => (id ? (counts[id] || 0) + (counts[id + '_wip'] || 0) : 0);
    const out = [];
    const add = (id) => { if (id && !out.includes(id)) out.push(id); };

    // Never start new work while badly metal-starved; finish what we have.
    if (p.metalRatio < 0.35 && p.metal < 60) return out;

    const R = this.R;
    const mexes = n(R.mex);
    const energyIncome = p.energyIncome;
    const factories = n(R.factory) + n(R.factoryT2);
    const hasSpot = !!this.findMetalSpot(builder);

    // Energy has to stay ahead of what our build power can spend, but not by
    // so much that we pour the whole economy into power plants.
    const energyTarget = 60 + p.buildPowerUsed * 0.35;

    // Running the bank dry stops everything, so energy comes first whenever
    // we are actually short of it. The cheap plant costs no energy to build,
    // which is what makes it the way out of a stall.
    if (p.energy < p.energyStorage * 0.3 || energyIncome < 24) add(R.energy);

    // Anti-air goes near the top the moment something is actually flying at
    // us. It is not an improvement to make when there is spare time; it is the
    // difference between having an answer and not having one.
    if (this.airSeen > 0 && n(R.antiAir) < 1 + Math.floor(this.airSeen / 2)) {
      add(R.antiAir);
    }

    if (mexes < 4 && hasSpot) add(R.mex);
    if (energyIncome < 42 && n(R.energy) + n(R.energyAlt) < 6) {
      add(energyIncome < 30 ? R.energy : (R.energyAlt || R.energy));
    }
    if (factories === 0) add(R.factory);

    // A barracks is the cheapest production in the game and finishes in a
    // third of the time a bot lab takes, so it goes up beside the first
    // factory rather than after it -- troops are what covers the gap while
    // the real army is still being built.
    if (time > this.cfg.barracksTime && n(R.barracks) < 1) add(R.barracks);

    // An air plant is a strategic opening rather than an incremental one, so
    // it sits with the factories: aircraft ignore the map, which is worth a
    // great deal on ground this broken. Below the first factory, above the
    // steady drip of power plants and turrets that would otherwise crowd it
    // out forever.
    if (factories > 0 && time > this.cfg.airTime && p.metalIncome > 14
        && n(R.airFactory) < 1) {
      add(R.airFactory);
    }
    // One tower on spec once the game is old enough that someone could have
    // aircraft, so the first raid is not free. Exactly one: anti-air shoots at
    // nothing else, so every tower past the first is metal that buys no ground
    // until an aircraft actually shows up -- and a second one on spec measured
    // out as games that ran to the clock instead of to a winner.
    if (time > this.cfg.airTime * 1.2 && n(R.antiAir) < 1) add(R.antiAir);
    if (hasSpot) add(R.mex);
    // Infantry scale by number, not by quality, so a second barracks is worth
    // more than a second bot lab once there is income to keep both busy.
    if (p.metalIncome > 20 && n(R.barracks) < 2) add(R.barracks);

    if (this.energyStallTime > 1.5 || energyIncome < energyTarget) {
      // A big reactor is a mid-game commitment, not an opening move: it costs
      // as much metal as a dozen tanks, so it only makes sense once there is
      // a spread of cheap plants already up and the income to absorb the lump.
      const bigReady = R.energyBig
        && p.metalIncome > 26
        && n(R.energy) >= 4
        && n(R.energyBig) < 1 + Math.floor(p.metalIncome / 45);
      add(bigReady ? R.energyBig : R.energy);
    }

    // More production capacity as the economy grows: extra factories, and
    // assist turrets beside them so queued units actually come out quickly.
    const factoryTarget = Math.min(4, 1 + Math.floor(p.metalIncome / 14));
    if (factories < factoryTarget) add(R.factory);
    const nanoTarget = Math.min(8, Math.floor(p.metalIncome / 5));
    if (factories > 0 && n(R.nano) < nanoTarget) add(R.nano);

    const wantDefence = time > this.cfg.defenceTime || w.time < this.defendUntil;
    if (wantDefence && n(R.defence) < 2 + Math.floor(time / 240)) add(R.defence);
    if (time > 180 && n(R.radar) < 1) add(R.radar);

    if (time > this.cfg.techTime && n(R.factoryT2) === 0 && p.metalIncome > 9) add(R.factoryT2);
    if (this.metalWasteTime > 3 && n(R.mstore) < 2) add(R.mstore);
    if (p.energy > p.energyStorage * 0.9 && p.metalIncome < 20 && n(R.converter) < 6) add(R.converter);
    if (n(R.estore) < 2 && energyIncome > 120) add(R.estore);
    if (time > 300 && n(R.defenceT2) < 2 && n(R.factoryT2) > 0) add(R.defenceT2);

    // Deliberately no catch-all fallback: a builder with nothing worth
    // building will assist the nearest factory instead, which turns spare
    // metal into army rather than into yet another power plant.
    return out;
  }

  /**
   * Best free metal spot this builder could actually use. Spots whose
   * footprint is obstructed are skipped, otherwise one unbuildable spot would
   * sit at the top of the list forever and stall the whole build order.
   */
  findMetalSpot(builder) {
    const w = this.world;
    const map = w.map;
    const def = getDef(this.R.mex, this.player.faction);
    const maxRange = builder.def.isCommander ? 900 : 2400;

    const candidates = [];
    for (const s of map.metalSpots) {
      if (s.taken) continue;
      const dBase = dist(s.x, s.y, this.baseX, this.baseY);
      if (dBase > maxRange) continue;
      const dEnemy = dist(s.x, s.y, this.enemyX, this.enemyY);
      // Prefer spots close to us and far from them.
      candidates.push({ spot: s, score: -dBase + dEnemy * 0.35 });
    }
    candidates.sort((a, b) => b.score - a.score);

    for (const c of candidates) {
      const snapped = map.snapFootprint(c.spot.x, c.spot.y, def.footprint);
      if (!canBuildHere(w, this.player.index, def, snapped.cx, snapped.cy)) continue;
      c.spot._snapped = snapped;
      return c.spot;
    }
    return null;
  }

  findBuildSpot(defId, builder) {
    const w = this.world;
    const map = w.map;
    const def = getDef(defId, this.player.faction);

    if (def.needsMetalSpot) {
      const spot = this.findMetalSpot(builder);
      if (!spot) return null;
      return spot._snapped || map.snapFootprint(spot.x, spot.y, def.footprint);
    }

    // Defences go toward the enemy; everything else clusters around the base.
    let originX = this.baseX;
    let originY = this.baseY;
    let minR = 110;
    let maxR = 520;
    const R = this.R;
    if (defId === R.defence || defId === R.defenceT2) {
      const a = Math.atan2(this.enemyY - this.baseY, this.enemyX - this.baseX);
      originX = this.baseX + Math.cos(a) * 300;
      originY = this.baseY + Math.sin(a) * 300;
      minR = 0;
      maxR = 320;
    } else if (defId === R.antiAir) {
      // Anti-air belongs over what it is protecting, not out at the front.
      minR = 60;
      maxR = 380;
    } else if (defId === R.airFactory) {
      minR = 140;
      maxR = 480;
    } else if (defId === R.radar) {
      minR = 200;
      maxR = 600;
    } else if (defId === R.nano) {
      // Park nano turrets next to a factory so they speed up unit production.
      const lab = this.world.unitsOf(this.player.index)
        .find((e) => e.def.factory && !e.underConstruction);
      if (lab) {
        originX = lab.x;
        originY = lab.y;
        minR = lab.def.footprintPx * 0.6 + 30;
        maxR = (getDef(R.nano, this.player.faction).buildRange || 300) * 0.8;
      }
    }

    const rngOffset = w.rng() * Math.PI * 2;
    for (let r = minR; r <= maxR; r += 34) {
      const steps = Math.max(8, Math.floor((r / 34) * 5));
      for (let i = 0; i < steps; i++) {
        const a = rngOffset + (i / steps) * Math.PI * 2;
        const x = originX + Math.cos(a) * r;
        const y = originY + Math.sin(a) * r;
        const snapped = map.snapFootprint(x, y, def.footprint);
        // Leave a one-cell gap so the base does not seal itself in.
        if (!map.canPlace(snapped.cx - 1, snapped.cy - 1, def.footprint + 2)) continue;
        if (!canBuildHere(w, this.player.index, def, snapped.cx, snapped.cy)) continue;
        return snapped;
      }
    }
    return null;
  }

  // ------------------------------------------------------------ production

  manageFactories(factories, counts) {
    const p = this.player;
    const n = (id) => (counts[id] || 0) + (counts[id + '_wip'] || 0);

    for (const f of factories) {
      const queued = f.factoryQueue.reduce((a, it) => a + it.count, 0);
      const queueCap = p.metalIncome > 25 ? 6 : 4;
      if (queued >= queueCap) continue;
      // Do not pile up a queue we cannot pay for.
      if (p.metalRatio < 0.4 && queued >= 1) continue;

      const R = this.R;
      const isT2 = f.defId === R.factoryT2;
      let pick;

      if (f.defId === R.barracks) {
        // Troopers are the body of the squad; lancers are what stops armour;
        // the AA team only earns its cost once something is in the air. Keep
        // the mix weighted to riflemen -- a platoon of nothing but rocket
        // troops evaporates the moment it meets infantry of its own.
        if (this.airSeen > 0 && n(R.aaInfantry) < 2) pick = R.aaInfantry;
        else {
          const r = this.world.rng();
          pick = r < 0.62 ? R.trooper : R.lancer;
        }
      } else if (f.defId === R.airFactory) {
        // Enough interceptors to contest the sky, then things that hit ground.
        const fighters = n(R.fighter);
        if (this.airSeen > fighters * 1.5) pick = R.fighter;
        else if (fighters < 2) pick = R.fighter;
        else pick = this.world.rng() < 0.55 ? R.gunship : R.bomber;
      } else if (isT2) {
        if (n(R.builderT2) < 2) pick = R.builderT2;
        else pick = this.world.rng() < 0.68 ? R.heavy : R.artillery;
      } else {
        const builderCount = n(R.builder) + n(R.builderT2);
        if (builderCount < this.cfg.builders) pick = R.builder;
        else {
          const r = this.world.rng();
          pick = r < 0.5 ? R.assault : r < 0.82 ? R.skirmisher : R.raider;
        }
      }

      const existing = f.factoryQueue.find((it) => it.defId === pick);
      if (existing) existing.count++;
      else f.factoryQueue.push({ defId: pick, count: 1, origCount: 1 });

      if (!f.rally) {
        f.rally = { x: this.stageX, y: this.stageY };
      }
    }
  }

  // ----------------------------------------------------------------- army

  manageArmy(army) {
    const w = this.world;

    const threat = this.findBaseThreat();
    if (threat) {
      this.defendUntil = w.time + 25;
      this.defendX = threat.x;
      this.defendY = threat.y;
    }

    if (w.time < this.defendUntil) {
      // Defend: everything converges on the intrusion.
      for (const u of army) {
        const busy = u.orders.length > 0 && u.orders[0].type === 'attackMove'
          && dist(u.orders[0].x, u.orders[0].y, this.defendX, this.defendY) < 220;
        if (busy) continue;
        u.orders.length = 0;
        u.orders.push({ type: 'attackMove', x: this.defendX, y: this.defendY });
      }
      this.attacking = false;
      return;
    }

    const idle = army.filter((u) => u.orders.length === 0);
    const waveSize = Math.min(
      this.cfg.maxWave,
      Math.floor(this.cfg.waveBase + w.time * this.cfg.waveGrowth)
    );

    if (this.attacking) {
      // Keep a running push supplied: idle units head to the current target.
      const target = this.attackTarget || { x: this.enemyX, y: this.enemyY };
      for (const u of idle) {
        u.orders.push({ type: 'attackMove', x: target.x, y: target.y });
      }
      if (army.length === 0) this.attacking = false;
      // Re-target when the previous objective is gone.
      if (w.time > (this.retargetAt || 0)) {
        this.attackTarget = this.pickAttackTarget();
        this.retargetAt = w.time + 12;
        for (const u of army) {
          u.orders.length = 0;
          u.orders.push({ type: 'attackMove', x: this.attackTarget.x, y: this.attackTarget.y });
        }
      }
      return;
    }

    // Trigger on the size of the whole army, not just the units that happen to
    // be idle this instant: units jostling at a crowded rally point still
    // count toward the push.
    if (army.length >= waveSize) {
      this.attackTarget = this.pickAttackTarget();
      this.retargetAt = w.time + 15;
      this.attacking = true;
      for (const u of army) {
        u.orders.length = 0;
        u.orders.push({ type: 'attackMove', x: this.attackTarget.x, y: this.attackTarget.y });
      }
    } else {
      // Gather at the staging point while we build up.
      for (const u of idle) {
        if (dist(u.x, u.y, this.stageX, this.stageY) > 260) {
          u.orders.push({ type: 'move', x: this.stageX + (w.rng() - 0.5) * 190, y: this.stageY + (w.rng() - 0.5) * 190 });
        }
      }
    }
  }

  /** Prefer a remembered enemy structure; fall back to their start position. */
  pickAttackTarget() {
    const w = this.world;
    const fog = w.fog[this.player.index];
    let best = null;
    let bestScore = -Infinity;
    for (const mem of fog.memory.values()) {
      if (w.players[mem.player].team === this.player.team) continue;
      const d = dist(mem.x, mem.y, this.baseX, this.baseY);
      let score = -d;
      // Judge remembered structures by what they do, not by which faction
      // built them - the enemy may not share our roster.
      const memDef = DEFS[mem.defId];
      if (memDef) {
        if (memDef.needsMetalSpot) score += 400;
        if (memDef.factory) score += 900;
        if (memDef.weapons && memDef.weapons.length) score -= 500;
      }
      if (score > bestScore) { bestScore = score; best = mem; }
    }
    if (best) return { x: best.x, y: best.y };
    return { x: this.enemyX, y: this.enemyY };
  }

  /** Any enemy unit close to our base, or any of our buildings taking fire. */
  findBaseThreat() {
    const w = this.world;
    const p = this.player;
    for (const e of w.entities) {
      if (!e.alive || e.player !== p.index) continue;
      if (w.time - e.lastDamageTime < 4 && dist(e.x, e.y, this.baseX, this.baseY) < 1100) {
        const attacker = w.get(e.lastAttackerId);
        if (attacker) return { x: attacker.x, y: attacker.y };
        return { x: e.x, y: e.y };
      }
    }
    return null;
  }
}
