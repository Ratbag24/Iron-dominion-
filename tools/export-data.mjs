// Export unit definitions, factions and a parity fixture as JSON.
//
//   node tools/export-data.mjs
//
// The stats are the game's design, not its implementation, so they live in
// data rather than being written twice in two languages. Both the JavaScript
// build and the Godot port read these files, which means a balance change is
// one edit, not two that can drift apart.
//
// The fixture captures known-good values straight out of the working
// JavaScript simulation. The Godot test suite checks itself against it, so
// the port is verified against the original rather than against my memory.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DEFS, FACTIONS, FACTION_IDS, BUILD_HOTKEYS, getDef } from '../src/sim/defs.js';
import { makeRng, makeNoise2D, fbm } from '../src/core/rng.js';
import { GameMap } from '../src/sim/map.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'assets/data');
await mkdir(OUT, { recursive: true });

// --------------------------------------------------------------- definitions
await writeFile(join(OUT, 'units.json'), JSON.stringify(DEFS, null, 2));
await writeFile(join(OUT, 'factions.json'), JSON.stringify(
  { factions: FACTIONS, order: FACTION_IDS, hotkeys: BUILD_HOTKEYS }, null, 2));

// ------------------------------------------------------------------ fixture
const fixture = { rng: {}, noise: {}, defs: {}, maps: {} };

// Seeded RNG: the port has to reproduce this stream bit for bit, or no two
// maps will ever agree between the two builds.
for (const seed of [1, 42, 12345]) {
  const rng = makeRng(seed);
  fixture.rng[seed] = Array.from({ length: 8 }, () => Number(rng().toFixed(12)));
}

for (const seed of [7, 2024]) {
  const noise = makeNoise2D(seed);
  fixture.noise[seed] = [];
  for (const [x, y] of [[0.5, 0.5], [3.25, 7.75], [12.1, 0.3], [100.5, 200.25]]) {
    fixture.noise[seed].push({
      x, y,
      raw: Number(noise(x, y).toFixed(10)),
      fbm4: Number(fbm(noise, x, y, 4).toFixed(10)),
    });
  }
}

// Resolved definitions, with faction modifiers applied.
for (const [id, faction] of [
  ['rifle', 'vanguard'], ['rifle', 'legion'], ['con_tank', 'concord'],
  ['mex', 'vanguard'], ['commander', 'legion'], ['con_fusion', 'concord'],
]) {
  const d = getDef(id, faction);
  fixture.defs[`${id}|${faction}`] = {
    hp: d.hp, metal: d.metal, energy: d.energy, buildTime: d.buildTime,
    speed: d.speed !== undefined ? Number(d.speed.toFixed(6)) : null,
    maxWeaponRange: d.maxWeaponRange,
    wreckMetal: d.wreckMetal,
    radius: Number(d.radius.toFixed(6)),
  };
}

// Map generation: same seed must give the same terrain, spots and starts.
for (const seed of [1, 7, 42]) {
  const map = new GameMap({ seed });
  const counts = [0, 0, 0];
  for (const t of map.terrain) counts[t]++;
  fixture.maps[seed] = {
    cols: map.cols, rows: map.rows,
    terrainCounts: counts,
    waterLine: Number(map.waterLine.toFixed(8)),
    rockLine: Number(map.rockLine.toFixed(8)),
    startPositions: map.startPositions.map((p) => [p.cx, p.cy]),
    metalSpotCount: map.metalSpots.length,
    // A sample of spots, so a subtly different placement order is caught too.
    firstSpots: map.metalSpots.slice(0, 6).map((s) => [s.cx, s.cy, s.yield]),
    heightSamples: [0, 1000, 5000, 20000, 36000].map(
      (i) => Number(map.heights[i].toFixed(8))),
  };
}

await writeFile(join(OUT, 'parity-fixture.json'), JSON.stringify(fixture, null, 2));

console.log(`units.json          ${Object.keys(DEFS).length} definitions`);
console.log(`factions.json       ${FACTION_IDS.length} factions`);
console.log(`parity-fixture.json ${Object.keys(fixture.rng).length} rng seeds, ` +
  `${Object.keys(fixture.defs).length} resolved defs, ${Object.keys(fixture.maps).length} maps`);
