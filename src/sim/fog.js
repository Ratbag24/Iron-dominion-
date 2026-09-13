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
