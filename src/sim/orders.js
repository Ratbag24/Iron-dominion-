// Order execution. Each entity runs its current order every tick, which either
// sets a movement goal, registers a build job, or picks an attack target.
//
// Build jobs are collected here and resolved later in construction.js, after
// the economy has worked out how much of the demand it can actually pay for.

import { dist, dist2 } from '../core/math.js';
import { getDef, BUILD_CELL } from './defs.js';

export const ORDER = {
  MOVE: 'move',
  ATTACK_MOVE: 'attackMove',
  ATTACK: 'attack',
  BUILD: 'build',
  REPAIR: 'repair',
  RECLAIM: 'reclaim',
  GUARD: 'guard',
  PATROL: 'patrol',
};

const ARRIVE_SLACK = 26;

export function updateOrders(world, e, dt) {
  if (e.underConstruction) {
    // A nanoframe does nothing until it is finished.
    e.moveGoal = null;
    return;
  }

  // Factories keep producing regardless of any other order they hold.
  if (e.def.factory && e.factoryQueue.length > 0) {
    world.buildJobs.push({ builder: e, kind: 'produce', target: e, power: e.def.buildPower });
  }

  // Idle construction turrets look for something nearby to help with.
  if (e.def.assistOnly) {
    autoAssist(world, e);
    return;
  }

  const order = e.orders[0];
  if (!order) {
    e.moveGoal = null;
    e.activeJob = null;
    // Idle builders range further afield looking for work - usually a factory
    // to assist, which is where spare metal is best spent.
    if (e.def.buildPower && !e.def.factory) autoAssist(world, e, true, 900);
    return;
  }

  switch (order.type) {
    case ORDER.MOVE: return doMove(world, e, order);
    case ORDER.ATTACK_MOVE: return doAttackMove(world, e, order);
    case ORDER.ATTACK: return doAttack(world, e, order);
    case ORDER.BUILD: return doBuild(world, e, order);
    case ORDER.REPAIR: return doRepair(world, e, order);
    case ORDER.RECLAIM: return doReclaim(world, e, order);
    case ORDER.GUARD: return doGuard(world, e, order);
    case ORDER.PATROL: return doPatrol(world, e, order);
    default: e.orders.shift();
  }
}

function finish(e) {
  e.orders.shift();
  e.moveGoal = null;
  e.path = null;
  e.activeJob = null;
}

function arriveRadius(e) {
  return Math.max(ARRIVE_SLACK, e.radius * 1.6);
}

// ------------------------------------------------------------------- moving

function doMove(world, e, order) {
  if (!e.def.speed) return finish(e);
  const d = dist(e.x, e.y, order.x, order.y);
  const slack = order.slack || arriveRadius(e);
  if (d <= slack) return finish(e);
  // A crowded destination is still a destination: if we have been jammed for
  // a while and we are nearly there, call it arrived rather than shoving
  // forever. Without this, rally points deadlock as the group grows.
  if (e.stuckTimer > 1.0 && d < slack * 5) return finish(e);
  e.moveGoal = order;
  e.targetId = 0;
}

function doAttackMove(world, e, order) {
  // Stop and engage anything in weapons range, otherwise keep walking.
  const foe = findNearbyEnemy(world, e, e.def.maxWeaponRange * 1.15 + 60);
  if (foe) {
    e.targetId = foe.id;
    const range = e.def.maxWeaponRange;
    if (dist(e.x, e.y, foe.x, foe.y) > range * 0.85) {
      e.moveGoal = { x: foe.x, y: foe.y };
    } else {
      e.moveGoal = null;
    }
    return;
  }
  e.targetId = 0;
  const d = dist(e.x, e.y, order.x, order.y);
  const slack = arriveRadius(e);
  if (d <= slack) return finish(e);
  if (e.stuckTimer > 1.0 && d < slack * 5) return finish(e);
  e.moveGoal = order;
}

