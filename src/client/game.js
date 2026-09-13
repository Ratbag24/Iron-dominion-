// Game client: owns the world, drives the fixed-step simulation, and holds
// the selection and command state the UI acts on.

import { World, SIM_DT } from '../sim/world.js';
import { getDef } from '../sim/defs.js';
import { canBuildHere } from '../sim/orders.js';
import { Camera3D } from './camera3d.js';
import { Renderer3D } from './gfx/renderer3d.js';
import { smoothHeightAt } from './gfx/terrain.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { Audio } from './audio.js';
import { dist, dist2 } from '../core/math.js';

const SPEEDS = [0, 1, 2, 3, 5];

export class Game {
  constructor(canvas, overlay, options) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.options = options;
    this.world = new World({
      seed: options.seed,
      commanderEnds: options.commanderEnds !== false,
      players: [
        { name: 'You', faction: options.faction, team: 0 },
        { name: 'Enemy AI', faction: options.enemyFaction, team: 1, isAI: true, aiLevel: options.difficulty },
      ],
    });

    this.playerIndex = 0;
    this.player = this.world.players[0];

    this.camera = new Camera3D(this.world.map, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.camera.centerOn(this.player.startX, this.player.startY);

    this.renderer = new Renderer3D(canvas, overlay, this.world, this.camera);
    this.renderer.setViewer(0);
    this.audio = new Audio();
    this.hud = new Hud(this);
    this.minimap = new Minimap(this, document.getElementById('minimap'));
    this.input = new Input(this, canvas);

    this.selection = [];
    this.controlGroups = {};
    this.placement = null;
    this.placementQueue = [];
    this.commandMarkers = [];
    this.messages = [];
    this.edgePan = true;
    this.speedIndex = 2;
    this.paused = false;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.gameOverShown = false;
    this.idleBuilderCursor = 0;
    this.running = true;
    this.fps = 60;
    this.simMs = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get speed() { return this.speedIndex; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.resize(w, h, dpr);
    this.dpr = dpr;
  }

  // ------------------------------------------------------------- main loop

  start() {
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.update(dt);
      this.render(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum > 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    this.input.update(dt);
    this.camera.update(dt);

    const multiplier = this.paused ? 0 : SPEEDS[this.speedIndex];
    if (multiplier > 0) {
      this.accumulator += dt * multiplier;
      // Cap catch-up so a slow frame cannot spiral.
      let steps = 0;
      const t0 = performance.now();
      while (this.accumulator >= SIM_DT && steps < 12) {
        this.world.tick(SIM_DT);
        this.accumulator -= SIM_DT;
        steps++;
      }
      if (steps > 0) {
        const per = (performance.now() - t0) / steps;
        this.simMs = this.simMs * 0.9 + per * 0.1;
      }
      if (this.accumulator > SIM_DT * 12) this.accumulator = 0;
    }

    this.selection = this.selection.filter((e) => e.alive);
    for (let i = this.commandMarkers.length - 1; i >= 0; i--) {
      this.commandMarkers[i].age += dt;
      if (this.commandMarkers[i].age > 0.6) this.commandMarkers.splice(i, 1);
    }
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].age += dt;
      if (this.messages[i].age > 3.5) this.messages.splice(i, 1);
    }

    this.audio.update(this.world, this.camera, dt);
    this.hud.update(dt);
    this.minimap.update(dt);

    if (this.world.gameOver && !this.gameOverShown) {
      this.gameOverShown = true;
      this.hud.showGameOver(this.world.winner === this.player.team);
    }
  }

  render(dt) {
    const view = {
      playerIndex: this.playerIndex,
      selection: this.selection,
      placement: this.placement,
      marquee: this.input.marquee,
      commandMarkers: this.commandMarkers,
    };
    this.renderer.render(dt, view);
  }

  // ------------------------------------------------------------- selection

