// Procedural 3D models.
//
// Each model is built from coloured primitives facing +X and merged into one
// geometry. A model may declare a turret (tracks its target) and a spinner
// (rotates continuously: drill heads, turbine blades, radar dishes).

import { box, cylinder, cone, sphere, plate, merge, splitEmissive } from './geometry.js';

const HULL = '#8b929c';
const HULL_DARK = '#4e545d';
const HULL_LIGHT = '#c3c9d2';
const DARK = '#2c3036';
const GLASS = '#16324d';
const GLOW = '#8ef6ff';
const TRACK = '#31353b';

/** Vanguard reads angular and light; Legion reads blocky and heavy. */
function heavyBuild(faction) {
  return faction === 'legion';
}

// ------------------------------------------------------------------- units

function commander(r, c, faction) {
  const wide = heavyBuild(faction);
  const parts = legPair(r, c, { gauge: 0.56, scale: 1.15, splay: 0.16 });

  // Pelvis and a torso that tapers towards the shoulders.
  parts.push(box(r * 0.8, r * 0.3, r * 1.0, HULL_DARK, { y: r * 1.1 }));
  parts.push(box(r * 1.35, r * 0.85, r * (wide ? 1.5 : 1.28), c.primary, { y: r * 1.62 }));
  parts.push(box(r * 1.0, r * 0.34, r * (wide ? 1.62 : 1.4), c.dark, { x: -r * 0.1, y: r * 2.06 }));

  // Shoulder pods and a sensor head.
  parts.push(...shoulder(r, c, { z: -r * 0.82, y: r * 1.9, scale: 1.2 }));
  parts.push(...shoulder(r, c, { z: r * 0.82, y: r * 1.9, scale: 1.2 }));
  parts.push(box(r * 0.52, r * 0.4, r * 0.6, HULL, { x: r * 0.12, y: r * 2.36 }));
  parts.push(box(r * 0.1, r * 0.16, r * 0.5, GLOW, { x: r * 0.4, y: r * 2.38 }));
  parts.push(...aerial(r, { x: -r * 0.5, z: r * 0.34, y: r * 2.26, len: 1.1 }));

  // Reactor housing in the chest, which is the part that glows.
  parts.push(cylinder(r * 0.3, r * 0.3, r * 0.26, HULL, { x: r * 0.52, y: r * 1.62, rz: Math.PI / 2 }, 12));
  parts.push(cylinder(r * 0.2, r * 0.2, r * 0.3, GLOW, { x: r * 0.6, y: r * 1.62, rz: Math.PI / 2 }, 12));
  parts.push(...engineDeck(r, { x: -r * 0.55, y: r * 2.06, w: 0.5, d: 1.1, slats: 4 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.58, r * 0.46, r * 0.7, c.dark, {}),
      ...gunBarrel(r, { len: 1.3, calibre: 0.13 }),
      box(r * 0.3, r * 0.2, r * 0.2, HULL, { x: -r * 0.34, y: r * 0.2 }),
    ]),
    turretY: r * 1.66,
  };
}

function conbot(r, c) {
  const parts = legPair(r, c, { gauge: 0.46, scale: 0.92 });
  parts.push(box(r * 0.66, r * 0.24, r * 0.8, HULL_DARK, { y: r * 0.9 }));
  parts.push(box(r * 1.15, r * 0.72, r * 1.0, c.primary, { y: r * 1.3 }));
  parts.push(box(r * 0.5, r * 0.3, r * 0.72, c.dark, { x: -r * 0.42, y: r * 1.74 }));
  // Nanolathe arm on a shoulder pivot, plus a materials hopper on the back.
  parts.push(...shoulder(r, c, { z: r * 0.6, y: r * 1.44, scale: 0.9 }));
  parts.push(box(r * 0.85, r * 0.24, r * 0.24, HULL_LIGHT, { x: r * 0.75, z: r * 0.6, y: r * 1.44 }));
  parts.push(cylinder(r * 0.16, r * 0.1, r * 0.26, HULL, { x: r * 1.22, z: r * 0.6, y: r * 1.44, rz: Math.PI / 2 }, 10));
  parts.push(sphere(r * 0.15, GLOW, { x: r * 1.4, z: r * 0.6, y: r * 1.44 }));
  parts.push(box(r * 0.44, r * 0.46, r * 0.6, HULL, { x: -r * 0.55, y: r * 1.42 }));
  parts.push(box(r * 0.2, r * 0.1, r * 0.4, GLOW, { x: r * 0.5, y: r * 1.56 }));
  return { body: merge(parts), turret: null };
}

