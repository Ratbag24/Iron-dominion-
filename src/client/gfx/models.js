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


// ----------------------------------------------------------------- concord
// Crewed machines: tracks, sloped plate, boxy superstructure. Deliberately
// heavier and flatter than the bot silhouettes so the two read apart at a
// glance from directly above.

const TRACK = '#31353b';

/** Two track units either side of a hull, facing +X. */
function tracks(len, width, height, gauge) {
  return [
    box(len, height, width, TRACK, { z: -gauge, y: height * 0.5 }),
    box(len, height, width, TRACK, { z: gauge, y: height * 0.5 }),
    box(len * 0.94, height * 0.35, width * 0.5, '#4a4f57', { z: -gauge, y: height * 0.62 }),
    box(len * 0.94, height * 0.35, width * 0.5, '#4a4f57', { z: gauge, y: height * 0.62 }),
  ];
}

function conCommander(r, c) {
  const parts = tracks(r * 2.3, r * 0.5, r * 0.6, r * 0.72);
  parts.push(box(r * 2.0, r * 0.42, r * 1.5, c.primary, { y: r * 0.8 }));
  parts.push(box(r * 1.3, r * 0.5, r * 1.2, c.primary, { x: -r * 0.15, y: r * 1.2 }));
  parts.push(box(r * 0.5, r * 0.3, r * 1.0, HULL, { x: -r * 0.75, y: r * 1.5 }));
  parts.push(cylinder(r * 0.07, r * 0.07, r * 1.1, HULL_LIGHT, { x: -r * 0.85, y: r * 2.0 }, 6));
  parts.push(sphere(r * 0.16, GLOW, { x: -r * 0.85, y: r * 2.55 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.95, r * 0.42, r * 1.0, c.dark, {}),
      box(r * 1.5, r * 0.22, r * 0.22, HULL_LIGHT, { x: r * 0.95 }),
      cylinder(r * 0.17, r * 0.17, r * 0.3, HULL, { x: r * 1.75, rz: Math.PI / 2 }, 8),
    ]),
    turretY: r * 1.5,
  };
}

function conEngineer(r, c) {
  const parts = tracks(r * 1.9, r * 0.44, r * 0.5, r * 0.6);
  parts.push(box(r * 1.6, r * 0.4, r * 1.15, c.primary, { y: r * 0.68 }));
  parts.push(box(r * 0.7, r * 0.42, r * 0.85, HULL, { x: -r * 0.4, y: r * 1.08 }));
  parts.push(box(r * 0.3, r * 0.2, r * 0.95, '#2a2e34', { x: r * 0.55, y: r * 0.98 }));
  return {
    body: merge(parts),
    // The jib swings to face whatever it is working on.
    turret: merge([
      box(r * 0.4, r * 0.3, r * 0.4, HULL, {}),
      box(r * 1.5, r * 0.14, r * 0.14, HULL_LIGHT, { x: r * 0.8, rz: -0.22 }),
      sphere(r * 0.16, GLOW, { x: r * 1.55, y: r * 0.34 }),
    ]),
    turretY: r * 1.05,
  };
}

function conJeep(r, c) {
  const parts = [];
  const wheel = (x, z) => cylinder(r * 0.3, r * 0.3, r * 0.22, TRACK, { x, z, y: r * 0.3, rx: Math.PI / 2 }, 8);
  parts.push(wheel(r * 0.62, -r * 0.6), wheel(r * 0.62, r * 0.6));
  parts.push(wheel(-r * 0.62, -r * 0.6), wheel(-r * 0.62, r * 0.6));
  parts.push(box(r * 1.8, r * 0.34, r * 0.95, c.primary, { y: r * 0.6 }));
  parts.push(box(r * 0.7, r * 0.3, r * 0.8, c.dark, { x: -r * 0.2, y: r * 0.92 }));
  parts.push(box(r * 0.5, r * 0.1, r * 0.9, HULL_LIGHT, { x: r * 0.75, y: r * 0.8 }));
  return {
    body: merge(parts),
    turret: merge([box(r * 0.8, r * 0.12, r * 0.12, HULL_LIGHT, { x: r * 0.4 })]),
    turretY: r * 1.1,
  };
}

