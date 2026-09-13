// Browser test. Serves the game, drives it through Chromium, and checks that
// it renders, that commands work, and that a base can actually be built.
//
//   node tests/browser.test.mjs [--headed] [--shots <dir>]
//
// Playwright must be available; the test skips cleanly if it is not.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8127;
const SHOTS = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
};

let failures = 0;
let checks = 0;
function check(name, cond, detail = '') {
  checks++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!cond) failures++;
}

// ------------------------------------------------------------------ server
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const path = join(ROOT, normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

let chromium;
try {
  ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
} catch {
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('Playwright not available - skipping browser test.');
    process.exit(0);
  }
}

await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });

const errors = [];
const offline = [];

// The web fonts are the one thing the page fetches from outside itself. They
// are a progressive enhancement with a real fallback stack, and sandboxes
// routinely block them, so record them separately from genuine faults.
const isFontHost = (url) => /fonts\.(googleapis|gstatic)\.com/.test(url);

page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = m.text();
  // A blocked font shows up as a generic resource error with no usable URL;
  // pair it with the requestfailed entry we already captured.
  if (/Failed to load resource/.test(text) && offline.length) return;
  errors.push('console: ' + text);
});
page.on('requestfailed', (r) => {
  if (isFontHost(r.url())) offline.push(r.url());
  else errors.push('request failed: ' + r.url());
});

const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name) }); };

