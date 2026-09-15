// Nanolathe construction, repair, reclaim and factory production.
//
// Build jobs registered by orders.js are grouped by target so that several
// builders assisting the same site simply add their build power together —
// the same "everything is build power" model Beyond All Reason uses.

import { getDef } from './defs.js';
import { clamp } from '../core/math.js';

const REPAIR_COST_FRACTION = 0.5;

/**
 * Group this tick's jobs and work out what each player would like to spend.
 * Fills world._jobGroups and the per-player demand totals.
 */
export function computeBuildDemand(world, dt) {
  const groups = new Map();

  for (const job of world.buildJobs) {
    const target = job.target;
    if (!target) continue;
    if (job.kind !== 'reclaim' && !target.alive) continue;
    const key = job.kind + ':' + target.id;
    let g = groups.get(key);
    if (!g) {
      g = { kind: job.kind, target, power: 0, player: job.builder.player, builders: [] };
      groups.set(key, g);
    }
    g.power += job.power;
    g.builders.push(job.builder);
  }

  for (const p of world.players) {
    p._metalDemand = 0;
    p._energyDemand = 0;
    p.buildPowerUsed = 0;
  }

  for (const g of groups.values()) {
    const player = world.players[g.player];
    player.buildPowerUsed += g.power;

    if (g.kind === 'build') {
      const def = g.target.def;
      const delta = Math.min(g.power * dt / def.buildTime, 1 - g.target.buildProgress);
      g.delta = Math.max(0, delta);
      g.metal = def.metal * g.delta;
      g.energy = def.energy * g.delta;
    } else if (g.kind === 'produce') {
      const factory = g.target;
      const item = factory.factoryQueue[0];
      if (!item) { g.delta = 0; g.metal = 0; g.energy = 0; continue; }
      const def = getDef(item.defId, world.players[factory.player].faction);
      g.itemDef = def;
      const delta = Math.min(g.power * dt / def.buildTime, 1 - factory.factoryProgress);
      g.delta = Math.max(0, delta);
      g.metal = def.metal * g.delta;
      g.energy = def.energy * g.delta;
    } else if (g.kind === 'repair') {
      const def = g.target.def;
      const hpPerSecond = g.power * (def.hp / def.buildTime);
      const deltaHp = Math.min(hpPerSecond * dt, g.target.maxHp - g.target.hp);
      g.deltaHp = Math.max(0, deltaHp);
      const fraction = g.target.maxHp > 0 ? g.deltaHp / g.target.maxHp : 0;
      g.metal = def.metal * fraction * REPAIR_COST_FRACTION;
      g.energy = 0;
    } else if (g.kind === 'reclaim') {
      // Reclaim produces metal instead of consuming it.
      g.metal = 0;
      g.energy = 0;
      const wreck = g.target;
      g.delta = Math.min(g.power * dt / wreck.reclaimTime, 1 - wreck.reclaimProgress);
      g.delta = Math.max(0, g.delta);
      continue;
    }

    player._metalDemand += g.metal;
    player._energyDemand += g.energy;
  }

  world._jobGroups = groups;
  return groups;
}

/** Spend the resources the economy allowed and advance each job. */
export function applyConstruction(world, dt) {
  const groups = world._jobGroups;
  if (!groups) return;

  for (const g of groups.values()) {
    const player = world.players[g.player];

    if (g.kind === 'reclaim') {
      const wreck = g.target;
      if (wreck.metalLeft <= 0) continue;
      const gained = Math.min(wreck.metal * g.delta, wreck.metalLeft);
      wreck.reclaimProgress = clamp(wreck.reclaimProgress + g.delta, 0, 1);
      wreck.metalLeft -= gained;
      player.metal = Math.min(player.metalStorage, player.metal + gained);
      player.metalReclaim += gained / dt;
      player.stats.metalReclaimed += gained;
      if (world.tickCount % 4 === 0 && gained > 0) {
        world.addEffect({
          type: 'nanolathe', x: g.builders[0].x, y: g.builders[0].y,
          tx: wreck.x, ty: wreck.y, reclaim: true, player: g.player,
        });
      }
      continue;
    }

    const ratio = Math.min(player.metalRatio, player.energyRatio);
    if (ratio <= 0) continue;

    if (g.kind === 'build') {
      const target = g.target;
      const delta = g.delta * ratio;
      if (delta <= 0) continue;
      target.buildProgress = clamp(target.buildProgress + delta, 0, 1);
      target.hp = Math.min(target.maxHp, Math.max(target.hp, target.maxHp * (0.05 + 0.95 * target.buildProgress)));
      spend(player, g.metal * ratio, g.energy * ratio);
      emitLathe(world, g, target.x, target.y);
      if (target.buildProgress >= 1) {
        target.underConstruction = false;
        target.hp = target.maxHp;
        target.buildProgress = 1;
        player.stats.built++;
        world.addEffect({ type: 'buildDone', x: target.x, y: target.y, size: target.def.footprintPx || target.radius * 2 });
      }
    } else if (g.kind === 'produce') {
      const factory = g.target;
      const item = factory.factoryQueue[0];
      if (!item) continue;
      const delta = g.delta * ratio;
      if (delta <= 0) continue;
      factory.factoryProgress = clamp(factory.factoryProgress + delta, 0, 1);
      spend(player, g.metal * ratio, g.energy * ratio);
      emitLathe(world, g, factory.x, factory.y);
      if (factory.factoryProgress >= 1) {
        factory.factoryProgress = 0;
        completeFactoryItem(world, factory, item);
      }
    } else if (g.kind === 'repair') {
      const target = g.target;
      const deltaHp = g.deltaHp * ratio;
      if (deltaHp <= 0) continue;
      target.hp = Math.min(target.maxHp, target.hp + deltaHp);
      spend(player, g.metal * ratio, 0);
      emitLathe(world, g, target.x, target.y);
    }
  }

  world._jobGroups = null;
}

