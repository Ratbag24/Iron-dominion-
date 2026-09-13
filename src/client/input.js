// Mouse and keyboard handling: selection, commands, build placement, camera.
//
// All picking goes through the 3D camera: the cursor is projected onto the
// terrain for ground commands, and entities are picked in screen space so a
// unit on a hilltop is as easy to click as one on the flat.

import { BUILD_HOTKEYS } from '../sim/defs.js';

const EDGE_PAN_MARGIN = 16;
const EDGE_PAN_SPEED = 1500;
const DOUBLE_CLICK_MS = 280;

/** Command hotkeys. Build hotkeys live on the definitions. */
const COMMAND_KEYS = {
  a: 'attackMove',
  s: 'stop',
  d: 'guard',
  f: 'patrol',
  e: 'reclaim',
  r: 'repair',
};

export class Input {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.keys = new Set();
    // Start the cursor at the centre of the view. Defaulting to (0, 0) would
    // put it in the top-left edge-scroll zone and pan the camera off the base
    // before the player has touched the mouse.
    this.mouse = {
      x: canvas.clientWidth / 2, y: canvas.clientHeight / 2,
      world: { x: game.camera.targetX, y: game.camera.targetZ },
      inside: false, moved: false,
    };
    this.marquee = null;
    this.panning = null;
    this.rotating = null;
    this.lastClickTime = 0;
    this.lastClickTarget = null;
    this.commandMode = null;
    this.attach();
  }

  attach() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    c.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _updateMouse(ev) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ev.clientX - rect.left;
    this.mouse.y = ev.clientY - rect.top;
    this.mouse.moved = true;
    const hit = this.game.camera.groundPick(this.mouse.x, this.mouse.y);
    if (hit) this.mouse.world = hit;
  }

  // ---------------------------------------------------------------- mouse

  onMouseDown(ev) {
    this._updateMouse(ev);
    const game = this.game;
    if (game.gameOverShown) return;

    if (ev.button === 1) {
      ev.preventDefault();
      if (ev.shiftKey || ev.altKey) this.rotating = { x: ev.clientX };
      else this.panning = { x: ev.clientX, y: ev.clientY };
      return;
    }

    if (ev.button === 2) {
      ev.preventDefault();
      if (game.placement) { game.cancelPlacement(); return; }
      if (this.commandMode) { this.commandMode = null; return; }
      this.issueContextCommand(ev.shiftKey);
      return;
    }

    if (game.placement) {
      const placed = game.tryPlaceBuilding(ev.shiftKey);
      if (placed && !ev.shiftKey) game.cancelPlacement();
      return;
    }

    if (this.commandMode) {
      this.applyCommandMode(ev.shiftKey);
      if (!ev.shiftKey) this.commandMode = null;
      return;
    }

    this.marquee = {
      sx: this.mouse.x, sy: this.mouse.y,
      cx: this.mouse.x, cy: this.mouse.y,
      shift: ev.shiftKey,
    };
  }

  onMouseMove(ev) {
    this._updateMouse(ev);
    if (this.panning) {
      const dx = ev.clientX - this.panning.x;
      const dy = ev.clientY - this.panning.y;
      this.game.camera.pan(-dx, -dy);
      this.panning.x = ev.clientX;
      this.panning.y = ev.clientY;
    }
    if (this.rotating) {
      this.game.camera.rotate((ev.clientX - this.rotating.x) * 0.006);
      this.rotating.x = ev.clientX;
    }
    if (this.marquee) {
      this.marquee.cx = this.mouse.x;
      this.marquee.cy = this.mouse.y;
    }
    if (this.game.placement) this.game.updatePlacement(this.mouse.world);
  }

  onMouseUp(ev) {
    if (ev.button === 1) { this.panning = null; this.rotating = null; return; }
    if (ev.button !== 0 || !this.marquee) return;

    const m = this.marquee;
    this.marquee = null;
    const dragged = Math.abs(m.cx - m.sx) > 5 || Math.abs(m.cy - m.sy) > 5;

    if (dragged) {
      this.game.selectInScreenBox(
        Math.min(m.sx, m.cx), Math.min(m.sy, m.cy),
        Math.max(m.sx, m.cx), Math.max(m.sy, m.cy),
        m.shift
      );
      return;
    }

    const hit = this.game.entityAtScreen(this.mouse.x, this.mouse.y);
    const now = performance.now();
    const isDouble = hit && hit === this.lastClickTarget && now - this.lastClickTime < DOUBLE_CLICK_MS;
    this.lastClickTime = now;
    this.lastClickTarget = hit;

    if (isDouble) this.game.selectAllOfTypeOnScreen(hit);
    else this.game.selectSingle(hit, m.shift);
  }

  onWheel(ev) {
    ev.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.game.camera.zoomBy(ev.deltaY, ev.clientX - rect.left, ev.clientY - rect.top);
  }

  // ------------------------------------------------------------- commands

  issueContextCommand(queue) {
    const game = this.game;
    const world = game.world;
    const sel = game.selection.filter((e) => e.alive && e.player === game.playerIndex);
    if (!sel.length) return;

    const wx = this.mouse.world.x;
    const wy = this.mouse.world.y;
    const target = game.entityAtScreen(this.mouse.x, this.mouse.y);
    const wreck = game.wreckAt(wx, wy);

    // Right-click on the map with only factories selected sets the rally point.
    const factories = sel.filter((e) => e.def.factory);
    if (factories.length === sel.length) {
      for (const f of factories) f.rally = { x: wx, y: wy };
      game.flashMessage('Rally point set');
      game.addCommandMarker(wx, wy, 'move');
      return;
    }

    for (const e of sel) {
      if (!queue) e.orders.length = 0;
      const hasBuild = !!e.def.buildPower;

      if (target && world.isEnemy(e, target)) {
        e.orders.push({ type: 'attack', targetId: target.id });
      } else if (target && target.player === e.player && target !== e) {
        if (hasBuild && (target.underConstruction || target.hp < target.maxHp * 0.999 || target.def.factory)) {
          e.orders.push({ type: 'repair', targetId: target.id });
        } else {
          e.orders.push({ type: 'guard', targetId: target.id });
        }
      } else if (wreck && hasBuild) {
        e.orders.push({ type: 'reclaim', wreckId: wreck.id });
      } else {
        e.orders.push({ type: 'move', x: wx, y: wy });
      }
    }
    game.spreadMoveOrders(sel, wx, wy, queue, !!target || !!wreck);
    game.addCommandMarker(wx, wy, target && world.isEnemy(sel[0], target) ? 'attack' : 'move');
  }

  applyCommandMode(queue) {
    const game = this.game;
    const sel = game.selection.filter((e) => e.alive && e.player === game.playerIndex);
    if (!sel.length) return;
    const wx = this.mouse.world.x;
    const wy = this.mouse.world.y;
    const target = game.entityAtScreen(this.mouse.x, this.mouse.y);
    const wreck = game.wreckAt(wx, wy);
    const mode = this.commandMode;

    for (const e of sel) {
      if (!queue) e.orders.length = 0;
      switch (mode) {
        case 'attackMove':
          if (target && game.world.isEnemy(e, target)) e.orders.push({ type: 'attack', targetId: target.id });
          else e.orders.push({ type: 'attackMove', x: wx, y: wy });
          break;
        case 'patrol':
          e.orders.push({ type: 'patrol', points: [{ x: e.x, y: e.y }, { x: wx, y: wy }], index: 1 });
          break;
        case 'guard':
          if (target) e.orders.push({ type: 'guard', targetId: target.id });
          break;
        case 'reclaim':
          if (wreck) e.orders.push({ type: 'reclaim', wreckId: wreck.id });
          else game.reclaimNearest(e, wx, wy);
          break;
        case 'repair':
          if (target && target.player === e.player) e.orders.push({ type: 'repair', targetId: target.id });
          break;
      }
    }
    game.addCommandMarker(wx, wy, mode === 'attackMove' ? 'attack' : 'move');
  }

  // ---------------------------------------------------------------- keys

  onKeyDown(ev) {
    const game = this.game;
    const key = ev.key.toLowerCase();
    if (ev.target && ev.target.tagName === 'INPUT') return;
    this.keys.add(key);

    if (key === 'escape') {
      if (game.placement) game.cancelPlacement();
      else if (this.commandMode) this.commandMode = null;
      else game.clearSelection();
      return;
    }

    if (/^[0-9]$/.test(key)) {
      const n = parseInt(key, 10);
      if (ev.ctrlKey || ev.metaKey) game.setControlGroup(n);
      else game.selectControlGroup(n, ev.shiftKey);
      ev.preventDefault();
      return;
    }

    if (key === ' ') { game.togglePause(); ev.preventDefault(); return; }
    if (key === '+' || key === '=') { game.setSpeed(game.speed + 1); return; }
    if (key === '-' || key === '_') { game.setSpeed(game.speed - 1); return; }
    if (key === 'tab') { ev.preventDefault(); game.cycleIdleBuilder(); return; }
    if (key === 'delete' || key === 'backspace') { game.selfDestructSelection(); return; }
    if (key === '[') { game.camera.rotate(-0.18); return; }
    if (key === ']') { game.camera.rotate(0.18); return; }
    if (key === 'home') { game.camera.reset(); return; }
    if (key === 'h') { game.focusCommander(); return; }

    // Build menu hotkeys take priority while a builder or factory is selected.
    const options = game.currentBuildOptions();
    if (options.length && !ev.ctrlKey && !ev.altKey) {
      for (const id of options) {
        if ((BUILD_HOTKEYS[id] || '').toLowerCase() === key) {
          game.chooseBuildOption(id);
          ev.preventDefault();
          return;
        }
      }
    }

    // Below the build menu, so V still builds a Laser Tower when a builder
    // is selected and only jumps to the last attack otherwise.
    if (key === 'v') { game.focusLastAttack(); return; }

    if (COMMAND_KEYS[key]) {
      const mode = COMMAND_KEYS[key];
      if (mode === 'stop') game.stopSelection();
      else {
        this.commandMode = mode;
        game.flashMessage(modeLabel(mode) + ': pick a target');
      }
    }
  }

  /** Per-frame camera panning from the arrow keys and screen edges. */
  update(dt) {
    const cam = this.game.camera;
    let right = 0;
    let forward = 0;
    const speed = EDGE_PAN_SPEED * (cam.distance / 900);

    if (this.keys.has('arrowup')) forward += speed;
    if (this.keys.has('arrowdown')) forward -= speed;
    if (this.keys.has('arrowleft')) right -= speed;
    if (this.keys.has('arrowright')) right += speed;

    // Edge scrolling only after the player has actually moved the mouse.
    if (this.mouse.inside && this.mouse.moved && this.game.edgePan && !this.panning) {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (this.mouse.x < EDGE_PAN_MARGIN) right -= speed;
      else if (this.mouse.x > w - EDGE_PAN_MARGIN) right += speed;
      if (this.mouse.y < EDGE_PAN_MARGIN) forward += speed;
      else if (this.mouse.y > h - EDGE_PAN_MARGIN) forward -= speed;
    }

    if (right || forward) cam.panWorld(right, forward, dt);
  }
}

function modeLabel(mode) {
  return {
    attackMove: 'Attack move', patrol: 'Patrol', guard: 'Guard',
    reclaim: 'Reclaim', repair: 'Repair',
  }[mode] || mode;
}