function scout(r, c) {
  // Digitigrade legs and a low, forward-leaning body: built for speed.
  const parts = legPair(r, c, { gauge: 0.5, scale: 0.85, splay: 0.2 });
  parts.push(box(r * 0.5, r * 0.2, r * 0.66, HULL_DARK, { y: r * 0.86 }));
  parts.push(box(r * 1.25, r * 0.46, r * 0.8, c.primary, { x: r * 0.1, y: r * 1.16, rz: -0.1 }));
  parts.push(cone(r * 0.42, r * 0.7, c.primary, { x: r * 0.82, y: r * 1.2, rz: -Math.PI / 2 }, 10));
  // Sensor cluster where a head would be.
  parts.push(box(r * 0.3, r * 0.26, r * 0.5, HULL, { x: r * 0.38, y: r * 1.45 }));
  parts.push(cylinder(r * 0.14, r * 0.14, r * 0.1, GLOW, { x: r * 0.54, y: r * 1.45, rz: Math.PI / 2 }, 10));
  parts.push(...aerial(r, { x: -r * 0.3, z: r * 0.26, y: r * 1.34, len: 1.2 }));
  parts.push(box(r * 0.34, r * 0.3, r * 0.44, HULL_DARK, { x: -r * 0.5, y: r * 1.22 }));
  return {
    body: merge(parts),
    turret: merge([
      cylinder(r * 0.12, r * 0.14, r * 0.12, HULL, {}, 10),
      box(r * 0.8, r * 0.1, r * 0.1, HULL_LIGHT, { x: r * 0.42, y: r * 0.04 }),
    ]),
    turretY: r * 1.42,
  };
}

function rifle(r, c, faction) {
  const wide = heavyBuild(faction);
  const parts = legPair(r, c, { gauge: 0.48, scale: 0.95 });
  parts.push(box(r * 0.66, r * 0.24, r * 0.82, HULL_DARK, { y: r * 0.94 }));
  parts.push(box(r * 1.15, r * 0.78, r * (wide ? 1.2 : 1.0), c.primary, { y: r * 1.36 }));
  // Legion carries a slab of frontal armour; Vanguard gets a sloped prow.
  if (wide) parts.push(box(r * 0.3, r * 0.6, r * 1.05, c.dark, { x: r * 0.62, y: r * 1.36 }));
  else parts.push(box(r * 0.42, r * 0.52, r * 0.86, c.dark, { x: r * 0.58, y: r * 1.36, rz: -0.26 }));
  parts.push(box(r * 0.46, r * 0.3, r * 0.6, HULL, { x: -r * 0.34, y: r * 1.82 }));
  parts.push(box(r * 0.1, r * 0.12, r * 0.34, GLOW, { x: -r * 0.1, y: r * 1.84 }));
  parts.push(...shoulder(r, c, { z: -r * 0.62, y: r * 1.56, scale: 0.9 }));
  parts.push(box(r * 0.4, r * 0.34, r * 0.44, HULL_DARK, { x: -r * 0.5, z: r * 0.4, y: r * 1.6 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.42, r * 0.34, r * 0.4, c.dark, {}),
      box(r * 0.95, r * 0.18, r * 0.18, HULL_LIGHT, { x: r * 0.6 }),
      cylinder(r * 0.12, r * 0.1, r * 0.18, '#5f646c', { x: r * 1.12, rz: Math.PI / 2 }, 10),
      box(r * 0.26, r * 0.2, r * 0.16, HULL, { x: -r * 0.2, y: r * 0.16 }),
    ]),
    turretY: r * 1.6,
  };
}

function rocket(r, c) {
  const parts = legPair(r, c, { gauge: 0.48, scale: 0.95 });
  parts.push(box(r * 0.64, r * 0.24, r * 0.8, HULL_DARK, { y: r * 0.94 }));
  parts.push(box(r * 1.05, r * 0.72, r * 1.0, c.primary, { y: r * 1.32 }));
  parts.push(box(r * 0.42, r * 0.28, r * 0.56, HULL, { x: -r * 0.3, y: r * 1.74 }));
  parts.push(box(r * 0.1, r * 0.1, r * 0.3, GLOW, { x: -r * 0.06, y: r * 1.76 }));
  parts.push(...shoulder(r, c, { z: -r * 0.66, y: r * 1.58 }));
  parts.push(...shoulder(r, c, { z: r * 0.66, y: r * 1.58 }));
  return {
    body: merge(parts),
    turret: merge([
      // Twin launcher boxes with loaded tubes, angled up slightly.
      ...[-1, 1].flatMap((side) => [
        box(r * 0.78, r * 0.44, r * 0.38, HULL, { x: r * 0.08, z: side * r * 0.44, rz: -0.16 }),
        ...[-0.1, 0.1].map((dz) => cone(r * 0.1, r * 0.24, '#ff9a5b', {
          x: r * 0.5, z: side * r * 0.44 + dz * r, y: r * 0.06, rz: -Math.PI / 2 - 0.16,
        }, 8)),
      ]),
      box(r * 0.3, r * 0.24, r * 0.5, c.dark, { x: -r * 0.3 }),
    ]),
    turretY: r * 1.74,
  };
}