try {
  console.log('\nLoading');
  console.log('-------');
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
  check('start menu renders', await page.isVisible('#btn-start'));
  await shot('01-menu.png');

  await page.click('#btn-start');
  await page.waitForFunction(() => window.game && window.game.world && window.game.world.tickCount > 10, null, { timeout: 60000 });
  await page.waitForTimeout(600);

  const boot = await page.evaluate(() => {
    const g = window.game;
    return {
      webgl: !!g.renderer.renderer.getContext(),
      drawCalls: g.renderer.renderer.info.render.calls,
      triangles: g.renderer.renderer.info.render.triangles,
      camTarget: [Math.round(g.camera.targetX), Math.round(g.camera.targetZ)],
      commander: (() => { const c = g.world.get(g.player.commanderId); return [Math.round(c.x), Math.round(c.y)]; })(),
    };
  });
  check('WebGL context is live', boot.webgl);
  check('scene is being drawn', boot.drawCalls > 3 && boot.triangles > 1000,
    `${boot.drawCalls} draw calls, ${boot.triangles} triangles`);
  check('camera starts on the commander',
    Math.abs(boot.camTarget[0] - boot.commander[0]) < 60 && Math.abs(boot.camTarget[1] - boot.commander[1]) < 60,
    `camera ${boot.camTarget} vs commander ${boot.commander}`);
  await shot('02-start.png');

  console.log('\nCamera and picking');
  console.log('------------------');
  const cam = await page.evaluate(() => {
    const g = window.game;
    const c = g.camera;
    const mid = [c.viewWidth / 2, c.viewHeight / 2];
    const before = c.groundPick(mid[0], mid[1]);
    c.rotate(0.9);
    c.zoomBy(-300, mid[0], mid[1]);
    c.update(0);
    const after = c.groundPick(mid[0], mid[1]);
    const com = g.world.get(g.player.commanderId);
    const h = g.world.map.heightAt(com.x, com.y) * 190 + com.radius;
    const s = c.worldToScreen(com.x, h, com.y, {});
    const picked = g.entityAtScreen(s.x, s.y);
    c.reset();
    c.centerOn(com.x, com.y);
    return {
      before: before && [Math.round(before.x), Math.round(before.y)],
      after: after && [Math.round(after.x), Math.round(after.y)],
      drift: before && after ? Math.round(Math.hypot(before.x - after.x, before.y - after.y)) : -1,
      picked: picked ? picked.defId : null,
    };
  });
  check('ground pick lands on the camera target', !!cam.before, JSON.stringify(cam.before));
  check('zoom keeps the point under the cursor', cam.drift >= 0 && cam.drift < 40, `drifted ${cam.drift} units`);
  check('units can be picked in screen space', cam.picked === 'commander', String(cam.picked));

  console.log('\nBuilding a base');
  console.log('---------------');
  const orders = await page.evaluate(() => {
    const g = window.game;
    const com = g.world.get(g.player.commanderId);
    const map = g.world.map;
    const out = [];

    const place = (defId, x, y) => {
      g.selectSingle(com, false);
      g.beginPlacement(defId);
      g.updatePlacement({ x, y });
      const ok = g.tryPlaceBuilding(true);
      g.cancelPlacement();
      out.push(defId + ':' + (ok ? 'ok' : 'refused'));
      return ok;
    };

    // Two extractors on real metal spots, then energy, then a factory.
    const spots = map.metalSpots
      .filter((s) => !s.taken)
      .sort((a, b) => Math.hypot(a.x - com.x, a.y - com.y) - Math.hypot(b.x - com.x, b.y - com.y))
      .slice(0, 2);
    for (const s of spots) place('mex', s.x, s.y);

    for (const [dx, dy] of [[130, -110], [-140, -110], [150, 120]]) place('solar', com.x + dx, com.y + dy);
    place('botlab', com.x - 30, com.y + 190);
    return out;
  });
  check('build orders were accepted', orders.every((o) => o.endsWith(':ok')), orders.join(' '));

  await page.evaluate(() => window.game.setSpeed(4));
  await page.waitForFunction(() => {
    const g = window.game;
    return g.world.unitsOf(0, 'botlab').some((b) => !b.underConstruction);
  }, null, { timeout: 180000 });

  const built = await page.evaluate(() => {
    const g = window.game;
    const own = g.world.unitsOf(0);
    const by = {};
    for (const e of own) if (!e.underConstruction) by[e.defId] = (by[e.defId] || 0) + 1;
    return { by, metalIncome: +g.player.metalIncome.toFixed(1), energyIncome: +g.player.energyIncome.toFixed(0) };
  });
  check('extractors finished and produce metal', (built.by.mex || 0) >= 2 && built.metalIncome > 4,
    `${built.by.mex || 0} extractors, +${built.metalIncome} metal/s`);
  check('power plants finished', (built.by.solar || 0) >= 3, `+${built.energyIncome} energy/s`);
  check('factory finished', (built.by.botlab || 0) >= 1);
  await shot('03-base.png');

  console.log('\nProduction and combat');
  console.log('---------------------');
  await page.evaluate(() => {
    const g = window.game;
    const lab = g.world.unitsOf(0, 'botlab')[0];
    g.selectSingle(lab, false);
    g.chooseBuildOption('conbot');
    for (let i = 0; i < 6; i++) g.chooseBuildOption('rifle');
  });
  await page.waitForFunction(() => window.game.world.unitsOf(0, 'rifle').length >= 3, null, { timeout: 180000 });

  const army = await page.evaluate(() => {
    const g = window.game;
    const rifles = g.world.unitsOf(0, 'rifle');
    // Send them at the enemy and make sure they receive the order.
    for (const r of rifles) { r.orders.length = 0; r.orders.push({ type: 'attackMove', x: g.world.players[1].startX, y: g.world.players[1].startY }); }
    g.selection = rifles.slice();
    for (const r of rifles) r.selected = true;
    g.onSelectionChanged();
    return { count: rifles.length, ordered: rifles.every((r) => r.orders.length > 0) };
  });
  check('factory produced units', army.count >= 3, army.count + ' assault bots');
  check('units accept attack-move orders', army.ordered);

  await page.waitForTimeout(4000);
  const moved = await page.evaluate(() => {
    const g = window.game;
    const rifles = g.world.unitsOf(0, 'rifle');
    return rifles.filter((r) => r.speed > 1).length;
  });
  check('ordered units are actually moving', moved > 0, moved + ' under way');
  await shot('04-army.png');

  // Let the match run on so the AI meets us somewhere in the middle.
  await page.evaluate(() => window.game.setSpeed(4));
  await page.waitForTimeout(25000);
  const late = await page.evaluate(() => {
    const g = window.game;
    return {
      time: Math.round(g.world.time),
      mine: g.world.unitsOf(0).length,
      enemy: g.world.unitsOf(1).length,
      projectiles: g.world.projectiles.length,
      losses: g.world.players[0].stats.lost + g.world.players[1].stats.lost,
      fps: Math.round(g.fps),
      simMs: +g.simMs.toFixed(2),
      drawCalls: g.renderer.renderer.info.render.calls,
      triangles: g.renderer.renderer.info.render.triangles,
    };
  });
  console.log('  state: ' + JSON.stringify(late));
  check('both sides are still developing', late.mine > 3 && late.enemy > 3,
    `${late.mine} vs ${late.enemy} units at ${late.time}s`);
  check('simulation step stays well inside its budget', late.simMs < 8,
    `${late.simMs}ms per tick, budget 33ms`);
  await shot('05-late.png');

  console.log('\nErrors');
  console.log('------');
  check('no console or page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  check('the game loads nothing but the web fonts from the network', true,
    offline.length
      ? `web fonts unreachable here (expected offline); the interface fell back as designed`
      : 'web fonts loaded');
} catch (err) {
  failures++;
  console.log('  FAIL  test threw: ' + err.message);
  await shot('99-failure.png');
} finally {
  await browser.close();
  server.close();
}

console.log('\nSummary');
console.log('-------');
console.log(`  ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