function conTank(r, c) {
  const parts = tracks(r * 2.1, r * 0.5, r * 0.56, r * 0.66);
  // Sloped glacis plate reads as armour from above.
  parts.push(box(r * 1.75, r * 0.4, r * 1.3, c.primary, { y: r * 0.76 }));
  parts.push(box(r * 0.6, r * 0.3, r * 1.25, c.primary, { x: r * 0.95, y: r * 0.72, rz: -0.3 }));
  parts.push(box(r * 0.9, r * 0.12, r * 1.35, HULL_DARK, { x: -r * 0.4, y: r * 0.97 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.1, r * 0.4, r * 1.0, c.dark, {}),
      box(r * 0.5, r * 0.28, r * 0.8, c.primary, { x: r * 0.5 }),
      box(r * 1.5, r * 0.18, r * 0.18, HULL_LIGHT, { x: r * 1.2 }),
      cylinder(r * 0.14, r * 0.14, r * 0.26, HULL, { x: r * 1.92, rz: Math.PI / 2 }, 8),
      box(r * 0.5, r * 0.12, r * 0.12, HULL, { x: -r * 0.1, z: r * 0.55, y: r * 0.24 }),
    ]),
    turretY: r * 1.0,
  };
}

function conMissile(r, c) {
  const parts = tracks(r * 1.95, r * 0.46, r * 0.52, r * 0.62);
  parts.push(box(r * 1.6, r * 0.4, r * 1.2, c.primary, { y: r * 0.72 }));
  parts.push(box(r * 0.6, r * 0.34, r * 0.9, c.dark, { x: r * 0.55, y: r * 1.05 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.95, r * 0.5, r * 1.15, HULL, { x: -r * 0.2, rz: -0.16 }),
      ...[-1, 0, 1].map((k) => cone(r * 0.13, r * 0.3, '#ff9a5b', {
        x: r * 0.42, z: k * r * 0.34, y: r * 0.14, rz: -Math.PI / 2 - 0.16,
      }, 5)),
    ]),
    turretY: r * 1.1,
  };
}

function conHeavyTank(r, c) {
  const parts = tracks(r * 2.4, r * 0.62, r * 0.66, r * 0.8);
  parts.push(box(r * 2.0, r * 0.5, r * 1.6, c.primary, { y: r * 0.88 }));
  parts.push(box(r * 0.7, r * 0.36, r * 1.5, c.primary, { x: r * 1.05, y: r * 0.84, rz: -0.28 }));
  parts.push(box(r * 1.1, r * 0.14, r * 1.7, HULL_DARK, { x: -r * 0.3, y: r * 1.15 }));
  parts.push(sphere(r * 0.2, GLOW, { x: -r * 0.8, y: r * 1.24 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.3, r * 0.5, r * 1.3, c.dark, {}),
      box(r * 1.6, r * 0.2, r * 0.2, HULL_LIGHT, { x: r * 1.3, z: -r * 0.32 }),
      box(r * 1.6, r * 0.2, r * 0.2, HULL_LIGHT, { x: r * 1.3, z: r * 0.32 }),
      box(r * 0.4, r * 0.26, r * 0.9, HULL, { x: -r * 0.55 }),
    ]),
    turretY: r * 1.2,
  };
}

function conHowitzer(r, c) {
  const parts = tracks(r * 2.0, r * 0.5, r * 0.54, r * 0.68);
  parts.push(box(r * 1.7, r * 0.38, r * 1.25, c.primary, { y: r * 0.74 }));
  // Recoil spades dug in at the back.
  parts.push(box(r * 0.5, r * 0.16, r * 0.3, HULL_DARK, { x: -r * 1.0, z: -r * 0.5, y: r * 0.3, rz: 0.4 }));
  parts.push(box(r * 0.5, r * 0.16, r * 0.3, HULL_DARK, { x: -r * 1.0, z: r * 0.5, y: r * 0.3, rz: 0.4 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.9, r * 0.42, r * 1.0, c.dark, {}),
      box(r * 2.4, r * 0.2, r * 0.2, HULL_LIGHT, { x: r * 1.3, rz: 0.12 }),
      cylinder(r * 0.19, r * 0.16, r * 0.34, HULL, { x: r * 2.5, y: r * 0.3, rz: Math.PI / 2 }, 8),
    ]),
    turretY: r * 1.02,
  };
}

function conDerrick(s, c) {
  const parts = foundation(s, c);
  // Four legs meeting at a head, with a walking beam that rocks as it pumps.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.09, s * 0.95, s * 0.09, HULL, {
      x: dx * s * 0.21, z: dz * s * 0.21, y: s * 0.5, rx: dz * 0.16, rz: -dx * 0.16,
    }));
  }
  parts.push(box(s * 0.3, s * 0.12, s * 0.3, HULL_LIGHT, { y: s * 1.0 }));
  return {
    body: merge(parts),
    spinner: merge([
      box(s * 0.8, s * 0.1, s * 0.12, c.light, {}),
      box(s * 0.14, s * 0.3, s * 0.14, HULL_DARK, { x: s * 0.36, y: -s * 0.18 }),
    ]),
    spinnerAxis: 'x',
    spinnerY: s * 1.08,
    spinSpeed: 1.5,
  };
}