function heavy(r, c) {
  const parts = legPair(r, c, { gauge: 0.6, scale: 1.1, splay: 0.16 });
  parts.push(box(r * 0.9, r * 0.34, r * 1.1, HULL_DARK, { y: r * 1.06 }));
  parts.push(box(r * 1.5, r * 0.95, r * 1.55, c.primary, { y: r * 1.55 }));
  // Layered chest armour and heavy shoulder pauldrons.
  parts.push(box(r * 0.34, r * 0.78, r * 1.3, c.dark, { x: r * 0.82, y: r * 1.55, rz: -0.14 }));
  parts.push(box(r * 1.05, r * 0.3, r * 1.62, c.dark, { x: -r * 0.16, y: r * 2.06 }));
  parts.push(...shoulder(r, c, { z: -r * 0.92, y: r * 1.86, scale: 1.3 }));
  parts.push(...shoulder(r, c, { z: r * 0.92, y: r * 1.86, scale: 1.3 }));
  parts.push(box(r * 0.5, r * 0.34, r * 0.56, HULL, { x: -r * 0.4, y: r * 2.3 }));
  parts.push(cylinder(r * 0.26, r * 0.26, r * 0.22, HULL, { x: r * 0.62, y: r * 1.62, rz: Math.PI / 2 }, 12));
  parts.push(cylinder(r * 0.17, r * 0.17, r * 0.26, GLOW, { x: r * 0.7, y: r * 1.62, rz: Math.PI / 2 }, 12));
  parts.push(...exhaust(r, { x: -r * 0.62, z: -r * 0.42, y: r * 2.2 }));
  parts.push(...exhaust(r, { x: -r * 0.62, z: r * 0.42, y: r * 2.2 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.62, r * 0.5, r * 1.2, c.dark, {}),
      ...[-1, 1].map((side) => box(r * 1.15, r * 0.22, r * 0.22, HULL_LIGHT, { x: r * 0.78, z: side * r * 0.42 })),
      ...[-1, 1].map((side) => cylinder(r * 0.14, r * 0.12, r * 0.2, '#5f646c', {
        x: r * 1.38, z: side * r * 0.42, rz: Math.PI / 2,
      }, 10)),
      box(r * 0.34, r * 0.26, r * 0.34, HULL, { x: -r * 0.42, y: r * 0.2 }),
    ]),
    turretY: r * 1.9,
  };
}

function siege(r, c) {
  const parts = legPair(r, c, { gauge: 0.56, scale: 1.0, splay: 0.22 });
  parts.push(box(r * 0.74, r * 0.26, r * 0.95, HULL_DARK, { y: r * 0.98 }));
  parts.push(box(r * 1.25, r * 0.7, r * 1.15, c.primary, { y: r * 1.34 }));
  // Bracing struts that plant the frame when the gun fires.
  for (const z of [-1, 1]) {
    parts.push(box(r * 0.5, r * 0.14, r * 0.16, HULL_DARK, {
      x: -r * 0.78, z: z * r * 0.5, y: r * 0.9, rz: 0.5,
    }));
  }
  parts.push(box(r * 0.44, r * 0.36, r * 0.72, HULL, { x: -r * 0.44, y: r * 1.7 }));
  parts.push(box(r * 0.12, r * 0.1, r * 0.34, GLOW, { x: -r * 0.16, y: r * 1.72 }));
  parts.push(...aerial(r, { x: -r * 0.66, z: r * 0.4, y: r * 1.68, len: 1.3 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.7, r * 0.46, r * 0.8, c.dark, {}),
      cylinder(r * 0.11, r * 0.12, r * 2.1, HULL_LIGHT, { x: r * 1.2, y: r * 0.1, rz: Math.PI / 2 + 0.08 }, 12),
      cylinder(r * 0.19, r * 0.19, r * 0.26, '#5f646c', { x: r * 0.95, y: r * 0.08, rz: Math.PI / 2 + 0.08 }, 12),
      cylinder(r * 0.17, r * 0.14, r * 0.24, '#4d5159', { x: r * 2.2, y: r * 0.2, rz: Math.PI / 2 + 0.08 }, 12),
      box(r * 0.4, r * 0.3, r * 0.5, HULL, { x: -r * 0.42 }),
    ]),
    turretY: r * 1.5,
  };
}

// -------------------------------------------------------------- structures

/**
 * Roof dressing. From directly above, a structure is its roof, so a bare slab
 * reads as a featureless block however good the walls are. These put team
 * colour, panel breaks and a little hardware up where the camera can see them.
 */
function roofPanels(s, y, c, opts = {}) {
  const span = opts.span || 0.86;
  const parts = [];
  const half = s * span * 0.5;
  // Ribs running across the roof.
  const ribs = opts.ribs || 3;
  for (let i = 0; i < ribs; i++) {
    const t = (i + 0.5) / ribs - 0.5;
    parts.push(box(s * span, s * 0.022, s * 0.045, HULL_DARK, { y: y + s * 0.012, z: t * s * span }));
  }
  // Team-coloured edge trim on two sides.
  parts.push(box(s * span, s * 0.03, s * 0.05, c.primary, { y: y + s * 0.01, z: -half }));
  parts.push(box(s * span, s * 0.03, s * 0.05, c.primary, { y: y + s * 0.01, z: half }));
  // Rooftop hardware: a vent block and a couple of pipes.
  if (opts.vents !== false) {
    parts.push(box(s * 0.16, s * 0.07, s * 0.16, HULL, { x: -s * 0.24, y: y + s * 0.045 }));
    parts.push(cylinder(s * 0.035, s * 0.035, s * 0.11, HULL_LIGHT, { x: s * 0.22, z: -s * 0.16, y: y + s * 0.06 }, 6));
    parts.push(cylinder(s * 0.035, s * 0.035, s * 0.11, HULL_LIGHT, { x: s * 0.22, z: s * 0.16, y: y + s * 0.06 }, 6));
  }
  return parts;
}

