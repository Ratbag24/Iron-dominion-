// Projectile flight and impact.
//
// Lasers travel fast in a straight line, missiles home, and plasma/artillery
// shells arc to a predicted impact point and detonate with splash damage.

import { dist, clamp, turnTowards } from '../core/math.js';

export function spawnProjectile(world, shooter, weapon, target, aimX, aimY) {
  const w = weapon.def;
  const spread = w.spread || 0;
  const baseAngle = Math.atan2(aimY - shooter.y, aimX - shooter.x);
  const angle = baseAngle + (world.rng() - 0.5) * 2 * spread;
  const flightDist = dist(shooter.x, shooter.y, aimX, aimY);

  const p = {
    kind: w.kind,
    x: shooter.x + Math.cos(shooter.turretAngle) * (shooter.radius * 0.9),
    y: shooter.y + Math.sin(shooter.turretAngle) * (shooter.radius * 0.9),
    vx: Math.cos(angle) * w.speed,
    vy: Math.sin(angle) * w.speed,
    speed: w.speed,
    damage: w.damage,
    aoe: w.aoe || 0,
    color: w.color,
    player: shooter.player,
    ownerId: shooter.id,
    targetId: target ? target.id : 0,
    life: clamp((w.range * 1.6) / w.speed, 0.25, 6),
    z: 0,
    trail: w.kind === 'laser' ? 22 : 0,
  };

  if (w.kind === 'arty' || w.kind === 'plasma') {
    // Lock in the impact point and arc toward it.
    p.tx = aimX + (world.rng() - 0.5) * 2 * spread * flightDist;
    p.ty = aimY + (world.rng() - 0.5) * 2 * spread * flightDist;
    const d = dist(p.x, p.y, p.tx, p.ty);
    p.flightTime = Math.max(0.05, d / w.speed);
    p.elapsed = 0;
    p.sx = p.x;
    p.sy = p.y;
    p.arc = w.kind === 'arty' ? d * 0.30 : d * 0.12;
    p.life = p.flightTime + 0.05;
  }

  world.projectiles.push(p);
  world.addEffect({
    type: 'muzzle', x: p.x, y: p.y, angle, color: w.color,
    size: Math.min(26, 6 + w.damage * 0.05),
  });
  return p;
}

export function updateProjectiles(world, dt) {
  const list = world.projectiles;
  const buf = [];

  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;

    if (p.kind === 'arty' || p.kind === 'plasma') {
      p.elapsed += dt;
      const t = clamp(p.elapsed / p.flightTime, 0, 1);
      p.px = p.x;
      p.py = p.y;
      p.x = p.sx + (p.tx - p.sx) * t;
      p.y = p.sy + (p.ty - p.sy) * t;
      p.z = Math.sin(t * Math.PI) * p.arc;
      if (t >= 1) {
        detonate(world, p, buf);
        list.splice(i, 1);
        continue;
      }
      // Shells low to the ground can still clip a unit on the way in.
      if (p.z < 18 && hitCheck(world, p, buf)) {
        list.splice(i, 1);
        continue;
      }
      continue;
    }

    if (p.kind === 'missile') {
      const target = world.get(p.targetId);
      if (target) {
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        const current = Math.atan2(p.vy, p.vx);
        const a = turnTowards(current, desired, 4.5 * dt);
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
      }
    }

    p.px = p.x;
    p.py = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (hitCheck(world, p, buf)) {
      list.splice(i, 1);
      continue;
    }

    if (p.life <= 0 || !world.map.inBounds((p.x / world.map.cell) | 0, (p.y / world.map.cell) | 0)) {
      if (p.aoe > 0) detonate(world, p, buf);
      list.splice(i, 1);
    }
  }
}

function hitCheck(world, p, buf) {
  const reach = 26 + p.speed * 0.02;
  world.grid.query(p.x, p.y, reach, buf);
  for (const e of buf) {
    if (!e.alive || e.id === p.ownerId) continue;
    if (world.players[e.player].team === world.players[p.player].team) continue;
    const r = e.radius + 3;
    // Segment check so fast projectiles cannot tunnel through small units.
    if (segmentHitsCircle(p.px, p.py, p.x, p.y, e.x, e.y, r)) {
      detonate(world, p, buf, e);
      return true;
    }
  }
  return false;
}

function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-9 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = x0 + dx * t;
  const py = y0 + dy * t;
  const ddx = cx - px;
  const ddy = cy - py;
  return ddx * ddx + ddy * ddy <= r * r;
}

function detonate(world, p, buf, directHit) {
  const shooter = world.get(p.ownerId);

  if (directHit) {
    world.damage(directHit, p.damage, shooter);
  }

  if (p.aoe > 0) {
    world.grid.query(p.x, p.y, p.aoe, buf);
    for (const e of buf) {
      if (!e.alive || e === directHit) continue;
      if (world.players[e.player].team === world.players[p.player].team) continue;
      const d = dist(p.x, p.y, e.x, e.y) - e.radius;
      if (d > p.aoe) continue;
      const falloff = 1 - clamp(d / p.aoe, 0, 1);
      world.damage(e, p.damage * falloff * 0.85, shooter);
    }
    world.addEffect({ type: 'explosion', x: p.x, y: p.y, size: p.aoe * 1.15, color: p.color });
  } else {
    world.addEffect({ type: 'impact', x: p.x, y: p.y, color: p.color, size: 8 });
  }
}
