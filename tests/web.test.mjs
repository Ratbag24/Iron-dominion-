// Web export test. Serves the exported browser build from a plain HTTP server
// and drives it through Chromium.
//
//   GODOT=/path/to/godot tools/godot-export.sh web
//   node tests/web.test.mjs [--shots <dir>]
//
// The server is deliberately plain: no Cross-Origin-Opener-Policy, no
// Cross-Origin-Embedder-Policy, so the page is not cross-origin isolated and
// SharedArrayBuffer is unavailable. That is exactly what GitHub Pages serves,
// and it is the condition the export has to work under.
//
// Playwright must be available; the test skips cleanly if it is not.

import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'web');
const PORT = 8124;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
};

let shotDir = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--shots') shotDir = process.argv[i + 1];
}

let failures = 0;
function check(ok, label, detail = '') {
  const suffix = detail ? `  (${detail})` : '';
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${suffix}`);
  if (!ok) failures++;
}

async function findChromium(chromium) {
  // The pinned browser first; a preinstalled one otherwise, since the two can
  // drift apart and either will do for this.
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter(Boolean);
  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {}
  }
  return undefined;
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('Playwright is not installed; skipping the web export test.');
  process.exit(0);
}

try {
  await access(join(ROOT, 'index.wasm'));
} catch {
  console.log(`No web export at ${ROOT}; skipping.`);
  console.log('Build one with: GODOT=/path/to/godot tools/godot-export.sh web');
  process.exit(0);
}

const server = createServer(async (req, res) => {
  const name = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const body = await readFile(join(ROOT, name));
    res.writeHead(200, { 'Content-Type': TYPES[extname(name)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch({
  executablePath: await findChromium(chromium),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const logs = [];
page.on('console', (m) => {
  const text = m.text();
  logs.push(text);
  if (m.type() === 'error') errors.push(text);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

/** How much of the frame is lit. The menu is nearly black; a match is not. */
const litFraction = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 0;
    const small = document.createElement('canvas');
    small.width = 160;
    small.height = 90;
    const ctx = small.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 160, 90);
    const data = ctx.getImageData(0, 0, 160, 90).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 150) lit++;
    }
    return lit / (data.length / 4);
  });

const shot = async (name) => {
  if (shotDir) await page.screenshot({ path: join(shotDir, `web-${name}.png`) });
};

console.log('\nServing without cross-origin isolation');
console.log('-------------------------------------');
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
check(
  !(await page.evaluate(() => crossOriginIsolated)),
  'the page is not cross-origin isolated',
  'the condition GitHub Pages serves under'
);
check(
  await page.evaluate(() => typeof SharedArrayBuffer === 'undefined'),
  'SharedArrayBuffer is unavailable'
);

console.log('\nStarting up');
console.log('-----------');
let canvas = null;
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(2000);
  canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    return { w: c.width, h: c.height, gl: !!(c.getContext('webgl2') || c.getContext('webgl')) };
  });
  if (canvas && canvas.w > 0 && canvas.gl) break;
}
check(!!canvas && canvas.w > 0 && canvas.gl, 'the engine starts and takes a GL context',
  canvas ? `${canvas.w}x${canvas.h}` : 'no canvas');
await shot('menu');

console.log('\nPlaying a match');
console.log('---------------');
// START MATCH sits at the middle-bottom of the menu.
await page.mouse.click(640, 607);

let started = false;
let waited = 0;
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(3000);
  waited += 3;
  if ((await litFraction()) > 0.5) {
    started = true;
    break;
  }
}
check(started, 'the match renders after START MATCH', `${waited}s`);
check(
  logs.some((l) => l.includes('match ready')),
  'the world was built',
  logs.find((l) => l.includes('world generated')) || 'no generation log'
);
await shot('match');

console.log('\nErrors');
console.log('------');
check(errors.length === 0, 'no console or page errors', errors.slice(0, 3).join(' | '));

console.log('\nSummary');
console.log('-------');
console.log(`  ${failures === 0 ? 'all checks passed' : `${failures} checks failed`}`);

await browser.close();
server.close();
process.exit(failures === 0 ? 0 : 1);
