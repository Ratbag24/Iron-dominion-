// Camera with smooth panning and zoom-to-cursor.

import { clamp } from '../core/math.js';

export class Camera {
  constructor(map, viewWidth, viewHeight) {
    this.map = map;
    this.x = map.width / 2;
    this.y = map.height / 2;
    this.zoom = 1;
    this.minZoom = 0.22;
    this.maxZoom = 2.4;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.targetZoom = 1;
    this.panVX = 0;
    this.panVY = 0;
  }

  resize(w, h) {
    this.viewWidth = w;
    this.viewHeight = h;
    // Never zoom out past the whole map.
    this.minZoom = Math.min(0.9, Math.max(0.12, Math.min(w / this.map.width, h / this.map.height) * 0.95));
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
    this.targetZoom = clamp(this.targetZoom, this.minZoom, this.maxZoom);
  }

  centerOn(x, y) {
    this.x = x;
    this.y = y;
    this.clampToMap();
  }

  /** Zoom toward a screen point so the world point under it stays put. */
  zoomAt(screenX, screenY, delta) {
    const before = this.screenToWorld(screenX, screenY);
    this.targetZoom = clamp(this.targetZoom * Math.pow(1.0016, -delta), this.minZoom, this.maxZoom);
    this.zoom = this.targetZoom;
    const after = this.screenToWorld(screenX, screenY);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clampToMap();
  }

  pan(dxScreen, dyScreen) {
    this.x += dxScreen / this.zoom;
    this.y += dyScreen / this.zoom;
    this.clampToMap();
  }

  update(dt) {
    if (this.panVX || this.panVY) {
      this.x += (this.panVX / this.zoom) * dt;
      this.y += (this.panVY / this.zoom) * dt;
      this.clampToMap();
    }
  }

  clampToMap() {
    const halfW = this.viewWidth / (2 * this.zoom);
    const halfH = this.viewHeight / (2 * this.zoom);
    const m = this.map;
    if (halfW * 2 >= m.width) this.x = m.width / 2;
    else this.x = clamp(this.x, halfW, m.width - halfW);
    if (halfH * 2 >= m.height) this.y = m.height / 2;
    else this.y = clamp(this.y, halfH, m.height - halfH);
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.viewWidth / 2,
      y: (wy - this.y) * this.zoom + this.viewHeight / 2,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewWidth / 2) / this.zoom + this.x,
      y: (sy - this.viewHeight / 2) / this.zoom + this.y,
    };
  }

  /** World-space rectangle currently on screen, with a margin for culling. */
  viewBounds(margin = 80) {
    const halfW = this.viewWidth / (2 * this.zoom) + margin;
    const halfH = this.viewHeight / (2 * this.zoom) + margin;
    return {
      left: this.x - halfW, right: this.x + halfW,
      top: this.y - halfH, bottom: this.y + halfH,
    };
  }

  applyTransform(ctx) {
    ctx.setTransform(
      this.zoom, 0, 0, this.zoom,
      this.viewWidth / 2 - this.x * this.zoom,
      this.viewHeight / 2 - this.y * this.zoom
    );
  }
}