function doAttack(world, e, order) {
  const target = world.get(order.targetId);
  if (!target) return finish(e);
  e.targetId = target.id;
  const range = e.def.maxWeaponRange;
  if (!range) {
    // Unarmed units told to attack simply move to the target.
    e.moveGoal = { x: target.x, y: target.y };
    if (dist(e.x, e.y, target.x, target.y) < 60) finish(e);
    return;
  }
  const d = dist(e.x, e.y, target.x, target.y) - target.radius;
  if (d > range * 0.9) {
    e.moveGoal = { x: target.x, y: target.y };
  } else {
    e.moveGoal = null;
  }
}

// ---------------------------------------------------------------- building

function doBuild(world, e, order) {
  const range = e.def.buildRange || 100;

  // Phase 1: no nanoframe yet. Walk into range, then place it.
  if (!order.targetId) {
    const d = dist(e.x, e.y, order.x, order.y);
    if (d > range * 0.85) {
      e.moveGoal = { x: order.x, y: order.y, slack: range * 0.8 };
      return;
    }
    e.moveGoal = null;

    const def = getDef(order.defId, world.players[e.player].faction);
    if (!canBuildHere(world, e.player, def, order.cx, order.cy)) {
      return finish(e); // site went bad while we walked over
    }
    const site = world.spawn(order.defId, e.player, order.x, order.y, { complete: false });
    order.targetId = site.id;
    nudgeUnitsOut(world, site);
    world.addEffect({ type: 'buildStart', x: site.x, y: site.y, size: site.def.footprintPx || site.radius * 2 });
  }

  // Phase 2: nanolathe it.
  const site = world.get(order.targetId);
  if (!site) return finish(e);
  if (!site.underConstruction) {
    // Finished. Keep repairing if it got shot up during construction.
    if (site.hp < site.maxHp * 0.999) {
      world.buildJobs.push({ builder: e, kind: 'repair', target: site, power: e.def.buildPower });
      e.moveGoal = null;
      return;
    }
    return finish(e);
  }

  const d = dist(e.x, e.y, site.x, site.y) - site.radius;
  if (d > range) {
    e.moveGoal = { x: site.x, y: site.y, slack: range * 0.75 };
    return;
  }
  e.moveGoal = null;
  e.activeJob = { kind: 'build', targetId: site.id };
  world.buildJobs.push({ builder: e, kind: 'build', target: site, power: e.def.buildPower });
}

function doRepair(world, e, order) {
  const target = world.get(order.targetId);
  if (!target || (target.hp >= target.maxHp && !target.underConstruction)) return finish(e);
  const range = e.def.buildRange || 100;
  const d = dist(e.x, e.y, target.x, target.y) - target.radius;
  if (d > range) {
    e.moveGoal = { x: target.x, y: target.y, slack: range * 0.75 };
    return;
  }
  e.moveGoal = null;
  const kind = target.underConstruction ? 'build' : 'repair';
  e.activeJob = { kind, targetId: target.id };
  world.buildJobs.push({ builder: e, kind, target, power: e.def.buildPower });
}

function doReclaim(world, e, order) {
  const wreck = world.wrecks.find((w) => w.id === order.wreckId);
  if (!wreck || wreck.metalLeft <= 0) return finish(e);
  const range = e.def.buildRange || 100;
  const d = dist(e.x, e.y, wreck.x, wreck.y) - wreck.radius;
  if (d > range) {
    e.moveGoal = { x: wreck.x, y: wreck.y, slack: range * 0.75 };
    return;
  }
  e.moveGoal = null;
  e.activeJob = { kind: 'reclaim', wreckId: wreck.id };
  world.buildJobs.push({ builder: e, kind: 'reclaim', target: wreck, power: e.def.buildPower });
}

