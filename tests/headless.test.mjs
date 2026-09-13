// Headless simulation tests. These run the real game loop with no renderer,
// which is how we prove the simulation works independently of the UI.

import { World, SIM_DT } from '../src/sim/world.js';
import { getDef, DEFS } from '../src/sim/defs.js';
import { GameMap } from '../src/sim/map.js';
import { Pathfinder } from '../src/sim/pathfinder.js';

let failures = 0;
let checks = 0;

function check(name, cond, detail = '') {
  checks++;
  if (cond) {
    console.log('  PASS  ' + name + (detail ? '  (' + detail + ')' : ''));
  } else {
    failures++;
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}

function section(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

function run(world, seconds) {
  const ticks = Math.round(seconds / SIM_DT);
  for (let i = 0; i < ticks && !world.gameOver; i++) world.tick(SIM_DT);
}

function snapshot(world, i) {
  const p = world.players[i];
  const own = world.unitsOf(i);
  const byDef = {};
  for (const e of own) byDef[e.defId] = (byDef[e.defId] || 0) + 1;
  return {
    metal: p.metal, energy: p.energy,
    metalIncome: p.metalIncome, energyIncome: p.energyIncome,
    units: own.length, byDef,
    army: own.filter((e) => e.weapons.length && e.def.speed && e.defId !== 'commander').length,
    buildings: own.filter((e) => e.isBuilding).length,
  };
}

function finite(world) {
  for (const e of world.entities) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) return e;
  }
  for (const p of world.projectiles) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return p;
  }
  for (const pl of world.players) {
    if (!Number.isFinite(pl.metal) || !Number.isFinite(pl.energy)) return pl;
  }
  return null;
}

// ---------------------------------------------------------------- defs
section('Definitions');
{
  let ok = true;
  const problems = [];
  for (const id of Object.keys(DEFS)) {
    for (const faction of ['vanguard', 'legion']) {
      const d = getDef(id, faction);
      if (!(d.hp > 0)) { ok = false; problems.push(id + ' hp'); }
      if (!(d.buildTime > 0)) { ok = false; problems.push(id + ' buildTime'); }
      if (d.kind === 'building' && !(d.footprint > 0)) { ok = false; problems.push(id + ' footprint'); }
      if (d.kind === 'unit' && !(d.speed > 0)) { ok = false; problems.push(id + ' speed'); }
      for (const b of d.build || []) {
        if (!DEFS[b]) { ok = false; problems.push(id + ' builds unknown ' + b); }
      }
    }
  }
  check('every definition is well formed', ok, problems.join(', '));
}

// ---------------------------------------------------------------- map
section('Map generation');
{
  let allConnected = true;
  let minSpots = Infinity;
  let symmetric = true;
  for (let seed = 1; seed <= 8; seed++) {
    const map = new GameMap({ seed });
    const pf = new Pathfinder(map);
    const [a, b] = map.startPositions;
    if (!pf.findPath(a.x, a.y, b.x, b.y)) allConnected = false;
    minSpots = Math.min(minSpots, map.metalSpots.length);
    // 180-degree rotational symmetry of the terrain classification
    for (let k = 0; k < 200; k++) {
      const cx = (k * 7919) % map.cols;
      const cy = (k * 104729) % map.rows;
      const t1 = map.terrain[map.idx(cx, cy)];
      const t2 = map.terrain[map.idx(map.cols - 1 - cx, map.rows - 1 - cy)];
      if (t1 !== t2) symmetric = false;
    }
  }
  check('start positions always connected by land', allConnected);
  check('maps carry a full set of metal spots', minSpots >= 20, 'min ' + minSpots);
  check('terrain is rotationally symmetric', symmetric);
}

// ---------------------------------------------------------------- economy
section('Economy and construction');
{
  const world = new World({
    seed: 7,
    players: [
      { name: 'A', faction: 'vanguard' },
      { name: 'B', faction: 'legion' },
    ],
  });
  const p = world.players[0];
  const com = world.get(p.commanderId);

  const spot = world.map.nearestFreeMetalSpot(p.startX, p.startY);
  const snapped = world.map.snapFootprint(spot.x, spot.y, getDef('mex', p.faction).footprint);
  com.orders.push({ type: 'build', defId: 'mex', x: snapped.x, y: snapped.y, cx: snapped.cx, cy: snapped.cy });

  const metalBefore = p.metal;
  run(world, 30);

  const mex = world.unitsOf(0, 'mex')[0];
  check('commander built a metal extractor', !!mex);
  check('extractor finished construction', mex && !mex.underConstruction,
    mex ? 'progress ' + mex.buildProgress.toFixed(2) : '');
  check('extractor generates metal income', p.metalIncome > 1.5,
    p.metalIncome.toFixed(2) + ' m/s');
  check('construction consumed resources', p.metal !== metalBefore);
  check('metal spot is marked as taken', spot.taken);

  // Energy structure
  com.orders.push({ type: 'build', defId: 'solar', x: p.startX + 140, y: p.startY + 40, ...world.map.snapFootprint(p.startX + 140, p.startY + 40, 4) });
  run(world, 40);
  check('solar collector adds energy income', p.energyIncome >= 20,
    p.energyIncome.toFixed(1) + ' e/s');
}