function spend(player, metal, energy) {
  player.metal = Math.max(0, player.metal - metal);
  player.energy = Math.max(0, player.energy - energy);
}

function emitLathe(world, g, tx, ty) {
  if (world.tickCount % 3 !== 0) return;
  for (let i = 0; i < g.builders.length && i < 6; i++) {
    const b = g.builders[i];
    if (b.x === tx && b.y === ty) continue;
    world.addEffect({ type: 'nanolathe', x: b.x, y: b.y, tx, ty, player: g.player });
  }
}

/** Place one body from a factory order, scattered if it is part of a squad. */
function spawnFromFactory(world, factory, defId, exit, index, count) {
  // A squad is dealt out around the factory door rather than stacked on it,
  // or the separation pass would spend its first second untangling them.
  const ring = count > 1 ? 9 + count * 1.6 : 0;
  const a = count > 1 ? (index / count) * Math.PI * 2 + world.rng() * 0.5 : 0;
  const sx = exit.x + Math.cos(a) * ring;
  const sy = exit.y + Math.sin(a) * ring;
  const unit = world.spawn(defId, factory.player, sx, sy, { complete: true });
  unit.heading = factory.heading;

  if (factory.rally) {
    // Scatter arrivals so a long production run does not pile into one point.
    const spread = 26 + Math.sqrt(Math.max(1, world.unitsOf(factory.player).length)) * 9;
    unit.orders.push({
      type: 'move',
      x: factory.rally.x + (world.rng() - 0.5) * spread,
      y: factory.rally.y + (world.rng() - 0.5) * spread,
    });
  } else {
    unit.orders.push({ type: 'move', x: sx, y: sy + factory.def.footprintPx * 0.9 });
  }

  world.addEffect({ type: 'unitDone', x: unit.x, y: unit.y, player: factory.player });
  return unit;
}

/** Pop a finished unit out of its factory and send it to the rally point. */
function completeFactoryItem(world, factory, item) {
  const exit = factoryExit(world, factory);
  // Infantry come out as a squad: one order, one cost, one build time, and
  // then `squad` bodies at once. Building them one at a time would make them
  // strictly worse tanks -- the whole point of troops is that they arrive as a
  // number. They are separate entities from the moment they leave the door,
  // not a group that has to be held together: they take losses individually,
  // spread out under fire, and can be split up like anything else.
  const def = getDef(item.defId, world.players[factory.player].faction);
  const count = def && def.squad > 1 ? def.squad : 1;

  for (let i = 0; i < count; i++) {
    spawnFromFactory(world, factory, item.defId, exit, i, count);
  }

  item.count--;
  if (item.count <= 0) {
    factory.factoryQueue.shift();
    if (factory.repeat) factory.factoryQueue.push({ defId: item.defId, count: item.origCount || 1, origCount: item.origCount || 1 });
  }
}

/** Find an unobstructed tile just outside the factory to place the new unit. */
function factoryExit(world, factory) {
  const map = world.map;
  const half = factory.def.footprintPx * 0.5;
  const candidates = [
    { x: factory.x, y: factory.y + half + 24 },
    { x: factory.x + half + 24, y: factory.y },
    { x: factory.x - half - 24, y: factory.y },
    { x: factory.x, y: factory.y - half - 24 },
  ];
  for (const c of candidates) {
    if (map.isPassable(c.x, c.y)) return c;
  }
  for (let r = 1; r < 8; r++) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const x = factory.x + Math.cos(ang) * (half + 24 + r * 18);
      const y = factory.y + Math.sin(ang) * (half + 24 + r * 18);
      if (map.isPassable(x, y)) return { x, y };
    }
  }
  return { x: factory.x, y: factory.y + half + 24 };
}
