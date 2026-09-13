// Grid A* with string-pulled smoothing.
//
// Searches are budgeted per tick: units queue a request and pick the result up
// a tick or two later, which keeps a 200-unit move order from stalling the
// simulation. Scratch arrays are preallocated and stamped with a generation
// counter so no per-search clearing is needed.

const SQRT2 = Math.SQRT2;

class BinaryHeap {
  constructor(capacity) {
    this.items = new Int32Array(capacity);
    this.scores = new Float32Array(capacity);
    this.size = 0;
  }
  clear() { this.size = 0; }
  push(item, score) {
    if (this.size >= this.items.length) return; // budget exhausted; drop
    let i = this.size++;
    this.items[i] = item;
    this.scores[i] = score;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.scores[parent] <= this.scores[i]) break;
      this._swap(i, parent);
      i = parent;
    }
  }
  pop() {
    const top = this.items[0];
    this.size--;
    if (this.size > 0) {
      this.items[0] = this.items[this.size];
      this.scores[0] = this.scores[this.size];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.size && this.scores[l] < this.scores[smallest]) smallest = l;
        if (r < this.size && this.scores[r] < this.scores[smallest]) smallest = r;
        if (smallest === i) break;
        this._swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }
  _swap(a, b) {
    const ti = this.items[a]; this.items[a] = this.items[b]; this.items[b] = ti;
    const ts = this.scores[a]; this.scores[a] = this.scores[b]; this.scores[b] = ts;
  }
}

export class Pathfinder {
  constructor(map, opts = {}) {
    this.map = map;
    const n = map.cols * map.rows;
    this.g = new Float32Array(n);
    this.cameFrom = new Int32Array(n);
    this.stamp = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.generation = 0;
    this.heap = new BinaryHeap(Math.min(n, 65536));
    this.maxNodes = opts.maxNodes || 12000;
    /** Searches allowed per simulation tick. */
    this.budgetPerTick = opts.budgetPerTick || 12;
    this.budget = this.budgetPerTick;
    this.requests = [];
    this.stats = { searches: 0, failures: 0, nodes: 0 };
  }

  beginTick() {
    this.budget = this.budgetPerTick;
  }

  /**
   * Queue a path request. `onPath(waypoints|null)` is invoked when the search
   * runs, which may be this tick or a later one.
   */
  request(sx, sy, tx, ty, onPath, priority = 0) {
    this.requests.push({ sx, sy, tx, ty, onPath, priority });
  }

  /** Run as many queued searches as the tick budget allows. */
  processRequests() {
    if (this.requests.length === 0) return;
    if (this.requests.length > 1) {
      this.requests.sort((a, b) => b.priority - a.priority);
    }
    let ran = 0;
    while (this.requests.length && ran < this.budget) {
      const req = this.requests.shift();
      ran++;
      const path = this.findPath(req.sx, req.sy, req.tx, req.ty);
      req.onPath(path);
    }
    // Anything left waits for the next tick; drop the tail if it grows absurd.
    if (this.requests.length > 600) this.requests.length = 600;
  }