// ---------------------------------------------------------------- stalling
section('Stall throttling');
{
  const world = new World({ seed: 11, players: [{ name: 'A' }, { name: 'B' }] });
  const p = world.players[0];
  const com = world.get(p.commanderId);
  p.metal = 5;     // deliberately broke
  p.energy = 5;

  const s = world.map.snapFootprint(p.startX + 150, p.startY, 4);
  com.orders.push({ type: 'build', defId: 'solar', x: s.x, y: s.y, cx: s.cx, cy: s.cy });
  run(world, 4);

  check('builder is throttled while stalling', p.metalRatio < 1 || p.energyRatio < 1,
    'mRatio ' + p.metalRatio.toFixed(2) + ' eRatio ' + p.energyRatio.toFixed(2));
  check('resources never go negative', p.metal >= 0 && p.energy >= 0);
  const site = world.unitsOf(0, 'solar')[0];
  check('construction still progresses slowly', site && site.buildProgress > 0 && site.buildProgress < 1,
    site ? site.buildProgress.toFixed(3) : 'no site');
}

// ---------------------------------------------------------------- factory
section('Factory production and reclaim');
{
  const world = new World({ seed: 3, players: [{ name: 'A' }, { name: 'B' }] });
  const p = world.players[0];
  p.metal = 4000;
  p.energy = 6000;
  const lab = world.spawn('botlab', 0, p.startX + 200, p.startY, { complete: true });
  lab.factoryQueue.push({ defId: 'rifle', count: 3, origCount: 3 });
  run(world, 40);
  const rifles = world.unitsOf(0, 'rifle');
  check('factory produced queued units', rifles.length === 3, rifles.length + ' produced');
  check('factory queue drained', lab.factoryQueue.length === 0);
  check('produced units are placed on passable ground',
    rifles.every((r) => world.map.isPassable(r.x, r.y)));

  // Reclaim: kill one and have a builder reclaim the wreck.
  const victim = rifles[0];
  world.kill(victim, null);
  check('death leaves a reclaimable wreck', world.wrecks.length > 0);
  const wreck = world.wrecks[0];
  const con = world.spawn('conbot', 0, wreck.x + 40, wreck.y, { complete: true });
  const metalBefore = p.metal;
  p.metal = 0;
  con.orders.push({ type: 'reclaim', wreckId: wreck.id });
  run(world, 25);
  check('reclaiming a wreck returns metal', p.metal > 0, p.metal.toFixed(1) + ' metal recovered');
}

// ---------------------------------------------------------------- combat
section('Combat');
{
  const world = new World({
    seed: 5,
    commanderEnds: false,
    players: [{ name: 'A' }, { name: 'B' }],
  });
  // Reveal everything so target acquisition is not gated on fog in this test.
  world.fog.forEach((f) => f.revealAll());
  const mid = { x: world.map.width / 2, y: world.map.height / 2 };
  let placed = 0;
  const attackers = [];
  const defenders = [];
  for (let i = 0; i < 4; i++) {
    const a = world.spawn('rifle', 0, mid.x - 120, mid.y - 40 + i * 24, { complete: true });
    const b = world.spawn('rifle', 1, mid.x + 120, mid.y - 40 + i * 24, { complete: true });
    attackers.push(a); defenders.push(b); placed += 2;
  }
  for (const a of attackers) a.orders.push({ type: 'attackMove', x: mid.x + 120, y: mid.y });
  for (const b of defenders) b.orders.push({ type: 'attackMove', x: mid.x - 120, y: mid.y });

  let firedProjectile = false;
  for (let i = 0; i < 30 * 45 && !world.gameOver; i++) {
    world.tick(SIM_DT);
    if (world.projectiles.length > 0) firedProjectile = true;
  }
  const aLeft = world.unitsOf(0, 'rifle').length;
  const bLeft = world.unitsOf(1, 'rifle').length;
  check('units fired weapons', firedProjectile);
  check('combat produced casualties', aLeft + bLeft < placed, aLeft + ' vs ' + bLeft + ' left');
}