function foundation(s, c, h = 2.5) {
  return [
    box(s, h, s, '#40454d', { y: h * 0.5 }),
    box(s * 0.9, h * 0.6, s * 0.9, '#545a64', { y: h * 1.1 }),
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

  // Roof: two slabs with a service gap down the middle, plus dressing so it
  // is not a blank plate when seen from overhead.
  parts.push(box(s * 0.88, s * 0.07, s * 0.3, '#575d67', { z: -s * 0.27, y: wallH + h }));
  parts.push(box(s * 0.88, s * 0.07, s * 0.16, '#575d67', { z: s * 0.1, y: wallH + h }));
  parts.push(box(s * 0.8, s * 0.025, s * 0.05, c.primary, { z: -s * 0.27, y: wallH + h + s * 0.045 }));
  parts.push(box(s * 0.24, s * 0.09, s * 0.14, HULL, { x: -s * 0.26, z: -s * 0.27, y: wallH + h + s * 0.07 }));
  parts.push(cylinder(s * 0.04, s * 0.04, s * 0.14, HULL_LIGHT, { x: s * 0.26, z: -s * 0.3, y: wallH + h + s * 0.08 }, 6));

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



// ------------------------------------------------------- detail helpers
// Small reusable pieces of hardware. Machines read as machines because of
// the fittings on them - hatches, grilles, stowage, aerials - not because
// the hull is a slightly better box.

/** Running gear: road wheels, return rollers and a track guard each side. */
function runningGear(len, width, height, gauge, wheels = 5) {
  const parts = [];
  const wheelR = height * 0.62;
  for (const side of [-gauge, gauge]) {
    // Track guard over the top of the run.
    parts.push(box(len, height * 0.34, width, TRACK, { z: side, y: height * 0.82 }));
    parts.push(box(len * 0.98, height * 0.16, width * 0.55, '#53585f', { z: side, y: height * 1.0 }));
    for (let i = 0; i < wheels; i++) {
      const t = wheels === 1 ? 0 : (i / (wheels - 1)) * 2 - 1;
      parts.push(cylinder(wheelR, wheelR, width * 0.72, '#3a3e44', {
        x: t * len * 0.42, z: side, y: wheelR, rx: Math.PI / 2,
      }, 10));
      parts.push(cylinder(wheelR * 0.42, wheelR * 0.42, width * 0.8, '#5b6068', {
        x: t * len * 0.42, z: side, y: wheelR, rx: Math.PI / 2,
      }, 8));
    }
    // Drive sprocket and idler, slightly proud of the road wheels.
    for (const end of [-1, 1]) {
      parts.push(cylinder(wheelR * 1.15, wheelR * 1.15, width * 0.66, '#4a4f57', {
        x: end * len * 0.5, z: side, y: wheelR * 1.05, rx: Math.PI / 2,
      }, 10));
    }
  }
  return parts;
}

/** Hatch with a raised rim; the thing that makes a hull look crewed. */
function cupola(r, c, { x = 0, z = 0, y = 0, scale = 1 } = {}) {
  return [
    cylinder(r * 0.3 * scale, r * 0.34 * scale, r * 0.2 * scale, HULL, { x, z, y: y + r * 0.1 * scale }, 12),
    cylinder(r * 0.24 * scale, r * 0.24 * scale, r * 0.07 * scale, HULL_LIGHT, { x, z, y: y + r * 0.23 * scale }, 12),
    box(r * 0.12 * scale, r * 0.05 * scale, r * 0.3 * scale, HULL_DARK, { x: x - r * 0.22 * scale, z, y: y + r * 0.24 * scale }),
  ];
}

/** A short whip aerial. */
function aerial(r, { x = 0, z = 0, y = 0, len = 1 } = {}) {
  return [
    cylinder(r * 0.05, r * 0.07, r * 0.18, HULL, { x, z, y: y + r * 0.09 }),
    cylinder(r * 0.022, r * 0.03, r * len, HULL_LIGHT, { x, z, y: y + r * len * 0.5 + r * 0.16 }, 6),
  ];
}

/** Stowage bins and jerry cans strapped along a hull side. */
function stowage(r, c, { x = 0, z = 0, y = 0, count = 2, spacing = 0.32 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * spacing;
    parts.push(box(r * 0.26, r * 0.16, r * 0.2, i % 2 ? HULL_DARK : '#4d5159', { x: x + t * r, z, y }));
  }
  return parts;
}

/** A louvred engine deck, which breaks up the largest flat surface on a hull. */
function engineDeck(r, { x = 0, z = 0, y = 0, w = 1, d = 1, slats = 4 } = {}) {
  const parts = [box(r * w, r * 0.06, r * d, '#33373d', { x, z, y })];
  for (let i = 0; i < slats; i++) {
    const t = (i + 0.5) / slats - 0.5;
    parts.push(box(r * w * 0.86, r * 0.05, r * d * 0.1, '#5a6068', { x, z: z + t * r * d, y: y + r * 0.05 }));
  }
  return parts;
}

/** Exhaust stack with a heat shield. */
function exhaust(r, { x = 0, z = 0, y = 0 } = {}) {
  return [
    cylinder(r * 0.08, r * 0.09, r * 0.3, '#2e3238', { x, z, y: y + r * 0.15 }, 10),
    cylinder(r * 0.11, r * 0.11, r * 0.06, '#6a6f77', { x, z, y: y + r * 0.3 }, 10),
  ];
}

/** A gun barrel with a mantlet, fume extractor and muzzle brake. */
function gunBarrel(r, { len = 1.5, calibre = 0.12, brake = true, y = 0 } = {}) {
  const parts = [
    box(r * 0.3, r * 0.34, r * 0.5, HULL, { x: r * 0.2, y }),
    cylinder(r * calibre, r * calibre * 1.05, r * len, HULL_LIGHT, { x: r * (0.35 + len * 0.5), y, rz: Math.PI / 2 }, 12),
    cylinder(r * calibre * 1.6, r * calibre * 1.6, r * 0.22, '#5f646c', { x: r * (0.35 + len * 0.45), y, rz: Math.PI / 2 }, 12),
  ];
  if (brake) {
    parts.push(cylinder(r * calibre * 1.5, r * calibre * 1.3, r * 0.2, '#4d5159', { x: r * (0.35 + len), y, rz: Math.PI / 2 }, 12));
  }
  return parts;
}


/**
 * A pair of jointed legs: hip, thigh, knee, shin and a splayed foot. Bots
 * were previously two plain boxes, which is what made them read as furniture
 * rather than as machines that walk.
 */
function legPair(r, c, { gauge = 0.5, scale = 1, splay = 0.12 } = {}) {
  const parts = [];
  const s = scale;
  for (const side of [-gauge, gauge]) {
    const dir = side < 0 ? -1 : 1;
    // Hip actuator.
    parts.push(cylinder(r * 0.16 * s, r * 0.16 * s, r * 0.2 * s, HULL, {
      z: side * r, y: r * 0.92 * s, rx: Math.PI / 2,
    }, 10));
    // Thigh, angled back; shin, angled forward. A slight Z stance reads as
    // load-bearing rather than as two vertical posts.
    parts.push(box(r * 0.24 * s, r * 0.56 * s, r * 0.24 * s, HULL_DARK, {
      x: -r * 0.06 * s, z: side * r, y: r * 0.66 * s, rz: 0.16,
    }));
    parts.push(cylinder(r * 0.12 * s, r * 0.12 * s, r * 0.18 * s, HULL_LIGHT, {
      x: -r * 0.14 * s, z: side * r, y: r * 0.4 * s, rx: Math.PI / 2,
    }, 8));
    parts.push(box(r * 0.2 * s, r * 0.42 * s, r * 0.2 * s, HULL_DARK, {
      x: -r * 0.06 * s, z: side * (r + dir * splay * r * 0.3), y: r * 0.2 * s, rz: -0.2,
    }));
    // Foot.
    parts.push(box(r * 0.46 * s, r * 0.12 * s, r * 0.3 * s, '#3d4148', {
      x: r * 0.02 * s, z: side * (r + dir * splay * r), y: r * 0.06 * s,
    }));
    parts.push(box(r * 0.16 * s, r * 0.08 * s, r * 0.26 * s, c.dark, {
      x: r * 0.24 * s, z: side * (r + dir * splay * r), y: r * 0.11 * s,
    }));
  }
  return parts;
}

/** Shoulder block with a pivot, for arm- and shoulder-mounted weapons. */
function shoulder(r, c, { z = 0, y = 0, scale = 1 } = {}) {
  return [
    box(r * 0.34 * scale, r * 0.34 * scale, r * 0.3 * scale, c.dark, { z, y }),
    cylinder(r * 0.15 * scale, r * 0.15 * scale, r * 0.34 * scale, HULL_LIGHT, {
      z, y, rx: Math.PI / 2,
    }, 10),
  ];
}

// ----------------------------------------------------------------- concord
// Crewed machines: tracks, sloped plate, boxy superstructure. Deliberately
// heavier and flatter than the bot silhouettes so the two read apart at a
// glance from directly above.


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
  const parts = runningGear(r * 2.4, r * 0.52, r * 0.6, r * 0.74, 6);
  parts.push(box(r * 2.05, r * 0.44, r * 1.5, c.primary, { y: r * 0.82 }));
  // Sloped glacis and a raked command superstructure.
  parts.push(box(r * 0.7, r * 0.3, r * 1.45, c.primary, { x: r * 1.1, y: r * 0.78, rz: -0.32 }));
  parts.push(box(r * 1.35, r * 0.52, r * 1.2, c.primary, { x: -r * 0.15, y: r * 1.24 }));
  parts.push(...engineDeck(r, { x: -r * 0.8, y: r * 1.06, w: 0.55, d: 1.35, slats: 5 }));
  parts.push(...stowage(r, c, { x: -r * 0.4, z: r * 0.82, y: r * 1.0, count: 3 }));
  parts.push(...exhaust(r, { x: -r * 0.95, z: -r * 0.5, y: r * 1.06 }));
  parts.push(...cupola(r, c, { x: -r * 0.45, z: r * 0.3, y: r * 1.5 }));
  parts.push(...aerial(r, { x: -r * 0.9, z: r * 0.5, y: r * 1.5, len: 1.3 }));
  parts.push(box(r * 0.5, r * 0.28, r * 1.0, HULL, { x: -r * 0.8, y: r * 1.52 }));
  parts.push(sphere(r * 0.17, GLOW, { x: -r * 0.8, y: r * 1.74 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.0, r * 0.44, r * 1.05, c.dark, {}),
      box(r * 0.55, r * 0.3, r * 0.95, c.dark, { x: -r * 0.62 }),   // bustle
      ...gunBarrel(r, { len: 1.55, calibre: 0.14 }),
      ...cupola(r, c, { x: -r * 0.18, z: r * 0.3, y: r * 0.22, scale: 0.9 }),
      box(r * 0.4, r * 0.1, r * 0.1, HULL_DARK, { x: r * 0.1, z: -r * 0.42, y: r * 0.2 }),
    ]),
    turretY: r * 1.52,
  };
}

