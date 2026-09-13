// Uniform spatial hash used for neighbour queries (target acquisition,
// unit separation, splash damage, selection). Rebuilt every simulation tick.

export class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].length) this.cells[i].length = 0;
    }
  }

  _index(x, y) {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  insert(ent) {
    this.cells[this._index(ent.x, ent.y)].push(ent);
  }

  /** Collect every entity whose cell overlaps the radius around (x, y). */
  query(x, y, radius, out = []) {
    out.length = 0;
    const cs = this.cellSize;
    let minX = ((x - radius) / cs) | 0;
    let maxX = ((x + radius) / cs) | 0;
    let minY = ((y - radius) / cs) | 0;
    let maxY = ((y + radius) / cs) | 0;
    if (minX < 0) minX = 0;
    if (minY < 0) minY = 0;
    if (maxX >= this.cols) maxX = this.cols - 1;
    if (maxY >= this.rows) maxY = this.rows - 1;
    for (let cy = minY; cy <= maxY; cy++) {
      const row = cy * this.cols;
      for (let cx = minX; cx <= maxX; cx++) {
        const cell = this.cells[row + cx];
        for (let i = 0; i < cell.length; i++) out.push(cell[i]);
      }
    }
    return out;
  }
}
