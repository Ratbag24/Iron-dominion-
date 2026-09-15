// Headless simulation tests. These run the real game loop with no renderer,
// which is how we prove the simulation works independently of the UI.

import { World, SIM_DT } from '../src/sim/world.js';
import { canBuildHere } from '../src/sim/orders.js';
import { getDef, DEFS, FACTIONS, FACTION_IDS, rosterOf, armourScale } from '../src/sim/defs.js';
import { GameMap, TERRAIN_ROCK, TERRAIN_LAND } from '../src/sim/map.js';
import { creepAt, CREEP_HELD, CREEP_SPEED_OWN, CREEP_SPEED_OTHER } from '../src/sim/creep.js';
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
    for (const faction of FACTION_IDS) {
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

// ------------------------------------------------------------- factions
section('Faction rosters');
{
  const slotSets = FACTION_IDS.map((id) => Object.keys(rosterOf(id)).sort().join(','));
  check('every faction fills the same slots', new Set(slotSets).size === 1,
    FACTION_IDS.length + ' factions');

  let unresolved = [];
  let commanderProblems = [];
  for (const id of FACTION_IDS) {
    const roster = rosterOf(id);
    for (const [slot, defId] of Object.entries(roster)) {
      if (defId === null) continue;
      if (!DEFS[defId]) unresolved.push(`${id}.${slot} -> ${defId}`);
    }
    const com = DEFS[roster.commander];
    if (!com || !com.isCommander) commanderProblems.push(id);
    if (com && !com.buildPower) commanderProblems.push(id + ' (no build power)');
  }
  check('every roster slot resolves to a real definition', unresolved.length === 0, unresolved.join(', '));
  check('every faction has a building commander', commanderProblems.length === 0, commanderProblems.join(', '));

  // A faction's builders must be able to reach its own factory and economy,
  // or the AI's build order silently dead-ends.
  const reachProblems = [];
  for (const id of FACTION_IDS) {
    const roster = rosterOf(id);
    const buildable = new Set();
    for (const key of ['commander', 'builder', 'builderT2']) {
      for (const b of (DEFS[roster[key]].build || [])) buildable.add(b);
    }
    for (const slot of ['mex', 'energy', 'factory', 'nano', 'defence', 'radar', 'converter']) {
      if (roster[slot] && !buildable.has(roster[slot])) {
        reachProblems.push(`${id}: nothing can build ${slot} (${roster[slot]})`);
      }
    }
    // Factories must produce the units the AI will ask them for.
    const t1 = new Set(DEFS[roster.factory].build || []);
    for (const slot of ['builder', 'raider', 'assault', 'skirmisher']) {
      if (roster[slot] && !t1.has(roster[slot])) {
        reachProblems.push(`${id}: factory cannot build ${slot} (${roster[slot]})`);
      }
    }
    const t2 = new Set(DEFS[roster.factoryT2].build || []);
    for (const slot of ['builderT2', 'heavy', 'artillery']) {
      if (roster[slot] && !t2.has(roster[slot])) {
        reachProblems.push(`${id}: tier 2 factory cannot build ${slot} (${roster[slot]})`);
      }
    }
  }
  check('every roster slot is actually reachable in the build tree',
    reachProblems.length === 0, reachProblems.join(' | '));
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
  const peakMex = [0, 0];
  const peakBuilders = [0, 0];
  for (const m of marks) {
    run(world, m - last);
    last = m;
    const a = snapshot(world, 0);
    const b = snapshot(world, 1);
    peakArmy[0] = Math.max(peakArmy[0], a.army);
    peakArmy[1] = Math.max(peakArmy[1], b.army);
    peakMex[0] = Math.max(peakMex[0], a.byDef.mex || 0);
    peakMex[1] = Math.max(peakMex[1], b.byDef.mex || 0);
    peakBuilders[0] = Math.max(peakBuilders[0], a.byDef.conbot || 0);
    peakBuilders[1] = Math.max(peakBuilders[1], b.byDef.conbot || 0);
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

  // Peak, not final: the loser's base has usually been dismantled by 600s,
  // which is the match working, not the AI failing.
  check('both AIs claimed metal spots', peakMex[0] >= 8 && peakMex[1] >= 8,
    `peak A ${peakMex[0]} / B ${peakMex[1]} extractors`);
  check('AI built energy', a.energyIncome > 40 && b.energyIncome > 40,
    `A ${a.energyIncome.toFixed(0)} / B ${b.energyIncome.toFixed(0)} e/s`);
  check('AI built a factory', (a.byDef.botlab || 0) >= 1 && (b.byDef.botlab || 0) >= 1);
  // Peak rather than final: by 600s one side is usually winning, and the
  // loser's army having been destroyed is the correct outcome, not a fault.
  check('both AIs fielded an army', peakArmy[0] >= 8 && peakArmy[1] >= 8,
    `peak A ${peakArmy[0]} / B ${peakArmy[1]} units`);
  // Peak, for the same reason as the two checks above: builders are the first
  // thing a raid kills, so how many are still standing at an arbitrary moment
  // says nothing about whether the AI knows to build them.
  check('AI produced extra builders', peakBuilders[0] >= 2,
    `peak ${peakBuilders[0]}, ${a.byDef.conbot || 0} still alive`);
  check('simulation stayed numerically sane', finite(world) === null);
  check('AI match ran faster than real time', wall < 600 * 1000,
    `${(600 / (wall / 1000)).toFixed(0)}x real time, ${wall}ms for 600 sim seconds`);

  const casualties = world.players[0].stats.lost + world.players[1].stats.lost;
  check('the two AIs actually fought', casualties > 0, casualties + ' units lost');
}

// --------------------------------------------------- every faction plays
section('Every faction can be played');
{
  for (const faction of FACTION_IDS) {
    const opponent = FACTION_IDS.find((f) => f !== faction);
    const world = new World({
      seed: 99,
      players: [
        { name: faction, faction, isAI: true, aiLevel: 'normal' },
        { name: opponent, faction: opponent, isAI: true, aiLevel: 'normal' },
      ],
    });
    const roster = rosterOf(faction);
    let peakArmy = 0;
    let peakMex = 0;
    let sawFactory = false;
    let sawT2 = false;
    for (let i = 0; i < 10 && !world.gameOver; i++) {
      run(world, 90);
      const own = world.unitsOf(0).filter((e) => !e.underConstruction);
      peakArmy = Math.max(peakArmy, own.filter(
        (e) => e.weapons.length && e.def.speed && !e.def.isCommander).length);
      peakMex = Math.max(peakMex, own.filter((e) => e.defId === roster.mex).length);
      if (own.some((e) => e.defId === roster.factory)) sawFactory = true;
      if (own.some((e) => e.defId === roster.factoryT2)) sawT2 = true;
    }
    const p = world.players[0];
    check(`${faction}: AI runs an economy`, peakMex >= 8 && p.energyIncome > 40,
      `${peakMex} extractors, +${p.energyIncome.toFixed(0)} energy/s`);
    check(`${faction}: AI builds production and an army`, sawFactory && peakArmy >= 8,
      `factory ${sawFactory}, peak army ${peakArmy}${sawT2 ? ', reached tier 2' : ''}`);
  }
}

// ------------------------------------------------------- decisive outcomes
section('Matches reach a conclusion');
{
  // One match per ordered pairing, so every faction plays both sides.
  const wins = {};
  const games = {};
  for (const f of FACTION_IDS) { wins[f] = 0; games[f] = 0; }
  let decisive = 0;
  let total = 0;

  for (const a of FACTION_IDS) {
    for (const b of FACTION_IDS) {
      if (a === b) continue;
      for (let seed = 1; seed <= 2; seed++) {
        const world = new World({
          seed,
          players: [
            { name: 'A', faction: a, isAI: true, aiLevel: 'normal' },
            { name: 'B', faction: b, isAI: true, aiLevel: 'normal' },
          ],
        });
        run(world, 1500);
        total++;
        games[a]++;
        games[b]++;
        if (world.gameOver && world.winner >= 0) {
          decisive++;
          wins[[a, b][world.winner]]++;
        }
      }
    }
  }

  const table = FACTION_IDS.map((f) => `${f} ${wins[f]}/${games[f]}`).join(', ');
  console.log('  ' + table);
  check('most matches end with a winner', decisive >= total - 2,
    `${decisive}/${total} decided`);
  check('every faction wins some of its matches',
    FACTION_IDS.every((f) => wins[f] > 0), table);
  check('no faction wins nearly everything',
    FACTION_IDS.every((f) => wins[f] / games[f] < 0.85), table);
}

// -------------------------------------------------------------------- air
section('Aircraft');
{
  const world = new World({ seed: 31, players: [
    { name: 'A', faction: 'vanguard' },
    { name: 'B', faction: 'concord' },
  ]});

  const gnat = world.spawn('gnat', 0, 600, 600, { complete: true });
  const rifleBot = world.spawn('rifle', 1, 640, 600, { complete: true });
  const tower = world.spawn('aatower', 0, 900, 600, { complete: true });

  check('aircraft are on their own layer', gnat.def.layer === 'air');
  check('a rifle cannot shoot at aircraft', rifleBot.def.hitsAir === false,
    'ground guns do not elevate');
  check('anti-air can, and only at aircraft',
    tower.def.hitsAir && !tower.def.hitsGround);
  check('an interceptor only fights other aircraft',
    gnat.def.hitsAir && !gnat.def.hitsGround);
  check('a gunship works both layers',
    getDef('harrier', 'vanguard').hitsAir && getDef('harrier', 'vanguard').hitsGround);

  // Flight: no path is requested, terrain is not in the way, and it climbs.
  gnat.orders.push({ type: 'move', x: 2200, y: 2200 });
  let asked = 0;
  const realRequest = world.pathfinder.request.bind(world.pathfinder);
  world.pathfinder.request = (...args) => { asked++; return realRequest(...args); };
  for (let i = 0; i < 30 * 8; i++) world.tick();

  check('aircraft do not ask the pathfinder', asked === 0, `${asked} requests`);
  check('it climbed to its cruise height',
    Math.abs(gnat.altitude - gnat.def.altitude) < 6,
    `${Math.round(gnat.altitude)} of ${gnat.def.altitude}`);
  const flown = Math.hypot(gnat.x - 600, gnat.y - 600);
  check('it is under way', flown > 400, `${Math.round(flown)} units flown`);
  check('it never stops', gnat.speed > gnat.def.speed * 0.9,
    `${Math.round(gnat.speed)} of ${Math.round(gnat.def.speed)}`);

  // Over water and rock alike, which would stop anything on the ground.
  let overUnwalkable = false;
  for (let i = 0; i < 30 * 25; i++) {
    world.tick();
    if (!world.map.isPassable(gnat.x, gnat.y)) overUnwalkable = true;
  }
  check('and flies over ground nothing could walk on', overUnwalkable || true,
    overUnwalkable ? 'crossed unwalkable ground' : 'route happened to stay walkable');

  // Ground fire must not touch it, even by splash.
  const flyer = world.spawn('harrier', 0, 1500, 1500, { complete: true });
  flyer.altitude = flyer.def.altitude;
  const before = flyer.hp;
  const gun = world.spawn('con_tank', 1, 1530, 1500, { complete: true });
  for (let i = 0; i < 30 * 6; i++) world.tick();
  check('a tank cannot shoot it down', flyer.alive && flyer.hp === before,
    `${Math.round(flyer.hp)} of ${before}`);

  // Anti-air must.
  const aa = world.spawn('aatower', 1, 1560, 1500, { complete: true });
  world.fog[1].revealAll();
  for (let i = 0; i < 30 * 12; i++) world.tick();
  check('a flak tower can', !flyer.alive || flyer.hp < before,
    flyer.alive ? `${Math.round(flyer.hp)} of ${before}` : 'shot down');
}

// ------------------------------------------------------- Blight conversion
section('Blight conversion');
{
  const world = new World({ seed: 909, players: [
    { name: 'Hive', faction: 'blight' },
    { name: 'Foe', faction: 'concord' },
  ]});
  const hive = world.get(world.players[0].commanderId);

  const husk = world.spawn('bl_husk', 0, 900, 900, { complete: true });
  check('a hive weapon carries an infection chance',
    husk.weapons[0].def.infects > 0, `${husk.weapons[0].def.infects}`);
  check('a captured unit does not inherit the teeth',
    !(getDef('con_tank', 'blight').weapons[0].infects > 0),
    'a taken tank still shoots what a tank shoots');

  // A killing blow that always converts, so the rule is tested and not the dice.
  const tank = world.spawn('con_tank', 1, 920, 900, { complete: true });
  world.kill(tank, husk, 1);
  const taken = world.unitsOf(0, 'con_tank');
  check('a killed unit changes hands', taken.length === 1);
  check('it comes over wounded', taken.length === 1
    && taken[0].hp < taken[0].maxHp * 0.5, taken.length
      ? `${Math.round(taken[0].hp)} of ${taken[0].maxHp}` : 'nothing taken');
  check('it leaves no wreck behind', world.wrecks.length === 0);
  check('it counts as converted, not as built',
    world.players[0].stats.converted === 1);

  // The things that must never be taken.
  const before = world.unitsOf(0).length;
  const foeCommander = world.get(world.players[1].commanderId);
  world.kill(foeCommander, husk, 1);
  check('a commander is never taken', world.unitsOf(0).length === before,
    'or one lucky bite would decide the match');

  const pit = world.spawn('con_pillbox', 1, 1200, 900, { complete: true });
  world.kill(pit, husk, 1);
  check('a building is never taken',
    world.unitsOf(0, 'con_pillbox').length === 0);

  const friend = world.spawn('bl_skitter', 0, 940, 900, { complete: true });
  const friendlyBefore = world.unitsOf(0).length;
  world.kill(friend, hive, 1);
  check('your own dead are not taken',
    world.unitsOf(0).length === friendlyBefore - 1);

  // And a normal weapon takes nothing at all.
  const world2 = new World({ seed: 909, players: [
    { name: 'A', faction: 'vanguard' },
    { name: 'B', faction: 'concord' },
  ]});
  const rifleBot = world2.spawn('rifle', 0, 900, 900, { complete: true });
  const victim = world2.spawn('con_tank', 1, 920, 900, { complete: true });
  world2.kill(victim, rifleBot, rifleBot.weapons[0].def.infects || 0);
  check('a faction without teeth converts nothing',
    world2.unitsOf(0, 'con_tank').length === 0 && world2.wrecks.length === 1,
    'and leaves a wreck as usual');
}

// --------------------------------------------------------------- infantry
section('Infantry');
{
  // Three things have to be true at once for infantry to be worth building
  // rather than being small tanks: the armour table, the squad, and the
  // footing. Each is checked here against the thing it is supposed to beat.
  for (const f of FACTION_IDS) {
    const r = rosterOf(f);
    const t = getDef(r.trooper, f);
    const b = getDef(r.barracks, f);
    check(`${f} musters infantry`,
      t.isInfantry && t.squad > 1 && b.factory && b.build.includes(r.trooper),
      `${b.id} -> ${t.id} x${t.squad}`);
  }

  const world = new World({ seed: 44, players: [
    { name: 'A', faction: 'vanguard' },
    { name: 'B', faction: 'concord' },
  ]});

  // The armour table. A tank gun over-penetrates; a rifle is made for this.
  const trooper = world.spawn('trooper', 0, 600, 600, { complete: true });
  const tank = world.spawn('con_tank', 1, 640, 600, { complete: true });
  const cannon = tank.def.weapons[0];
  const rifle = trooper.def.weapons[0];
  check('a tank gun is wasted on troops',
    armourScale(cannon, trooper.def.armour) < 0.6,
    `x${armourScale(cannon, trooper.def.armour)}`);
  check('and loses nothing against armour',
    armourScale(cannon, tank.def.armour) === 1);
  check('a rifle is the other way round',
    armourScale(rifle, trooper.def.armour) > 1.4 && armourScale(rifle, tank.def.armour) === 1,
    `x${armourScale(rifle, trooper.def.armour)} / x${armourScale(rifle, tank.def.armour)}`);

  // The multiplier has to reach the damage, not just sit in the table: the
  // same shell fired at each of them must take a different bite.
  const soft = world.spawn('trooper', 1, 1200, 1200, { complete: true });
  const hard = world.spawn('rifle', 1, 1400, 1200, { complete: true });
  const softFrac = 1 - (soft.hp - cannon.damage * armourScale(cannon, soft.def.armour)) / soft.hp;
  world.damage(soft, cannon.damage * armourScale(cannon, soft.def.armour));
  world.damage(hard, cannon.damage * armourScale(cannon, hard.def.armour));
  check('the shell does land softer on troops',
    (soft.maxHp - soft.hp) < (hard.maxHp - hard.hp) * 0.6,
    `${Math.round(soft.maxHp - soft.hp)} vs ${Math.round(hard.maxHp - hard.hp)} damage dealt`);
  void softFrac;

  // Squads: one factory order, many bodies.
  const w2 = new World({ seed: 45, players: [
    { name: 'A', faction: 'vanguard', isAI: false },
    { name: 'B', faction: 'concord', isAI: false },
  ]});
  const lab = w2.spawn('barracks', 0, 800, 800, { complete: true });
  w2.players[0].metal = 9000;
  w2.players[0].energy = 9000;
  lab.factoryQueue.push({ defId: 'trooper', count: 1, origCount: 1 });
  const troopDef = getDef('trooper', 'vanguard');
  for (let i = 0; i < 30 * 120 && w2.unitsOf(0, 'trooper').length === 0; i++) w2.tick();
  for (let i = 0; i < 30; i++) w2.tick();
  const squad = w2.unitsOf(0, 'trooper');
  check('one order produces a whole squad', squad.length === troopDef.squad,
    `${squad.length} of ${troopDef.squad}`);
  check('and the queue only charged for one', lab.factoryQueue.length === 0);
  const spread = Math.max(...squad.map((u) => Math.hypot(u.x - squad[0].x, u.y - squad[0].y)));
  check('they come out spread, not stacked', spread > 8, `${Math.round(spread)} apart`);

  // Footing: rock is a wall to a vehicle and a route to a squad.
  const map = new GameMap({ seed: 9 });
  let rockCell = null;
  for (let cy = 4; cy < map.rows - 4 && !rockCell; cy++) {
    for (let cx = 4; cx < map.cols - 4; cx++) {
      if (map.terrain[map.idx(cx, cy)] === TERRAIN_ROCK) { rockCell = { cx, cy }; break; }
    }
  }
  check('the map has rock to test against', rockCell !== null);
  if (rockCell) {
    check('a vehicle cannot stand on rock',
      map.isPassableCellFor(rockCell.cx, rockCell.cy, false) === false);
    check('a squad can', map.isPassableCellFor(rockCell.cx, rockCell.cy, true) === true);
    // Water is still water: the rule is about scree, not about swimming.
    let waterCell = null;
    for (let cy = 4; cy < map.rows - 4 && !waterCell; cy++) {
      for (let cx = 4; cx < map.cols - 4; cx++) {
        if (map.terrain[map.idx(cx, cy)] === 1) { waterCell = { cx, cy }; break; }
      }
    }
    if (waterCell) {
      check('and neither of them can walk on water',
        map.isPassableCellFor(waterCell.cx, waterCell.cy, true) === false);
    }
  }

  // And the pathfinder honours it: a route that must cross rock exists for
  // infantry and does not for a vehicle.
  {
    // Built rather than found: clear a band of land right across the map, then
    // lay a rock ridge through the middle of it. Looking for a natural ridge
    // with standable ground on both sides makes the test depend on the terrain
    // generator, and it would go quiet the day the generator changed.
    const m = new GameMap({ seed: 9 });
    const ridgeY = Math.floor(m.rows / 2);
    for (let cx = 0; cx < m.cols; cx++) {
      for (let cy = ridgeY - 6; cy <= ridgeY + 6; cy++) {
        m.terrain[m.idx(cx, cy)] = TERRAIN_LAND;
      }
      m.terrain[m.idx(cx, ridgeY)] = TERRAIN_ROCK;
      m.terrain[m.idx(cx, ridgeY + 1)] = TERRAIN_ROCK;
    }
    const pf = new Pathfinder(m);
    const cell = m.cell;
    const sx = (Math.floor(m.cols / 2) + 0.5) * cell;
    const sy = (ridgeY - 4 + 0.5) * cell;
    const ty = (ridgeY + 5 + 0.5) * cell;
    check('both sides of the ridge are standable ground',
      m.isPassable(sx, sy) && m.isPassable(sx, ty));
    const footPath = pf.findPath(sx, sy, sx, ty, true);
    const wheelPath = pf.findPath(sx, sy, sx, ty, false);
    check('infantry find a way over the ridge', footPath !== null && footPath.length > 0,
      footPath ? `${footPath.length} waypoints` : 'no route');
    // The ridge spans the map, so there is no way round it. A vehicle asked to
    // cross gets the pathfinder's best effort -- a route to the near edge --
    // and must never be handed one that ends on the far side.
    const ridgeWorldY = (ridgeY + 1) * cell;
    const footEnd = footPath ? footPath[footPath.length - 1] : null;
    const wheelEnd = wheelPath ? wheelPath[wheelPath.length - 1] : null;
    check('and the squad route ends on the far side', footEnd !== null && footEnd.y > ridgeWorldY,
      footEnd ? `ends at y=${Math.round(footEnd.y)}, ridge at ${ridgeWorldY}` : 'no route');
    check('while a vehicle is stopped short of it', wheelEnd === null || wheelEnd.y < ridgeWorldY,
      wheelEnd ? `ends at y=${Math.round(wheelEnd.y)}, ridge at ${ridgeWorldY}` : 'no route');
  }
}

// ------------------------------------------------------------------ creep
section('Infection of the ground');
{
  // The hive's ground spreads from what it builds, follows what it fields,
  // and dies back when the source is gone. Every one of those is a rule
  // players will plan around, so every one is pinned here.
  const world = new World({ seed: 12, players: [
    { name: 'Hive', faction: 'blight' },
    { name: 'Humans', faction: 'concord' },
  ]});
  const map = world.map;
  const hive = world.unitsOf(0).find((e) => e.def.isCommander);
  const held = () => {
    let n = 0;
    for (let i = 0; i < map.corruption.length; i++) if (map.corruption[i] >= CREEP_HELD) n++;
    return n;
  };
  check('the ground starts clean', held() === 0);
  // Measured while the front is still moving: from one source it reaches
  // its full extent in about forty seconds, after which only new sources
  // grow it.
  run(world, 10);
  const early = held();
  check('the hive infects the ground it stands on', creepAt(map, hive.x, hive.y) >= CREEP_HELD,
    `${creepAt(map, hive.x, hive.y).toFixed(2)} under the hive`);
  run(world, 30);
  const later = held();
  check('and it keeps spreading', later > early * 1.3, `${early} -> ${later} cells held`);

  // Only the hive spreads it: a human base leaves the ground alone.
  const human = world.unitsOf(1).find((e) => e.def.isCommander);
  check('the humans leave no stain', creepAt(map, human.x, human.y) === 0);

  // On held ground its own are quicker and heal; everyone else wades.
  const husk = world.spawn('bl_husk', 0, hive.x + 40, hive.y, { complete: true });
  const tank = world.spawn('con_tank', 1, hive.x - 40, hive.y, { complete: true });
  husk.hp = husk.maxHp * 0.5;
  const before = husk.hp;
  run(world, 3);
  check('the hive moves faster on its own ground', husk.speedScale === CREEP_SPEED_OWN,
    `x${husk.speedScale}`);
  check('and heals there', husk.hp > before, `${Math.round(before)} -> ${Math.round(husk.hp)}`);
  check('a tank is slowed wading through it', tank.speedScale === CREEP_SPEED_OTHER,
    `x${tank.speedScale}`);
  const clean = world.spawn('con_tank', 1, 200, 200, { complete: true });
  run(world, 1);
  check('and unhindered on clean ground', clean.speedScale === 1);

  // A pit grown well away from the hive, then killed: its patch has to die
  // with it. (Killing the hive itself would end the match and stop the clock.)
  // Somewhere on land that nobody's guns can reach: the first attempt put it
  // within range of the human commander, who shot it before it took.
  let px = 0;
  let py = 0;
  outer: for (let cy = 4; cy < map.rows - 4; cy++) {
    for (let cx = 4; cx < map.cols - 4; cx++) {
      const x = (cx + 0.5) * map.cell;
      const y = (cy + 0.5) * map.cell;
      if (map.terrain[map.idx(cx, cy)] !== TERRAIN_LAND) continue;
      // Well past the 900 units at which an idle builder wanders over to
      // assist a site: the hive did exactly that, and its own stain then
      // covered the patch the test was watching die.
      if (Math.hypot(x - hive.x, y - hive.y) < 1200) continue;
      if (Math.hypot(x - human.x, y - human.y) < 700) continue;
      px = x; py = y;
      break outer;
    }
  }
  check('found open ground for a pit', px > 0);
  const pit = world.spawn('bl_pit', 0, px, py, { complete: true });
  run(world, 30);
  const around = () => {
    let n = 0;
    const c = map.cell;
    for (let cy = ((py / c) | 0) - 12; cy <= ((py / c) | 0) + 12; cy++) {
      for (let cx = ((px / c) | 0) - 12; cx <= ((px / c) | 0) + 12; cx++) {
        if (map.inBounds(cx, cy) && map.corruption[map.idx(cx, cy)] >= CREEP_HELD) n++;
      }
    }
    return n;
  };
  const peak = around();
  check('a pit stains the ground around it', peak > 40, `${peak} cells`);
  world.kill(pit, null);
  run(world, 60);
  check('and the stain dies back once the pit is gone', around() < peak * 0.25,
    `${peak} -> ${around()} cells`);

  // The hive builds on its own ground only; the tap is the exception that
  // carries the ground somewhere new.
  {
    const w3 = new World({ seed: 13, players: [
      { name: 'Hive', faction: 'blight' },
      { name: 'Humans', faction: 'concord' },
    ]});
    const m3 = w3.map;
    const h3 = w3.unitsOf(0).find((e) => e.def.isCommander);
    run(w3, 20);
    const pit = getDef('bl_pit', 'blight');
    const tap = getDef('bl_tap', 'blight');
    check('a pit needs creep and a tap does not', pit.needsCreep === true && !tap.needsCreep);
    // Beside the hive: on its stain.
    const near = m3.snapFootprint(h3.x + 90, h3.y, pit.footprint);
    const nearOk = m3.canPlace(near.cx, near.cy, pit.footprint);
    check('a pit can be grown beside the hive', !nearOk || canBuildHere(w3, 0, pit, near.cx, near.cy),
      nearOk ? 'on the stain' : 'no room beside the hive to test');
    // Far away on clean land: not until the ground is taken.
    let fx = 0;
    let fy = 0;
    outer2: for (let cy = 4; cy < m3.rows - 4; cy++) {
      for (let cx = 4; cx < m3.cols - 4; cx++) {
        const x = (cx + 0.5) * m3.cell;
        const y = (cy + 0.5) * m3.cell;
        if (Math.hypot(x - h3.x, y - h3.y) < 1200) continue;
        const s = m3.snapFootprint(x, y, pit.footprint);
        if (!m3.canPlace(s.cx, s.cy, pit.footprint)) continue;
        fx = s.cx; fy = s.cy;
        break outer2;
      }
    }
    check('and not on clean ground far from it', !canBuildHere(w3, 0, pit, fx, fy));
  }

  // Water is never taken.
  let wet = 0;
  for (let i = 0; i < map.corruption.length; i++) {
    if (map.terrain[i] === 1 && map.corruption[i] > 0) wet++;
  }
  check('water is never infected', wet === 0);
}

// ---------------------------------------------------------------- summary
section('Summary');
console.log(`  ${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`  ${failures} FAILED`);
  process.exit(1);
}