function conEngineer(r, c) {
  const parts = runningGear(r * 1.95, r * 0.46, r * 0.5, r * 0.62, 5);
  parts.push(box(r * 1.65, r * 0.42, r * 1.15, c.primary, { y: r * 0.7 }));
  parts.push(box(r * 0.72, r * 0.44, r * 0.85, HULL, { x: -r * 0.42, y: r * 1.12 }));
  parts.push(...engineDeck(r, { x: r * 0.55, y: r * 0.92, w: 0.5, d: 1.0, slats: 4 }));
  parts.push(...exhaust(r, { x: -r * 0.1, z: -r * 0.46, y: r * 0.92 }));
  // Dozer blade at the front, and a toolbox behind the cab.
  parts.push(box(r * 0.12, r * 0.42, r * 1.3, '#5c6169', { x: r * 0.92, y: r * 0.4, rz: 0.18 }));
  parts.push(box(r * 0.4, r * 0.24, r * 0.5, HULL_DARK, { x: -r * 0.82, y: r * 1.04 }));
  parts.push(...aerial(r, { x: -r * 0.7, z: r * 0.36, y: r * 1.34, len: 1.0 }));
  return {
    body: merge(parts),
    turret: merge([
      cylinder(r * 0.22, r * 0.26, r * 0.2, HULL, { y: r * 0.05 }, 12),
      box(r * 1.35, r * 0.15, r * 0.15, HULL_LIGHT, { x: r * 0.72, y: r * 0.16, rz: -0.2 }),
      box(r * 0.5, r * 0.11, r * 0.11, HULL, { x: r * 1.4, y: r * 0.42, rz: 0.12 }),
      sphere(r * 0.15, GLOW, { x: r * 1.62, y: r * 0.44 }),
    ]),
    turretY: r * 1.1,
  };
}

