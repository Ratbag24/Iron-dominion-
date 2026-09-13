// Procedural map generation.
//
// Maps are 180-degree rotationally symmetric so neither start position gets a
// better share of the metal spots. Terrain is classified per navigation cell:
// land is passable, water and rock are not.

import { makeRng, makeNoise2D, fbm } from '../core/rng.js';
import { BUILD_CELL } from './defs.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const TERRAIN_LAND = 0;
export const TERRAIN_WATER = 1;
export const TERRAIN_ROCK = 2;

export class GameMap {
  constructor(opts = {}) {
    this.width = opts.width || 3072;
    this.height = opts.height || 3072;
    this.cell = BUILD_CELL;
    this.cols = Math.floor(this.width / this.cell);
    this.rows = Math.floor(this.height / this.cell);
    this.seed = opts.seed >>> 0 || 1;

    this.terrain = new Uint8Array(this.cols * this.rows);
    this.heights = new Float32Array(this.cols * this.rows);
    /** Cells occupied by finished or in-progress buildings. */
    this.blocked = new Uint8Array(this.cols * this.rows);

    this.metalSpots = [];
    this.startPositions = [];

    this._generate();
  }

  idx(cx, cy) {
    return cy * this.cols + cx;
  }

  inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }

  terrainAt(x, y) {
    const cx = (x / this.cell) | 0;
    const cy = (y / this.cell) | 0;
    if (!this.inBounds(cx, cy)) return TERRAIN_ROCK;
    return this.terrain[this.idx(cx, cy)];
  }

  heightAt(x, y) {
    const cx = (x / this.cell) | 0;
    const cy = (y / this.cell) | 0;
    if (!this.inBounds(cx, cy)) return 0;
    return this.heights[this.idx(cx, cy)];
  }

  /** Can a ground unit stand on this cell? */
  isPassableCell(cx, cy) {
    if (!this.inBounds(cx, cy)) return false;
    const i = this.idx(cx, cy);
    return this.terrain[i] === TERRAIN_LAND && this.blocked[i] === 0;
  }

  isPassable(x, y) {
    return this.isPassableCell((x / this.cell) | 0, (y / this.cell) | 0);
  }

  /** Terrain-only test, ignoring buildings: used when placing structures. */
  isBuildableCell(cx, cy) {
    if (!this.inBounds(cx, cy)) return false;
    const i = this.idx(cx, cy);
    return this.terrain[i] === TERRAIN_LAND && this.blocked[i] === 0;
  }

  setBlocked(cx0, cy0, size, value) {
    for (let cy = cy0; cy < cy0 + size; cy++) {
      for (let cx = cx0; cx < cx0 + size; cx++) {
        if (this.inBounds(cx, cy)) this.blocked[this.idx(cx, cy)] = value;
      }
    }
  }

  /** Snap a world position to the build grid for a footprint of `size` cells. */
  snapFootprint(x, y, size) {
    const half = size * this.cell * 0.5;
    let cx = Math.round((x - half) / this.cell);
    let cy = Math.round((y - half) / this.cell);
    cx = Math.max(0, Math.min(this.cols - size, cx));
    cy = Math.max(0, Math.min(this.rows - size, cy));
    return {
      cx, cy,
      x: cx * this.cell + half,
      y: cy * this.cell + half,
    };
  }

  canPlace(cx, cy, size) {
    for (let y = cy; y < cy + size; y++) {
      for (let x = cx; x < cx + size; x++) {
        if (!this.isBuildableCell(x, y)) return false;
      }
    }
    return true;
  }

  /** Nearest unclaimed metal spot to a point, or null. */
  nearestFreeMetalSpot(x, y, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const s of this.metalSpots) {
      if (s.taken) continue;
      const dx = s.x - x;
      const dy = s.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  metalSpotNear(x, y, radius = 40) {
    for (const s of this.metalSpots) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy <= radius * radius) return s;
    }
    return null;
  }

  // ------------------------------------------------------------- generation

  _generate() {
    const rng = makeRng(this.seed);
    const noise = makeNoise2D(this.seed);
    const detail = makeNoise2D(this.seed ^ 0x9e3779b9);
    const { cols, rows } = this;

    // Rotationally symmetric height field: averaging a sample with its
    // 180-degree counterpart makes h(x, y) === h(cols-1-x, rows-1-y).
    const scale = 3.4 / cols;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const ox = cols - 1 - cx;
        const oy = rows - 1 - cy;
        const a = fbm(noise, cx * scale, cy * scale, 5);
        const b = fbm(noise, ox * scale, oy * scale, 5);
        let h = (a + b) * 0.5;
        // A touch of fine detail, kept symmetric the same way.
        const da = fbm(detail, cx * scale * 4, cy * scale * 4, 3);
        const db = fbm(detail, ox * scale * 4, oy * scale * 4, 3);
        h += ((da + db) * 0.5 - 0.5) * 0.09;
        this.heights[this.idx(cx, cy)] = h;
      }
    }

    // Classify by percentile rather than fixed cut-offs. Averaging a sample
    // with its mirror narrows the height distribution, and the narrowing
    // varies by seed, so absolute thresholds would give wildly different maps.
    const sorted = Float32Array.from(this.heights).sort();
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const waterLine = pct(0.16);
    const rockLine = pct(0.88);
    this.waterLine = waterLine;
    this.rockLine = rockLine;
    // Stretch the heights back out so the renderer has contrast to shade with.
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    const span = Math.max(1e-6, hi - lo);
    for (let i = 0; i < this.terrain.length; i++) {
      const h = this.heights[i];
      this.terrain[i] = h < waterLine ? TERRAIN_WATER : h > rockLine ? TERRAIN_ROCK : TERRAIN_LAND;
      this.heights[i] = (h - lo) / span;
    }
    this.waterLine = (waterLine - lo) / span;
    this.rockLine = (rockLine - lo) / span;

    this._pickStartPositions();
    this._placeMetalSpots(rng);
    this._ensureConnectivity();
  }

  /** Start positions sit on opposite sides, mirrored through the centre. */
  _pickStartPositions() {
    const margin = Math.floor(this.cols * 0.16);
    let best = null;
    let bestScore = -Infinity;
    // Search the top-left region for the flattest open ground.
    for (let cy = margin; cy < this.rows * 0.42; cy += 2) {
      for (let cx = margin; cx < this.cols * 0.42; cx += 2) {
        const score = this._opennessScore(cx, cy, 7);
        if (score > bestScore) {
          bestScore = score;
          best = { cx, cy };
        }
      }
    }
    if (!best) best = { cx: margin, cy: margin };

    this._carveClearing(best.cx, best.cy, 9);
    const mirror = { cx: this.cols - 1 - best.cx, cy: this.rows - 1 - best.cy };
    this._carveClearing(mirror.cx, mirror.cy, 9);

    this.startPositions = [best, mirror].map((p) => ({
      cx: p.cx, cy: p.cy,
      x: (p.cx + 0.5) * this.cell,
      y: (p.cy + 0.5) * this.cell,
    }));
  }

  _opennessScore(cx, cy, r) {
    let land = 0;
    let total = 0;
    let minH = Infinity;
    let maxH = -Infinity;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) return -Infinity;
        total++;
        const i = this.idx(x, y);
        if (this.terrain[i] === TERRAIN_LAND) land++;
        const h = this.heights[i];
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
    // Prefer flat, open ground, and push start positions away from the centre
    // so the two players are not crowded together on lopsided terrain.
    const cxMid = (this.cols - 1) / 2;
    const cyMid = (this.rows - 1) / 2;
    const fromCentre = Math.hypot(cx - cxMid, cy - cyMid) / Math.hypot(cxMid, cyMid);
    return (land / total) * 100 - (maxH - minH) * 60 + fromCentre * 45;
  }

  /**
   * Flatten a disc of ground into a buildable clearing. The flat height is the
   * local average and the edges are feathered, so a base sits naturally in the
   * landscape instead of on top of a sheer-sided mesa.
   */
  _carveClearing(cx, cy, r) {
    const mid = (this.waterLine + this.rockLine) * 0.5;

    // Local mean height, so the clearing follows the surrounding ground.
    let sum = 0;
    let n = 0;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        sum += this.heights[this.idx(x, y)];
        n++;
      }
    }
    let flat = n > 0 ? sum / n : mid;
    // Keep the clearing on dry, buildable ground whatever the surroundings.
    flat = Math.min(Math.max(flat, this.waterLine + 0.06), this.rockLine - 0.06);

    const outer = r * 1.9; // feathered skirt reaching beyond the flat core
    for (let y = cy - outer; y <= cy + outer; y++) {
      for (let x = cx - outer; x <= cx + outer; x++) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (!this.inBounds(ix, iy)) continue;
        const d = Math.hypot(ix - cx, iy - cy);
        if (d > outer) continue;

        // 1 inside the core, easing to 0 at the edge of the skirt.
        const t = clamp01((d - r * 0.65) / (outer - r * 0.65));
        const w = 1 - t * t * (3 - 2 * t);

        const i = this.idx(ix, iy);
        this.heights[i] = this.heights[i] + (flat - this.heights[i]) * w;

        if (d <= r) {
          this.terrain[i] = TERRAIN_LAND;
        } else {
          const h = this.heights[i];
          this.terrain[i] = h < this.waterLine ? TERRAIN_WATER
            : h > this.rockLine ? TERRAIN_ROCK : TERRAIN_LAND;
        }
      }
    }
  }

  _placeMetalSpots(rng) {
    const spots = [];
    const minGap = this.cell * 7;
    const centre = { cx: (this.cols - 1) / 2, cy: (this.rows - 1) / 2 };

    const tryAdd = (cx, cy, yield_) => {
      if (!this.inBounds(cx, cy)) return false;
      if (this.terrain[this.idx(cx, cy)] !== TERRAIN_LAND) return false;
      if (!this.canPlace(cx - 1, cy - 1, 3)) return false;
      const x = (cx + 0.5) * this.cell;
      const y = (cy + 0.5) * this.cell;
      for (const s of spots) {
        const dx = s.x - x;
        const dy = s.y - y;
        if (dx * dx + dy * dy < minGap * minGap) return false;
      }
      spots.push({ cx, cy, x, y, yield: yield_, taken: false, ownerId: -1 });
      return true;
    };

    // Guaranteed spots around each start position, mirrored automatically.
    const start = this.startPositions[0];
    const ring = [
      [-4, -4], [4, -4], [-4, 4], [4, 4], [0, -7], [7, 0], [-7, 0], [0, 7],
    ];
    for (const [dx, dy] of ring) {
      const cx = start.cx + dx;
      const cy = start.cy + dy;
      if (tryAdd(cx, cy, 1.0)) {
        tryAdd(this.cols - 1 - cx, this.rows - 1 - cy, 1.0);
      }
    }

    // Contested spots scattered over the rest of the map, always in pairs.
    let attempts = 0;
    while (spots.length < 40 && attempts < 4000) {
      attempts++;
      const cx = rng.int(3, this.cols - 4);
      const cy = rng.int(3, this.rows - 4);
      const mx = this.cols - 1 - cx;
      const my = this.rows - 1 - cy;
      // Skip the exact centre cell, which maps onto itself.
      if (Math.abs(cx - centre.cx) < 1 && Math.abs(cy - centre.cy) < 1) continue;
      const yieldValue = rng.chance(0.22) ? 1.6 : 1.0;
      const before = spots.length;
      if (tryAdd(cx, cy, yieldValue)) {
        if (!tryAdd(mx, my, yieldValue)) spots.length = before; // keep pairs honest
      }
    }

    this.metalSpots = spots;
  }

  /**
   * Guarantee the two start positions are connected by land. If the terrain
   * generator walled them off, carve a corridor rather than reroll the map.
   */
  _ensureConnectivity() {
    const a = this.startPositions[0];
    const b = this.startPositions[1];
    const reach = this._floodFill(a.cx, a.cy);
    if (reach[this.idx(b.cx, b.cy)]) {
      this._reachable = reach;
      this._pruneUnreachableSpots(reach);
      return;
    }
    this._carveCorridor(a, b);
    const reach2 = this._floodFill(a.cx, a.cy);
    this._reachable = reach2;
    this._pruneUnreachableSpots(reach2);
  }

  _floodFill(sx, sy) {
    const seen = new Uint8Array(this.cols * this.rows);
    const queue = new Int32Array(this.cols * this.rows);
    let head = 0;
    let tail = 0;
    const start = this.idx(sx, sy);
    seen[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const cx = i % this.cols;
      const cy = (i / this.cols) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (seen[ni] || this.terrain[ni] !== TERRAIN_LAND) continue;
        seen[ni] = 1;
        queue[tail++] = ni;
      }
    }
    return seen;
  }

  _carveCorridor(a, b) {
    let x = a.cx;
    let y = a.cy;
    let guard = 0;
    while ((x !== b.cx || y !== b.cy) && guard++ < 20000) {
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          if (!this.inBounds(x + ox, y + oy)) continue;
          const i = this.idx(x + ox, y + oy);
          this.terrain[i] = TERRAIN_LAND;
          const mid = (this.waterLine + this.rockLine) * 0.5;
          if (this.heights[i] < this.waterLine) this.heights[i] = mid;
          if (this.heights[i] > this.rockLine) this.heights[i] = mid;
        }
      }
      if (x !== b.cx) x += Math.sign(b.cx - x);
      if (y !== b.cy) y += Math.sign(b.cy - y);
    }
  }

  _pruneUnreachableSpots(reach) {
    this.metalSpots = this.metalSpots.filter((s) => reach[this.idx(s.cx, s.cy)]);
  }
}
