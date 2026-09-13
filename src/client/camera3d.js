// Top-down RTS camera.
//
// The camera orbits a ground target at a fixed pitch, the way Beyond All
// Reason's default camera does: pan moves the target, the wheel changes
// distance, and the view can be rotated around the target.

import * as THREE from '../../vendor/three.module.js';
import { clamp, lerp } from '../core/math.js';
import { smoothHeightAt, HEIGHT_SCALE } from './gfx/terrain.js';

const MIN_DIST = 240;
const MAX_DIST = 3000;

export class Camera3D {
  constructor(map, aspect) {
    this.map = map;
    this.camera = new THREE.PerspectiveCamera(48, aspect, 8, 12000);

    this.targetX = map.width / 2;
    this.targetZ = map.height / 2;
    this.distance = 900;
    this.yaw = Math.PI / 2;   // looking "down the map" from the south
    this.pitchNear = 0.62;
    this.pitchFar = 1.16;

    this._v = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this.viewWidth = 1;
    this.viewHeight = 1;

    this.update(0);
  }

  get pitch() {
    const t = clamp((this.distance - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
    return lerp(this.pitchNear, this.pitchFar, Math.pow(t, 0.65));
  }

  /** Approximate ground-plane scale, used for speed and size heuristics. */
  get zoom() {
    return 900 / this.distance;
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  centerOn(x, y) {
    this.targetX = x;
    this.targetZ = y;
    this.clampToMap();
    this.update(0);
  }

  clampToMap() {
    const m = 120;
    this.targetX = clamp(this.targetX, -m, this.map.width + m);
    this.targetZ = clamp(this.targetZ, -m, this.map.height + m);
    this.distance = clamp(this.distance, MIN_DIST, MAX_DIST);
  }

  /** Screen-space drag to world panning, in the camera's own axes. */
  pan(dxScreen, dyScreen) {
    const scale = this.distance / 900;
    const fx = -Math.cos(this.yaw);
    const fz = -Math.sin(this.yaw);
    const rx = -fz;
    const rz = fx;
    const k = 1.6 * scale;
    this.targetX += (rx * dxScreen + fx * dyScreen) * k;
    this.targetZ += (rz * dxScreen + fz * dyScreen) * k;
    this.clampToMap();
  }

  /** Move along the camera's ground axes, in world units per second. */
  panWorld(right, forward, dt) {
    const fx = -Math.cos(this.yaw);
    const fz = -Math.sin(this.yaw);
    const rx = -fz;
    const rz = fx;
    this.targetX += (rx * right + fx * forward) * dt;
    this.targetZ += (rz * right + fz * forward) * dt;
    this.clampToMap();
  }

  rotate(delta) {
    this.yaw += delta;
  }

  zoomBy(deltaY, screenX, screenY) {
    // Zoom toward whatever is under the cursor, as a map application should.
    const before = screenX !== undefined ? this.groundPick(screenX, screenY) : null;
    this.distance = clamp(this.distance * Math.pow(1.0013, deltaY), MIN_DIST, MAX_DIST);
    this.update(0);
    if (before) {
      const after = this.groundPick(screenX, screenY);
      if (after) {
        this.targetX += before.x - after.x;
        this.targetZ += before.y - after.y;
        this.clampToMap();
      }
    }
    this.update(0);
  }

  reset() {
    this.yaw = Math.PI / 2;
    this.distance = 900;
  }

  update(dt) {
    const pitch = this.pitch;
    const groundY = smoothHeightAt(this.map, this.targetX, this.targetZ);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    this.camera.position.set(
      this.targetX + cosP * Math.cos(this.yaw) * this.distance,
      groundY + sinP * this.distance,
      this.targetZ + cosP * Math.sin(this.yaw) * this.distance
    );
    this._v.set(this.targetX, groundY, this.targetZ);
    this.camera.lookAt(this._v);
    this.camera.updateMatrixWorld();
  }

  // ------------------------------------------------------------- picking

  /**
   * March the view ray through the heightfield and return the ground point in
   * simulation coordinates ({x, y} where y is the sim's second axis).
   */
  groundPick(screenX, screenY) {
    this._ndc.x = (screenX / this.viewWidth) * 2 - 1;
    this._ndc.y = -(screenY / this.viewHeight) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera);

    const origin = this._raycaster.ray.origin;
    const dir = this._raycaster.ray.direction;
    if (dir.y >= -1e-4) return null; // looking at or above the horizon

    const map = this.map;
    const step = map.cell * 0.9;
    const maxT = 14000;

    let prevT = 0;
    let prevDiff = origin.y - this._sampleHeight(origin.x, origin.z);
    if (prevDiff <= 0) prevDiff = 0.001;

    for (let t = step; t < maxT; t += step) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      if (y < -HEIGHT_SCALE) break;
      const diff = y - this._sampleHeight(x, z);
      if (diff <= 0) {
        // Refine the crossing between prevT and t.
        let lo = prevT;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) * 0.5;
          const mx = origin.x + dir.x * mid;
          const my = origin.y + dir.y * mid;
          const mz = origin.z + dir.z * mid;
          if (my - this._sampleHeight(mx, mz) > 0) lo = mid;
          else hi = mid;
        }
        const ft = (lo + hi) * 0.5;
        return { x: origin.x + dir.x * ft, y: origin.z + dir.z * ft };
      }
      prevT = t;
      prevDiff = diff;
    }

    // Nothing hit inside the field: fall back to the zero plane so commands
    // issued past the map edge still resolve to somewhere sensible.
    const t = -origin.y / dir.y;
    if (t > 0 && t < maxT) return { x: origin.x + dir.x * t, y: origin.z + dir.z * t };
    return null;
  }

  _sampleHeight(x, z) {
    const map = this.map;
    if (x < 0 || z < 0 || x >= map.width || z >= map.height) return 0;
    return smoothHeightAt(map, x, z);
  }

  /** Project a world position (sim x, height y, sim y) to screen pixels. */
  worldToScreen(x, height, y, out = {}) {
    this._v.set(x, height, y);
    this._v.project(this.camera);
    out.x = (this._v.x * 0.5 + 0.5) * this.viewWidth;
    out.y = (-this._v.y * 0.5 + 0.5) * this.viewHeight;
    out.behind = this._v.z > 1;
    return out;
  }

  /** World rectangle roughly covered by the view, for culling and minimap. */
  viewBounds(margin = 0) {
    const corners = [[0, 0], [this.viewWidth, 0], [0, this.viewHeight], [this.viewWidth, this.viewHeight]];
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const [sx, sy] of corners) {
      const p = this.groundPick(sx, sy);
      if (!p) continue;
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
    if (!isFinite(left)) {
      const span = this.distance;
      left = this.targetX - span;
      right = this.targetX + span;
      top = this.targetZ - span;
      bottom = this.targetZ + span;
    }
    return {
      left: left - margin, right: right + margin,
      top: top - margin, bottom: bottom + margin,
    };
  }
}