function conDiesel(s, c) {
  const parts = foundation(s, c);
  parts.push(box(s * 0.78, s * 0.46, s * 0.66, HULL, { y: s * 0.33 }));
  parts.push(box(s * 0.8, s * 0.1, s * 0.7, c.primary, { y: s * 0.58 }));
  // Radiator grille and exhaust stacks.
  parts.push(box(s * 0.06, s * 0.3, s * 0.56, '#22262b', { x: s * 0.4, y: s * 0.33 }));
  for (const dz of [-0.22, 0.22]) {
    parts.push(cylinder(s * 0.07, s * 0.08, s * 0.5, HULL_DARK, { x: -s * 0.28, z: dz * s, y: s * 0.78 }, 6));
  }
  return { body: merge(parts) };
}

function conFusion(s, c) {
  const parts = foundation(s, c, 3);
  parts.push(cylinder(s * 0.3, s * 0.36, s * 0.4, HULL, { y: s * 0.28 }, 12));
  parts.push(sphere(s * 0.3, c.primary, { y: s * 0.58 }, 12));
  parts.push(sphere(s * 0.19, GLOW, { y: s * 0.58 }, 10));
  // Cooling towers at the corners.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(cylinder(s * 0.1, s * 0.14, s * 0.54, HULL_LIGHT, {
      x: dx * s * 0.34, z: dz * s * 0.34, y: s * 0.32,
    }, 8));
  }
  parts.push(box(s * 0.86, s * 0.06, s * 0.1, c.dark, { y: s * 0.1 }));
  parts.push(box(s * 0.1, s * 0.06, s * 0.86, c.dark, { y: s * 0.1 }));
  return { body: merge(parts) };
}

function conRefinery(s, c) {
  const parts = foundation(s, c);
  parts.push(cylinder(s * 0.22, s * 0.24, s * 0.7, HULL, { x: -s * 0.16, y: s * 0.42 }, 10));
  parts.push(cylinder(s * 0.15, s * 0.16, s * 0.5, HULL_LIGHT, { x: s * 0.22, z: s * 0.18, y: s * 0.32 }, 8));
  parts.push(cylinder(s * 0.12, s * 0.12, s * 0.1, '#ffd76a', { x: -s * 0.16, y: s * 0.8 }, 10));
  parts.push(box(s * 0.5, s * 0.07, s * 0.07, HULL_DARK, { x: s * 0.04, z: -s * 0.2, y: s * 0.5 }));
  return { body: merge(parts) };
}

function conTankStore(s, c, metalKind) {
  const parts = foundation(s, c);
  const tint = metalKind ? '#9aa3ad' : '#d8b24a';
  parts.push(cylinder(s * 0.3, s * 0.3, s * 0.62, tint, { z: -s * 0.18, y: s * 0.44 }, 12));
  parts.push(cylinder(s * 0.3, s * 0.3, s * 0.62, tint, { z: s * 0.18, y: s * 0.44 }, 12));
  parts.push(box(s * 0.06, s * 0.06, s * 0.4, HULL_DARK, { y: s * 0.7 }));
  return { body: merge(parts) };
}

function conYard(s, c, advanced) {
  const h = advanced ? 3.0 : 2.6;
  const parts = foundation(s, c, h);
  const wallH = s * (advanced ? 0.42 : 0.36);
  // A shed with a roller door on +Z, the side vehicles drive out of.
  parts.push(box(s * 0.9, wallH, s * 0.1, c.primary, { z: -s * 0.4, y: wallH * 0.5 + h }));
  parts.push(box(s * 0.1, wallH, s * 0.8, c.primary, { x: s * 0.4, y: wallH * 0.5 + h }));
  parts.push(box(s * 0.1, wallH, s * 0.8, c.primary, { x: -s * 0.4, y: wallH * 0.5 + h }));
  parts.push(box(s * 0.9, s * 0.08, s * 0.9, HULL_DARK, { y: wallH + h }));
  parts.push(box(s * 0.66, wallH * 0.7, s * 0.06, '#1b1f24', { z: s * 0.4, y: wallH * 0.35 + h }));
  parts.push(box(s * 0.9, s * 0.07, s * 0.12, c.light, { z: s * 0.4, y: wallH + h }));
  // Hardstanding apron the vehicles roll onto.
  parts.push(box(s * 0.7, s * 0.04, s * 0.3, '#2c3036', { z: s * 0.62, y: h }));
  if (advanced) {
    parts.push(box(s * 0.5, s * 0.14, s * 0.5, c.light, { y: wallH + h + s * 0.08 }));
    parts.push(cylinder(s * 0.08, s * 0.1, s * 0.5, HULL_LIGHT, { x: s * 0.3, z: -s * 0.3, y: wallH + h + s * 0.28 }, 8));
    parts.push(sphere(s * 0.1, GLOW, { y: wallH + h + s * 0.2 }));
  }
  return { body: merge(parts) };
}

