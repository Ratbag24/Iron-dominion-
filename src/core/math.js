// Small math helpers shared by the simulation and the renderer.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** Shortest signed angular difference from `a` to `b`, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate `from` towards `to` by at most `maxStep` radians. */
export function turnTowards(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function normalizeAngle(a) {
  a %= TAU;
  if (a < 0) a += TAU;
  return a;
}

/**
 * Solve for the lead position needed to hit a unit moving at constant
 * velocity with a projectile of a fixed speed. Falls back to the target's
 * current position when no solution exists.
 */
export function interceptPoint(sx, sy, tx, ty, tvx, tvy, speed) {
  if (!(speed > 0)) return { x: tx, y: ty };
  const dx = tx - sx;
  const dy = ty - sy;
  const a = tvx * tvx + tvy * tvy - speed * speed;
  const b = 2 * (dx * tvx + dy * tvy);
  const c = dx * dx + dy * dy;
  let t;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-6) return { x: tx, y: ty };
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return { x: tx, y: ty };
    const root = Math.sqrt(disc);
    const t1 = (-b + root) / (2 * a);
    const t2 = (-b - root) / (2 * a);
    t = Math.min(t1 < 0 ? Infinity : t1, t2 < 0 ? Infinity : t2);
  }
  if (!isFinite(t) || t < 0) return { x: tx, y: ty };
  return { x: tx + tvx * t, y: ty + tvy * t };
}

/** Format a number for the resource readouts: 1234 -> "1.2k". */
export function shortNum(v) {
  const a = Math.abs(v);
  if (a >= 10000) return (v / 1000).toFixed(0) + 'k';
  if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
  return v.toFixed(0);
}