function conJeep(r, c) {
  const parts = [];
  const wheel = (x, z) => [
    cylinder(r * 0.32, r * 0.32, r * 0.2, '#2e3238', { x, z, y: r * 0.32, rx: Math.PI / 2 }, 12),
    cylinder(r * 0.15, r * 0.15, r * 0.23, '#6a6f77', { x, z, y: r * 0.32, rx: Math.PI / 2 }, 8),
  ];
  for (const [x, z] of [[0.64, -0.58], [0.64, 0.58], [-0.64, -0.58], [-0.64, 0.58]]) {
    parts.push(...wheel(x * r, z * r));
  }
  parts.push(box(r * 1.85, r * 0.3, r * 0.92, c.primary, { y: r * 0.6 }));
  // Bonnet, windscreen frame and roll bar.
  parts.push(box(r * 0.6, r * 0.2, r * 0.86, c.primary, { x: r * 0.6, y: r * 0.83 }));
  parts.push(box(r * 0.07, r * 0.34, r * 0.8, HULL, { x: r * 0.26, y: r * 0.95, rz: -0.28 }));
  parts.push(box(r * 0.07, r * 0.05, r * 0.86, HULL, { x: -r * 0.55, y: r * 1.12 }));
  parts.push(box(r * 0.07, r * 0.46, r * 0.07, HULL, { x: -r * 0.55, z: -r * 0.4, y: r * 0.9 }));
  parts.push(box(r * 0.07, r * 0.46, r * 0.07, HULL, { x: -r * 0.55, z: r * 0.4, y: r * 0.9 }));
  parts.push(box(r * 0.34, r * 0.2, r * 0.62, HULL_DARK, { x: -r * 0.72, y: r * 0.82 }));
  parts.push(...aerial(r, { x: -r * 0.4, z: r * 0.42, y: r * 0.78, len: 1.1 }));
  parts.push(cylinder(r * 0.13, r * 0.13, r * 0.08, '#c8cdd4', { x: r * 0.92, z: -r * 0.28, y: r * 0.68, rz: Math.PI / 2 }, 10));
  parts.push(cylinder(r * 0.13, r * 0.13, r * 0.08, '#c8cdd4', { x: r * 0.92, z: r * 0.28, y: r * 0.68, rz: Math.PI / 2 }, 10));
  return {
    body: merge(parts),
    turret: merge([
      cylinder(r * 0.14, r * 0.16, r * 0.12, HULL, {}, 10),
      box(r * 0.85, r * 0.09, r * 0.09, HULL_LIGHT, { x: r * 0.42, y: r * 0.06 }),
      box(r * 0.24, r * 0.18, r * 0.3, HULL_DARK, { x: -r * 0.08, y: r * 0.08 }),
    ]),
    turretY: r * 1.05,
  };
}

