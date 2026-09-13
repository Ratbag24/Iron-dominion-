// Procedural 3D models.
//
// Each model is built from coloured primitives facing +X and merged into one
// geometry. A model may declare a turret (tracks its target) and a spinner
// (rotates continuously: drill heads, turbine blades, radar dishes).

import { box, cylinder, cone, sphere, plate, merge } from './geometry.js';

const HULL = '#8b929c';
const HULL_DARK = '#4e545d';
const HULL_LIGHT = '#c3c9d2';
const DARK = '#2c3036';
const GLASS = '#16324d';
const GLOW = '#8ef6ff';

/** Vanguard reads angular and light; Legion reads blocky and heavy. */
function heavyBuild(faction) {
  return faction === 'legion';
}

// ------------------------------------------------------------------- units

function commander(r, c, faction) {
  const parts = [];
  const wide = heavyBuild(faction);
  parts.push(box(r * 0.34, r * 1.0, r * 0.34, HULL_DARK, { x: -r * 0.15, y: r * 0.5, z: -r * 0.55 }));
  parts.push(box(r * 0.34, r * 1.0, r * 0.34, HULL_DARK, { x: -r * 0.15, y: r * 0.5, z: r * 0.55 }));
  parts.push(box(r * 1.5, r * 0.95, r * (wide ? 1.6 : 1.35), c.primary, { y: r * 1.5 }));
  parts.push(box(r * 0.8, r * 0.5, r * 1.95, HULL, { x: r * 0.1, y: r * 1.95 }));
  parts.push(box(r * 0.55, r * 0.55, r * 0.55, HULL_LIGHT, { x: r * 0.35, y: r * 2.3 }));
  parts.push(sphere(r * 0.3, GLOW, { x: r * 0.45, y: r * 1.6 }));
  parts.push(cone(r * 0.45, r * 0.5, c.light, { x: r * 0.7, y: r * 2.35, rz: -Math.PI / 2 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.25, r * 0.34, r * 0.34, HULL_LIGHT, { x: r * 0.75 }),
      box(r * 0.5, r * 0.5, r * 0.72, c.dark, {}),
    ]),
    turretY: r * 1.55,
  };
}

function conbot(r, c) {
  const parts = [];
  parts.push(box(r * 0.3, r * 0.8, r * 0.3, HULL_DARK, { x: -r * 0.1, y: r * 0.4, z: -r * 0.45 }));
  parts.push(box(r * 0.3, r * 0.8, r * 0.3, HULL_DARK, { x: -r * 0.1, y: r * 0.4, z: r * 0.45 }));
  parts.push(box(r * 1.3, r * 0.85, r * 1.1, c.primary, { y: r * 1.2 }));
  parts.push(box(r * 0.9, r * 0.3, r * 0.3, HULL_LIGHT, { x: r * 0.95, y: r * 1.3 }));
  parts.push(sphere(r * 0.24, GLOW, { x: r * 1.45, y: r * 1.3 }));
  parts.push(box(r * 0.5, r * 0.35, r * 0.8, HULL, { x: -r * 0.5, y: r * 1.75 }));
  return { body: merge(parts), turret: null };
}

function scout(r, c) {
  const parts = [];
  parts.push(box(r * 0.26, r * 0.7, r * 0.26, HULL_DARK, { y: r * 0.35, z: -r * 0.5 }));
  parts.push(box(r * 0.26, r * 0.7, r * 0.26, HULL_DARK, { y: r * 0.35, z: r * 0.5 }));
  parts.push(cone(r * 0.8, r * 1.7, c.primary, { x: r * 0.1, y: r * 1.1, rz: -Math.PI / 2 }, 6));
  parts.push(sphere(r * 0.26, GLASS, { x: r * 0.5, y: r * 1.25 }));
  return {
    body: merge(parts),
    turret: merge([box(r * 0.8, r * 0.2, r * 0.2, HULL_LIGHT, { x: r * 0.5 })]),
    turretY: r * 1.15,
  };
}