function doGuard(world, e, order) {
  const target = world.get(order.targetId);
  if (!target) return finish(e);

  if (e.def.buildPower) {
    const helped = assistTarget(world, e, target);
    if (helped) return;
  }

  // Combat escorts shadow the target and engage anything that threatens it.
  const foe = findNearbyEnemy(world, e, (e.def.maxWeaponRange || 0) + 180);
  if (foe && e.def.maxWeaponRange) {
    e.targetId = foe.id;
    e.moveGoal = dist(e.x, e.y, foe.x, foe.y) > e.def.maxWeaponRange * 0.85
      ? { x: foe.x, y: foe.y } : null;
    return;
  }
  e.targetId = 0;
  const d = dist(e.x, e.y, target.x, target.y);
  const keep = target.radius + e.radius + 55;
  e.moveGoal = d > keep * 1.6 ? { x: target.x, y: target.y, slack: keep } : null;
}

function doPatrol(world, e, order) {
  const points = order.points;
  if (!points || points.length === 0) return finish(e);

  // Fight anything that turns up on the route.
  if (e.def.maxWeaponRange) {
    const foe = findNearbyEnemy(world, e, e.def.maxWeaponRange * 1.15 + 60);
    if (foe) {
      e.targetId = foe.id;
      e.moveGoal = dist(e.x, e.y, foe.x, foe.y) > e.def.maxWeaponRange * 0.85
        ? { x: foe.x, y: foe.y } : null;
      return;
    }
    e.targetId = 0;
  }

  // Builders on patrol behave like BAR's: they repair and reclaim as they go.
  if (e.def.buildPower && autoAssist(world, e, true, 320)) return;

  const p = points[order.index % points.length];
  if (dist(e.x, e.y, p.x, p.y) <= arriveRadius(e) * 1.4) {
    order.index = (order.index + 1) % points.length;
  }
  e.moveGoal = points[order.index % points.length];
}

// --------------------------------------------------------------- assisting

/** Contribute build power to whatever `target` is currently doing. */
function assistTarget(world, e, target) {
  const range = e.def.buildRange || 100;
  const withinRange = () => dist(e.x, e.y, target.x, target.y) - target.radius <= range;

  const register = (kind, jobTarget) => {
    if (dist(e.x, e.y, jobTarget.x, jobTarget.y) - (jobTarget.radius || 0) > range) {
      e.moveGoal = { x: jobTarget.x, y: jobTarget.y, slack: range * 0.7 };
      return true;
    }
    e.moveGoal = null;
    e.activeJob = { kind, targetId: jobTarget.id };
    world.buildJobs.push({ builder: e, kind, target: jobTarget, power: e.def.buildPower });
    return true;
  };

  if (target.underConstruction) return register('build', target);
  if (target.def.factory && target.factoryQueue.length > 0) {
    if (!withinRange()) {
      e.moveGoal = { x: target.x, y: target.y, slack: range * 0.7 };
      return true;
    }
    e.moveGoal = null;
    world.buildJobs.push({ builder: e, kind: 'produce', target, power: e.def.buildPower });
    return true;
  }
  // Follow whatever the guarded builder is working on.
  if (target.activeJob) {
    if (target.activeJob.wreckId) {
      const wreck = world.wrecks.find((w) => w.id === target.activeJob.wreckId);
      if (wreck && wreck.metalLeft > 0) return register('reclaim', wreck);
    } else {
      const sub = world.get(target.activeJob.targetId);
      if (sub) return register(sub.underConstruction ? 'build' : 'repair', sub);
    }
  }
  if (target.hp < target.maxHp * 0.999) return register('repair', target);
  return false;
}

/**
 * Look for nearby work: unfinished structures first, then busy factories,
 * then damaged friendlies, then wrecks worth reclaiming.
 */
