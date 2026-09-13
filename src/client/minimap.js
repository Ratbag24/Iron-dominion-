// Minimap: terrain thumbnail, fog, unit dots and the camera rectangle.
// Click or drag to move the camera; right-click issues a move order.

import { renderMapThumbnail } from './gfx/terrain.js';

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.accum = 0;
    this._buildTerrainThumb();
    this._bind();
  }

  _buildTerrainThumb() {
    this.thumb = renderMapThumbnail(this.game.world.map, this.size);
  }

  _bind() {
    const c = this.canvas;
    const toWorld = (ev) => {
      const r = c.getBoundingClientRect();
      const map = this.game.world.map;
      return {
        x: ((ev.clientX - r.left) / r.width) * map.width,
        y: ((ev.clientY - r.top) / r.height) * map.height,
      };
    };
    let dragging = false;
    c.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      const w = toWorld(ev);
      if (ev.button === 2) {
        const sel = this.game.selection.filter((e) => e.player === this.game.playerIndex && e.def.speed);
        for (const e of sel) {
          if (!ev.shiftKey) e.orders.length = 0;
          e.orders.push({ type: 'move', x: w.x, y: w.y });
        }
        this.game.addCommandMarker(w.x, w.y, 'move');
        return;
      }
      dragging = true;
      this.game.camera.centerOn(w.x, w.y);
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const w = toWorld(ev);
      this.game.camera.centerOn(w.x, w.y);
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    c.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  update(dt) {
    this.accum += dt;
    if (this.accum < 1 / 15) return;
    this.accum = 0;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const game = this.game;
    const world = game.world;
    const map = world.map;
    const s = this.size;
    const scale = s / map.width;

    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(this.thumb, 0, 0);

    // Fog
    const fog = world.fog[game.playerIndex];
    const cw = s / fog.cols;
    const ch = s / fog.rows;
    for (let y = 0; y < fog.rows; y++) {
      for (let x = 0; x < fog.cols; x++) {
        const i = y * fog.cols + x;
        if (fog.visible[i]) continue;
        ctx.fillStyle = fog.explored[i] ? 'rgba(3,5,8,0.5)' : 'rgba(3,5,8,0.94)';
        ctx.fillRect(x * cw, y * ch, cw + 1, ch + 1);
      }
    }

    // Entities
    const myTeam = world.players[game.playerIndex].team;
    for (const e of world.entities) {
      if (!e.alive) continue;
      const team = world.players[e.player].team;
      const visible = team === myTeam || fog.isVisible(e.x, e.y);
      if (!visible) continue;
      ctx.fillStyle = world.players[e.player].color.primary;
      const r = e.isBuilding ? Math.max(2, e.def.footprintPx * scale * 0.5) : (e.def.isCommander ? 3.2 : 1.9);
      ctx.fillRect(e.x * scale - r, e.y * scale - r, r * 2, r * 2);
    }

    // Remembered enemy structures
    for (const mem of fog.memory.values()) {
      if (fog.isVisible(mem.x, mem.y)) continue;
      ctx.fillStyle = 'rgba(255,90,74,0.45)';
      ctx.fillRect(mem.x * scale - 2, mem.y * scale - 2, 4, 4);
    }

    // Attack pings, so an assault on an off-screen expansion is visible.
    for (const ping of game.pings) {
      const k = ping.age / 4;
      const r = (5 + k * 16);
      ctx.strokeStyle = `rgba(255,90,74,${(1 - k).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ping.x * scale, ping.y * scale, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Camera footprint. The 3D view covers a trapezoid on the ground, so
    // trace the four picked screen corners rather than an axis-aligned box.
    const cam = game.camera;
    const corners = [
      cam.groundPick(0, 0),
      cam.groundPick(cam.viewWidth, 0),
      cam.groundPick(cam.viewWidth, cam.viewHeight),
      cam.groundPick(0, cam.viewHeight),
    ];
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (const c of corners) {
      if (!c) continue;
      const px = c.x * scale;
      const py = c.y * scale;
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    if (started) { ctx.closePath(); ctx.stroke(); }
  }
}
