// Build a single self-contained HTML file.
//
//   node tools/build.mjs
//
// Produces:
//   dist/iron-dominion.html  - standalone page, open it directly in a browser
//   dist/artifact.html       - the same page as an Artifact-ready fragment
//
// Everything (Three.js included) is inlined, so the result needs no server,
// no network and no install to play.

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

function section(html, tag) {
  const open = html.indexOf('<' + tag);
  if (open === -1) return '';
  const start = html.indexOf('>', open) + 1;
  const end = html.indexOf('</' + tag + '>', start);
  return html.slice(start, end);
}

const result = await build({
  entryPoints: [join(ROOT, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
});
const js = result.outputFiles[0].text;

const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const css = section(html, 'style');
const body = section(html, 'body')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();

await mkdir(DIST, { recursive: true });

const links = (html.match(/<link[^>]*rel="(?:stylesheet|preconnect)"[^>]*>/g) || []).join('\n');

const head = `<title>Iron Dominion</title>
${links}
<meta name="description" content="A real-time strategy game in the Beyond All Reason tradition: dual metal and energy economy, nanolathe construction, reclaim, tech tiers and large-scale 3D combat.">
<style>${css}</style>`;

const page = `${head}
${body}
<script>${js}</script>`;

await writeFile(join(DIST, 'artifact.html'), page);

await writeFile(join(DIST, 'iron-dominion.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
${head}
</head>
<body style="margin:0">
${body}
<script>${js}</script>
</body>
</html>`);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log('dist/iron-dominion.html  ' + kb(page) + '  (standalone, open in any browser)');
console.log('dist/artifact.html       ' + kb(page) + '  (Artifact fragment)');
console.log('  bundled script         ' + kb(js));