export function autoAssist(world, e, idleOnly = false, radiusOverride = 0) {
  const radius = radiusOverride || (e.def.assistOnly ? e.def.buildRange : e.def.buildRange * 2.2);
  const found = world.grid.query(e.x, e.y, radius, []);
  const team = world.players[e.player].team;

  let best = null;
  let bestScore = -Infinity;
  for (const other of found) {
    if (!other.alive || other === e) continue;
    if (world.players[other.player].team !== team) continue;
    const d = dist(e.x, e.y, other.x, other.y);
    if (d > radius) continue;
    let score = -d;
    if (other.underConstruction) score += 5000;
    else if (other.def.factory && other.factoryQueue.length > 0) score += 3000;
    else if (other.hp < other.maxHp * 0.98) score += 1500;
    else continue;
    if (score > bestScore) { bestScore = score; best = other; }
  }

  if (best) {
    const range = e.def.buildRange || 100;
    const d = dist(e.x, e.y, best.x, best.y) - best.radius;
    if (d > range) {
      if (e.def.assistOnly) return false; // turrets cannot walk over
      e.moveGoal = { x: best.x, y: best.y, slack: range * 0.7 };
      return true;
    }
    e.moveGoal = null;
    const kind = best.underConstruction ? 'build'
      : (best.def.factory && best.factoryQueue.length > 0) ? 'produce' : 'repair';
    world.buildJobs.push({ builder: e, kind, target: best, power: e.def.buildPower });
    return true;
  }

  // Nothing to help with: reclaim a wreck within reach.
  if (idleOnly || e.def.assistOnly) {
    let wreck = null;
    let bestD = radius * radius;
    for (const w of world.wrecks) {
      if (w.metalLeft <= 0) continue;
      const d = dist2(e.x, e.y, w.x, w.y);
      if (d < bestD) { bestD = d; wreck = w; }
    }
    if (wreck) {
      const range = e.def.buildRange || 100;
      const d = dist(e.x, e.y, wreck.x, wreck.y) - wreck.radius;
      if (d > range) {
        if (e.def.assistOnly) return false;
        e.moveGoal = { x: wreck.x, y: wreck.y, slack: range * 0.7 };
        return true;
      }
      e.moveGoal = null;
      world.buildJobs.push({ builder: e, kind: 'reclaim', target: wreck, power: e.def.buildPower });
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------- helpers

export function findNearbyEnemy(world, e, radius) {
  const found = world.grid.query(e.x, e.y, radius, []);
  let best = null;
  let bestScore = -Infinity;
  for (const other of found) {
    if (!other.alive || !world.isEnemy(e, other)) continue;
    const d = dist(e.x, e.y, other.x, other.y);
    if (d > radius) continue;
    if (!world.fog[e.player].isVisible(other.x, other.y)) continue;
    // Prefer close, dangerous, and nearly-dead things.
    let score = -d;
    if (other.def.maxWeaponRange > 0) score += 220;
    if (other.def.buildPower) score += 140;
    if (other.underConstruction) score += 180;
    score += (1 - other.hp / other.maxHp) * 160;
    if (score > bestScore) { bestScore = score; best = other; }
  }
  return best;
}

/** Is this footprint legal for `playerIndex` to build on right now? */
export function canBuildHere(world, playerIndex, def, cx, cy) {
  const map = world.map;
  if (!map.canPlace(cx, cy, def.footprint)) return false;
  if (def.needsMetalSpot) {
    const x = (cx + def.footprint / 2) * BUILD_CELL;
    const y = (cy + def.footprint / 2) * BUILD_CELL;
    const spot = map.metalSpotNear(x, y, BUILD_CELL * 1.6);
    if (!spot || spot.taken) return false;
  }
  return true;
}

/** Shove any units standing inside a freshly placed footprint out of the way. */
function nudgeUnitsOut(world, site) {
  const r = (site.def.footprintPx || site.radius * 2) * 0.75;
  const found = world.grid.query(site.x, site.y, r + 40, []);
  for (const u of found) {
    if (!u.alive || u.isBuilding || !u.def.speed) continue;
    const dx = u.x - site.x;
    const dy = u.y - site.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < r + u.radius) {
      const push = r + u.radius + 4 - d;
      u.x += (dx / d) * push;
      u.y += (dy / d) * push;
    }
  }
}
