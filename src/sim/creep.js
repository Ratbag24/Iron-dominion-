// The hive's infection of the ground.
//
// Every Blight structure, and to a lesser degree every Blight body, seeps
// corruption into the cells around it; corruption spreads to its neighbours
// and slowly dies back where nothing feeds it. The result is a living stain
// that grows out from the hive's base, follows its army across the map, and
// recedes when the source is killed - the map itself becomes the faction's
// footprint, which is the whole idea of playing something that infects.
//
// It is also a mechanic, not only a picture. The hive moves faster on its own
// ground and heals there; everyone else is slowed wading through it. That is
// what makes territory worth taking and worth burning back.

import { TERRAIN_WATER } from './map.js';

/** Simulation ticks between spread passes. Spread is slow by design. */
export const CREEP_INTERVAL = 15;
/**
 * Spread is a ceiling, not an addition: a cell can rise to STEP below its
 * strongest established neighbour, and no higher. The first version added a
 * fraction of the neighbour each pass, and a patch with no source left fed
 * itself forever - every interior cell kept every other at full strength.
 * With a ceiling the value falls off by STEP per cell from the source, and
 * when the source dies the whole patch decays together, which is what
 * "recedes" has to mean.
 */
const STEP = 0.06;
const STEP_DIAG = STEP * 1.414;
/** How fast a cell rises towards its ceiling per pass. This is what makes
 * the front visibly creep rather than snap out to its full extent. */
const GROW = 0.08;
const SPREAD_FROM = 0.55;
/** Loss per pass everywhere. Sources out-feed it; nothing else does. */
const DECAY = 0.035;
/** The value a source drives its cells towards, per pass. */
const SOURCE_RATE = 0.22;

/** Corruption at which a cell counts as the hive's ground. */
export const CREEP_HELD = 0.4;
/** Corruption a hive structure needs under it to be grown. A little below
 * HELD, so the frontier just past the last building is buildable. */
export const CREEP_BUILD = 0.3;
/** Speed multipliers on held ground, for its own and for everyone else. */
export const CREEP_SPEED_OWN = 1.18;
export const CREEP_SPEED_OTHER = 0.8;
/** Fraction of max hp regained per second on held ground, own units only. */
export const CREEP_REGEN = 0.008;

/** Does this player's faction spread corruption? */
export function spreadsCreep(world, playerIndex) {
  const p = world.players[playerIndex];
  return !!(p && p.factionDef && p.factionDef.spreadsCreep);
}

/** Corruption in [0, 1] under a world position. */
export function creepAt(map, x, y) {
  const cx = (x / map.cell) | 0;
  const cy = (y / map.cell) | 0;
  if (!map.inBounds(cx, cy)) return 0;
  return map.corruption[map.idx(cx, cy)];
}

/**
 * One spread pass. Runs every CREEP_INTERVAL ticks; per-tick effects on units
 * (speed, regen) are applied in applyCreepEffects below, every tick.
 */
export function updateCreep(world, dt) {
  const map = world.map;
  const corr = map.corruption;
  if (world.tickCount % CREEP_INTERVAL !== 0) return;

  // Sources first: the hive's own things push the ground under them up.
  for (const e of world.entities) {
    if (!e.alive || !e.def.creep) continue;
    if (!spreadsCreep(world, e.player)) continue;
    // Under construction a structure has only begun to take: half strength.
    const strength = e.underConstruction ? 0.5 : 1;
    seed(map, e.x, e.y, e.def.creep, SOURCE_RATE * strength);
  }

  // Then spread from established cells and decay everywhere. Reads from a
  // snapshot so a pass cannot chase itself across a row.
  const { cols, rows } = map;
  const snap = world._creepSnap || (world._creepSnap = new Float32Array(corr.length));
  snap.set(corr);
  for (let cy = 0; cy < rows; cy++) {
    const row = cy * cols;
    for (let cx = 0; cx < cols; cx++) {
      const i = row + cx;
      let v = snap[i] - DECAY;
      if (map.terrain[i] === TERRAIN_WATER) { corr[i] = 0; continue; }
      // The strongest established neighbour sets this cell's ceiling. All
      // eight neighbours, with the diagonals a longer step: with only the
      // four the front grew as a diamond, which on the map read as a square
      // stain with corners.
      let ceiling = 0;
      const left = cx > 0;
      const right = cx < cols - 1;
      const up = cy > 0;
      const down = cy < rows - 1;
      if (left && snap[i - 1] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i - 1] - STEP);
      if (right && snap[i + 1] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i + 1] - STEP);
      if (up && snap[i - cols] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i - cols] - STEP);
      if (down && snap[i + cols] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i + cols] - STEP);
      if (up && left && snap[i - cols - 1] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i - cols - 1] - STEP_DIAG);
      if (up && right && snap[i - cols + 1] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i - cols + 1] - STEP_DIAG);
      if (down && left && snap[i + cols - 1] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i + cols - 1] - STEP_DIAG);
      if (down && right && snap[i + cols + 1] >= SPREAD_FROM) ceiling = Math.max(ceiling, snap[i + cols + 1] - STEP_DIAG);
      if (ceiling > v) v = Math.min(ceiling, snap[i] + GROW);
      corr[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
}

/** Push the corruption within `radius` cells of (x, y) towards 1. */
function seed(map, x, y, radius, rate) {
  const corr = map.corruption;
  const cx0 = (x / map.cell) | 0;
  const cy0 = (y / map.cell) | 0;
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const cx = cx0 + dx;
      const cy = cy0 + dy;
      if (!map.inBounds(cx, cy)) continue;
      const d = Math.hypot(dx, dy) / radius;
      if (d > 1) continue;
      const i = map.idx(cx, cy);
      if (map.terrain[i] === TERRAIN_WATER) continue;
      // Full strength at the centre, fading to nothing at the rim, so a
      // source makes a mound of corruption rather than a plateau.
      const w = 1 - d * d;
      corr[i] = Math.min(1, corr[i] + rate * w * (1.2 - corr[i]));
    }
  }
}

/**
 * Per-tick effects of standing on corrupted ground. Sets `speedScale` on every
 * mobile ground unit (movement reads it) and heals the hive's own.
 */
export function applyCreepEffects(world, dt) {
  const map = world.map;
  for (const e of world.entities) {
    if (!e.alive || e.isBuilding || !e.def.speed) { continue; }
    if (e.def.layer === 'air') { e.speedScale = 1; continue; }
    const c = creepAt(map, e.x, e.y);
    if (c < CREEP_HELD) { e.speedScale = 1; continue; }
    if (spreadsCreep(world, e.player)) {
      e.speedScale = CREEP_SPEED_OWN;
      if (e.hp < e.maxHp && !e.underConstruction) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * CREEP_REGEN * dt);
      }
    } else {
      e.speedScale = CREEP_SPEED_OTHER;
    }
  }
}
