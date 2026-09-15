// Fog of war and radar.
//
// Three states per cell: unexplored, explored (terrain remembered, units not
// shown), and currently visible. Radar coverage reveals moving contacts as
// blips without identifying them, which is how BAR handles radar.

export class FogMap {
  constructor(map, cellSize = 32) {
    this.map = map;
    this.cell = cellSize;
    this.cols = Math.ceil(map.width / cellSize);
    this.rows = Math.ceil(map.height / cellSize);
    this.explored = new Uint8Array(this.cols * this.rows);
    this.visible = new Uint8Array(this.cols * this.rows);
    this.radar = new Uint8Array(this.cols * this.rows);
    /** Last known enemy structures, keyed by entity id. */
    this.memory = new Map();
    this.version = 0;
    /**
     * Row spans queued by addCircle, each packed as row << 24 | x0 << 12 | x1,
     * so one numeric sort groups them by row and a single pass can merge them.
     */
    this._spans = [];
  }

  beginFrame() {
    this.visible.fill(0);
    this.radar.fill(0);
    this.version++;
  }

  _clampCol(c) { return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c; }
  _clampRow(r) { return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r; }

  revealCircle(x, y, radius) {
    const cs = this.cell;
    const r = radius / cs;
    const cx = x / cs;
    const cy = y / cs;
    const minX = this._clampCol(Math.floor(cx - r));
    const maxX = this._clampCol(Math.ceil(cx + r));
    const minY = this._clampRow(Math.floor(cy - r));
    const maxY = this._clampRow(Math.ceil(cy + r));
    const r2 = r * r;
    for (let gy = minY; gy <= maxY; gy++) {
      const dy = gy + 0.5 - cy;
      const row = gy * this.cols;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx + 0.5 - cx;
        if (dx * dx + dy * dy > r2) continue;
        const i = row + gx;
        this.visible[i] = 1;
        this.explored[i] = 1;
      }
    }
  }

  /**
   * Batched reveals: queue discs with addCircle, then write them once with
   * endBatch. An army is a clump, and forty units on the same few cells
   * stamping the same disc forty times was the largest cost in the tick at
   * scale. Merging the discs into row spans first means each revealed cell is
   * written once however many units can see it. The cells revealed are
   * exactly those revealCircle would reveal for the same discs.
   */
  beginBatch() {
    this._spans.length = 0;
  }

  addCircle(x, y, radius) {
    const cs = this.cell;
    const r = radius / cs;
    const cx = x / cs;
    const cy = y / cs;
    const minY = this._clampRow(Math.floor(cy - r));
    const maxY = this._clampRow(Math.ceil(cy + r));
    const r2 = r * r;
    const last = this.cols - 1;
    for (let gy = minY; gy <= maxY; gy++) {
      const dy = gy + 0.5 - cy;
      const rem = r2 - dy * dy;
      if (rem < 0) continue;
      // A cell is in the disc when (gx + 0.5 - cx)^2 <= rem, so the row's
      // run is the integers within half of cx - 0.5.
      const half = Math.sqrt(rem);
      let x0 = Math.ceil(cx - 0.5 - half);
      let x1 = Math.floor(cx - 0.5 + half);
      if (x1 < 0 || x0 > last || x1 < x0) continue;
      if (x0 < 0) x0 = 0;
      if (x1 > last) x1 = last;
      this._spans.push((gy << 24) | (x0 << 12) | x1);
    }
  }

  endBatch() {
    const spans = this._spans;
    spans.sort((a, b) => a - b);
    const n = spans.length;
    let i = 0;
    while (i < n) {
      const s = spans[i];
      const row = s >> 24;
      const x0 = (s >> 12) & 0xfff;
      let x1 = s & 0xfff;
      i++;
      // Swallow every later span on this row that touches or overlaps.
      while (i < n) {
        const t = spans[i];
        if ((t >> 24) !== row || ((t >> 12) & 0xfff) > x1 + 1) break;
        const e = t & 0xfff;
        if (e > x1) x1 = e;
        i++;
      }
      const base = row * this.cols;
      for (let gx = x0; gx <= x1; gx++) {
        this.visible[base + gx] = 1;
        this.explored[base + gx] = 1;
      }
    }
  }

  revealRadar(x, y, radius) {
    const cs = this.cell;
    const r = radius / cs;
    const cx = x / cs;
    const cy = y / cs;
    const minX = this._clampCol(Math.floor(cx - r));
    const maxX = this._clampCol(Math.ceil(cx + r));
    const minY = this._clampRow(Math.floor(cy - r));
    const maxY = this._clampRow(Math.ceil(cy + r));
    const r2 = r * r;
    for (let gy = minY; gy <= maxY; gy++) {
      const dy = gy + 0.5 - cy;
      const row = gy * this.cols;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx + 0.5 - cx;
        if (dx * dx + dy * dy > r2) continue;
        this.radar[row + gx] = 1;
      }
    }
  }

  _index(x, y) {
    const gx = this._clampCol((x / this.cell) | 0);
    const gy = this._clampRow((y / this.cell) | 0);
    return gy * this.cols + gx;
  }

  isVisible(x, y) { return this.visible[this._index(x, y)] === 1; }
  isExplored(x, y) { return this.explored[this._index(x, y)] === 1; }
  hasRadar(x, y) { return this.radar[this._index(x, y)] === 1; }

  /** Remember an enemy structure so it stays drawn as a ghost under fog. */
  remember(e) {
    this.memory.set(e.id, {
      id: e.id, defId: e.defId, x: e.x, y: e.y, player: e.player,
      faction: e.def.faction, footprint: e.def.footprint || 0,
      radius: e.radius, heading: e.heading,
    });
  }

  /** Drop remembered structures we can now see are gone. */
  forgetGone(liveIds) {
    for (const [id, mem] of this.memory) {
      if (liveIds.has(id)) continue;
      if (this.isVisible(mem.x, mem.y)) this.memory.delete(id);
    }
  }

  revealAll() {
    this.explored.fill(1);
    this.visible.fill(1);
  }
}
