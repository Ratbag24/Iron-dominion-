// Target acquisition and weapon firing.
//
// What a weapon can shoot at is part of its definition. Most guns are laid for
// ground targets and cannot elevate onto an aircraft; dedicated anti-air can,
// and a few mounts do both. Without that rule an air unit is just a fast
// ground unit that ignores terrain, and there is nothing to answer it with.

import { dist, angleDelta, turnTowards, interceptPoint } from '../core/math.js';
import { spawnProjectile } from './projectiles.js';

/** Can this weapon engage that target? `targets` defaults to ground only. */
export function canHit(weaponDef, target) {
  const targets = weaponDef.targets || 'ground';
  if (targets === 'both') return true;
  const flying = target.def.layer === 'air';
  return targets === 'air' ? flying : !flying;
}

/** Does this entity have any weapon that could engage that target? */
export function canEngage(e, target) {
  for (const w of e.weapons) {
    if (canHit(w.def, target)) return true;
  }
  return false;
}

const TURRET_TURN_UNIT = 7.0;     // radians/second
const TURRET_TURN_BUILDING = 3.2;
const AIM_TOLERANCE = 0.22;       // radians

export function updateCombat(world, dt) {
  const buf = [];

  for (const e of world.entities) {
    if (!e.alive || e.underConstruction || e.weapons.length === 0) continue;

    const maxRange = e.def.maxWeaponRange;
    const target = resolveTarget(world, e, maxRange, buf);

    if (!target) {
      // Idle turrets drift back to facing forward.
      if (e.isBuilding) e.turretAngle = turnTowards(e.turretAngle, e.heading, TURRET_TURN_BUILDING * dt * 0.3);
      for (const w of e.weapons) w.cooldown = Math.max(0, w.cooldown - dt);
      continue;
    }

    e.targetId = target.id;

    const turnRate = e.isBuilding ? TURRET_TURN_BUILDING : TURRET_TURN_UNIT;
    const toTarget = Math.atan2(target.y - e.y, target.x - e.x);
    e.turretAngle = turnTowards(e.turretAngle, toTarget, turnRate * dt);

    const surfaceDist = dist(e.x, e.y, target.x, target.y) - target.radius;

    for (const w of e.weapons) {
      w.cooldown -= dt;
      if (w.cooldown > 0) continue;
      if (surfaceDist > w.def.range) continue;
      if (!canHit(w.def, target)) continue;

      const lead = interceptPoint(e.x, e.y, target.x, target.y, target.vx || 0, target.vy || 0, w.def.speed);
      const aimAngle = Math.atan2(lead.y - e.y, lead.x - e.x);
      if (Math.abs(angleDelta(e.turretAngle, aimAngle)) > AIM_TOLERANCE) continue;

      spawnProjectile(world, e, w, target, lead.x, lead.y);
      w.cooldown = w.def.reload;
      w.lastFire = world.time;
      w.targetId = target.id;
      // Stagger multi-weapon units so both barrels do not fire on the same frame.
      break;
    }
  }
}

function resolveTarget(world, e, maxRange, buf) {
  // Hold on to an explicitly ordered target even outside vision.
  const ordered = e.orders[0] && e.orders[0].type === 'attack' ? world.get(e.orders[0].targetId) : null;
  if (ordered && world.isEnemy(e, ordered) && canEngage(e, ordered)) {
    if (dist(e.x, e.y, ordered.x, ordered.y) - ordered.radius <= maxRange * 1.05) return ordered;
    return null; // still walking into range
  }

  const current = world.get(e.targetId);
  if (current && world.isEnemy(e, current) && canEngage(e, current)
      && dist(e.x, e.y, current.x, current.y) - current.radius <= maxRange
      && world.fog[e.player].isVisible(current.x, current.y)) {
    return current;
  }

  return acquire(world, e, maxRange, buf);
}

function acquire(world, e, maxRange, buf) {
  world.grid.query(e.x, e.y, maxRange + 40, buf);
  const fog = world.fog[e.player];
  let best = null;
  let bestScore = -Infinity;

  for (const o of buf) {
    if (!o.alive || !world.isEnemy(e, o)) continue;
    if (!canEngage(e, o)) continue;
    const d = dist(e.x, e.y, o.x, o.y) - o.radius;
    if (d > maxRange) continue;
    if (!fog.isVisible(o.x, o.y)) continue;

    // Shoot the thing that matters most: threats first, then builders, then
    // whatever is closest to dying.
    let score = 1000 - d;
    if (o.def.maxWeaponRange > 0) score += 400;
    if (o.def.buildPower) score += 260;
    if (o.underConstruction) score += 220;
    if (o.id === e.lastAttackerId) score += 350;
    score += (1 - o.hp / o.maxHp) * 200;
    if (o.isBuilding && !o.def.weapons) score -= 300; // prefer live targets
    // Anything that can shoot back at aircraft is the first thing an aircraft
    // should be killing.
    if (e.def.layer === 'air' && o.def.hitsAir) score += 500;

    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}
