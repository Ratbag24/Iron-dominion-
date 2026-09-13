// Ground movement: path following, steering, unit separation and terrain
// collision. Units push each other apart rather than colliding hard, which
// keeps large groups from deadlocking in corridors.

import { clamp, dist, dist2, turnTowards } from '../core/math.js';

const REPATH_DISTANCE = 140;   // goal moved this far -> ask for a new path
const STUCK_SPEED = 6;         // world units/second considered "not moving"
const STUCK_LIMIT = 1.1;       // seconds before we try to recover

export function updateMovement(world, dt) {
  const neighbours = [];

  for (const e of world.entities) {
    if (!e.alive || e.isBuilding || !e.def.speed || e.underConstruction) continue;

    const goal = e.moveGoal;
    if (goal && !(Number.isFinite(goal.x) && Number.isFinite(goal.y))) {
      e.moveGoal = null;
      e.orders.length = 0;
    }
    if (!e.moveGoal) {
      decelerate(e, dt);
      e.path = null;
      integrate(world, e, dt);
      continue;
    }

    const slack = goal.slack || Math.max(22, e.radius * 1.5);
    if (dist2(e.x, e.y, goal.x, goal.y) <= slack * slack) {
      e.path = null;
      decelerate(e, dt);
      integrate(world, e, dt);
      continue;
    }

    ensurePath(world, e, goal);

    // Aim at the current waypoint, or straight at the goal while we wait for
    // the pathfinder to get to our request.
    let aimX = goal.x;
    let aimY = goal.y;
    if (e.path && e.pathIndex < e.path.length) {
      const wp = e.path[e.pathIndex];
      const wpSlack = e.pathIndex === e.path.length - 1 ? slack : Math.max(18, e.radius * 1.2);
      if (dist2(e.x, e.y, wp.x, wp.y) <= wpSlack * wpSlack) {
        e.pathIndex++;
        if (e.pathIndex >= e.path.length) {
          e.path = null;
        }
      }
      if (e.path && e.pathIndex < e.path.length) {
        aimX = e.path[e.pathIndex].x;
        aimY = e.path[e.pathIndex].y;
      }
    }

    steer(world, e, aimX, aimY, dt);
    separate(world, e, neighbours, dt);
    integrate(world, e, dt);
    checkStuck(world, e, goal, dt);
  }
}

function ensurePath(world, e, goal) {
  const needsPath = !e.path
    || !e.pathGoal
    || dist2(e.pathGoal.x, e.pathGoal.y, goal.x, goal.y) > REPATH_DISTANCE * REPATH_DISTANCE;

  if (!needsPath || e.pathPending) return;

  e.pathPending = true;
  e.pathGoal = { x: goal.x, y: goal.y };
  const sx = e.x;
  const sy = e.y;
  const gx = goal.x;
  const gy = goal.y;
  const priority = e.def.role === 'builder' ? 2 : 1;
  world.pathfinder.request(sx, sy, gx, gy, (path) => {
    e.pathPending = false;
    if (!e.alive) return;
    // A newer goal may have been issued while the request was queued.
    if (!e.pathGoal || dist2(e.pathGoal.x, e.pathGoal.y, gx, gy) > 1) return;
    e.path = path;
    e.pathIndex = 0;
    if (!path) {
      // Unreachable: stop trying so the unit does not grind against a wall.
      e.moveGoal = null;
      e.pathGoal = null;
      if (e.orders.length) e.orders.shift();
    }
  }, priority);
}

function steer(world, e, aimX, aimY, dt) {
  const dx = aimX - e.x;
  const dy = aimY - e.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const desiredAngle = Math.atan2(dy, dx);

  e.heading = turnTowards(e.heading, desiredAngle, e.def.turnRate * dt);

  // Slow down while turning hard, and while arriving.
  const facing = Math.cos(e.heading - desiredAngle);
  const turnPenalty = clamp(facing, 0.15, 1);
  const arrival = clamp(d / 60, 0.25, 1);
  const targetSpeed = e.def.speed * turnPenalty * arrival;

  const tvx = Math.cos(e.heading) * targetSpeed;
  const tvy = Math.sin(e.heading) * targetSpeed;
  const accel = e.def.accel * dt;
  e.vx += clamp(tvx - e.vx, -accel, accel);
  e.vy += clamp(tvy - e.vy, -accel, accel);
}

function decelerate(e, dt) {
  const decel = e.def.accel * 2 * dt;
  const sp = Math.hypot(e.vx, e.vy);
  if (sp <= decel) {
    e.vx = 0;
    e.vy = 0;
  } else {
    e.vx -= (e.vx / sp) * decel;
    e.vy -= (e.vy / sp) * decel;
  }
}

/** Push overlapping units apart, weighted by mass. */
function separate(world, e, buf, dt) {
  const reach = e.radius * 2.6 + 18;
  world.grid.query(e.x, e.y, reach, buf);
  let px = 0;
  let py = 0;
  for (let i = 0; i < buf.length; i++) {
    const o = buf[i];
    if (o === e || !o.alive || o.isBuilding) continue;
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const minDist = e.radius + o.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist * minDist || d2 < 1e-9) continue;
    const d = Math.sqrt(d2);
    const overlap = (minDist - d) / minDist;
    const massRatio = o.def.mass / (e.def.mass + o.def.mass);
    px += (dx / d) * overlap * massRatio;
    py += (dy / d) * overlap * massRatio;
  }
  if (px || py) {
    const push = e.def.speed * 2.2;
    e.vx += px * push * dt * 30 * 0.6;
    e.vy += py * push * dt * 30 * 0.6;
  }
}

/** Integrate velocity with terrain collision, sliding along blocked edges. */
function integrate(world, e, dt) {
  const speed = Math.hypot(e.vx, e.vy);
  const maxSpeed = e.def.speed * 1.35;
  if (speed > maxSpeed) {
    e.vx = (e.vx / speed) * maxSpeed;
    e.vy = (e.vy / speed) * maxSpeed;
  }
  e.speed = Math.min(speed, maxSpeed);
  if (e.speed < 0.001) return;

  const map = world.map;
  const nx = e.x + e.vx * dt;
  const ny = e.y + e.vy * dt;

  if (map.isPassable(nx, ny)) {
    e.x = nx;
    e.y = ny;
    return;
  }
  // Blocked head-on: try each axis so units slide along walls instead of
  // sticking to them.
  if (map.isPassable(nx, e.y)) {
    e.x = nx;
    e.vy *= 0.4;
  } else if (map.isPassable(e.x, ny)) {
    e.y = ny;
    e.vx *= 0.4;
  } else {
    e.vx *= 0.25;
    e.vy *= 0.25;
  }
  e.x = clamp(e.x, 8, map.width - 8);
  e.y = clamp(e.y, 8, map.height - 8);
}

function checkStuck(world, e, goal, dt) {
  const moved = dist(e.x, e.y, e.lastX, e.lastY) / dt;
  e.lastX = e.x;
  e.lastY = e.y;

  if (moved < STUCK_SPEED) {
    e.stuckTimer += dt;
  } else {
    e.stuckTimer = 0;
    return;
  }

  if (e.stuckTimer > STUCK_LIMIT) {
    e.stuckTimer = 0;
    e.path = null;
    e.pathGoal = null;
    // Shuffle sideways to break symmetric jams, then repath next tick.
    const a = e.heading + (world.rng() < 0.5 ? 1 : -1) * (Math.PI * 0.5);
    e.vx += Math.cos(a) * e.def.speed * 0.9;
    e.vy += Math.sin(a) * e.def.speed * 0.9;
  }
}
