// Resource production and the stall model.
//
// Income is gathered, construction demand is priced, and if demand exceeds
// what the player can pay every builder is throttled by the same ratio. That
// shared throttle is what makes over-expanding in BAR feel the way it does:
// nothing breaks, everything just slows down together.

import { clamp } from '../core/math.js';
import { computeBuildDemand } from './construction.js';

export const BASE_METAL_STORAGE = 1000;
export const BASE_ENERGY_STORAGE = 1000;

export function runEconomy(world, dt) {
  const players = world.players;

  for (const p of players) {
    p.metalIncome = 0;
    p.energyIncome = 0;
    p.metalReclaim = 0;
    p.metalStorage = BASE_METAL_STORAGE;
    p.energyStorage = BASE_ENERGY_STORAGE;
    p._converterCapacity = 0;
    p.metalWasted = 0;
    p.energyWasted = 0;
  }

  // --- gross production -------------------------------------------------
  for (const e of world.entities) {
    if (!e.alive || e.underConstruction) continue;
    const p = players[e.player];
    const def = e.def;

    if (def.metalPerSecond && e.metalSpot) {
      p.metalIncome += def.metalPerSecond * e.metalSpot.yield;
    }
    if (def.flatMetalPerSecond) {
      p.metalIncome += def.flatMetalPerSecond;
    }
    if (def.energyPerSecond) {
      p.energyIncome += def.energyPerSecond;
    }
    if (def.windPowered) {
      p.energyIncome += 2 + 20 * world.windStrength;
    }
    if (def.metalStorage) p.metalStorage += def.metalStorage;
    if (def.energyStorage) p.energyStorage += def.energyStorage;
    if (def.convertsEnergy) p._converterCapacity += def.convertsEnergy;
  }

  // Difficulty handicap: the AI's income multiplier. Human players run at 1.
  for (const p of players) {
    if (p.incomeMultiplier && p.incomeMultiplier !== 1) {
      p.metalIncome *= p.incomeMultiplier;
      p.energyIncome *= p.incomeMultiplier;
    }
  }

  // The commander carries its own modest storage, as in BAR.
  for (const p of players) {
    const com = world.get(p.commanderId);
    if (com && !com.underConstruction) {
      p.metalStorage += 500;
      p.energyStorage += 500;
    }
  }

  // --- price this tick's construction -----------------------------------
  computeBuildDemand(world, dt);

  for (const p of players) {
    const metalAvailable = p.metal + p.metalIncome * dt;
    const energyAvailable = p.energy + p.energyIncome * dt;

    p.metalRatio = p._metalDemand > 1e-9 ? clamp(metalAvailable / p._metalDemand, 0, 1) : 1;
    p.energyRatio = p._energyDemand > 1e-9 ? clamp(energyAvailable / p._energyDemand, 0, 1) : 1;

    const ratio = Math.min(p.metalRatio, p.energyRatio);
    p.metalDrain = (p._metalDemand * ratio) / dt;
    p.energyDrain = (p._energyDemand * ratio) / dt;

    // Credit income before construction.js spends it.
    p.metal += p.metalIncome * dt;
    p.energy += p.energyIncome * dt;
    p.stats.metalProduced += p.metalIncome * dt;

    p.stalling = {
      metal: p.metalRatio < 0.98 && p._metalDemand > 1e-6,
      energy: p.energyRatio < 0.98 && p._energyDemand > 1e-6,
    };
  }
}

/**
 * Run energy converters on whatever energy is left after construction, and
 * clamp both resources to storage. Called after applyConstruction.
 */
export function settleEconomy(world, dt) {
  for (const p of world.players) {
    if (p._converterCapacity > 0) {
      // Keep a floor in the bank so converters never cause a stall themselves.
      const floor = p.energyStorage * 0.08;
      const spare = Math.max(0, p.energy - floor);
      const consumed = Math.min(p._converterCapacity * dt, spare);
      if (consumed > 0) {
        p.energy -= consumed;
        const made = consumed / 70; // 70 energy buys 1 metal
        p.metal += made;
        p.metalIncome += made / dt;
        p.energyDrain += consumed / dt;
      }
    }

    if (p.metal > p.metalStorage) {
      p.metalWasted = (p.metal - p.metalStorage) / dt;
      p.metal = p.metalStorage;
    }
    if (p.energy > p.energyStorage) {
      p.energyWasted = (p.energy - p.energyStorage) / dt;
      p.energy = p.energyStorage;
    }
    if (p.metal < 0) p.metal = 0;
    if (p.energy < 0) p.energy = 0;
  }
}