function rifle(r, c, faction) {
  const parts = [];
  const wide = heavyBuild(faction);
  parts.push(box(r * 0.3, r * 0.85, r * 0.3, HULL_DARK, { x: -r * 0.05, y: r * 0.42, z: -r * 0.48 }));
  parts.push(box(r * 0.3, r * 0.85, r * 0.3, HULL_DARK, { x: -r * 0.05, y: r * 0.42, z: r * 0.48 }));
  parts.push(box(r * 1.25, r * 0.9, r * (wide ? 1.3 : 1.05), c.primary, { y: r * 1.25 }));
  if (!wide) parts.push(cone(r * 0.55, r * 0.6, c.light, { x: r * 0.75, y: r * 1.35, rz: -Math.PI / 2 }, 6));
  else parts.push(box(r * 0.35, r * 0.6, r * 1.2, c.dark, { x: r * 0.6, y: r * 1.35 }));
  parts.push(box(r * 0.4, r * 0.36, r * 0.4, HULL, { x: -r * 0.4, y: r * 1.85 }));
  return {
    body: merge(parts),
    turret: merge([box(r * 1.0, r * 0.22, r * 0.22, HULL_LIGHT, { x: r * 0.6 })]),
    turretY: r * 1.35,
  };
}

function rocket(r, c) {
  const parts = [];
  parts.push(box(r * 0.3, r * 0.85, r * 0.3, HULL_DARK, { y: r * 0.42, z: -r * 0.48 }));
  parts.push(box(r * 0.3, r * 0.85, r * 0.3, HULL_DARK, { y: r * 0.42, z: r * 0.48 }));
  parts.push(box(r * 1.15, r * 0.85, r * 1.05, c.primary, { y: r * 1.2 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.9, r * 0.5, r * 0.42, HULL, { x: r * 0.1, z: -r * 0.45 }),
      box(r * 0.9, r * 0.5, r * 0.42, HULL, { x: r * 0.1, z: r * 0.45 }),
      cone(r * 0.16, r * 0.34, '#ff9a5b', { x: r * 0.62, z: -r * 0.45, rz: -Math.PI / 2 }, 5),
      cone(r * 0.16, r * 0.34, '#ff9a5b', { x: r * 0.62, z: r * 0.45, rz: -Math.PI / 2 }, 5),
    ]),
    turretY: r * 1.75,
  };
}

function heavy(r, c) {
  const parts = [];
  parts.push(box(r * 0.42, r * 0.9, r * 0.42, HULL_DARK, { y: r * 0.45, z: -r * 0.62 }));
  parts.push(box(r * 0.42, r * 0.9, r * 0.42, HULL_DARK, { y: r * 0.45, z: r * 0.62 }));
  parts.push(box(r * 1.6, r * 1.0, r * 1.7, c.primary, { y: r * 1.35 }));
  parts.push(box(r * 1.1, r * 0.45, r * 1.95, HULL, { x: -r * 0.1, y: r * 1.95 }));
  parts.push(sphere(r * 0.28, GLOW, { x: r * 0.6, y: r * 1.45 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.2, r * 0.28, r * 0.28, HULL_LIGHT, { x: r * 0.75, z: -r * 0.4 }),
      box(r * 1.2, r * 0.28, r * 0.28, HULL_LIGHT, { x: r * 0.75, z: r * 0.4 }),
      box(r * 0.55, r * 0.5, r * 1.15, c.dark, {}),
    ]),
    turretY: r * 1.95,
  };
}

function siege(r, c) {
  const parts = [];
  parts.push(box(r * 0.36, r * 0.8, r * 0.36, HULL_DARK, { y: r * 0.4, z: -r * 0.55 }));
  parts.push(box(r * 0.36, r * 0.8, r * 0.36, HULL_DARK, { y: r * 0.4, z: r * 0.55 }));
  parts.push(box(r * 1.35, r * 0.8, r * 1.25, c.primary, { y: r * 1.15 }));
  parts.push(box(r * 0.5, r * 0.4, r * 1.45, HULL_DARK, { x: -r * 0.45, y: r * 1.5 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 2.1, r * 0.3, r * 0.3, HULL_LIGHT, { x: r * 1.0 }),
      cylinder(r * 0.22, r * 0.22, r * 0.4, HULL, { x: r * 2.0, rz: Math.PI / 2 }, 8),
      box(r * 0.6, r * 0.55, r * 0.85, c.dark, {}),
    ]),
    turretY: r * 1.6,
  };
}