  /**
   * Pick an entity under the cursor in screen space. Candidates come from the
   * ground point below the cursor, then each is projected and measured in
   * pixels, so units on high ground are as clickable as units on the flat.
   */
  entityAtScreen(sx, sy) {
    const ground = this.camera.groundPick(sx, sy);
    if (!ground) return null;
    const fog = this.world.fog[this.playerIndex];
    const myTeam = this.player.team;
    const map = this.world.map;

    // A generous world radius: at a low camera angle a tall structure can sit
    // a long way from the ground point behind it. The projection test below
    // does the real filtering.
    const found = this.world.grid.query(ground.x, ground.y, 420, []);
    let best = null;
    let bestD = Infinity;
    const scr = {};

    for (const e of found) {
      if (!e.alive) continue;
      const team = this.world.players[e.player].team;
      if (team !== myTeam && !fog.isVisible(e.x, e.y)) continue;

      const h = smoothHeightAt(map, e.x, e.y) + (e.isBuilding ? e.def.footprintPx * 0.2 : e.radius);
      this.camera.worldToScreen(e.x, h, e.y, scr);
      if (scr.behind) continue;

      // Pixel radius scales with the entity's size and the current zoom.
      const worldR = e.isBuilding ? e.def.footprintPx * 0.55 : e.radius * 1.5;
      const edge = {};
      this.camera.worldToScreen(e.x + worldR, h, e.y, edge);
      const pixelR = Math.max(9, Math.hypot(edge.x - scr.x, edge.y - scr.y));

      const d = Math.hypot(sx - scr.x, sy - scr.y);
      if (d <= pixelR && d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  wreckAt(wx, wy) {
    for (const w of this.world.wrecks) {
      if (dist2(wx, wy, w.x, w.y) <= (w.radius + 10) ** 2) return w;
    }
    return null;
  }

  selectSingle(entity, add) {
    if (!entity) {
      if (!add) this.clearSelection();
      return;
    }
    if (!add) this.clearSelection();
    if (!this.selection.includes(entity)) {
      entity.selected = true;
      this.selection.push(entity);
    }
    this.onSelectionChanged();
  }

  /** Marquee selection, tested in screen space against the drag rectangle. */
  selectInScreenBox(x0, y0, x1, y1, add) {
    if (!add) this.clearSelection();
    const mine = [];
    const others = [];
    const map = this.world.map;
    const scr = {};
    for (const e of this.world.entities) {
      if (!e.alive) continue;
      const h = smoothHeightAt(map, e.x, e.y) + (e.isBuilding ? e.def.footprintPx * 0.2 : e.radius);
      this.camera.worldToScreen(e.x, h, e.y, scr);
      if (scr.behind) continue;
      if (scr.x < x0 || scr.x > x1 || scr.y < y0 || scr.y > y1) continue;
      if (e.player === this.playerIndex) mine.push(e);
      else if (this.world.fog[this.playerIndex].isVisible(e.x, e.y)) others.push(e);
    }
    // Prefer own mobile units, then own buildings, then anything visible.
    let pick = mine.filter((e) => !e.isBuilding);
    if (!pick.length) pick = mine;
    if (!pick.length) pick = others.slice(0, 1);

    for (const e of pick) {
      if (!this.selection.includes(e)) {
        e.selected = true;
        this.selection.push(e);
      }
    }
    this.onSelectionChanged();
  }

  selectAllOfTypeOnScreen(proto) {
    const b = this.camera.viewBounds(60);
    this.clearSelection();
    for (const e of this.world.entities) {
      if (!e.alive || e.defId !== proto.defId || e.player !== proto.player) continue;
      if (e.x < b.left || e.x > b.right || e.y < b.top || e.y > b.bottom) continue;
      e.selected = true;
      this.selection.push(e);
    }
    this.onSelectionChanged();
  }

  clearSelection() {
    for (const e of this.selection) e.selected = false;
    this.selection.length = 0;
    this.cancelPlacement();
    this.onSelectionChanged();
  }

  onSelectionChanged() {
    this.hud.refreshSelection();
  }

  setControlGroup(n) {
    this.controlGroups[n] = this.selection.filter((e) => e.alive).map((e) => e.id);
    this.flashMessage(`Group ${n} set (${this.controlGroups[n].length})`);
  }

  selectControlGroup(n, add) {
    const ids = this.controlGroups[n];
    if (!ids || !ids.length) return;
    if (!add) this.clearSelection();
    for (const id of ids) {
      const e = this.world.get(id);
      if (e && !this.selection.includes(e)) {
        e.selected = true;
        this.selection.push(e);
      }
    }
    if (this.selection.length) {
      const c = this.selectionCentre();
      this.camera.centerOn(c.x, c.y);
    }
    this.onSelectionChanged();
  }

  selectionCentre() {
    let x = 0;
    let y = 0;
    for (const e of this.selection) { x += e.x; y += e.y; }
    return { x: x / this.selection.length, y: y / this.selection.length };
  }

  focusCommander() {
    const com = this.world.get(this.player.commanderId);
    if (!com) { this.flashMessage('Commander lost'); return; }
    this.camera.centerOn(com.x, com.y);
    this.selectSingle(com, false);
  }

  cycleIdleBuilder() {
    const idle = this.world.unitsOf(this.playerIndex)
      .filter((e) => e.def.buildPower && !e.isBuilding && e.orders.length === 0);
    if (!idle.length) { this.flashMessage('No idle builders'); return; }
    this.idleBuilderCursor = (this.idleBuilderCursor + 1) % idle.length;
    const e = idle[this.idleBuilderCursor];
    this.selectSingle(e, false);
    this.camera.centerOn(e.x, e.y);
  }

  // -------------------------------------------------------------- commands

  stopSelection() {
    for (const e of this.selection) {
      if (e.player !== this.playerIndex) continue;
      e.orders.length = 0;
      e.moveGoal = null;
      e.path = null;
      e.targetId = 0;
    }
    this.flashMessage('Stop');
  }

  selfDestructSelection() {
    const sel = this.selection.filter((e) => e.player === this.playerIndex);
    if (!sel.length) return;
    for (const e of sel) {
      if (e.defId === 'commander') continue; // too easy to lose by accident
      this.world.kill(e, null);
    }
    this.flashMessage('Self-destruct');
  }

  /** Fan a group's move orders out so they do not all target one point. */
  spreadMoveOrders(sel, wx, wy, queue, isTargeted) {
    if (isTargeted || sel.length < 2) return;
    const movers = sel.filter((e) => e.def.speed && e.orders.length && e.orders[e.orders.length - 1].type === 'move');
    if (movers.length < 2) return;

    const spacing = 34;
    const cols = Math.ceil(Math.sqrt(movers.length));
    const centre = (cols - 1) / 2;
    movers.forEach((e, i) => {
      const gx = (i % cols) - centre;
      const gy = Math.floor(i / cols) - centre;
      const order = e.orders[e.orders.length - 1];
      order.x = wx + gx * spacing;
      order.y = wy + gy * spacing;
    });
  }

  reclaimNearest(builder, wx, wy) {
    let best = null;
    let bestD = 400 * 400;
    for (const w of this.world.wrecks) {
      const d = dist2(wx, wy, w.x, w.y);
      if (d < bestD) { bestD = d; best = w; }
    }
    if (best) builder.orders.push({ type: 'reclaim', wreckId: best.id });
  }

  addCommandMarker(x, y, kind) {
    this.commandMarkers.push({ x, y, kind, age: 0 });
    this.audio.play('command');
  }

  flashMessage(text) {
    this.messages.push({ text, age: 0 });
    this.hud.setMessages(this.messages);
  }

  // -------------------------------------------------------------- building

  /** Build options for the current selection (builders or factories). */
  currentBuildOptions() {
    const sel = this.selection.filter((e) => e.player === this.playerIndex && !e.underConstruction);
    if (!sel.length) return [];
    // Factories offer unit production; builders offer structures.
    const factory = sel.find((e) => e.def.factory);
    if (factory) return factory.def.build || [];
    const builder = sel.find((e) => e.def.build && e.def.build.length);
    return builder ? builder.def.build : [];
  }

  chooseBuildOption(defId) {
    const sel = this.selection.filter((e) => e.player === this.playerIndex && !e.underConstruction);
    const factory = sel.find((e) => e.def.factory && (e.def.build || []).includes(defId));
    if (factory) {
      const count = this.input && this.input.keys.has('shift') ? 5 : 1;
      for (const f of sel.filter((e) => e.def.factory && (e.def.build || []).includes(defId))) {
        const existing = f.factoryQueue.find((q) => q.defId === defId);
        if (existing) existing.count += count;
        else f.factoryQueue.push({ defId, count, origCount: count });
      }
      this.audio.play('click');
      this.hud.refreshSelection();
      return;
    }
    this.beginPlacement(defId);
  }

  beginPlacement(defId) {
    const def = getDef(defId, this.player.faction);
    this.placement = {
      defId, def, cx: 0, cy: 0, x: 0, y: 0, valid: false,
      queue: this.placementQueue,
    };
    this.updatePlacement(this.input ? this.input.mouse.world : { x: 0, y: 0 });
    this.audio.play('click');
  }

  updatePlacement(world) {
    const p = this.placement;
    if (!p) return;
    const map = this.world.map;
    const snapped = map.snapFootprint(world.x, world.y, p.def.footprint);
    p.cx = snapped.cx;
    p.cy = snapped.cy;
    p.x = snapped.x;
    p.y = snapped.y;
    p.valid = canBuildHere(this.world, this.playerIndex, p.def, p.cx, p.cy)
      && this.world.fog[this.playerIndex].isExplored(p.x, p.y);
  }

  tryPlaceBuilding(queue) {
    const p = this.placement;
    if (!p || !p.valid) {
      this.flashMessage('Cannot build there');
      return false;
    }
    const builders = this.selection.filter(
      (e) => e.player === this.playerIndex && e.def.build && e.def.build.includes(p.defId) && !e.def.factory
    );
    if (!builders.length) {
      this.flashMessage('No builder selected');
      return false;
    }

    const order = { type: 'build', defId: p.defId, x: p.x, y: p.y, cx: p.cx, cy: p.cy };
    // Nearest builder takes the job; the rest assist it.
    let primary = builders[0];
    let bestD = Infinity;
    for (const b of builders) {
      const d = dist2(b.x, b.y, p.x, p.y);
      if (d < bestD) { bestD = d; primary = b; }
    }
    if (!queue) primary.orders.length = 0;
    primary.orders.push(order);
    for (const b of builders) {
      if (b === primary) continue;
      if (!queue) b.orders.length = 0;
      b.orders.push({ type: 'guard', targetId: primary.id });
    }

    this.addCommandMarker(p.x, p.y, 'move');
    this.audio.play('build');
    return true;
  }

  cancelPlacement() {
    this.placement = null;
    this.placementQueue = [];
  }

  // ---------------------------------------------------------------- speed

  setSpeed(index) {
    this.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, index));
    this.flashMessage(`Speed ${SPEEDS[this.speedIndex]}x`);
    this.hud.refreshTopBar();
  }

  get speedMultiplier() { return SPEEDS[this.speedIndex]; }

  togglePause() {
    this.paused = !this.paused;
    this.flashMessage(this.paused ? 'Paused' : 'Resumed');
  }

  destroy() {
    this.running = false;
  }
}

export { SPEEDS };