  /**
   * Returns an array of {x, y} waypoints from start to goal, or null when no
   * route exists. The start position itself is not included.
   */
  findPath(sx, sy, tx, ty) {
    const map = this.map;
    const cols = map.cols;
    const cell = map.cell;

    let scx = Math.floor(sx / cell);
    let scy = Math.floor(sy / cell);
    let tcx = Math.floor(tx / cell);
    let tcy = Math.floor(ty / cell);

    if (!map.inBounds(scx, scy)) return null;
    if (!map.inBounds(tcx, tcy)) return null;

    // If the unit is standing inside a blocked cell (pushed into a building,
    // say) start the search from the closest open cell instead of failing.
    if (!map.isPassableCell(scx, scy)) {
      const near = this._nearestOpen(scx, scy, 6);
      if (!near) return null;
      scx = near.cx; scy = near.cy;
    }

    // A goal inside a building or on water resolves to the closest open cell,
    // which is what "move next to that thing" should mean.
    if (!map.isPassableCell(tcx, tcy)) {
      const near = this._nearestOpen(tcx, tcy, 10);
      if (!near) return null;
      tcx = near.cx; tcy = near.cy;
    }

    const startIdx = scy * cols + scx;
    const goalIdx = tcy * cols + tcx;
    if (startIdx === goalIdx) return [{ x: tx, y: ty }];

    const gen = ++this.generation;
    const heap = this.heap;
    heap.clear();
    this.g[startIdx] = 0;
    this.stamp[startIdx] = gen;
    this.cameFrom[startIdx] = -1;
    this.closed[startIdx] = 0;
    heap.push(startIdx, this._heuristic(scx, scy, tcx, tcy));

    let expanded = 0;
    let found = false;
    // Track the closest node reached, so a blocked goal still yields progress.
    let bestIdx = startIdx;
    let bestH = this._heuristic(scx, scy, tcx, tcy);

    this.stats.searches++;

    while (heap.size > 0 && expanded < this.maxNodes) {
      const current = heap.pop();
      if (this.stamp[current] === gen && this.closed[current] === 1) continue;
      this.closed[current] = 1;
      this.stamp[current] = gen;
      expanded++;

      if (current === goalIdx) { found = true; break; }

      const cx = current % cols;
      const cy = (current / cols) | 0;
      const h = this._heuristic(cx, cy, tcx, tcy);
      if (h < bestH) { bestH = h; bestIdx = current; }

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!map.isPassableCell(nx, ny)) continue;
          if (dx !== 0 && dy !== 0) {
            // No cutting corners through the diagonal gap between two blockers.
            if (!map.isPassableCell(cx + dx, cy) || !map.isPassableCell(cx, cy + dy)) continue;
          }
          const ni = ny * cols + nx;
          if (this.stamp[ni] === gen && this.closed[ni] === 1) continue;
          const step = dx !== 0 && dy !== 0 ? SQRT2 : 1;
          const tentative = this.g[current] + step;
          if (this.stamp[ni] === gen && tentative >= this.g[ni]) continue;
          this.stamp[ni] = gen;
          this.closed[ni] = 0;
          this.g[ni] = tentative;
          this.cameFrom[ni] = current;
          heap.push(ni, tentative + this._heuristic(nx, ny, tcx, tcy));
        }
      }
    }

    this.stats.nodes += expanded;

    const endIdx = found ? goalIdx : bestIdx;
    if (endIdx === startIdx) {
      this.stats.failures++;
      return null;
    }

    // Walk the parent chain back to the start.
    const cells = [];
    let node = endIdx;
    let guard = 0;
    while (node !== -1 && node !== startIdx && guard++ < 100000) {
      cells.push(node);
      node = this.cameFrom[node];
    }
    cells.reverse();
    if (cells.length === 0) {
      this.stats.failures++;
      return null;
    }

    const points = cells.map((i) => ({
      x: ((i % cols) + 0.5) * cell,
      y: (((i / cols) | 0) + 0.5) * cell,
    }));
    if (found) {
      points[points.length - 1] = { x: tx, y: ty };
    }
    return this._smooth(sx, sy, points);
  }

  _heuristic(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    // Octile distance, mildly weighted to break ties toward straighter paths.
    return (dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx) * 1.001;
  }

  _nearestOpen(cx, cy, maxRadius) {
    const map = this.map;
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (map.isPassableCell(nx, ny)) return { cx: nx, cy: ny };
        }
      }
    }
    return null;
  }

  /** Drop waypoints that a straight line can already reach (string pulling). */
  _smooth(sx, sy, points) {
    if (points.length <= 2) return points;
    const out = [];
    let anchorX = sx;
    let anchorY = sy;
    let i = 0;
    while (i < points.length) {
      let furthest = i;
      for (let j = points.length - 1; j > i; j--) {
        if (this.hasLineOfWalk(anchorX, anchorY, points[j].x, points[j].y)) {
          furthest = j;
          break;
        }
      }
      out.push(points[furthest]);
      anchorX = points[furthest].x;
      anchorY = points[furthest].y;
      if (furthest === points.length - 1) break;
      i = furthest + 1;
    }
    return out;
  }

  /** Sample the straight segment for blocked cells. */
  hasLineOfWalk(x0, y0, x1, y1) {
    const map = this.map;
    const cell = map.cell;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.ceil(Math.hypot(dx, dy) / (cell * 0.5));
    if (steps === 0) return true;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      if (!map.isPassableCell(Math.floor(x / cell), Math.floor(y / cell))) return false;
    }
    return true;
  }
}