// -------------------------------------------------------------- structures

function foundation(s, c, h = 2.5) {
  return [
    box(s, h, s, '#3b4048', { y: h * 0.5 }),
    box(s * 0.9, h * 0.6, s * 0.9, '#4b515b', { y: h * 1.1 }),
    box(s * 0.14, h * 2.2, s * 0.14, c.primary, { x: s * 0.42, y: h * 1.1, z: s * 0.42 }),
    box(s * 0.14, h * 2.2, s * 0.14, c.primary, { x: -s * 0.42, y: h * 1.1, z: s * 0.42 }),
    box(s * 0.14, h * 2.2, s * 0.14, c.primary, { x: s * 0.42, y: h * 1.1, z: -s * 0.42 }),
    box(s * 0.14, h * 2.2, s * 0.14, c.primary, { x: -s * 0.42, y: h * 1.1, z: -s * 0.42 }),
  ];
}

function mex(s, c) {
  const parts = foundation(s, c);
  parts.push(cylinder(s * 0.3, s * 0.36, s * 0.5, HULL, { y: s * 0.3 }, 10));
  parts.push(cylinder(s * 0.16, s * 0.16, s * 0.62, HULL_DARK, { y: s * 0.66 }, 8));
  return {
    body: merge(parts),
    spinner: merge([
      box(s * 0.62, s * 0.1, s * 0.13, c.light, { x: s * 0.2 }),
      box(s * 0.13, s * 0.1, s * 0.62, c.light, { z: s * 0.2 }),
      cylinder(s * 0.1, s * 0.1, s * 0.2, GLOW, {}, 6),
    ]),
    spinnerAxis: 'y',
    spinnerY: s * 0.95,
    spinSpeed: 1.7,
  };
}

function solar(s, c) {
  const parts = foundation(s, c, 2);
  parts.push(box(s * 0.16, s * 0.42, s * 0.16, HULL, { y: s * 0.24 }));
  parts.push(box(s * 0.92, s * 0.05, s * 0.92, GLASS, { y: s * 0.5, rz: 0.22 }));
  parts.push(box(s * 0.92, s * 0.02, s * 0.08, c.primary, { y: s * 0.54, rz: 0.22 }));
  return { body: merge(parts) };
}

function wind(s, c) {
  const parts = foundation(s, c, 2);
  parts.push(cylinder(s * 0.1, s * 0.16, s * 1.35, HULL, { y: s * 0.7 }, 8));
  parts.push(box(s * 0.36, s * 0.22, s * 0.22, HULL_LIGHT, { x: s * 0.1, y: s * 1.4 }));
  return {
    body: merge(parts),
    spinner: merge([
      box(s * 0.06, s * 0.95, s * 0.12, c.light, { y: s * 0.42 }),
      box(s * 0.06, s * 0.95, s * 0.12, c.light, { y: -s * 0.21, z: s * 0.36, rx: 2.094 }),
      box(s * 0.06, s * 0.95, s * 0.12, c.light, { y: -s * 0.21, z: -s * 0.36, rx: -2.094 }),
    ]),
    spinnerAxis: 'x',
    spinnerY: s * 1.4,
    spinnerX: s * 0.3,
    spinSpeed: 3.2,
  };
}