function conCrane(s, c) {
  const parts = foundation(s, c, 2);
  parts.push(box(s * 0.16, s * 0.9, s * 0.16, HULL, { y: s * 0.48 }));
  return {
    body: merge(parts),
    turret: merge([
      box(s * 0.24, s * 0.16, s * 0.24, HULL_LIGHT, {}),
      box(s * 0.8, s * 0.08, s * 0.08, HULL_LIGHT, { x: s * 0.4, rz: -0.14 }),
      box(s * 0.24, s * 0.08, s * 0.08, HULL_DARK, { x: -s * 0.16 }),
      sphere(s * 0.1, GLOW, { x: s * 0.78, y: s * 0.1 }),
    ]),
    turretY: s * 0.98,
  };
}

function conBunker(s, c, big) {
  const parts = foundation(s, c, big ? 2.4 : 2.0);
  // Sloped concrete casemate rather than an open turret ring.
  parts.push(box(s * 0.7, s * (big ? 0.34 : 0.28), s * 0.7, '#5b6068', { y: s * (big ? 0.2 : 0.17) }));
  parts.push(box(s * 0.56, s * 0.1, s * 0.56, c.primary, { y: s * (big ? 0.4 : 0.33) }));
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.12, s * 0.16, s * 0.12, '#494e56', { x: dx * s * 0.38, z: dz * s * 0.38, y: s * 0.1 }));
  }
  return {
    body: merge(parts),
    turret: merge([
      box(s * 0.36, s * 0.26, s * 0.5, HULL, {}),
      box(s * (big ? 0.9 : 0.75), s * (big ? 0.17 : 0.12), s * (big ? 0.17 : 0.12), HULL_LIGHT, { x: s * (big ? 0.6 : 0.5) }),
      ...(big ? [cylinder(s * 0.13, s * 0.11, s * 0.24, HULL, { x: s * 1.06, rz: Math.PI / 2 }, 8)] : []),
    ]),
    turretY: s * (big ? 0.46 : 0.38),
  };
}

function conRadar(s, c) {
  const parts = foundation(s, c, 2);
  // Lattice mast rather than a single pole.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.05, s * 0.85, s * 0.05, HULL, { x: dx * s * 0.11, z: dz * s * 0.11, y: s * 0.45 }));
  }
  parts.push(box(s * 0.3, s * 0.05, s * 0.3, HULL_LIGHT, { y: s * 0.5 }));
  parts.push(box(s * 0.3, s * 0.05, s * 0.3, HULL_LIGHT, { y: s * 0.86 }));
  return {
    body: merge(parts),
    spinner: merge([
      box(s * 0.1, s * 0.44, s * 0.62, c.primary, { rz: 0.3 }),
      box(s * 0.16, s * 0.06, s * 0.06, HULL_LIGHT, { x: -s * 0.12 }),
    ]),
    spinnerAxis: 'y',
    spinnerY: s * 1.02,
    spinSpeed: 1.3,
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

  con_commander: (d, c) => conCommander(d.radius, c),
  con_engineer: (d, c) => conEngineer(d.radius, c),
  con_engineer2: (d, c) => conEngineer(d.radius, c),
  con_jeep: (d, c) => conJeep(d.radius, c),
  con_tank: (d, c) => conTank(d.radius, c),
  con_missile: (d, c) => conMissile(d.radius, c),
  con_heavytank: (d, c) => conHeavyTank(d.radius, c),
  con_howitzer: (d, c) => conHowitzer(d.radius, c),
  con_derrick: (d, c) => conDerrick(d.footprintPx, c),
  con_diesel: (d, c) => conDiesel(d.footprintPx, c),
  con_fusion: (d, c) => conFusion(d.footprintPx, c),
  con_refinery: (d, c) => conRefinery(d.footprintPx, c),
  con_silo: (d, c) => conTankStore(d.footprintPx, c, true),
  con_battery: (d, c) => conTankStore(d.footprintPx, c, false),
  con_yard: (d, c) => conYard(d.footprintPx, c, false),
  con_works: (d, c) => conYard(d.footprintPx, c, true),
  con_crane: (d, c) => conCrane(d.footprintPx, c),
  con_pillbox: (d, c) => conBunker(d.footprintPx, c, false),
  con_bastion: (d, c) => conBunker(d.footprintPx, c, true),
  con_radar: (d, c) => conRadar(d.footprintPx, c),
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