function conTank(r, c) {
  const parts = runningGear(r * 2.15, r * 0.5, r * 0.56, r * 0.68, 6);
  // Hull with a sloped glacis and side skirts.
  parts.push(box(r * 1.8, r * 0.42, r * 1.3, c.primary, { y: r * 0.78 }));
  parts.push(box(r * 0.64, r * 0.32, r * 1.26, c.primary, { x: r * 1.0, y: r * 0.74, rz: -0.34 }));
  parts.push(box(r * 1.7, r * 0.24, r * 0.08, '#43474e', { z: -r * 0.7, y: r * 0.74 }));
  parts.push(box(r * 1.7, r * 0.24, r * 0.08, '#43474e', { z: r * 0.7, y: r * 0.74 }));
  parts.push(...engineDeck(r, { x: -r * 0.62, y: r * 1.0, w: 0.6, d: 1.2, slats: 5 }));
  parts.push(...exhaust(r, { x: -r * 0.86, z: r * 0.46, y: r * 1.0 }));
  parts.push(...stowage(r, c, { x: -r * 0.3, z: r * 0.72, y: r * 0.96, count: 2 }));
  parts.push(box(r * 0.3, r * 0.1, r * 0.12, HULL_DARK, { x: r * 1.2, z: -r * 0.4, y: r * 0.6 }));
  parts.push(box(r * 0.3, r * 0.1, r * 0.12, HULL_DARK, { x: r * 1.2, z: r * 0.4, y: r * 0.6 }));
  return {
    body: merge(parts),
    turret: merge([
      // Faceted turret: front plate, cheeks, bustle.
      box(r * 1.0, r * 0.4, r * 0.95, c.dark, {}),
      box(r * 0.42, r * 0.34, r * 0.78, c.dark, { x: r * 0.6, rz: -0.22 }),
      box(r * 0.55, r * 0.3, r * 0.85, c.dark, { x: -r * 0.6 }),
      ...gunBarrel(r, { len: 1.45, calibre: 0.115 }),
      ...cupola(r, c, { x: -r * 0.12, z: r * 0.26, y: r * 0.2 }),
      // Smoke dischargers and a coaxial mount.
      box(r * 0.1, r * 0.12, r * 0.34, HULL_DARK, { x: r * 0.2, z: -r * 0.44, y: r * 0.18 }),
      box(r * 0.1, r * 0.12, r * 0.34, HULL_DARK, { x: r * 0.2, z: r * 0.44, y: r * 0.18 }),
      box(r * 0.44, r * 0.08, r * 0.08, HULL_LIGHT, { x: r * 0.42, z: -r * 0.24, y: r * 0.14 }),
    ]),
    turretY: r * 1.0,
  };
}

function conMissile(r, c) {
  const parts = runningGear(r * 2.0, r * 0.46, r * 0.52, r * 0.64, 5);
  parts.push(box(r * 1.65, r * 0.42, r * 1.2, c.primary, { y: r * 0.72 }));
  parts.push(box(r * 0.58, r * 0.3, r * 1.15, c.primary, { x: r * 0.95, y: r * 0.7, rz: -0.3 }));
  parts.push(box(r * 0.62, r * 0.36, r * 0.9, c.dark, { x: r * 0.52, y: r * 1.08 }));
  parts.push(...engineDeck(r, { x: -r * 0.55, y: r * 0.94, w: 0.5, d: 1.1, slats: 4 }));
  parts.push(...aerial(r, { x: -r * 0.8, z: -r * 0.4, y: r * 0.94, len: 1.2 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.34, r * 0.3, r * 0.9, HULL, { x: -r * 0.3 }),
      // Boxed launcher, elevated, with tubes showing at the front.
      box(r * 1.0, r * 0.52, r * 1.15, HULL, { x: -r * 0.1, rz: -0.2 }),
      ...[-1, 0, 1].flatMap((k) => [
        cylinder(r * 0.13, r * 0.13, r * 0.16, '#3a3e44', {
          x: r * 0.44, z: k * r * 0.34, y: r * 0.2, rz: Math.PI / 2 - 0.2,
        }, 10),
        cone(r * 0.11, r * 0.26, '#ff9a5b', {
          x: r * 0.52, z: k * r * 0.34, y: r * 0.22, rz: -Math.PI / 2 - 0.2,
        }, 8),
      ]),
    ]),
    turretY: r * 1.12,
  };
}