function converter(s, c) {
  const parts = foundation(s, c);
  parts.push(cylinder(s * 0.3, s * 0.3, s * 0.7, HULL, { y: s * 0.45 }, 10));
  parts.push(cylinder(s * 0.33, s * 0.33, s * 0.1, '#ffd76a', { y: s * 0.62 }, 10));
  parts.push(box(s * 0.12, s * 0.12, s * 0.8, HULL_DARK, { x: s * 0.36, y: s * 0.3 }));
  parts.push(box(s * 0.12, s * 0.12, s * 0.8, HULL_DARK, { x: -s * 0.36, y: s * 0.3 }));
  return { body: merge(parts) };
}

function storage(s, c, metalKind) {
  const parts = foundation(s, c);
  const tint = metalKind ? '#9aa3ad' : '#d8b24a';
  parts.push(cylinder(s * 0.34, s * 0.34, s * 0.75, tint, { y: s * 0.5 }, 12));
  parts.push(cylinder(s * 0.37, s * 0.37, s * 0.08, HULL_DARK, { y: s * 0.5 }, 12));
  parts.push(cylinder(s * 0.3, s * 0.3, s * 0.06, c.primary, { y: s * 0.89 }, 12));
  return { body: merge(parts) };
}

function lab(s, c, advanced) {
  const h = advanced ? 3.0 : 2.6;
  const parts = foundation(s, c, h);

  // An open-fronted hangar: side walls, a back wall and a roof that stops
  // short of the mouth, so finished units are visible driving out on +Z.
  const wallH = s * (advanced ? 0.44 : 0.38);
  const wallT = s * 0.12;
  parts.push(box(wallT, wallH, s * 0.84, c.primary, { x: s * 0.38, y: wallH * 0.5 + h }));
  parts.push(box(wallT, wallH, s * 0.84, c.primary, { x: -s * 0.38, y: wallH * 0.5 + h }));
  parts.push(box(s * 0.88, wallH, wallT, c.primary, { z: -s * 0.38, y: wallH * 0.5 + h }));

  // Roof: two slabs with a service gap down the middle.
  parts.push(box(s * 0.88, s * 0.07, s * 0.3, HULL_DARK, { z: -s * 0.27, y: wallH + h }));
  parts.push(box(s * 0.88, s * 0.07, s * 0.16, HULL_DARK, { z: s * 0.1, y: wallH + h }));

  // Gantry arch over the hangar mouth.
  parts.push(box(s * 0.1, wallH * 0.95, s * 0.1, HULL, { x: s * 0.38, z: s * 0.36, y: wallH * 0.5 + h }));
  parts.push(box(s * 0.1, wallH * 0.95, s * 0.1, HULL, { x: -s * 0.38, z: s * 0.36, y: wallH * 0.5 + h }));
  parts.push(box(s * 0.86, s * 0.1, s * 0.12, HULL_LIGHT, { z: s * 0.36, y: wallH + h }));

  // Interior floor plate and the lathe head that assembles units.
  parts.push(box(s * 0.66, s * 0.05, s * 0.72, '#23272d', { y: h + s * 0.02, z: -s * 0.02 }));
  parts.push(box(s * 0.18, s * 0.14, s * 0.18, HULL_LIGHT, { y: wallH * 0.72 + h, z: -s * 0.05 }));
  parts.push(sphere(s * 0.07, GLOW, { y: wallH * 0.6 + h, z: -s * 0.05 }));

  if (advanced) {
    parts.push(cylinder(s * 0.09, s * 0.13, s * 0.6, HULL_LIGHT, { x: s * 0.3, z: -s * 0.3, y: wallH + h + s * 0.3 }, 8));
    parts.push(cylinder(s * 0.09, s * 0.13, s * 0.6, HULL_LIGHT, { x: -s * 0.3, z: -s * 0.3, y: wallH + h + s * 0.3 }, 8));
    parts.push(box(s * 0.5, s * 0.08, s * 0.5, c.light, { y: wallH + h + s * 0.1 }));
    parts.push(sphere(s * 0.1, GLOW, { y: wallH + h + s * 0.62, z: -s * 0.3 }));
  }
  return { body: merge(parts) };
}