// ---------------------------------------------------------------- AI match
section('Full AI vs AI match');
{
  const world = new World({
    seed: 2024,
    players: [
      { name: 'Vanguard AI', faction: 'vanguard', isAI: true, aiLevel: 'normal' },
      { name: 'Legion AI', faction: 'legion', isAI: true, aiLevel: 'normal' },
    ],
  });

  const t0 = Date.now();
  const marks = [60, 180, 360, 600];
  let last = 0;
  const reports = [];
  const peakArmy = [0, 0];
  for (const m of marks) {
    run(world, m - last);
    last = m;
    const a = snapshot(world, 0);
    const b = snapshot(world, 1);
    peakArmy[0] = Math.max(peakArmy[0], a.army);
    peakArmy[1] = Math.max(peakArmy[1], b.army);
    reports.push({ t: m, a, b, over: world.gameOver });
    if (world.gameOver) break;
  }
  const wall = Date.now() - t0;

  for (const r of reports) {
    console.log(
      `  t=${String(r.t).padStart(3)}s  ` +
      `A: ${String(r.a.units).padStart(3)}u ${String(r.a.buildings).padStart(2)}b army ${String(r.a.army).padStart(3)} ` +
      `M+${r.a.metalIncome.toFixed(1)} E+${r.a.energyIncome.toFixed(0)}  |  ` +
      `B: ${String(r.b.units).padStart(3)}u ${String(r.b.buildings).padStart(2)}b army ${String(r.b.army).padStart(3)} ` +
      `M+${r.b.metalIncome.toFixed(1)} E+${r.b.energyIncome.toFixed(0)}`
    );
  }

  const a = reports[reports.length - 1].a;
  const b = reports[reports.length - 1].b;

  check('AI claimed metal spots', (a.byDef.mex || 0) >= 4 && (b.byDef.mex || 0) >= 4,
    `A ${a.byDef.mex || 0} / B ${b.byDef.mex || 0} extractors`);
  check('AI built energy', a.energyIncome > 40 && b.energyIncome > 40,
    `A ${a.energyIncome.toFixed(0)} / B ${b.energyIncome.toFixed(0)} e/s`);
  check('AI built a factory', (a.byDef.botlab || 0) >= 1 && (b.byDef.botlab || 0) >= 1);
  // Peak rather than final: by 600s one side is usually winning, and the
  // loser's army having been destroyed is the correct outcome, not a fault.
  check('both AIs fielded an army', peakArmy[0] >= 8 && peakArmy[1] >= 8,
    `peak A ${peakArmy[0]} / B ${peakArmy[1]} units`);
  check('AI produced extra builders', (a.byDef.conbot || 0) >= 2, `${a.byDef.conbot || 0} conbots`);
  check('simulation stayed numerically sane', finite(world) === null);
  check('AI match ran faster than real time', wall < 600 * 1000,
    `${(600 / (wall / 1000)).toFixed(0)}x real time, ${wall}ms for 600 sim seconds`);

  const casualties = world.players[0].stats.lost + world.players[1].stats.lost;
  check('the two AIs actually fought', casualties > 0, casualties + ' units lost');
}

// ------------------------------------------------------- decisive outcomes
section('Matches reach a conclusion');
{
  let decisive = 0;
  let balanced = { vanguard: 0, legion: 0 };
  const total = 6;
  for (let seed = 1; seed <= total; seed++) {
    const swap = seed % 2 === 0;
    const f0 = swap ? 'legion' : 'vanguard';
    const f1 = swap ? 'vanguard' : 'legion';
    const world = new World({
      seed,
      players: [
        { name: 'A', faction: f0, isAI: true, aiLevel: 'normal' },
        { name: 'B', faction: f1, isAI: true, aiLevel: 'normal' },
      ],
    });
    run(world, 1500);
    if (world.gameOver && world.winner >= 0) {
      decisive++;
      balanced[[f0, f1][world.winner]]++;
    }
  }
  check('most matches end with a winner', decisive >= total - 1,
    `${decisive}/${total} decided`);
  check('neither faction dominates', balanced.vanguard > 0 && balanced.legion > 0,
    `vanguard ${balanced.vanguard} / legion ${balanced.legion}`);
}

// ---------------------------------------------------------------- summary
section('Summary');
console.log(`  ${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`  ${failures} FAILED`);
  process.exit(1);
}