function conHeavyTank(r, c) {
  const parts = runningGear(r * 2.5, r * 0.62, r * 0.66, r * 0.82, 7);
  parts.push(box(r * 2.05, r * 0.52, r * 1.62, c.primary, { y: r * 0.9 }));
  parts.push(box(r * 0.76, r * 0.4, r * 1.56, c.primary, { x: r * 1.12, y: r * 0.86, rz: -0.3 }));
  // Applique armour blocks along the flanks.
  for (const z of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      parts.push(box(r * 0.5, r * 0.22, r * 0.1, '#4a4f57', {
        x: (i - 1) * r * 0.62, z: z * r * 0.86, y: r * 0.92,
      }));
    }
  }
  parts.push(...engineDeck(r, { x: -r * 0.72, y: r * 1.17, w: 0.62, d: 1.45, slats: 6 }));
  parts.push(...exhaust(r, { x: -r * 1.0, z: -r * 0.56, y: r * 1.17 }));
  parts.push(...exhaust(r, { x: -r * 1.0, z: r * 0.56, y: r * 1.17 }));
  parts.push(sphere(r * 0.19, GLOW, { x: r * 0.5, y: r * 1.2 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.25, r * 0.5, r * 1.25, c.dark, {}),
      box(r * 0.5, r * 0.42, r * 1.0, c.dark, { x: r * 0.72, rz: -0.2 }),
      box(r * 0.62, r * 0.36, r * 1.1, c.dark, { x: -r * 0.76 }),
      ...gunBarrel(r, { len: 1.5, calibre: 0.11, y: -r * 0.3 }),
      ...gunBarrel(r, { len: 1.5, calibre: 0.11, y: r * 0.3 }),
      ...cupola(r, c, { x: -r * 0.3, z: r * 0.34, y: r * 0.24, scale: 1.1 }),
      box(r * 0.12, r * 0.14, r * 0.4, HULL_DARK, { x: r * 0.1, z: -r * 0.56, y: r * 0.22 }),
      box(r * 0.12, r * 0.14, r * 0.4, HULL_DARK, { x: r * 0.1, z: r * 0.56, y: r * 0.22 }),
    ]),
    turretY: r * 1.24,
  };
}

function conHowitzer(r, c) {
  const parts = runningGear(r * 2.05, r * 0.5, r * 0.54, r * 0.7, 6);
  parts.push(box(r * 1.75, r * 0.4, r * 1.25, c.primary, { y: r * 0.76 }));
  parts.push(box(r * 0.6, r * 0.3, r * 1.2, c.primary, { x: r * 0.98, y: r * 0.72, rz: -0.3 }));
  parts.push(...engineDeck(r, { x: r * 0.5, y: r * 0.98, w: 0.45, d: 1.1, slats: 4 }));
  // Recoil spades, dug in at the back.
  for (const z of [-1, 1]) {
    parts.push(box(r * 0.55, r * 0.18, r * 0.34, '#4a4f57', {
      x: -r * 1.02, z: z * r * 0.5, y: r * 0.32, rz: 0.42,
    }));
  }
  parts.push(...stowage(r, c, { x: -r * 0.3, z: r * 0.74, y: r * 0.94, count: 3, spacing: 0.28 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.95, r * 0.44, r * 1.05, c.dark, {}),
      box(r * 0.5, r * 0.34, r * 0.9, c.dark, { x: -r * 0.6 }),
      // A long, heavy barrel with a bore evacuator part way along it.
      cylinder(r * 0.115, r * 0.125, r * 2.5, HULL_LIGHT, { x: r * 1.45, y: r * 0.12, rz: Math.PI / 2 + 0.06 }, 12),
      cylinder(r * 0.2, r * 0.2, r * 0.3, '#5f646c', { x: r * 1.1, y: r * 0.1, rz: Math.PI / 2 + 0.06 }, 12),
      cylinder(r * 0.19, r * 0.15, r * 0.28, '#4d5159', { x: r * 2.62, y: r * 0.22, rz: Math.PI / 2 + 0.06 }, 12),
      box(r * 0.36, r * 0.36, r * 0.5, HULL, { x: r * 0.22, y: r * 0.06 }),
      ...cupola(r, c, { x: -r * 0.2, z: r * 0.3, y: r * 0.22, scale: 0.85 }),
    ]),
    turretY: r * 1.04,
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
  // A lighter roof deck with ribs, trim and hardware, rather than one dark
  // plate the size of the whole footprint.
  parts.push(box(s * 0.9, s * 0.08, s * 0.9, '#5a6069', { y: wallH + h }));
  parts.push(...roofPanels(s, wallH + h + s * 0.04, c, { ribs: 4, span: 0.86 }));
  // Skylight strip down the middle of the shed.
  parts.push(box(s * 0.2, s * 0.03, s * 0.7, '#243544', { y: wallH + h + s * 0.05 }));
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

/**
 * Colours treated as self-illuminated. Parts painted in these are split out
 * and drawn unlit at full brightness, so the bloom pass picks them up.
 */
const EMISSIVE_COLOURS = [GLOW, '#ff9a5b', '#ffd76a', '#8ef6ff', '#9fe8ff'];

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

  // Peel the glowing detail off each part into its own geometry.
  for (const part of ['body', 'turret', 'spinner']) {
    if (!m[part]) continue;
    const { solid, glow } = splitEmissive(m[part], EMISSIVE_COLOURS);
    m[part] = solid;
    m[part + 'Glow'] = glow;
  }

  cache.set(key, m);
  return m;
}

export function clearModelCache() {
  cache.clear();
}