function nano(s, c) {
  const parts = foundation(s, c, 2);
  parts.push(cylinder(s * 0.14, s * 0.22, s * 0.95, HULL, { y: s * 0.5 }, 8));
  return {
    body: merge(parts),
    turret: merge([
      box(s * 0.62, s * 0.2, s * 0.2, HULL_LIGHT, { x: s * 0.3 }),
      sphere(s * 0.14, GLOW, { x: s * 0.62 }),
    ]),
    turretY: s * 1.0,
  };
}

function turret(s, c, big) {
  const parts = foundation(s, c, big ? 2.6 : 2.2);
  parts.push(cylinder(s * (big ? 0.36 : 0.3), s * (big ? 0.4 : 0.34), s * 0.34, c.primary, { y: s * 0.3 }, 10));
  return {
    body: merge(parts),
    turret: merge([
      box(s * 0.5, s * 0.36, s * 0.62, HULL, {}),
      box(s * (big ? 0.95 : 0.8), s * (big ? 0.24 : 0.17), s * (big ? 0.24 : 0.17), HULL_LIGHT, { x: s * (big ? 0.6 : 0.5) }),
      ...(big ? [box(s * 0.16, s * 0.3, s * 0.3, HULL, { x: s * 1.02 })] : []),
    ]),
    turretY: s * 0.5,
  };
}

function radar(s, c) {
  const parts = foundation(s, c, 2);
  parts.push(cylinder(s * 0.1, s * 0.16, s * 0.85, HULL, { y: s * 0.45 }, 8));
  return {
    body: merge(parts),
    spinner: merge([
      cone(s * 0.42, s * 0.26, c.primary, { rx: Math.PI / 2, z: s * 0.1 }, 12),
      box(s * 0.06, s * 0.06, s * 0.3, HULL_LIGHT, { z: -s * 0.1 }),
    ]),
    spinnerAxis: 'y',
    spinnerY: s * 0.95,
    spinSpeed: 1.1,
  };
}

// ---------------------------------------------------------------- dispatch

const BUILDERS = {
  commander: (d, c) => commander(d.radius, c, d.faction),
  conbot: (d, c) => conbot(d.radius, c),
  adv_conbot: (d, c) => conbot(d.radius, c),
  scout: (d, c) => scout(d.radius, c),
  rifle: (d, c) => rifle(d.radius, c, d.faction),
  rocket: (d, c) => rocket(d.radius, c),
  heavy: (d, c) => heavy(d.radius, c),
  siege: (d, c) => siege(d.radius, c),
  mex: (d, c) => mex(d.footprintPx, c),
  solar: (d, c) => solar(d.footprintPx, c),
  wind: (d, c) => wind(d.footprintPx, c),
  converter: (d, c) => converter(d.footprintPx, c),
  mstore: (d, c) => storage(d.footprintPx, c, true),
  estore: (d, c) => storage(d.footprintPx, c, false),
  botlab: (d, c) => lab(d.footprintPx, c, false),
  advbotlab: (d, c) => lab(d.footprintPx, c, true),
  nano: (d, c) => nano(d.footprintPx, c),
  llt: (d, c) => turret(d.footprintPx, c, false),
  hlt: (d, c) => turret(d.footprintPx, c, true),
  radar: (d, c) => radar(d.footprintPx, c),
};

const cache = new Map();

/** Build (and cache) the model for a definition rendered in a player colour. */
export function modelFor(def, colors) {
  const key = def.id + '|' + def.faction + '|' + colors.primary;
  let m = cache.get(key);
  if (m) return m;

  const build = BUILDERS[def.id];
  m = build ? build(def, colors) : { body: box(def.radius * 1.6, def.radius * 1.6, def.radius * 1.6, colors.primary, { y: def.radius * 0.8 }) };
  m.turretY = m.turretY || 0;
  m.spinnerY = m.spinnerY || 0;
  m.spinnerX = m.spinnerX || 0;
  m.spinSpeed = m.spinSpeed || 0;
  m.spinnerAxis = m.spinnerAxis || 'y';
  cache.set(key, m);
  return m;
}

export function clearModelCache() {
  cache.clear();
}
