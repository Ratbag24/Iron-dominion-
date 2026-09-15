// Procedural 3D models.
//
// Each model is built from coloured primitives facing +X and merged into one
// geometry. A model may declare a turret (tracks its target) and a spinner
// (rotates continuously: drill heads, turbine blades, radar dishes).

import { box, cylinder, cone, sphere, plate, merge, splitEmissive } from './geometry.js';

const HULL = '#a2a9b4';
const HULL_DARK = '#5f6670';
const HULL_LIGHT = '#d2d8e0';
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
  const legs = legPairParts(r, c, { gauge: 0.56, scale: 1.15, splay: 0.16 });
  const parts = [];

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
    legs: legGeos(legs),
    turret: merge([
      box(r * 0.58, r * 0.46, r * 0.7, c.dark, {}),
      ...gunBarrel(r, { len: 1.3, calibre: 0.13 }),
      box(r * 0.3, r * 0.2, r * 0.2, HULL, { x: -r * 0.34, y: r * 0.2 }),
    ]),
    turretY: r * 1.66,
  };
}

function conbot(r, c) {
  const legs = legPairParts(r, c, { gauge: 0.46, scale: 0.9 });
  const parts = [];
  parts.push(box(r * 0.6, r * 0.22, r * 0.72, HULL_DARK, { y: r * 0.9 }));
  parts.push(cylinder(r * 0.24, r * 0.24, r * 0.1, STEEL, { y: r * 1.0 }, 12));
  parts.push(box(r * 0.9, r * 0.66, r * 0.9, HULL, { y: r * 1.28 }));
  parts.push(...seam(r, { from: [-r * 0.36, r * 1.6, 0], to: [r * 0.36, r * 1.6, 0], width: 0.035 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 0.7, r * 0.09, r * 0.04, c.primary, { z: side * r * 0.47, y: r * 1.4 }));
  }
  // Head, and the spool of nanolathe cable that marks it as a builder.
  parts.push(box(r * 0.36, r * 0.26, r * 0.46, HULL_DARK, { x: -r * 0.2, y: r * 1.68 }));
  parts.push(box(r * 0.06, r * 0.1, r * 0.28, GLOW, { x: -r * 0.02, y: r * 1.7 }));
  parts.push(cylinder(r * 0.2, r * 0.2, r * 0.24, HULL_DARK, { x: -r * 0.5, y: r * 1.34, rx: Math.PI / 2 }, 12));
  parts.push(cylinder(r * 0.1, r * 0.1, r * 0.28, STEEL, { x: -r * 0.5, y: r * 1.34, rx: Math.PI / 2 }, 8));
  parts.push(...cable(r, [-r * 0.5, r * 1.2, r * 0.14], [-r * 0.1, r * 1.0, r * 0.3], { sag: 0.2 }));
  parts.push(...grille(r, { x: -r * 0.42, y: r * 1.56, w: 0.1, d: 0.5, slats: 4 }));
  parts.push(...aerial(r, { x: -r * 0.34, z: r * 0.26, y: r * 1.6, len: 0.9 }));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      cylinder(r * 0.16, r * 0.18, r * 0.16, HULL_DARK, {}, 12),
      box(r * 0.46, r * 0.18, r * 0.22, HULL, { x: r * 0.28 }),
      cylinder(r * 0.1, r * 0.06, r * 0.26, GLOW, { x: r * 0.62, rz: Math.PI / 2 }, 10),
      ...boltRing(r, { y: r * 0.1, radius: 0.13, count: 6, size: 0.024 }),
    ]),
    turretY: r * 1.46,
  };
}

function scout(r, c) {
  // Digitigrade legs and a low, forward-leaning body: built for speed.
  const legs = legPairParts(r, c, { gauge: 0.5, scale: 0.85, splay: 0.2 });
  const parts = [];
  parts.push(box(r * 0.52, r * 0.22, r * 0.68, HULL_DARK, { y: r * 0.86 }));
  parts.push(cylinder(r * 0.22, r * 0.22, r * 0.1, STEEL, { y: r * 0.98 }, 12));
  parts.push(box(r * 1.25, r * 0.48, r * 0.8, HULL, { x: r * 0.1, y: r * 1.16, rz: -0.1 }));
  parts.push(cone(r * 0.44, r * 0.72, HULL, { x: r * 0.82, y: r * 1.2, rz: -Math.PI / 2 }, 12));
  parts.push(...seam(r, { from: [-r * 0.4, r * 1.4, 0], to: [r * 0.5, r * 1.44, 0], width: 0.03 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 0.7, r * 0.09, r * 0.04, c.primary, { x: r * 0.1, z: side * r * 0.41, y: r * 1.22 }));
    // Thruster pods for the sprint, which is what this thing is for.
    parts.push(cylinder(r * 0.11, r * 0.13, r * 0.3, HULL_DARK,
      { x: -r * 0.5, z: side * r * 0.34, y: r * 1.16, rz: Math.PI / 2 }, 10));
    parts.push(cylinder(r * 0.08, r * 0.08, r * 0.06, GLOW,
      { x: -r * 0.68, z: side * r * 0.34, y: r * 1.16, rz: Math.PI / 2 }, 8));
  }
  // Sensor cluster where a head would be.
  parts.push(box(r * 0.32, r * 0.28, r * 0.52, HULL_DARK, { x: r * 0.38, y: r * 1.46 }));
  parts.push(box(r * 0.06, r * 0.12, r * 0.4, GLOW, { x: r * 0.55, y: r * 1.47 }));
  parts.push(...optics(r, { x: r * 0.3, z: -r * 0.24, y: r * 1.58, scale: 0.55 }));
  parts.push(...aerial(r, { x: -r * 0.3, z: r * 0.26, y: r * 1.34, len: 1.3 }));
  parts.push(box(r * 0.36, r * 0.32, r * 0.46, HULL_DARK, { x: -r * 0.5, y: r * 1.22 }));
  parts.push(...grille(r, { x: -r * 0.66, y: r * 1.22, w: 0.08, d: 0.4, slats: 4 }));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      cylinder(r * 0.13, r * 0.15, r * 0.14, HULL_DARK, {}, 10),
      box(r * 0.26, r * 0.2, r * 0.26, HULL, { x: r * 0.12 }),
      box(r * 0.8, r * 0.1, r * 0.1, HULL_LIGHT, { x: r * 0.44, y: r * 0.04 }),
      cylinder(r * 0.06, r * 0.06, r * 0.14, GREASE, { x: r * 0.86, y: r * 0.04, rz: Math.PI / 2 }, 8),
      box(r * 0.14, r * 0.18, r * 0.1, GREASE, { x: r * 0.18, y: -r * 0.14 }),
    ]),
    turretY: r * 1.42,
  };
}

function rifle(r, c, faction) {
  const wide = heavyBuild(faction);
  const legs = legPairParts(r, c, { gauge: 0.48, scale: 0.95 });
  const parts = [];

  // Pelvis and waist ring, so the torso sits on something rather than floating.
  parts.push(box(r * 0.66, r * 0.24, r * 0.82, HULL_DARK, { y: r * 0.94 }));
  parts.push(cylinder(r * 0.3, r * 0.3, r * 0.12, STEEL, { y: r * 1.06 }, 14));
  parts.push(...boltRing(r, { y: r * 1.1, radius: 0.24, count: 10, size: 0.026 }));

  // Torso in plain armour; the team colour goes on panels, not on all of it.
  parts.push(box(r * 1.15, r * 0.78, r * (wide ? 1.2 : 1.0), HULL, { y: r * 1.36 }));
  parts.push(...seam(r, { from: [-r * 0.5, r * 1.74, 0], to: [r * 0.5, r * 1.74, 0], width: 0.04 }));
  // Legion carries a slab of frontal armour; Vanguard gets a sloped prow.
  if (wide) {
    parts.push(...armourPlate(r, { x: r * 0.62, y: r * 1.36, w: 1.05, h: 0.62, d: 0.14, c }));
  } else {
    parts.push(box(r * 0.44, r * 0.54, r * 0.86, HULL_DARK, { x: r * 0.58, y: r * 1.36, rz: -0.26 }));
    parts.push(...boltLine(r, {
      from: [r * 0.72, r * 1.6, -r * 0.34], to: [r * 0.72, r * 1.6, r * 0.34], count: 4,
    }));
  }
  // Chest recognition panel and a rib down each flank.
  parts.push(box(r * 0.4, r * 0.28, r * 0.04, c.primary, { x: r * 0.42, y: r * 1.3, rz: -0.26 }));
  for (const side of [-1, 1]) {
    const z = side * r * (wide ? 0.62 : 0.52);
    parts.push(box(r * 0.9, r * 0.1, r * 0.04, c.primary, { z, y: r * 1.5 }));
    parts.push(...seam(r, { from: [-r * 0.45, r * 1.2, z], to: [r * 0.45, r * 1.2, z], width: 0.032 }));
  }

  // Head: sensor housing set into a collar, with an eye band.
  parts.push(cylinder(r * 0.2, r * 0.22, r * 0.12, HULL_DARK, { x: -r * 0.28, y: r * 1.74 }, 12));
  parts.push(box(r * 0.46, r * 0.32, r * 0.6, HULL, { x: -r * 0.3, y: r * 1.9 }));
  parts.push(box(r * 0.08, r * 0.13, r * 0.36, GLOW, { x: -r * 0.06, y: r * 1.92 }));
  parts.push(box(r * 0.3, r * 0.06, r * 0.5, HULL_DARK, { x: -r * 0.3, y: r * 2.07 }));
  parts.push(...aerial(r, { x: -r * 0.5, z: r * 0.2, y: r * 1.98, len: 0.9 }));

  // Back: power pack with a grille and its cooling run.
  parts.push(box(r * 0.34, r * 0.6, r * 0.74, HULL_DARK, { x: -r * 0.62, y: r * 1.4 }));
  parts.push(...grille(r, { x: -r * 0.78, y: r * 1.4, w: 0.1, d: 0.6, slats: 5 }));
  parts.push(...cable(r, [-r * 0.72, r * 1.66, -r * 0.24], [-r * 0.36, r * 1.78, -r * 0.3]));
  parts.push(...cable(r, [-r * 0.72, r * 1.62, r * 0.24], [-r * 0.36, r * 1.74, r * 0.3]));

  parts.push(...shoulder(r, c, { z: -r * 0.62, y: r * 1.56, scale: 0.9 }));
  parts.push(box(r * 0.4, r * 0.34, r * 0.44, HULL_DARK, { x: -r * 0.5, z: r * 0.4, y: r * 1.6 }));

  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      // Shoulder mount, upper arm, and the weapon it carries.
      cylinder(r * 0.22, r * 0.22, r * 0.26, HULL_DARK, { rx: Math.PI / 2 }, 12),
      ...boltRing(r, { y: r * 0.14, radius: 0.16, count: 7, size: 0.026 }),
      box(r * 0.44, r * 0.36, r * 0.42, HULL, { x: r * 0.1 }),
      box(r * 0.95, r * 0.2, r * 0.2, HULL_LIGHT, { x: r * 0.62 }),
      cylinder(r * 0.09, r * 0.09, r * 0.26, STEEL, { x: r * 1.12, rz: Math.PI / 2 }, 10),
      cylinder(r * 0.12, r * 0.1, r * 0.1, GREASE, { x: r * 1.3, rz: Math.PI / 2 }, 10),
      // Magazine, heat shroud and a carry handle over the receiver.
      box(r * 0.2, r * 0.3, r * 0.16, GREASE, { x: r * 0.44, y: -r * 0.22 }),
      ...[-1, 1].map((side) =>
        box(r * 0.42, r * 0.05, r * 0.05, STEEL, { x: r * 0.64, z: side * r * 0.1, y: r * 0.12 })),
      box(r * 0.26, r * 0.05, r * 0.1, HULL_DARK, { x: r * 0.3, y: r * 0.22 }),
      box(r * 0.3, r * 0.12, r * 0.04, c.primary, { x: r * 0.12, z: r * 0.22 }),
    ]),
    turretY: r * 1.6,
  };
}

function rocket(r, c) {
  const legs = legPairParts(r, c, { gauge: 0.5, scale: 1.0 });
  const parts = [];
  parts.push(box(r * 0.7, r * 0.24, r * 0.86, HULL_DARK, { y: r * 0.94 }));
  parts.push(cylinder(r * 0.28, r * 0.28, r * 0.12, STEEL, { y: r * 1.06 }, 14));
  parts.push(...boltRing(r, { y: r * 1.1, radius: 0.22, count: 9, size: 0.026 }));
  // Squat torso: this one is a launcher platform rather than a fighter.
  parts.push(box(r * 1.0, r * 0.7, r * 1.1, HULL, { y: r * 1.36 }));
  parts.push(box(r * 0.36, r * 0.5, r * 0.9, HULL_DARK, { x: r * 0.56, y: r * 1.3, rz: -0.2 }));
  parts.push(...seam(r, { from: [-r * 0.45, r * 1.72, 0], to: [r * 0.4, r * 1.72, 0], width: 0.04 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 0.8, r * 0.1, r * 0.04, c.primary, { z: side * r * 0.57, y: r * 1.5 }));
  }
  parts.push(box(r * 0.4, r * 0.28, r * 0.5, HULL_DARK, { x: -r * 0.24, y: r * 1.78 }));
  parts.push(box(r * 0.07, r * 0.12, r * 0.3, GLOW, { x: -r * 0.04, y: r * 1.8 }));
  parts.push(...optics(r, { x: -r * 0.2, z: -r * 0.3, y: r * 1.8, scale: 0.6 }));
  // Reload magazine on the back, with its handling rail.
  parts.push(box(r * 0.34, r * 0.62, r * 0.86, HULL_DARK, { x: -r * 0.6, y: r * 1.38 }));
  parts.push(...grille(r, { x: -r * 0.77, y: r * 1.38, w: 0.1, d: 0.7, slats: 6 }));
  parts.push(...railing(r, { from: [-r * 0.6, r * 1.7, -r * 0.34], to: [-r * 0.6, r * 1.7, r * 0.34], posts: 3, height: 0.14 }));
  parts.push(...cable(r, [-r * 0.7, r * 1.64, r * 0.3], [-r * 0.28, r * 1.74, r * 0.36]));
  parts.push(...shoulder(r, c, { z: -r * 0.66, y: r * 1.54, scale: 0.95 }));
  parts.push(...aerial(r, { x: -r * 0.44, z: r * 0.3, y: r * 1.86, len: 1.1 }));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      cylinder(r * 0.22, r * 0.22, r * 0.24, HULL_DARK, { rx: Math.PI / 2 }, 12),
      // Four-cell launcher with loaded warheads showing.
      box(r * 0.62, r * 0.56, r * 0.66, HULL, { x: r * 0.2 }),
      ...[-1, 1].flatMap((sz) => [-1, 1].map((sy) =>
        cylinder(r * 0.13, r * 0.13, r * 0.14, GREASE, {
          x: r * 0.52, z: sz * r * 0.17, y: sy * r * 0.16, rz: Math.PI / 2,
        }, 10))),
      ...[-1, 1].flatMap((sz) => [-1, 1].map((sy) =>
        cone(r * 0.1, r * 0.22, '#ff9a5b', {
          x: r * 0.64, z: sz * r * 0.17, y: sy * r * 0.16, rz: -Math.PI / 2,
        }, 8))),
      ...boltRing(r, { x: r * 0.2, y: r * 0.3, radius: 0.24, count: 8, size: 0.026 }),
      box(r * 0.5, r * 0.05, r * 0.16, c.primary, { x: r * 0.2, y: r * 0.3 }),
      box(r * 0.22, r * 0.22, r * 0.3, HULL_DARK, { x: -r * 0.2 }),
    ]),
    turretY: r * 1.56,
  };
}

function heavy(r, c) {
  const legs = legPairParts(r, c, { gauge: 0.62, scale: 1.35, splay: 0.16 });
  const parts = [];
  parts.push(box(r * 1.0, r * 0.3, r * 1.2, HULL_DARK, { y: r * 1.26 }));
  parts.push(cylinder(r * 0.4, r * 0.4, r * 0.16, STEEL, { y: r * 1.44 }, 16));
  parts.push(...boltRing(r, { y: r * 1.5, radius: 0.32, count: 12, size: 0.03 }));

  // Slab torso with bolted-on frontal armour: the silhouette of a siege unit.
  parts.push(box(r * 1.5, r * 1.05, r * 1.5, HULL, { y: r * 1.94 }));
  parts.push(...armourPlate(r, { x: r * 0.82, y: r * 1.94, w: 1.3, h: 0.9, d: 0.16, c }));
  parts.push(...seam(r, { from: [-r * 0.6, r * 2.47, 0], to: [r * 0.6, r * 2.47, 0], width: 0.05 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 1.2, r * 0.13, r * 0.05, c.primary, { z: side * r * 0.77, y: r * 2.2 }));
    parts.push(...seam(r, { from: [-r * 0.6, r * 1.6, side * r * 0.76], to: [r * 0.6, r * 1.6, side * r * 0.76] }));
    parts.push(...armourPlate(r, { x: -r * 0.1, y: r * 1.94, z: side * r * 0.82, w: 1.1, h: 0.5, d: 0.08, c }));
  }
  // Head sunk between the shoulders.
  parts.push(box(r * 0.5, r * 0.34, r * 0.66, HULL_DARK, { x: -r * 0.3, y: r * 2.58 }));
  parts.push(box(r * 0.08, r * 0.14, r * 0.46, GLOW, { x: -r * 0.06, y: r * 2.6 }));
  parts.push(...optics(r, { x: -r * 0.24, z: -r * 0.36, y: r * 2.62, scale: 0.75 }));
  // Power pack and heat exchangers.
  parts.push(box(r * 0.44, r * 0.86, r * 1.05, HULL_DARK, { x: -r * 0.86, y: r * 1.98 }));
  parts.push(...grille(r, { x: -r * 1.08, y: r * 1.98, w: 0.12, d: 0.9, slats: 7 }));
  parts.push(...exhaust(r, { x: -r * 0.86, z: r * 0.42, y: r * 2.42 }));
  parts.push(...exhaust(r, { x: -r * 0.86, z: -r * 0.42, y: r * 2.42 }));
  parts.push(...cable(r, [-r * 1.0, r * 2.3, -r * 0.34], [-r * 0.5, r * 2.44, -r * 0.42]));
  parts.push(...cable(r, [-r * 1.0, r * 2.26, r * 0.34], [-r * 0.5, r * 2.4, r * 0.42]));
  parts.push(...shoulder(r, c, { z: -r * 0.9, y: r * 2.18, scale: 1.2 }));
  parts.push(...aerial(r, { x: -r * 0.66, z: r * 0.44, y: r * 2.52, len: 1.2 }));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      cylinder(r * 0.3, r * 0.3, r * 0.34, HULL_DARK, { rx: Math.PI / 2 }, 14),
      ...boltRing(r, { y: r * 0.2, radius: 0.22, count: 9, size: 0.03 }),
      box(r * 0.6, r * 0.5, r * 0.56, HULL, { x: r * 0.18 }),
      // Twin heavy barrels with a shared shroud.
      ...[-1, 1].flatMap((side) => [
        cylinder(r * 0.11, r * 0.105, r * 1.35, HULL_LIGHT,
          { x: r * 0.94, z: side * r * 0.16, rz: Math.PI / 2 }, 12),
        cylinder(r * 0.15, r * 0.13, r * 0.2, GREASE,
          { x: r * 1.6, z: side * r * 0.16, rz: Math.PI / 2 }, 12),
      ]),
      box(r * 0.5, r * 0.26, r * 0.5, HULL_DARK, { x: r * 0.66 }),
      ...boltLine(r, { from: [r * 0.5, r * 0.14, -r * 0.22], to: [r * 0.86, r * 0.14, -r * 0.22], count: 3 }),
      box(r * 0.3, r * 0.34, r * 0.2, GREASE, { x: -r * 0.14, y: -r * 0.24 }),
      box(r * 0.4, r * 0.14, r * 0.04, c.primary, { x: r * 0.1, z: r * 0.29 }),
    ]),
    turretY: r * 2.2,
  };
}

function siege(r, c) {
  const legs = legPairParts(r, c, { gauge: 0.66, scale: 1.2, splay: 0.24 });
  const parts = [];
  // Wide, braced base: a firing platform rather than a walker.
  parts.push(box(r * 1.2, r * 0.3, r * 1.5, HULL_DARK, { y: r * 1.1 }));
  for (const side of [-1, 1]) {
    // Outriggers, planted.
    parts.push(box(r * 0.3, r * 0.14, r * 0.6, STEEL, { x: -r * 0.5, z: side * r * 0.9, y: r * 0.9, rz: 0.2 }));
    parts.push(cylinder(r * 0.12, r * 0.16, r * 0.5, HULL_DARK, { x: -r * 0.62, z: side * r * 1.0, y: r * 0.5 }, 10));
  }
  parts.push(cylinder(r * 0.36, r * 0.36, r * 0.14, STEEL, { y: r * 1.28 }, 16));
  parts.push(...boltRing(r, { y: r * 1.34, radius: 0.28, count: 11, size: 0.03 }));
  parts.push(box(r * 1.1, r * 0.66, r * 1.2, HULL, { y: r * 1.62 }));
  parts.push(...grille(r, { x: -r * 0.5, y: r * 1.95, w: 0.4, d: 0.9, slats: 6 }));
  parts.push(...seam(r, { from: [-r * 0.5, r * 1.96, 0], to: [r * 0.5, r * 1.96, 0], width: 0.04 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 0.9, r * 0.1, r * 0.04, c.primary, { z: side * r * 0.62, y: r * 1.74 }));
  }
  parts.push(box(r * 0.4, r * 0.3, r * 0.5, HULL_DARK, { x: r * 0.5, y: r * 1.98 }));
  parts.push(...optics(r, { x: r * 0.56, z: -r * 0.2, y: r * 2.04, scale: 0.7 }));
  parts.push(...aerial(r, { x: -r * 0.5, z: r * 0.44, y: r * 1.94, len: 1.4 }));
  parts.push(...cable(r, [-r * 0.6, r * 1.9, r * 0.3], [-r * 0.1, r * 1.96, r * 0.5]));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      cylinder(r * 0.3, r * 0.3, r * 0.3, HULL_DARK, { rx: Math.PI / 2 }, 14),
      box(r * 0.66, r * 0.48, r * 0.72, HULL, { x: r * 0.1 }),
      // Long gun on a cradle, with recuperators and a big brake.
      cylinder(r * 0.2, r * 0.2, r * 0.6, HULL_DARK, { x: r * 0.5, y: r * 0.1, rz: Math.PI / 2 - 0.1 }, 14),
      cylinder(r * 0.11, r * 0.105, r * 2.6, HULL_LIGHT, { x: r * 1.6, y: r * 0.24, rz: Math.PI / 2 - 0.1 }, 14),
      cylinder(r * 0.17, r * 0.17, r * 0.28, GREASE, { x: r * 2.85, y: r * 0.36, rz: Math.PI / 2 - 0.1 }, 14),
      ...[-1, 1].map((side) =>
        cylinder(r * 0.06, r * 0.06, r * 0.9, STEEL, { x: r * 1.0, z: side * r * 0.16, y: r * 0.36, rz: Math.PI / 2 - 0.1 }, 10)),
      box(r * 0.4, r * 0.4, r * 0.44, HULL_DARK, { x: -r * 0.3 }),
      ...boltRing(r, { x: -r * 0.3, y: r * 0.24, radius: 0.16, count: 8, size: 0.026 }),
      box(r * 0.3, r * 0.18, r * 0.22, GREASE, { x: -r * 0.44, z: r * 0.32 }),
      box(r * 0.36, r * 0.14, r * 0.03, c.primary, { x: -r * 0.16, z: r * 0.37 }),
    ]),
    turretY: r * 1.9,
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
  const tint = metalKind ? HULL : '#d8b24a';
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

// --------------------------------------------------------- detail vocabulary
//
// These exist because the models carry no textures: every panel line, bolt and
// grille has to be geometry, or the hulls read as bare blocks. They are kept
// cheap - a bolt is an eight-sided cylinder - and used in rows, because it is
// the repetition that makes a surface look manufactured rather than moulded.

const STEEL = '#7d838c';
const GREASE = '#3a3f46';

/** Bolt heads evenly spaced along a line. The cheapest read of "assembled". */
function boltLine(r, { from, to, count = 4, size = 0.05, colour = STEEL }) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    parts.push(cylinder(r * size, r * size, r * size * 0.7, colour, {
      x: from[0] + (to[0] - from[0]) * t,
      y: from[1] + (to[1] - from[1]) * t,
      z: from[2] + (to[2] - from[2]) * t,
      rx: Math.PI / 2,
    }, 6));
  }
  return parts;
}

/** Bolt heads around a circular rim: hatch collars, turret rings, hubs. */
function boltRing(r, { x = 0, y = 0, z = 0, radius = 0.3, count = 8, size = 0.045, colour = STEEL }) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    parts.push(cylinder(r * size, r * size, r * size * 0.8, colour, {
      x: x + Math.cos(a) * r * radius,
      z: z + Math.sin(a) * r * radius,
      y,
    }, 6));
  }
  return parts;
}

/** A raised weld seam. Breaks a long flat face into panels. */
function seam(r, { from, to, width = 0.035, colour = HULL_DARK }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz) || r * 0.1;
  return [box(len, r * width * 0.5, r * width, colour, {
    x: (from[0] + to[0]) / 2,
    y: (from[1] + to[1]) / 2,
    z: (from[2] + to[2]) / 2,
    ry: -Math.atan2(dz, dx),
  })];
}

/** A louvred grille: radiator faces, intakes, engine decks. */
function grille(r, { x = 0, y = 0, z = 0, w = 0.6, d = 0.5, slats = 6, colour = GREASE }) {
  const parts = [box(r * w, r * 0.05, r * d, colour, { x, y, z })];
  for (let i = 0; i < slats; i++) {
    const t = (i + 0.5) / slats - 0.5;
    parts.push(box(r * w * 0.9, r * 0.045, r * d * (0.55 / slats), STEEL,
      { x, y: y + r * 0.04, z: z + t * r * d, rx: 0.35 }));
  }
  return parts;
}

/** A hose or cable run, sagging between two points. */
function cable(r, from, to, { colour = GREASE, sag = 0.12, segments = 4, thickness = 0.028 } = {}) {
  const parts = [];
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const at = (t) => [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * r * sag,
      from[2] + (to[2] - from[2]) * t,
    ];
    const a = at(t0);
    const b = at(t1);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 0.001;
    parts.push(cylinder(r * thickness, r * thickness, len, colour, {
      x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2,
      rz: Math.atan2(dy, Math.hypot(dx, dz)) - Math.PI / 2,
      ry: -Math.atan2(dz, dx),
    }, 5));
  }
  return parts;
}

/** A sensor block: armoured housing with lenses that catch the light. */
function optics(r, { x = 0, y = 0, z = 0, scale = 1, glow = GLOW } = {}) {
  return [
    box(r * 0.3 * scale, r * 0.22 * scale, r * 0.4 * scale, HULL_DARK, { x, y, z }),
    box(r * 0.05 * scale, r * 0.16 * scale, r * 0.3 * scale, DARK, { x: x + r * 0.16 * scale, y, z }),
    cylinder(r * 0.06 * scale, r * 0.06 * scale, r * 0.05 * scale, glow,
      { x: x + r * 0.19 * scale, y: y + r * 0.03 * scale, z: z - r * 0.08 * scale, rz: Math.PI / 2 }, 8),
    cylinder(r * 0.04 * scale, r * 0.04 * scale, r * 0.05 * scale, GLASS,
      { x: x + r * 0.19 * scale, y: y + r * 0.03 * scale, z: z + r * 0.09 * scale, rz: Math.PI / 2 }, 8),
    ...boltLine(r, {
      from: [x - r * 0.13 * scale, y + r * 0.12 * scale, z - r * 0.15 * scale],
      to: [x + r * 0.1 * scale, y + r * 0.12 * scale, z - r * 0.15 * scale],
      count: 3, size: 0.028 * scale,
    }),
  ];
}

/** Grab rails along a hull, the detail that gives a vehicle human scale. */
function railing(r, { from, to, posts = 3, height = 0.16, thickness = 0.022 } = {}) {
  const parts = [];
  const top = [];
  for (let i = 0; i < posts; i++) {
    const t = posts === 1 ? 0.5 : i / (posts - 1);
    const px = from[0] + (to[0] - from[0]) * t;
    const py = from[1] + (to[1] - from[1]) * t;
    const pz = from[2] + (to[2] - from[2]) * t;
    parts.push(cylinder(r * thickness, r * thickness, r * height, STEEL,
      { x: px, y: py + r * height * 0.5, z: pz }, 5));
    top.push([px, py + r * height, pz]);
  }
  for (let i = 0; i < top.length - 1; i++) {
    parts.push(...cable(r, top[i], top[i + 1], { colour: STEEL, sag: 0, segments: 1, thickness }));
  }
  return parts;
}

/** An armour plate laid over a hull face, bolted at its edge. */
function armourPlate(r, { x = 0, y = 0, z = 0, w = 0.5, h = 0.4, d = 0.08, tilt = 0, colour = null, c = null }) {
  const shade = colour || (c ? c.dark : HULL_DARK);
  return [
    box(r * d, r * h, r * w, shade, { x, y, z, rz: tilt }),
    ...boltLine(r, {
      from: [x + r * d * 0.6, y + r * h * 0.38, z - r * w * 0.38],
      to: [x + r * d * 0.6, y + r * h * 0.38, z + r * w * 0.38],
      count: 4, size: 0.032,
    }),
  ];
}

/** Tool and track-link stowage, strapped to a hull side. */
function toolRack(r, { x = 0, y = 0, z = 0, count = 3 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * 0.22;
    parts.push(box(r * 0.18, r * 0.05, r * 0.05, i % 2 ? STEEL : GREASE,
      { x: x + t * r, y, z }));
  }
  parts.push(box(r * 0.02, r * 0.09, r * 0.02, GREASE, { x: x - r * 0.2, y, z }));
  parts.push(box(r * 0.02, r * 0.09, r * 0.02, GREASE, { x: x + r * 0.2, y, z }));
  return parts;
}

function runningGear(len, width, height, gauge, wheels = 5) {
  const parts = [];
  const wheelR = height * 0.62;
  for (const side of [-gauge, gauge]) {
    // Track guard over the top of the run.
    parts.push(box(len, height * 0.34, width, TRACK, { z: side, y: height * 0.82 }));
    parts.push(box(len * 0.98, height * 0.16, width * 0.55, '#53585f', { z: side, y: height * 1.0 }));
    for (let i = 0; i < wheels; i++) {
      const t = wheels === 1 ? 0 : (i / (wheels - 1)) * 2 - 1;
      parts.push(cylinder(wheelR, wheelR, width * 0.72, GREASE, {
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
    cylinder(r * 0.08, r * 0.09, r * 0.3, GREASE, { x, z, y: y + r * 0.15 }, 10),
    cylinder(r * 0.11, r * 0.11, r * 0.06, STEEL, { x, z, y: y + r * 0.3 }, 10),
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
/**
 * Legs as separate parts, each with its hip pivot, so the view can swing
 * them. `legPair` below flattens this for anything that only wants geometry.
 *
 * Animation is the single largest thing separating "models" from "a game":
 * a walker that glides is a chess piece. Each leg is exported as its own node
 * hung from the hip, and unit_view.gd rocks it fore and aft in time with the
 * unit's speed. That is all a walk cycle is at this camera distance.
 */
function legPairParts(r, c, { gauge = 0.5, scale = 1, splay = 0.12 } = {}) {
  const legs = [];
  const s = scale;
  for (const side of [-gauge, gauge]) {
    const parts = [];
    const dir = side < 0 ? -1 : 1;
    // Hip actuator, with its bolted collar.
    parts.push(cylinder(r * 0.17 * s, r * 0.17 * s, r * 0.22 * s, HULL, {
      z: side * r, y: r * 0.92 * s, rx: Math.PI / 2,
    }, 12));
    parts.push(cylinder(r * 0.2 * s, r * 0.2 * s, r * 0.06 * s, HULL_DARK, {
      z: side * r * 1.06, y: r * 0.92 * s, rx: Math.PI / 2,
    }, 12));
    parts.push(...boltRing(r, {
      z: side * r * 1.1, y: r * 0.92 * s, radius: 0.13 * s, count: 6, size: 0.026 * s,
    }));

    // Thigh, angled back; shin, angled forward. A slight Z stance reads as
    // load-bearing rather than as two vertical posts.
    parts.push(box(r * 0.24 * s, r * 0.56 * s, r * 0.24 * s, HULL_DARK, {
      x: -r * 0.06 * s, z: side * r, y: r * 0.66 * s, rz: 0.16,
    }));
    // Hydraulic ram alongside the thigh: the detail that says "powered".
    parts.push(cylinder(r * 0.05 * s, r * 0.05 * s, r * 0.34 * s, STEEL, {
      x: r * 0.1 * s, z: side * r, y: r * 0.72 * s, rz: 0.16,
    }, 8));
    parts.push(cylinder(r * 0.035 * s, r * 0.035 * s, r * 0.26 * s, HULL_LIGHT, {
      x: r * 0.07 * s, z: side * r, y: r * 0.48 * s, rz: 0.16,
    }, 8));

    // Knee: joint pin plus a shin guard over the front of it.
    parts.push(cylinder(r * 0.13 * s, r * 0.13 * s, r * 0.2 * s, HULL_LIGHT, {
      x: -r * 0.14 * s, z: side * r, y: r * 0.4 * s, rx: Math.PI / 2,
    }, 10));
    parts.push(box(r * 0.1 * s, r * 0.26 * s, r * 0.24 * s, c.dark, {
      x: -r * 0.02 * s, z: side * r, y: r * 0.38 * s, rz: -0.3,
    }));

    parts.push(box(r * 0.2 * s, r * 0.42 * s, r * 0.2 * s, HULL_DARK, {
      x: -r * 0.06 * s, z: side * (r + dir * splay * r * 0.3), y: r * 0.2 * s, rz: -0.2,
    }));
    // Ankle linkage.
    parts.push(cylinder(r * 0.04 * s, r * 0.04 * s, r * 0.22 * s, STEEL, {
      x: -r * 0.16 * s, z: side * (r + dir * splay * r * 0.4), y: r * 0.2 * s, rz: -0.2,
    }, 6));

    // Foot: sole, toe plate and a heel spur.
    parts.push(box(r * 0.48 * s, r * 0.1 * s, r * 0.32 * s, '#3d4148', {
      x: r * 0.02 * s, z: side * (r + dir * splay * r), y: r * 0.06 * s,
    }));
    parts.push(box(r * 0.18 * s, r * 0.08 * s, r * 0.28 * s, c.dark, {
      x: r * 0.24 * s, z: side * (r + dir * splay * r), y: r * 0.11 * s,
    }));
    parts.push(box(r * 0.1 * s, r * 0.07 * s, r * 0.22 * s, '#33373d', {
      x: -r * 0.22 * s, z: side * (r + dir * splay * r), y: r * 0.09 * s, rz: 0.3,
    }));
    parts.push(...boltLine(r, {
      from: [-r * 0.12 * s, r * 0.12 * s, side * (r + dir * splay * r)],
      to: [r * 0.16 * s, r * 0.12 * s, side * (r + dir * splay * r)],
      count: 3, size: 0.026 * s,
    }));
    legs.push({ parts, pivot: [0, r * 0.92 * s, side * r], phase: side < 0 ? 0 : 1 });
  }
  return legs;
}

function legPair(r, c, opts = {}) {
  return legPairParts(r, c, opts).flatMap((l) => l.parts);
}

/** Merge each leg's parts, ready for the exporter and the renderer. */
function legGeos(legs) {
  return legs.map((l) => ({ geo: merge(l.parts), pivot: l.pivot, phase: l.phase }));
}

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
  const parts = [];
  const wheel = (x, z) => [
    cylinder(r * 0.3, r * 0.3, r * 0.22, GREASE, { x, z, y: r * 0.3, rx: Math.PI / 2 }, 14),
    cylinder(r * 0.14, r * 0.14, r * 0.25, STEEL, { x, z, y: r * 0.3, rx: Math.PI / 2 }, 10),
  ];
  for (const [x, z] of [[0.6, -0.55], [0.6, 0.55], [-0.6, -0.55], [-0.6, 0.55]]) {
    parts.push(...wheel(x * r, z * r));
  }
  // Flatbed with a cab forward and a nanolathe gantry over the deck.
  parts.push(box(r * 1.8, r * 0.28, r * 0.9, HULL, { y: r * 0.56 }));
  parts.push(box(r * 0.62, r * 0.5, r * 0.82, HULL, { x: r * 0.56, y: r * 0.92 }));
  parts.push(box(r * 0.05, r * 0.3, r * 0.68, GLASS, { x: r * 0.86, y: r * 1.0 }));
  parts.push(box(r * 0.66, r * 0.05, r * 0.84, HULL_DARK, { x: r * 0.56, y: r * 1.18 }));
  parts.push(...grille(r, { x: r * 0.56, y: r * 1.2, w: 0.3, d: 0.5, slats: 4 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 1.1, r * 0.09, r * 0.04, c.primary, { x: -r * 0.2, z: side * r * 0.46, y: r * 0.6 }));
    parts.push(box(r * 0.06, r * 0.42, r * 0.06, STEEL, { x: -r * 0.75, z: side * r * 0.36, y: r * 0.9 }));
  }
  parts.push(box(r * 0.9, r * 0.06, r * 0.78, STEEL, { x: -r * 0.5, y: r * 1.12 }));
  parts.push(box(r * 0.34, r * 0.3, r * 0.5, HULL_DARK, { x: -r * 0.5, y: r * 0.84 }));
  parts.push(...cable(r, [-r * 0.8, r * 1.1, r * 0.2], [-r * 0.3, r * 0.98, r * 0.34]));
  parts.push(...toolRack(r, { x: -r * 0.2, z: -r * 0.5, y: r * 0.74, count: 3 }));
  parts.push(...aerial(r, { x: r * 0.26, z: r * 0.36, y: r * 1.2, len: 1.0 }));
  return {
    body: merge(parts),
    turret: merge([
      cylinder(r * 0.16, r * 0.18, r * 0.14, HULL, {}, 12),
      box(r * 0.5, r * 0.16, r * 0.22, HULL_LIGHT, { x: r * 0.3, y: r * 0.06 }),
      cylinder(r * 0.1, r * 0.06, r * 0.24, GLOW, { x: r * 0.62, y: r * 0.06, rz: Math.PI / 2 }, 10),
      box(r * 0.2, r * 0.18, r * 0.24, HULL_DARK, { x: -r * 0.1, y: r * 0.08 }),
    ]),
    turretY: r * 1.24,
  };
}

function conJeep(r, c) {
  const parts = [];
  // Wheels with a hub, a rim and visible tread blocks.
  const wheel = (x, z) => {
    const out = [
      cylinder(r * 0.32, r * 0.32, r * 0.2, GREASE, { x, z, y: r * 0.32, rx: Math.PI / 2 }, 14),
      cylinder(r * 0.16, r * 0.16, r * 0.23, STEEL, { x, z, y: r * 0.32, rx: Math.PI / 2 }, 10),
      cylinder(r * 0.07, r * 0.07, r * 0.25, HULL_LIGHT, { x, z, y: r * 0.32, rx: Math.PI / 2 }, 8),
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push(box(r * 0.09, r * 0.06, r * 0.21, '#24272c', {
        x: x + Math.cos(a) * r * 0.3, y: r * 0.32 + Math.sin(a) * r * 0.3, z, ry: 0, rz: -a,
      }));
    }
    return out;
  };
  for (const [x, z] of [[0.64, -0.58], [0.64, 0.58], [-0.64, -0.58], [-0.64, 0.58]]) {
    parts.push(...wheel(x * r, z * r));
  }

  // Chassis rails and a plain metal body. Team colour goes on the bonnet and
  // a stripe down each flank, not over the whole vehicle.
  parts.push(box(r * 1.9, r * 0.1, r * 0.72, GREASE, { y: r * 0.4 }));
  parts.push(box(r * 1.85, r * 0.32, r * 0.92, HULL, { y: r * 0.6 }));
  parts.push(box(r * 0.62, r * 0.22, r * 0.86, HULL, { x: r * 0.6, y: r * 0.84 }));
  parts.push(box(r * 0.5, r * 0.03, r * 0.6, c.primary, { x: r * 0.6, y: r * 0.96 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 1.3, r * 0.1, r * 0.04, c.primary, { z: side * r * 0.47, y: r * 0.62 }));
    parts.push(...seam(r, { from: [-r * 0.7, r * 0.76, side * r * 0.46], to: [r * 0.7, r * 0.76, side * r * 0.46], width: 0.03 }));
  }
  // Bonnet louvres and headlamps.
  parts.push(...grille(r, { x: r * 0.62, y: r * 0.96, w: 0.34, d: 0.6, slats: 5 }));
  for (const side of [-1, 1]) {
    parts.push(cylinder(r * 0.13, r * 0.13, r * 0.09, HULL_DARK,
      { x: r * 0.92, z: side * r * 0.28, y: r * 0.68, rz: Math.PI / 2 }, 12));
    parts.push(cylinder(r * 0.1, r * 0.1, r * 0.04, GLASS,
      { x: r * 0.97, z: side * r * 0.28, y: r * 0.68, rz: Math.PI / 2 }, 12));
  }
  parts.push(box(r * 0.16, r * 0.12, r * 0.9, GREASE, { x: r * 1.0, y: r * 0.5 }));

  // Windscreen frame, roll cage, seats and a spare wheel on the tail.
  parts.push(box(r * 0.07, r * 0.36, r * 0.8, HULL, { x: r * 0.26, y: r * 0.96, rz: -0.28 }));
  parts.push(box(r * 0.05, r * 0.3, r * 0.72, GLASS, { x: r * 0.25, y: r * 0.96, rz: -0.28 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 0.06, r * 0.5, r * 0.06, STEEL, { x: -r * 0.55, z: side * r * 0.4, y: r * 0.92 }));
    parts.push(box(r * 0.06, r * 0.24, r * 0.34, HULL_DARK, { x: -r * 0.18, z: side * r * 0.24, y: r * 0.86 }));
  }
  parts.push(box(r * 0.9, r * 0.06, r * 0.86, STEEL, { x: -r * 0.12, y: r * 1.16 }));
  parts.push(...railing(r, { from: [-r * 0.9, r * 0.76, 0], to: [-r * 0.4, r * 0.76, 0], posts: 2, height: 0.14 }));
  parts.push(cylinder(r * 0.3, r * 0.3, r * 0.16, GREASE, { x: -r * 0.98, y: r * 0.74, rz: Math.PI / 2 }, 14));
  parts.push(...boltRing(r, { x: -r * 1.06, y: r * 0.74, radius: 0.12, count: 6, size: 0.028 }));
  parts.push(...aerial(r, { x: -r * 0.4, z: r * 0.42, y: r * 0.78, len: 1.1 }));
  parts.push(...toolRack(r, { x: -r * 0.5, z: -r * 0.5, y: r * 0.78, count: 2 }));

  return {
    body: merge(parts),
    turret: merge([
      // Pintle mount with a shield, ammo box and a proper machine gun.
      cylinder(r * 0.15, r * 0.17, r * 0.14, HULL, {}, 12),
      ...boltRing(r, { y: r * 0.08, radius: 0.12, count: 6, size: 0.024 }),
      box(r * 0.06, r * 0.3, r * 0.44, HULL_DARK, { x: r * 0.16, y: r * 0.18 }),
      box(r * 0.3, r * 0.14, r * 0.12, STEEL, { x: r * 0.2, y: r * 0.08 }),
      box(r * 0.8, r * 0.07, r * 0.07, HULL_LIGHT, { x: r * 0.5, y: r * 0.08 }),
      cylinder(r * 0.05, r * 0.05, r * 0.2, GREASE, { x: r * 0.92, y: r * 0.08, rz: Math.PI / 2 }, 8),
      box(r * 0.2, r * 0.16, r * 0.14, GREASE, { x: r * 0.04, z: r * 0.14, y: r * 0.04 }),
      box(r * 0.22, r * 0.2, r * 0.28, HULL_DARK, { x: -r * 0.14, y: r * 0.1 }),
    ]),
    turretY: r * 1.1,
  };
}

function conTank(r, c) {
  const parts = runningGear(r * 2.15, r * 0.5, r * 0.56, r * 0.68, 6);

  // Lower hull in plain metal. The team colour is an accent here, not the
  // paint job: a hull that is entirely one saturated colour reads as a toy,
  // however much detail is bolted to it.
  parts.push(box(r * 1.8, r * 0.44, r * 1.3, HULL, { y: r * 0.78 }));
  // Sloped glacis, with its weld seam and the tow points either side.
  parts.push(box(r * 0.7, r * 0.34, r * 1.26, HULL, { x: r * 1.0, y: r * 0.74, rz: -0.34 }));
  parts.push(...seam(r, { from: [r * 0.66, r * 1.0, -r * 0.63], to: [r * 0.66, r * 1.0, r * 0.63] }));
  parts.push(...boltLine(r, {
    from: [r * 1.22, r * 0.62, -r * 0.5], to: [r * 1.22, r * 0.62, r * 0.5], count: 5,
  }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 0.22, r * 0.12, r * 0.14, STEEL, { x: r * 1.26, z: side * r * 0.44, y: r * 0.6 }));
  }

  // Fenders over the tracks, with the mudguard lip that catches the light.
  for (const side of [-1, 1]) {
    parts.push(box(r * 1.9, r * 0.07, r * 0.3, HULL_DARK, { z: side * r * 0.74, y: r * 0.98 }));
    parts.push(box(r * 0.26, r * 0.2, r * 0.28, HULL_DARK, { x: -r * 0.98, z: side * r * 0.74, y: r * 0.9 }));
    parts.push(...seam(r, {
      from: [-r * 0.9, r * 1.02, side * r * 0.74], to: [r * 0.9, r * 1.02, side * r * 0.74], width: 0.03,
    }));
  }

  // Engine deck: the biggest flat face on the hull, so it carries the grille.
  parts.push(...grille(r, { x: -r * 0.62, y: r * 1.0, w: 0.62, d: 1.15, slats: 7 }));
  parts.push(...boltRing(r, { x: -r * 0.62, y: r * 1.02, radius: 0.42, count: 10, size: 0.03 }));
  parts.push(...exhaust(r, { x: -r * 0.86, z: r * 0.46, y: r * 1.0 }));
  parts.push(...exhaust(r, { x: -r * 0.86, z: -r * 0.46, y: r * 1.0 }));

  // Crew kit: the details that give a vehicle human scale.
  parts.push(...toolRack(r, { x: -r * 0.3, z: r * 0.78, y: r * 1.04 }));
  parts.push(...stowage(r, c, { x: -r * 0.36, z: -r * 0.78, y: r * 1.04, count: 3, spacing: 0.26 }));
  parts.push(...railing(r, {
    from: [-r * 0.2, r * 1.02, r * 0.6], to: [r * 0.5, r * 1.02, r * 0.6], posts: 3,
  }));
  parts.push(...cable(r, [-r * 0.85, r * 1.04, -r * 0.2], [-r * 0.3, r * 1.02, -r * 0.5]));

  // Team colour: a band along the hull sides and a recognition panel.
  for (const side of [-1, 1]) {
    parts.push(box(r * 1.5, r * 0.11, r * 0.05, c.primary, { z: side * r * 0.66, y: r * 0.86 }));
  }
  parts.push(box(r * 0.34, r * 0.03, r * 0.5, c.primary, { x: -r * 0.05, y: r * 1.01 }));

  return {
    body: merge(parts),
    turret: merge([
      // Faceted turret: front plate, cheeks, bustle.
      box(r * 1.0, r * 0.42, r * 0.95, HULL, {}),
      box(r * 0.46, r * 0.36, r * 0.8, HULL, { x: r * 0.6, rz: -0.24 }),
      box(r * 0.58, r * 0.32, r * 0.86, HULL_DARK, { x: -r * 0.62 }),
      // Bustle rack: open stowage behind the turret.
      box(r * 0.5, r * 0.24, r * 0.8, GREASE, { x: -r * 0.68, y: r * 0.2 }),
      ...toolRack(r, { x: -r * 0.68, y: r * 0.3, count: 3 }),
      // Mantlet, then the gun through it.
      cylinder(r * 0.26, r * 0.26, r * 0.34, HULL_DARK, { x: r * 0.82, rz: Math.PI / 2 }, 14),
      ...boltRing(r, { x: r * 0.8, radius: 0.22, count: 9, size: 0.032 }),
      ...gunBarrel(r, { len: 1.5, calibre: 0.115 }),
      ...cupola(r, c, { x: -r * 0.12, z: r * 0.26, y: r * 0.2 }),
      ...boltRing(r, { x: -r * 0.12, z: r * 0.26, y: r * 0.22, radius: 0.2, count: 8, size: 0.026 }),
      ...optics(r, { x: r * 0.22, z: -r * 0.3, y: r * 0.22, scale: 0.8 }),
      // Smoke dischargers, angled outboard.
      ...[-1, 1].map((side) =>
        box(r * 0.12, r * 0.14, r * 0.36, HULL_DARK, { x: r * 0.2, z: side * r * 0.46, y: r * 0.16, ry: side * 0.3 })),
      ...[-1, 1].flatMap((side) => boltLine(r, {
        from: [r * 0.12, r * 0.24, side * r * 0.46], to: [r * 0.3, r * 0.24, side * r * 0.46],
        count: 3, size: 0.028,
      })),
      box(r * 0.46, r * 0.09, r * 0.09, HULL_LIGHT, { x: r * 0.44, z: -r * 0.24, y: r * 0.14 }),
      ...aerial(r, { x: -r * 0.5, z: -r * 0.34, y: r * 0.18, len: 1.1 }),
      // Turret-side team panel, where an insignia would go.
      ...[-1, 1].map((side) =>
        box(r * 0.42, r * 0.2, r * 0.03, c.primary, { x: -r * 0.08, z: side * r * 0.49 })),
      ...seam(r, { from: [-r * 0.42, r * 0.22, 0], to: [r * 0.4, r * 0.22, 0], width: 0.03 }),
    ]),
    turretY: r * 1.02,
  };
}
// Concord structures: a field base, not a factory floor. Poured concrete
// pads with steel bollards, sandbags where something shoots, corrugated
// walls, floodlights, drums and pipe racks - the furniture of a human army
// that arrived by truck. Team colour is a hazard stripe and a pennant; the
// walls are steel and concrete, as they are on the hulls.

const CONCRETE = '#5b6068';   // the exporter's Concrete slot
const CONCRETE_DARK = DARK;
const SANDBAG = '#8a7d5e';
const DRUM = '#4c6b3a';

/** A concrete pad with joint lines, corner bollards and one striped edge. */
function conPad(s, c, h = 2.5) {
  const parts = [
    box(s, h, s, CONCRETE_DARK, { y: h * 0.5 }),
    box(s * 0.92, h * 0.5, s * 0.92, CONCRETE, { y: h * 1.1 }),
  ];
  // Expansion joints, cut as thin dark lines across the slab.
  for (const t of [-0.25, 0.25]) {
    parts.push(box(s * 0.92, h * 0.12, s * 0.014, CONCRETE_DARK, { z: t * s, y: h * 1.36 }));
    parts.push(box(s * 0.014, h * 0.12, s * 0.92, CONCRETE_DARK, { x: t * s, y: h * 1.36 }));
  }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(cylinder(s * 0.03, s * 0.035, h * 2.2, STEEL, { x: dx * s * 0.44, z: dz * s * 0.44, y: h * 1.6 }, 8));
    parts.push(cylinder(s * 0.032, s * 0.032, h * 0.5, c.primary, { x: dx * s * 0.44, z: dz * s * 0.44, y: h * 2.5 }, 8));
  }
  // Hazard stripe along the front edge, where the traffic is.
  for (let i = 0; i < 6; i++) {
    parts.push(box(s * 0.11, h * 0.08, s * 0.05, i % 2 ? c.primary : DARK, {
      x: (i - 2.5) * s * 0.14, z: s * 0.44, y: h * 1.38,
    }));
  }
  return parts;
}

/** A ring of sandbags, two courses high, with a gap on +X. */
function sandbags(s, { radius = 0.4, y = 0, gap = true }) {
  const parts = [];
  const n = Math.max(10, Math.round(radius * s / 5));
  for (let course = 0; course < 2; course++) {
    for (let i = 0; i < n; i++) {
      const a = (i + course * 0.5) / n * Math.PI * 2;
      if (gap && Math.abs(a) < 0.35) continue;
      parts.push(box(s * 0.11, s * 0.045, s * 0.06, SANDBAG, {
        x: Math.cos(a) * s * radius, z: Math.sin(a) * s * radius,
        y: y + s * (0.025 + course * 0.045), ry: -a,
      }));
    }
  }
  return parts;
}

/** A corrugated wall: a slab with vertical seams and a top rail. */
function corrugated(s, w, hgt, thick, { x = 0, y = 0, z = 0, ry = 0, colour = HULL } = {}) {
  const parts = [box(w, hgt, thick, colour, { x, y, z, ry })];
  const n = Math.max(3, Math.round(w / (s * 0.08)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    parts.push(box(w * 0.01, hgt * 0.92, thick * 1.3, HULL_DARK, {
      x: x + Math.cos(ry) * t * w, z: z - Math.sin(ry) * t * w, y, ry,
    }));
  }
  parts.push(box(w, hgt * 0.06, thick * 1.5, HULL_LIGHT, { x, y: y + hgt * 0.5, z, ry }));
  return parts;
}

/** A floodlight on a mast: what says "people work here at night". */
function floodlight(s, { x = 0, z = 0, y = 0, h = 0.7, face = 0 }) {
  return [
    cylinder(s * 0.018, s * 0.022, s * h, STEEL, { x, z, y: y + s * h * 0.5 }, 6),
    box(s * 0.09, s * 0.06, s * 0.05, HULL_DARK, { x: x + Math.cos(face) * s * 0.04, z: z - Math.sin(face) * s * 0.04, y: y + s * h, ry: face }),
    box(s * 0.05, s * 0.045, s * 0.012, '#ffd76a', { x: x + Math.cos(face) * s * 0.075, z: z - Math.sin(face) * s * 0.075, y: y + s * h, ry: face }),
  ];
}

/** Fuel drums, stacked as a depot would. */
function drums(s, { x = 0, z = 0, y = 0, count = 3 }) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const dx = (i % 2) * s * 0.075;
    const dz = Math.floor(i / 2) * s * 0.075;
    parts.push(cylinder(s * 0.035, s * 0.035, s * 0.1, DRUM, { x: x + dx, z: z + dz, y: y + s * 0.05 }, 8));
    parts.push(cylinder(s * 0.037, s * 0.037, s * 0.008, HULL_DARK, { x: x + dx, z: z + dz, y: y + s * 0.03 }, 8));
    parts.push(cylinder(s * 0.037, s * 0.037, s * 0.008, HULL_DARK, { x: x + dx, z: z + dz, y: y + s * 0.08 }, 8));
  }
  return parts;
}

/** A pipe run with elbows and a flange, between two points at one height. */
function pipeRun(s, from, to, { r = 0.02, colour = STEEL } = {}) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const parts = [cylinder(s * r, s * r, len, colour, {
    x: (from[0] + to[0]) / 2, y: from[1], z: (from[2] + to[2]) / 2,
    ry: -Math.atan2(dz, dx), rz: Math.PI / 2,
  }, 8)];
  parts.push(cylinder(s * r * 1.5, s * r * 1.5, s * r * 1.2, HULL_DARK, {
    x: from[0] + dx * 0.3, y: from[1], z: from[2] + dz * 0.3, ry: -Math.atan2(dz, dx), rz: Math.PI / 2,
  }, 8));
  parts.push(sphere(s * r * 1.3, colour, { x: from[0], y: from[1], z: from[2] }, 6, 5));
  parts.push(sphere(s * r * 1.3, colour, { x: to[0], y: to[1], z: to[2] }, 6, 5));
  return parts;
}

/** A ladder up a face. */
function ladder(s, { x = 0, z = 0, y = 0, h = 0.5, ry = 0 }) {
  const parts = [];
  const rungs = Math.max(3, Math.round(h * s / 5));
  for (const side of [-1, 1]) {
    parts.push(box(s * 0.012, s * h, s * 0.012, STEEL, {
      x: x + Math.cos(ry) * side * s * 0.03, z: z - Math.sin(ry) * side * s * 0.03, y: y + s * h * 0.5,
    }));
  }
  for (let i = 0; i < rungs; i++) {
    parts.push(box(s * 0.07, s * 0.01, s * 0.01, STEEL, { x, z, y: y + s * h * (i + 0.5) / rungs, ry }));
  }
  return parts;
}

function conTankStore(s, c, metalKind) {
  const parts = conPad(s, c);
  const tint = metalKind ? HULL : '#d8b24a';
  for (const z of [-0.2, 0.2]) {
    parts.push(cylinder(s * 0.24, s * 0.24, s * 0.6, tint, { z: z * s, y: s * 0.42 }, 14));
    parts.push(cylinder(s * 0.25, s * 0.25, s * 0.03, HULL_DARK, { z: z * s, y: s * 0.72 }, 14));
    for (const y of [0.22, 0.42, 0.62]) {
      parts.push(...boltRing(s, { z: z * s, y: s * y, radius: 0.245, count: 12, size: 0.012 }));
    }
    parts.push(cylinder(s * 0.06, s * 0.06, s * 0.04, HULL_LIGHT, { z: z * s, y: s * 0.74 }, 8));
    parts.push(...ladder(s, { x: s * 0.25, z: z * s, y: s * 0.12, h: 0.6 }));
  }
  parts.push(...pipeRun(s, [0, s * 0.5, -s * 0.2], [0, s * 0.5, s * 0.2]));
  parts.push(...pipeRun(s, [-s * 0.1, s * 0.16, s * 0.2], [-s * 0.42, s * 0.16, s * 0.2]));
  parts.push(box(s * 0.16, s * 0.05, s * 0.5, c.primary, { x: -s * 0.36, y: s * 0.15 }));
  parts.push(...drums(s, { x: s * 0.3, z: -s * 0.4, y: s * 0.13, count: 3 }));
  return { body: merge(parts) };
}

function conYard(s, c, advanced) {
  const h = advanced ? 3.0 : 2.6;
  const parts = conPad(s, c, h);
  const wallH = s * (advanced ? 0.42 : 0.36);
  const wy = wallH * 0.5 + h;
  // A steel shed with corrugated walls and a roller door on +Z, the side
  // vehicles drive out of.
  parts.push(...corrugated(s, s * 0.9, wallH, s * 0.05, { z: -s * 0.4, y: wy }));
  parts.push(...corrugated(s, s * 0.8, wallH, s * 0.05, { x: s * 0.4, y: wy, ry: Math.PI / 2 }));
  parts.push(...corrugated(s, s * 0.8, wallH, s * 0.05, { x: -s * 0.4, y: wy, ry: Math.PI / 2 }));
  // Roof: two pitched slabs meeting at a ridge, with skylights.
  const ry = wallH + h;
  parts.push(box(s * 0.94, s * 0.04, s * 0.5, HULL_DARK, { z: -s * 0.23, y: ry + s * 0.04, rx: -0.16 }));
  parts.push(box(s * 0.94, s * 0.04, s * 0.5, HULL_DARK, { z: s * 0.23, y: ry + s * 0.04, rx: 0.16 }));
  parts.push(box(s * 0.96, s * 0.05, s * 0.06, HULL_LIGHT, { y: ry + s * 0.08 }));
  for (const x of [-0.3, 0, 0.3]) {
    parts.push(box(s * 0.16, s * 0.012, s * 0.14, GLASS, { x: x * s, z: -s * 0.22, y: ry + s * 0.07, rx: -0.16 }));
  }
  parts.push(...boltLine(s, { from: [-s * 0.42, ry + s * 0.09, 0], to: [s * 0.42, ry + s * 0.09, 0], count: 7, size: 0.014 }));
  // Roller door, its rail, and the lintel with the hazard stripe.
  parts.push(box(s * 0.62, wallH * 0.82, s * 0.04, DARK, { z: s * 0.4, y: wallH * 0.41 + h }));
  for (let i = 0; i < 6; i++) {
    parts.push(box(s * 0.62, wallH * 0.012, s * 0.05, DARK, { z: s * 0.4, y: h + wallH * (0.1 + i * 0.13) }));
  }
  parts.push(box(s * 0.9, s * 0.07, s * 0.1, HULL_DARK, { z: s * 0.4, y: wallH + h }));
  for (let i = 0; i < 8; i++) {
    parts.push(box(s * 0.1, s * 0.04, s * 0.012, i % 2 ? c.primary : DARK, { x: (i - 3.5) * s * 0.11, z: s * 0.43, y: wallH + h }));
  }
  // Hardstanding apron, drums, a floodlight and a pennant.
  parts.push(box(s * 0.7, s * 0.03, s * 0.28, '#33373d', { z: s * 0.6, y: h }));
  parts.push(...drums(s, { x: -s * 0.4, z: s * 0.5, y: h, count: 4 }));
  parts.push(...floodlight(s, { x: s * 0.44, z: s * 0.52, y: h, h: 0.5, face: Math.PI }));
  parts.push(cylinder(s * 0.012, s * 0.012, s * 0.5, STEEL, { x: -s * 0.42, z: -s * 0.42, y: ry + s * 0.2 }, 6));
  parts.push(box(s * 0.008, s * 0.08, s * 0.14, c.primary, { x: -s * 0.42, z: -s * 0.35, y: ry + s * 0.4 }));
  if (advanced) {
    // A gantry crane on the roof and a second, taller stack of plant.
    parts.push(box(s * 0.05, s * 0.3, s * 0.05, STEEL, { x: s * 0.3, z: -s * 0.3, y: ry + s * 0.2 }));
    parts.push(box(s * 0.05, s * 0.3, s * 0.05, STEEL, { x: -s * 0.3, z: -s * 0.3, y: ry + s * 0.2 }));
    parts.push(box(s * 0.7, s * 0.05, s * 0.06, HULL_LIGHT, { z: -s * 0.3, y: ry + s * 0.36 }));
    parts.push(...cable(s, [s * 0.3, ry + s * 0.34, -s * 0.3], [-s * 0.3, ry + s * 0.34, -s * 0.3], { sag: 0.05 }));
    parts.push(...grille(s, { x: s * 0.28, y: ry + s * 0.09, z: s * 0.18, w: 0.2, d: 0.16, slats: 5 }));
    parts.push(sphere(s * 0.05, GLOW, { z: -s * 0.3, y: ry + s * 0.3 }));
  }
  return { body: merge(parts) };
}

function conCrane(s, c) {
  const parts = conPad(s, c, 2);
  // Lattice mast: four legs, cross-braces, a ladder up one face.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.04, s * 0.95, s * 0.04, STEEL, { x: dx * s * 0.1, z: dz * s * 0.1, y: s * 0.5 }));
  }
  for (let i = 0; i < 5; i++) {
    const y = s * (0.12 + i * 0.18);
    parts.push(box(s * 0.24, s * 0.02, s * 0.02, STEEL, { z: s * 0.1, y }));
    parts.push(box(s * 0.24, s * 0.02, s * 0.02, STEEL, { z: -s * 0.1, y }));
    parts.push(box(s * 0.02, s * 0.02, s * 0.24, STEEL, { x: s * 0.1, y }));
    parts.push(box(s * 0.24, s * 0.02, s * 0.02, HULL_DARK, { z: s * 0.1, y: y + s * 0.09, rz: 0.6 }));
  }
  parts.push(...ladder(s, { x: -s * 0.11, y: s * 0.05, h: 0.85, ry: Math.PI / 2 }));
  parts.push(...drums(s, { x: s * 0.3, z: s * 0.3, y: 2, count: 2 }));
  parts.push(box(s * 0.12, s * 0.05, s * 0.3, c.primary, { x: -s * 0.36, y: 2.5 }));
  return {
    body: merge(parts),
    turret: merge([
      box(s * 0.26, s * 0.14, s * 0.26, HULL_LIGHT, {}),
      box(s * 0.08, s * 0.1, s * 0.16, GLASS, { x: s * 0.12, y: s * 0.03 }),
      box(s * 0.9, s * 0.07, s * 0.07, STEEL, { x: s * 0.42, rz: -0.12 }),
      box(s * 0.3, s * 0.07, s * 0.07, HULL_DARK, { x: -s * 0.2 }),
      box(s * 0.1, s * 0.12, s * 0.1, HULL_DARK, { x: -s * 0.32, y: -s * 0.02 }),
      ...cable(s, [s * 0.86, s * 0.02, 0], [s * 0.86, -s * 0.3, 0], { sag: 0.0, segments: 1 }),
      box(s * 0.06, s * 0.05, s * 0.06, HULL_LIGHT, { x: s * 0.86, y: -s * 0.3 }),
      sphere(s * 0.06, GLOW, { x: s * 0.86, y: -s * 0.36 }),
    ]),
    turretY: s * 0.98,
  };
}

function conBunker(s, c, big) {
  const h = big ? 2.4 : 2.0;
  const parts = conPad(s, c, h);
  // Sandbags around a low concrete casemate with a firing slit.
  parts.push(...sandbags(s, { radius: big ? 0.42 : 0.4, y: h, gap: false }));
  parts.push(box(s * 0.56, s * (big ? 0.3 : 0.24), s * 0.56, CONCRETE, { y: h + s * (big ? 0.15 : 0.12) }));
  parts.push(box(s * 0.6, s * 0.05, s * 0.6, CONCRETE_DARK, { y: h + s * (big ? 0.32 : 0.26) }));
  parts.push(box(s * 0.62, s * 0.04, s * 0.14, DARK, { x: s * 0.0, y: h + s * (big ? 0.2 : 0.16), z: s * 0.29 }));
  parts.push(...boltLine(s, { from: [-s * 0.26, h + s * 0.3, -s * 0.31], to: [s * 0.26, h + s * 0.3, -s * 0.31], count: 4, size: 0.014 }));
  for (const [dx, dz] of [[1, 1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.08, s * 0.05, s * 0.16, c.primary, { x: dx * s * 0.26, z: dz * s * 0.26, y: h + s * (big ? 0.35 : 0.29) }));
  }
  parts.push(...drums(s, { x: -s * 0.45, z: -s * 0.45, y: h, count: 1 }));
  return {
    body: merge(parts),
    turret: merge([
      box(s * 0.36, s * 0.24, s * 0.46, HULL, {}),
      box(s * 0.3, s * 0.06, s * 0.4, HULL_DARK, { y: s * 0.14 }),
      ...boltRing(s, { y: -s * 0.1, radius: 0.22, count: 10, size: 0.013 }),
      box(s * (big ? 0.9 : 0.75), s * (big ? 0.15 : 0.11), s * (big ? 0.15 : 0.11), HULL_LIGHT, { x: s * (big ? 0.6 : 0.5) }),
      cylinder(s * (big ? 0.1 : 0.08), s * (big ? 0.1 : 0.08), s * 0.14, HULL_DARK, { x: s * 0.24, rz: Math.PI / 2 }, 8),
      ...(big ? [cylinder(s * 0.13, s * 0.11, s * 0.24, HULL, { x: s * 1.06, rz: Math.PI / 2 }, 8)] : []),
      ...optics(s * 0.5, { x: -s * 0.1, y: s * 0.16, z: s * 0.14, scale: 0.6 }),
    ]),
    turretY: h + s * (big ? 0.42 : 0.34),
  };
}

function conRadar(s, c) {
  const parts = conPad(s, c, 2);
  // Lattice mast with guy cables and a small hut at its foot.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.04, s * 0.88, s * 0.04, STEEL, { x: dx * s * 0.1, z: dz * s * 0.1, y: s * 0.46 }));
  }
  for (let i = 0; i < 4; i++) {
    const y = s * (0.2 + i * 0.2);
    parts.push(box(s * 0.24, s * 0.018, s * 0.018, STEEL, { z: s * 0.1, y }));
    parts.push(box(s * 0.018, s * 0.018, s * 0.24, STEEL, { x: s * 0.1, y }));
  }
  parts.push(box(s * 0.28, s * 0.04, s * 0.28, HULL_LIGHT, { y: s * 0.9 }));
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1]]) {
    parts.push(...cable(s, [dx * s * 0.1, s * 0.86, dz * s * 0.1], [dx * s * 0.42, 2, dz * s * 0.42], { sag: 0.02, segments: 2, thickness: 0.012 }));
  }
  parts.push(box(s * 0.28, s * 0.2, s * 0.22, HULL, { x: -s * 0.28, z: s * 0.28, y: 2 + s * 0.1 }));
  parts.push(box(s * 0.3, s * 0.03, s * 0.24, HULL_DARK, { x: -s * 0.28, z: s * 0.28, y: 2 + s * 0.21 }));
  parts.push(box(s * 0.06, s * 0.06, s * 0.05, GLASS, { x: -s * 0.13, z: s * 0.28, y: 2 + s * 0.12 }));
  parts.push(box(s * 0.28, s * 0.03, s * 0.05, c.primary, { x: -s * 0.28, z: s * 0.4, y: 2 + s * 0.21 }));
  return {
    body: merge(parts),
    spinner: merge([
      // A dish: a shallow cone facing +X, on a yoke.
      cone(s * 0.3, s * 0.1, HULL_LIGHT, { x: s * 0.1, rz: -Math.PI / 2 }, 14),
      cylinder(s * 0.3, s * 0.3, s * 0.02, HULL, { x: s * 0.04, rz: Math.PI / 2 }, 14),
      box(s * 0.02, s * 0.02, s * 0.5, c.primary, { x: s * 0.13 }),
      cylinder(s * 0.012, s * 0.012, s * 0.26, STEEL, { x: s * 0.2, rz: Math.PI / 2 }, 6),
      sphere(s * 0.03, GLOW, { x: s * 0.34 }),
      box(s * 0.08, s * 0.1, s * 0.1, HULL_DARK, { x: -s * 0.04 }),
    ]),
    spinnerAxis: 'y',
    spinnerY: s * 1.02,
    spinSpeed: 1.3,
  };
}

function conDerrick(s, c) {
  const parts = conPad(s, c);
  // Pumpjack: a braced A-frame, a wellhead with a valve wheel, and a
  // walking beam that rocks as it pumps.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(box(s * 0.07, s * 0.95, s * 0.07, STEEL, {
      x: dx * s * 0.2, z: dz * s * 0.2, y: s * 0.5, rx: dz * 0.16, rz: -dx * 0.16,
    }));
  }
  for (const y of [0.35, 0.7]) {
    const w = 0.4 - y * 0.16;
    parts.push(box(s * w, s * 0.02, s * 0.02, STEEL, { z: s * w * 0.5, y: s * y }));
    parts.push(box(s * w, s * 0.02, s * 0.02, STEEL, { z: -s * w * 0.5, y: s * y }));
  }
  parts.push(box(s * 0.26, s * 0.1, s * 0.26, HULL_LIGHT, { y: s * 1.0 }));
  parts.push(...boltRing(s, { y: s * 1.06, radius: 0.1, count: 6, size: 0.014 }));
  // Wellhead and valve wheel.
  parts.push(cylinder(s * 0.06, s * 0.07, s * 0.2, HULL_DARK, { x: s * 0.36, y: 2.5 + s * 0.1 }, 8));
  parts.push(cylinder(s * 0.08, s * 0.08, s * 0.012, '#d8b24a', { x: s * 0.36, y: 2.5 + s * 0.22 }, 10));
  parts.push(...pipeRun(s, [s * 0.36, 2.5 + s * 0.12, 0], [-s * 0.42, 2.5 + s * 0.12, -s * 0.3]));
  parts.push(...drums(s, { x: -s * 0.42, z: s * 0.3, y: 2.5, count: 2 }));
  parts.push(box(s * 0.1, s * 0.04, s * 0.3, c.primary, { x: s * 0.38, z: -s * 0.3, y: 2.5 }));
  return {
    body: merge(parts),
    spinner: merge([
      box(s * 0.84, s * 0.08, s * 0.1, HULL_LIGHT, {}),
      box(s * 0.84, s * 0.02, s * 0.12, c.primary, { y: s * 0.05 }),
      box(s * 0.14, s * 0.32, s * 0.12, HULL_DARK, { x: s * 0.38, y: -s * 0.18 }),
      cylinder(s * 0.09, s * 0.09, s * 0.1, HULL, { x: -s * 0.4, rx: Math.PI / 2 }, 10),
    ]),
    spinnerAxis: 'x',
    spinnerY: s * 1.08,
    spinSpeed: 1.5,
  };
}

function conDiesel(s, c) {
  const parts = conPad(s, c);
  // A generator in a container: grille one end, stacks, a control cabinet,
  // drums and the cable that leaves it.
  parts.push(box(s * 0.76, s * 0.44, s * 0.6, HULL, { y: s * 0.32 }));
  parts.push(...seam(s, { from: [-s * 0.38, s * 0.32, -s * 0.31], to: [s * 0.38, s * 0.32, -s * 0.31], width: 0.02 }));
  parts.push(box(s * 0.78, s * 0.04, s * 0.62, HULL_DARK, { y: s * 0.55 }));
  parts.push(box(s * 0.78, s * 0.03, s * 0.08, c.primary, { y: s * 0.58, z: s * 0.28 }));
  parts.push(...grille(s, { x: s * 0.39, y: s * 0.32, z: 0, w: 0.02, d: 0.44, slats: 7 }));
  parts.push(box(s * 0.03, s * 0.32, s * 0.5, DARK, { x: s * 0.39, y: s * 0.32 }));
  for (const dz of [-0.18, 0.18]) {
    parts.push(cylinder(s * 0.05, s * 0.06, s * 0.42, HULL_DARK, { x: -s * 0.24, z: dz * s, y: s * 0.74 }, 8));
    parts.push(cylinder(s * 0.065, s * 0.065, s * 0.03, STEEL, { x: -s * 0.24, z: dz * s, y: s * 0.94 }, 8));
  }
  parts.push(box(s * 0.16, s * 0.24, s * 0.1, HULL_LIGHT, { x: s * 0.2, z: s * 0.36, y: 2.5 + s * 0.12 }));
  parts.push(...optics(s * 0.6, { x: s * 0.2, y: 2.5 + s * 0.2, z: s * 0.42, scale: 0.35, glow: '#ffd76a' }));
  parts.push(...boltLine(s, { from: [-s * 0.3, s * 0.12, s * 0.31], to: [s * 0.3, s * 0.12, s * 0.31], count: 5, size: 0.012 }));
  parts.push(...drums(s, { x: -s * 0.45, z: -s * 0.45, y: 2.5, count: 3 }));
  parts.push(...cable(s, [s * 0.2, 2.5 + s * 0.02, s * 0.42], [s * 0.45, 2.5 + s * 0.02, s * 0.45], { sag: 0.0, segments: 2 }));
  return { body: merge(parts) };
}

function conFusion(s, c) {
  const parts = conPad(s, c, 3);
  // A containment dome on a drum, four cooling towers, and the pipe runs
  // that tie them together. The warning stripe is the team colour.
  parts.push(cylinder(s * 0.3, s * 0.34, s * 0.36, HULL, { y: s * 0.26 }, 14));
  for (const y of [0.14, 0.3]) parts.push(...boltRing(s, { y: s * y, radius: 0.32, count: 14, size: 0.013 }));
  parts.push(sphere(s * 0.29, HULL_LIGHT, { y: s * 0.56 }, 14));
  parts.push(...seam(s, { from: [-s * 0.29, s * 0.56, 0], to: [s * 0.29, s * 0.56, 0], width: 0.02 }));
  parts.push(sphere(s * 0.15, GLOW, { y: s * 0.56 }, 10));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(box(s * 0.05, s * 0.03, s * 0.08, i % 2 ? c.primary : DARK, {
      x: Math.cos(a) * s * 0.35, z: Math.sin(a) * s * 0.35, y: s * 0.45, ry: -a,
    }));
  }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(cylinder(s * 0.09, s * 0.13, s * 0.5, CONCRETE, { x: dx * s * 0.34, z: dz * s * 0.34, y: s * 0.3 }, 10));
    parts.push(cylinder(s * 0.1, s * 0.1, s * 0.02, HULL_DARK, { x: dx * s * 0.34, z: dz * s * 0.34, y: s * 0.55 }, 10));
    parts.push(...pipeRun(s, [dx * s * 0.34, s * 0.16, dz * s * 0.34], [dx * s * 0.2, s * 0.16, dz * s * 0.2], { r: 0.022 }));
  }
  parts.push(...ladder(s, { x: -s * 0.32, y: 3, h: 0.36, ry: Math.PI / 2 }));
  parts.push(...railing(s, { from: [-s * 0.44, 3, s * 0.44], to: [s * 0.44, 3, s * 0.44], posts: 4 }));
  parts.push(...floodlight(s, { x: s * 0.44, z: -s * 0.44, y: 3, h: 0.5, face: Math.PI * 0.75 }));
  return { body: merge(parts) };
}

function conHeavyTank(r, c) {
  const parts = runningGear(r * 2.5, r * 0.62, r * 0.66, r * 0.8, 7);

  // Deep hull with a two-plane glacis and heavy side skirts.
  parts.push(box(r * 2.05, r * 0.52, r * 1.55, HULL, { y: r * 0.88 }));
  parts.push(box(r * 0.7, r * 0.4, r * 1.5, HULL, { x: r * 1.14, y: r * 0.82, rz: -0.38 }));
  parts.push(box(r * 0.42, r * 0.26, r * 1.48, HULL_DARK, { x: r * 1.34, y: r * 0.56, rz: 0.28 }));
  parts.push(...seam(r, { from: [r * 0.78, r * 1.14, -r * 0.74], to: [r * 0.78, r * 1.14, r * 0.74] }));
  parts.push(...boltLine(r, { from: [r * 1.4, r * 0.66, -r * 0.6], to: [r * 1.4, r * 0.66, r * 0.6], count: 6 }));
  for (const side of [-1, 1]) {
    parts.push(...armourPlate(r, { x: r * 0.3, y: r * 0.86, z: side * r * 0.84, w: 1.4, h: 0.44, d: 0.1, c }));
    parts.push(box(r * 2.2, r * 0.08, r * 0.34, HULL_DARK, { z: side * r * 0.88, y: r * 1.14 }));
    parts.push(box(r * 1.6, r * 0.11, r * 0.05, c.primary, { z: side * r * 0.78, y: r * 0.98 }));
  }

  parts.push(...grille(r, { x: -r * 0.78, y: r * 1.16, w: 0.66, d: 1.34, slats: 8 }));
  parts.push(...boltRing(r, { x: -r * 0.78, y: r * 1.18, radius: 0.5, count: 12, size: 0.03 }));
  parts.push(...exhaust(r, { x: -r * 1.0, z: r * 0.54, y: r * 1.16 }));
  parts.push(...exhaust(r, { x: -r * 1.0, z: -r * 0.54, y: r * 1.16 }));
  parts.push(...toolRack(r, { x: -r * 0.3, z: r * 0.9, y: r * 1.2, count: 4 }));
  parts.push(...stowage(r, c, { x: -r * 0.36, z: -r * 0.9, y: r * 1.2, count: 3, spacing: 0.3 }));
  parts.push(...railing(r, { from: [-r * 0.1, r * 1.18, r * 0.7], to: [r * 0.6, r * 1.18, r * 0.7], posts: 3 }));
  parts.push(...cable(r, [-r * 0.98, r * 1.2, -r * 0.3], [-r * 0.4, r * 1.18, -r * 0.6]));

  return {
    body: merge(parts),
    turret: merge([
      box(r * 1.25, r * 0.52, r * 1.2, HULL, {}),
      box(r * 0.55, r * 0.44, r * 1.0, HULL, { x: r * 0.76, rz: -0.24 }),
      box(r * 0.7, r * 0.4, r * 1.1, HULL_DARK, { x: -r * 0.8 }),
      box(r * 0.6, r * 0.3, r * 1.0, GREASE, { x: -r * 0.88, y: r * 0.26 }),
      ...toolRack(r, { x: -r * 0.88, y: r * 0.4, count: 4 }),
      // Mantlet and a two-stage barrel with a muzzle brake.
      cylinder(r * 0.32, r * 0.32, r * 0.42, HULL_DARK, { x: r * 1.02, rz: Math.PI / 2 }, 16),
      ...boltRing(r, { x: r * 1.0, radius: 0.27, count: 11, size: 0.034 }),
      ...gunBarrel(r, { len: 1.7, calibre: 0.135 }),
      ...cupola(r, c, { x: -r * 0.18, z: r * 0.32, y: r * 0.26, scale: 1.15 }),
      ...boltRing(r, { x: -r * 0.18, z: r * 0.32, y: r * 0.28, radius: 0.24, count: 9, size: 0.028 }),
      ...optics(r, { x: r * 0.3, z: -r * 0.38, y: r * 0.28, scale: 0.9 }),
      ...[-1, 1].map((side) =>
        box(r * 0.14, r * 0.16, r * 0.42, HULL_DARK, { x: r * 0.24, z: side * r * 0.56, y: r * 0.2, ry: side * 0.3 })),
      box(r * 0.5, r * 0.1, r * 0.1, HULL_LIGHT, { x: r * 0.5, z: -r * 0.3, y: r * 0.18 }),
      ...aerial(r, { x: -r * 0.6, z: -r * 0.42, y: r * 0.22, len: 1.2 }),
      ...[-1, 1].map((side) => box(r * 0.5, r * 0.24, r * 0.03, c.primary, { x: -r * 0.1, z: side * r * 0.61 })),
      ...seam(r, { from: [-r * 0.55, r * 0.27, 0], to: [r * 0.5, r * 0.27, 0], width: 0.035 }),
    ]),
    turretY: r * 1.18,
  };
}

function conHowitzer(r, c) {
  const parts = runningGear(r * 2.4, r * 0.56, r * 0.6, r * 0.74, 6);

  // Low open hull: this is a gun that happens to have a chassis under it.
  parts.push(box(r * 1.9, r * 0.4, r * 1.35, HULL, { y: r * 0.8 }));
  parts.push(box(r * 0.6, r * 0.3, r * 1.3, HULL, { x: r * 1.05, y: r * 0.76, rz: -0.32 }));
  parts.push(...boltLine(r, { from: [r * 1.3, r * 0.62, -r * 0.52], to: [r * 1.3, r * 0.62, r * 0.52], count: 5 }));
  for (const side of [-1, 1]) {
    parts.push(box(r * 2.0, r * 0.07, r * 0.3, HULL_DARK, { z: side * r * 0.8, y: r * 1.0 }));
    parts.push(box(r * 1.4, r * 0.1, r * 0.04, c.primary, { z: side * r * 0.7, y: r * 0.86 }));
    // Recoil spades, folded up against the hull rear.
    parts.push(box(r * 0.5, r * 0.34, r * 0.1, STEEL, { x: -r * 1.0, z: side * r * 0.45, y: r * 0.82, rz: 0.5 }));
  }
  parts.push(...grille(r, { x: -r * 0.5, y: r * 1.02, w: 0.5, d: 1.1, slats: 6 }));
  parts.push(...exhaust(r, { x: -r * 0.8, z: r * 0.46, y: r * 1.02 }));
  parts.push(box(r * 0.5, r * 0.3, r * 0.8, HULL, { x: r * 0.6, y: r * 1.05 }));
  parts.push(box(r * 0.04, r * 0.18, r * 0.52, GLASS, { x: r * 0.84, y: r * 1.08 }));
  parts.push(...toolRack(r, { x: -r * 0.2, z: r * 0.84, y: r * 1.06, count: 3 }));
  parts.push(...railing(r, { from: [-r * 0.8, r * 1.02, -r * 0.55], to: [-r * 0.1, r * 1.02, -r * 0.55], posts: 3 }));

  return {
    body: merge(parts),
    turret: merge([
      // Open mount: trunnions, a shield, and a long barrel on a cradle.
      box(r * 0.9, r * 0.4, r * 1.0, HULL, {}),
      box(r * 0.1, r * 0.66, r * 1.1, HULL_DARK, { x: r * 0.5, rz: -0.16 }),
      ...boltLine(r, { from: [r * 0.56, r * 0.3, -r * 0.5], to: [r * 0.56, r * 0.3, r * 0.5], count: 5 }),
      ...[-1, 1].map((side) =>
        cylinder(r * 0.16, r * 0.16, r * 0.2, STEEL, { z: side * r * 0.42, y: r * 0.1, rx: Math.PI / 2 }, 12)),
      cylinder(r * 0.2, r * 0.2, r * 1.0, HULL_DARK, { x: r * 0.5, y: r * 0.16, rz: Math.PI / 2 - 0.12 }, 14),
      cylinder(r * 0.12, r * 0.115, r * 2.4, HULL_LIGHT, { x: r * 1.5, y: r * 0.34, rz: Math.PI / 2 - 0.12 }, 14),
      cylinder(r * 0.17, r * 0.17, r * 0.26, GREASE, { x: r * 2.6, y: r * 0.47, rz: Math.PI / 2 - 0.12 }, 14),
      cylinder(r * 0.15, r * 0.15, r * 0.1, STEEL, { x: r * 2.78, y: r * 0.49, rz: Math.PI / 2 - 0.12 }, 14),
      // Recuperator cylinders over the barrel, and the breech behind.
      ...[-1, 1].map((side) =>
        cylinder(r * 0.07, r * 0.07, r * 0.9, STEEL, { x: r * 0.9, z: side * r * 0.17, y: r * 0.36, rz: Math.PI / 2 - 0.12 }, 10)),
      box(r * 0.44, r * 0.42, r * 0.5, HULL_DARK, { x: -r * 0.34, y: r * 0.04 }),
      ...boltRing(r, { x: -r * 0.34, y: r * 0.26, radius: 0.18, count: 8, size: 0.028 }),
      box(r * 0.34, r * 0.2, r * 0.24, GREASE, { x: -r * 0.5, z: r * 0.36, y: r * 0.1 }),
      ...optics(r, { x: r * 0.1, z: -r * 0.44, y: r * 0.26, scale: 0.75 }),
      box(r * 0.42, r * 0.2, r * 0.03, c.primary, { x: -r * 0.2, z: r * 0.51 }),
    ]),
    turretY: r * 1.04,
  };
}

function conMissile(r, c) {
  const parts = runningGear(r * 2.0, r * 0.46, r * 0.52, r * 0.64, 5);

  parts.push(box(r * 1.65, r * 0.44, r * 1.2, HULL, { y: r * 0.72 }));
  parts.push(box(r * 0.6, r * 0.32, r * 1.15, HULL, { x: r * 0.95, y: r * 0.7, rz: -0.3 }));
  parts.push(...seam(r, { from: [r * 0.6, r * 0.94, -r * 0.58], to: [r * 0.6, r * 0.94, r * 0.58] }));
  parts.push(...boltLine(r, { from: [r * 1.18, r * 0.58, -r * 0.46], to: [r * 1.18, r * 0.58, r * 0.46], count: 5 }));

  // Crew cab forward, engine deck aft.
  parts.push(box(r * 0.64, r * 0.38, r * 0.9, HULL, { x: r * 0.52, y: r * 1.08 }));
  parts.push(box(r * 0.05, r * 0.22, r * 0.6, GLASS, { x: r * 0.84, y: r * 1.12 }));
  parts.push(...optics(r, { x: r * 0.5, z: -r * 0.42, y: r * 1.26, scale: 0.7 }));
  parts.push(...grille(r, { x: -r * 0.55, y: r * 0.96, w: 0.5, d: 1.0, slats: 6 }));
  parts.push(...exhaust(r, { x: -r * 0.78, z: r * 0.42, y: r * 0.96 }));

  for (const side of [-1, 1]) {
    parts.push(box(r * 1.7, r * 0.06, r * 0.26, HULL_DARK, { z: side * r * 0.7, y: r * 0.92 }));
    parts.push(box(r * 1.2, r * 0.1, r * 0.04, c.primary, { z: side * r * 0.62, y: r * 0.78 }));
  }
  parts.push(...toolRack(r, { x: -r * 0.2, z: r * 0.74, y: r * 0.98 }));
  parts.push(...cable(r, [-r * 0.72, r * 1.0, -r * 0.3], [-r * 0.2, r * 0.98, -r * 0.55]));
  parts.push(...aerial(r, { x: -r * 0.8, z: -r * 0.4, y: r * 0.94, len: 1.2 }));

  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.36, r * 0.32, r * 0.9, HULL, { x: -r * 0.3 }),
      ...boltRing(r, { x: -r * 0.3, y: r * 0.18, radius: 0.3, count: 10, size: 0.028 }),
      // Boxed launcher, elevated, with loaded tubes showing at the front.
      box(r * 1.0, r * 0.54, r * 1.15, HULL, { x: -r * 0.1, rz: -0.2 }),
      box(r * 0.9, r * 0.05, r * 0.3, c.primary, { x: -r * 0.12, y: r * 0.3, rz: -0.2 }),
      ...[-1, 0, 1].flatMap((k) => [
        cylinder(r * 0.14, r * 0.14, r * 0.18, GREASE, {
          x: r * 0.44, z: k * r * 0.34, y: r * 0.2, rz: Math.PI / 2 - 0.2,
        }, 12),
        cylinder(r * 0.155, r * 0.155, r * 0.05, HULL_DARK, {
          x: r * 0.5, z: k * r * 0.34, y: r * 0.21, rz: Math.PI / 2 - 0.2,
        }, 12),
        cone(r * 0.11, r * 0.26, '#ff9a5b', {
          x: r * 0.56, z: k * r * 0.34, y: r * 0.23, rz: -Math.PI / 2 - 0.2,
        }, 10),
      ]),
      // Reload rack and the elevation ram under the box.
      box(r * 0.5, r * 0.3, r * 0.8, GREASE, { x: -r * 0.66, y: -r * 0.1 }),
      cylinder(r * 0.06, r * 0.06, r * 0.5, STEEL, { x: -r * 0.34, y: -r * 0.24, rz: 0.5 }, 8),
      ...seam(r, { from: [-r * 0.5, r * 0.3, 0], to: [r * 0.3, r * 0.42, 0], width: 0.035 }),
    ]),
    turretY: r * 1.12,
  };
}

function conRefinery(s, c) {
  const parts = conPad(s, c);
  // Two tanks, a flare stack, a pipe rack and the valves between them.
  parts.push(cylinder(s * 0.2, s * 0.22, s * 0.66, HULL, { x: -s * 0.18, y: s * 0.4 }, 12));
  for (const y of [0.2, 0.4, 0.6]) parts.push(...boltRing(s, { x: -s * 0.18, y: s * y, radius: 0.215, count: 10, size: 0.012 }));
  parts.push(cylinder(s * 0.21, s * 0.21, s * 0.03, HULL_DARK, { x: -s * 0.18, y: s * 0.74 }, 12));
  parts.push(cylinder(s * 0.14, s * 0.15, s * 0.48, HULL_LIGHT, { x: s * 0.22, z: s * 0.18, y: s * 0.3 }, 10));
  parts.push(...boltRing(s, { x: s * 0.22, z: s * 0.18, y: s * 0.4, radius: 0.15, count: 8, size: 0.012 }));
  // Flare stack with its flame.
  parts.push(cylinder(s * 0.04, s * 0.05, s * 0.86, STEEL, { x: s * 0.28, z: -s * 0.26, y: s * 0.5 }, 8));
  parts.push(cylinder(s * 0.06, s * 0.06, s * 0.04, HULL_DARK, { x: s * 0.28, z: -s * 0.26, y: s * 0.94 }, 8));
  parts.push(sphere(s * 0.05, '#ff9a5b', { x: s * 0.28, z: -s * 0.26, y: s * 0.99 }, 8, 6));
  // Pipe rack: two runs on posts, with the valve wheel.
  parts.push(...pipeRun(s, [-s * 0.18, s * 0.5, 0], [s * 0.22, s * 0.5, s * 0.18]));
  parts.push(...pipeRun(s, [-s * 0.18, s * 0.28, -s * 0.2], [s * 0.28, s * 0.28, -s * 0.26], { r: 0.016 }));
  parts.push(cylinder(s * 0.06, s * 0.06, s * 0.012, '#d8b24a', { x: 0, y: s * 0.56, z: s * 0.08, rz: Math.PI / 2 }, 10));
  parts.push(...ladder(s, { x: -s * 0.4, y: 2.5, h: 0.62, ry: Math.PI / 2 }));
  parts.push(...drums(s, { x: s * 0.3, z: s * 0.36, y: 2.5, count: 2 }));
  parts.push(box(s * 0.12, s * 0.04, s * 0.36, c.primary, { x: -s * 0.4, z: s * 0.26, y: 2.5 }));
  return { body: merge(parts) };
}

// ------------------------------------------------------------------ Blight
//
// Grown rather than built. Where the machine factions are plated boxes with
// panel lines, this is carapace and sac: squashed spheres, splayed cones and
// rings of teeth. The team colour still carries, because a player has to be
// able to tell whose hive is whose.

const CHITIN = '#6d6455';
const CHITIN_DARK = '#3a342b';
const CHITIN_LIGHT = '#9c8f78';
const FLESH = '#8c5b63';
const BILE = '#b6ff6a';

/** A domed shell: the shape most of the hive is made of. */
function carapace(r, c, { x = 0, y = 0, z = 0, scale = 1, squash = 0.62 } = {}) {
  return [
    sphere(r * scale, c, { x, y, z, sy: squash }, 12),
    sphere(r * scale * 0.82, CHITIN_DARK, { x: x - r * scale * 0.18, y, z, sy: squash * 0.9 }, 10),
  ];
}

/** Thin legs splayed out sideways, three to a side. */
function crawlerLegs(r, c, { scale = 1, gauge = 0.62, count = 3 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const along = (i / Math.max(1, count - 1) - 0.5) * r * 1.3 * scale;
    for (const side of [-1, 1]) {
      const z = side * r * gauge;
      parts.push(cylinder(r * 0.07 * scale, r * 0.05 * scale, r * 0.62 * scale, CHITIN_DARK,
        { x: along, y: r * 0.46 * scale, z: z * 0.7, rx: side * 0.9 }, 6));
      parts.push(cylinder(r * 0.05 * scale, r * 0.03 * scale, r * 0.5 * scale, CHITIN,
        { x: along, y: r * 0.18 * scale, z, rx: side * -0.5 }, 6));
    }
  }
  return parts;
}

/** A ridge of spines along the back. */
function spines(r, c, { x = 0, y = 0, count = 4, len = 0.5, spacing = 0.3 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1) - 0.5;
    parts.push(cone(r * 0.1, r * len * (1 - Math.abs(t) * 0.5), CHITIN_LIGHT,
      { x: x + t * r * spacing * count, y, rz: -0.25 }, 6));
  }
  return parts;
}

/** A ring of teeth around a mouth. */
function maw(r, { x = 0, y = 0, radius = 0.4, count = 8, len = 0.3 } = {}) {
  const parts = [cylinder(r * radius * 0.8, r * radius, r * 0.12, FLESH,
    { x, y, rz: Math.PI / 2 }, 12)];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    parts.push(cone(r * 0.06, r * len, CHITIN_LIGHT, {
      x: x + r * 0.08,
      y: y + Math.sin(a) * r * radius * 0.8,
      z: Math.cos(a) * r * radius * 0.8,
      rz: -Math.PI / 2,
    }, 5));
  }
  return parts;
}

/** Feeding tendrils, drooping outward. */
function tendrils(r, c, { x = 0, y = 0, count = 5, len = 0.7, spread = 0.5 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    parts.push(cylinder(r * 0.05, r * 0.02, r * len, FLESH, {
      x: x + Math.cos(a) * r * spread * 0.4,
      y,
      z: Math.sin(a) * r * spread,
      rx: Math.sin(a) * 0.7,
      rz: Math.cos(a) * 0.7,
    }, 5));
  }
  return parts;
}

/** An egg sac: the hive's answer to a storage tank. */
function sac(s, c, { x = 0, z = 0, scale = 1, colour = null } = {}) {
  return [
    sphere(s * 0.2 * scale, colour || c.primary, { x, z, y: s * 0.2 * scale, sy: 1.15 }, 12),
    sphere(s * 0.13 * scale, BILE, { x, z, y: s * 0.24 * scale, sy: 1.1 }, 10),
  ];
}

/** A low organic mound every Blight structure sits on. */
function mound(s, c, h = 0.1) {
  return [
    sphere(s * 0.44, CHITIN_DARK, { y: s * h * 0.5, sy: h * 1.6 }, 14),
    sphere(s * 0.34, c.dark, { y: s * h * 0.8, sy: h * 1.3 }, 12),
  ];
}

// The hive's equivalent of the panel lines, bolts and grilles the metal
// factions got. It is not enough to make a shape organic by making it round:
// what reads as living rather than moulded is segmentation, asymmetry, and
// surfaces that look like they grew in layers. All of it is geometry, because
// there are no textures anywhere in this project.

/**
 * Overlapping plates along a body, each a little smaller than the last.
 *
 * The single most useful thing here. A bare dome reads as a pebble; the same
 * dome with five plates lapped over it reads as a carapace, and it costs a
 * handful of flattened boxes.
 */
function segments(r, { from, to, count = 5, width = 0.8, rise = 0.1, colour = CHITIN_LIGHT }) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const taper = 1 - Math.abs(t - 0.35) * 0.55;
    parts.push(box(r * 0.1, r * rise, r * width * taper, colour, {
      x: from[0] + (to[0] - from[0]) * t,
      y: from[1] + (to[1] - from[1]) * t,
      z: from[2] + (to[2] - from[2]) * t,
      rz: -0.2 + t * 0.35,
    }));
  }
  return parts;
}

/** Breathing pores down a flank: small dark pits, in an uneven row. */
function pores(r, { x = 0, y = 0, z = 0, count = 4, spacing = 0.26, size = 0.055 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = i - (count - 1) / 2;
    parts.push(cylinder(r * size, r * size * 0.7, r * 0.04, CHITIN_DARK, {
      x: x + t * r * spacing,
      y: y + Math.sin(i * 2.3) * r * 0.04,
      z, rx: Math.PI / 2,
    }, 6));
  }
  return parts;
}

/** A raised vein running over a surface, in two or three kinked lengths. */
function vein(r, { from, to, colour = FLESH, thickness = 0.03, kinks = 2 } = {}) {
  const parts = [];
  const steps = kinks + 1;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const wob = Math.sin(i * 1.9) * r * 0.07;
    const ax = from[0] + (to[0] - from[0]) * t0;
    const ay = from[1] + (to[1] - from[1]) * t0 + wob;
    const az = from[2] + (to[2] - from[2]) * t0;
    const bx = from[0] + (to[0] - from[0]) * t1;
    const by = from[1] + (to[1] - from[1]) * t1 - wob;
    const bz = from[2] + (to[2] - from[2]) * t1;
    const len = Math.hypot(bx - ax, by - ay, bz - az) || r * 0.05;
    parts.push(box(len, r * thickness, r * thickness, colour, {
      x: (ax + bx) / 2, y: (ay + by) / 2, z: (az + bz) / 2,
      rz: Math.atan2(by - ay, bx - ax),
      ry: -Math.atan2(bz - az, bx - ax),
    }));
  }
  return parts;
}

/**
 * A properly jointed leg: coxa, femur, tibia, claw.
 *
 * The old legs were two cylinders at a fixed angle, which read as sticks. A
 * real insect leg goes up, out, then down, and the raised knee above the body
 * line is what makes the silhouette read as a crawling thing at any size.
 */
function jointedLeg(r, { x = 0, y = 0, z = 0, side = 1, scale = 1, splay = 0.5, lift = 0.5 }) {
  const s = scale;
  const parts = [];
  // Coxa: the socket where it meets the body.
  parts.push(sphere(r * 0.09 * s, CHITIN_DARK, { x, y, z }, 6, 5));
  // Femur, angled up and out to the raised knee.
  const kx = x - r * 0.1 * s;
  const ky = y + r * 0.42 * s * lift;
  const kz = z + side * r * 0.42 * s * splay;
  parts.push(cylinder(r * 0.075 * s, r * 0.055 * s, r * Math.hypot(0.1, 0.42 * lift, 0.42 * splay) * s,
    CHITIN, { x: (x + kx) / 2, y: (y + ky) / 2, z: (z + kz) / 2,
      rz: Math.PI / 2 - Math.atan2(ky - y, kx - x),
      rx: Math.atan2(kz - z, ky - y) }, 6));
  parts.push(sphere(r * 0.07 * s, CHITIN_LIGHT, { x: kx, y: ky, z: kz }, 6, 5));
  // Tibia, down and further out to the ground.
  const fx = kx + r * 0.16 * s;
  const fy = r * 0.05 * s;
  const fz = kz + side * r * 0.3 * s * splay;
  parts.push(cylinder(r * 0.05 * s, r * 0.028 * s, r * Math.hypot(0.16, 0.42 * lift, 0.3 * splay) * s,
    CHITIN_DARK, { x: (kx + fx) / 2, y: (ky + fy) / 2, z: (kz + fz) / 2,
      rz: Math.PI / 2 - Math.atan2(fy - ky, fx - kx),
      rx: Math.atan2(fz - kz, fy - ky) }, 6));
  // Claw.
  parts.push(cone(r * 0.035 * s, r * 0.12 * s, CHITIN_LIGHT, { x: fx, y: fy, z: fz, rz: Math.PI }, 5));
  return parts;
}

/** A row of jointed legs down both sides of a body. */
/**
 * A row of jointed legs, each its own part pivoted at the coxa. Alternate
 * legs on alternate sides share a phase, which is the tripod gait every
 * six-legged thing actually walks with: three feet down, three swinging.
 */
function legRowParts(r, { count = 3, scale = 1, gauge = 0.6, from = -0.5, to = 0.5, y = 0.5, lift = 0.5 } = {}) {
  const legs = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = r * (from + (to - from) * t);
    // Front legs reach further forward, rear legs trail: a row of identical
    // legs reads as a millipede toy rather than as something that walks.
    const lean = 1 - Math.abs(t - 0.5) * 0.4;
    for (const side of [-1, 1]) {
      const z = side * r * gauge * 0.45;
      legs.push({
        parts: jointedLeg(r, { x, y: r * y, z, side, scale: scale * lean, splay: gauge, lift }),
        pivot: [x, r * y, z],
        phase: ((i % 2 === 0) === (side > 0)) ? 0 : 1,
      });
    }
  }
  return legs;
}

function legRow(r, opts = {}) {
  return legRowParts(r, opts).flatMap((l) => l.parts);
}

/**
 * The hive's recognition marking.
 *
 * Team colour on a Blight unit was the whole carapace, which made every hive
 * unit a solid block of red or green and lost the shape inside it -- the same
 * mistake the metal hulls made before they were rebuilt. The body is chitin
 * now, and the colour is carried here: a marked plate over the back, a pair of
 * flank flashes, and the glow of whatever it uses for eyes.
 */
function hiveMark(r, c, { x = 0, y = 0, scale = 1, flanks = true } = {}) {
  const parts = [box(r * 0.5 * scale, r * 0.08 * scale, r * 0.44 * scale, c.primary, {
    x, y, rz: -0.06,
  })];
  parts.push(box(r * 0.3 * scale, r * 0.05 * scale, r * 0.2 * scale, c.light, { x: x + r * 0.05 * scale, y: y + r * 0.05 * scale }));
  if (flanks) {
    for (const side of [-1, 1]) {
      parts.push(box(r * 0.34 * scale, r * 0.2 * scale, r * 0.04 * scale, c.dark, {
        x, y: y - r * 0.18 * scale, z: side * r * 0.42 * scale,
      }));
    }
  }
  return parts;
}

// --------------------------------------------------------------- hive units

function blHive(r, c) {
  // The hive itself: the largest walker the faction fields, and the thing the
  // match ends on. Four heavy jointed legs, a segmented back, and a mouth that
  // could take a tank.
  const legs = legRowParts(r, { count: 4, scale: 1.9, gauge: 0.85, from: -0.9, to: 0.7, y: 1.2, lift: 0.7 });
  const parts = [];

  // Thorax and abdomen as two masses rather than one dome: the waist between
  // them is what makes it read as a body instead of a boulder.
  parts.push(...carapace(r, CHITIN, { x: r * 0.25, y: r * 1.55, scale: 1.35, squash: 0.76 }));
  parts.push(...carapace(r, CHITIN_DARK, { x: -r * 0.95, y: r * 1.4, scale: 1.05, squash: 0.85 }));
  parts.push(cylinder(r * 0.5, r * 0.5, r * 0.4, CHITIN_DARK, { x: -r * 0.42, y: r * 1.5, rz: Math.PI / 2 }, 10));

  parts.push(...segments(r, {
    from: [r * 0.7, r * 2.62, 0], to: [-r * 1.4, r * 2.52, 0], count: 7, width: 1.3, rise: 0.11,
  }));
  parts.push(...spines(r, c, { x: -r * 0.3, y: r * 2.61, count: 5, len: 0.8, spacing: 0.26 }));
  parts.push(...hiveMark(r, c, { x: r * 0.15, y: r * 2.65, scale: 1.5 }));
  parts.push(...pores(r, { x: -r * 0.5, y: r * 1.5, z: r * 0.88, count: 5, spacing: 0.32, size: 0.07 }));
  parts.push(...pores(r, { x: -r * 0.5, y: r * 1.5, z: -r * 0.88, count: 5, spacing: 0.32, size: 0.07 }));
  parts.push(...vein(r, { from: [r * 0.6, r * 1.9, r * 0.5], to: [-r * 1.1, r * 1.6, r * 0.7], thickness: 0.05 }));
  parts.push(...vein(r, { from: [r * 0.6, r * 1.9, -r * 0.5], to: [-r * 1.1, r * 1.6, -r * 0.7], thickness: 0.05 }));

  // Head: a plated skull slung forward, with the mouth under it.
  parts.push(...carapace(r, CHITIN_LIGHT, { x: r * 1.25, y: r * 1.5, scale: 0.68, squash: 0.8 }));
  parts.push(...maw(r, { x: r * 1.55, y: r * 1.32, radius: 0.42, count: 10, len: 0.4 }));
  for (const side of [-1, 1]) {
    parts.push(sphere(r * 0.13, BILE, { x: r * 1.4, y: r * 1.78, z: side * r * 0.26 }, 8, 6));
    parts.push(cone(r * 0.08, r * 0.5, CHITIN_DARK, {
      x: r * 1.3, y: r * 1.9, z: side * r * 0.38, rz: -0.6, rx: side * 0.5,
    }, 6));
  }
  parts.push(...tendrils(r, c, { x: r * 1.2, y: r * 1.05, count: 6, len: 0.85, spread: 0.55 }));

  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      ...carapace(r, CHITIN_LIGHT, { scale: 0.52, squash: 0.85 }),
      ...segments(r, { from: [r * 0.2, r * 0.3, 0], to: [-r * 0.4, r * 0.2, 0], count: 3, width: 0.55, rise: 0.07 }),
      box(r * 0.3, r * 0.06, r * 0.26, c.primary, { x: -r * 0.05, y: r * 0.34 }),
      cylinder(r * 0.16, r * 0.2, r * 0.9, CHITIN, { x: r * 0.6, rz: Math.PI / 2 }, 10),
      cylinder(r * 0.11, r * 0.09, r * 0.3, FLESH, { x: r * 0.9, rz: Math.PI / 2 }, 8),
      cylinder(r * 0.1, r * 0.1, r * 0.22, BILE, { x: r * 1.12, rz: Math.PI / 2 }, 8),
      ...pores(r, { x: r * 0.1, y: r * 0.1, z: r * 0.3, count: 3, spacing: 0.2, size: 0.04 }),
    ]),
    turretY: r * 2.2,
  };
}

function blTender(r, c) {
  // The hive's builder: a carrier, not a fighter. Its tendrils are the
  // nanolathe, so they are the most worked part of it.
  const legs = legRowParts(r, { count: 3, scale: 1.1, gauge: 0.66, from: -0.55, to: 0.4, y: 0.72, lift: 0.5 });
  const parts = [];
  parts.push(...carapace(r, CHITIN, { y: r * 0.95, scale: 0.95, squash: 0.68 }));
  parts.push(...carapace(r, CHITIN_DARK, { x: -r * 0.52, y: r * 0.88, scale: 0.6, squash: 0.85 }));
  parts.push(...segments(r, {
    from: [r * 0.4, r * 1.64, 0], to: [-r * 0.7, r * 1.54, 0], count: 5, width: 0.85, rise: 0.08,
  }));
  parts.push(...hiveMark(r, c, { x: 0, y: r * 1.67, scale: 0.95 }));
  parts.push(...pores(r, { x: -r * 0.2, y: r * 0.95, z: r * 0.62, count: 4, spacing: 0.24, size: 0.05 }));
  parts.push(...pores(r, { x: -r * 0.2, y: r * 0.95, z: -r * 0.62, count: 4, spacing: 0.24, size: 0.05 }));
  // Head and the feeding tendrils it builds with.
  parts.push(...carapace(r, CHITIN_LIGHT, { x: r * 0.72, y: r * 0.95, scale: 0.4, squash: 0.85 }));
  parts.push(...tendrils(r, c, { x: r * 0.95, y: r * 0.9, count: 5, len: 0.8, spread: 0.42 }));
  parts.push(sphere(r * 0.11, BILE, { x: r * 0.82, y: r * 1.14 }, 8, 6));
  parts.push(...vein(r, { from: [r * 0.5, r * 1.1, r * 0.35], to: [-r * 0.5, r * 0.9, r * 0.5] }));
  return { body: merge(parts), legs: legGeos(legs) };
}

function blSkitter(r, c) {
  // All legs and jaw. Nothing here is meant to survive being shot at, so it is
  // built long and low: the silhouette of something that runs.
  const legs = legRowParts(r, { count: 3, scale: 1.25, gauge: 0.85, from: -0.5, to: 0.5, y: 0.7, lift: 0.75 });
  const parts = [];
  parts.push(...carapace(r, CHITIN, { y: r * 0.8, scale: 0.78, squash: 0.48 }));
  parts.push(...segments(r, {
    from: [r * 0.3, r * 1.21, 0], to: [-r * 0.6, r * 1.11, 0], count: 4, width: 0.6, rise: 0.07,
  }));
  parts.push(...hiveMark(r, c, { x: -r * 0.05, y: r * 1.24, scale: 0.7, flanks: false }));
  parts.push(...maw(r, { x: r * 0.74, y: r * 0.78, radius: 0.3, count: 6, len: 0.3 }));
  for (const side of [-1, 1]) {
    parts.push(sphere(r * 0.075, BILE, { x: r * 0.52, y: r * 0.98, z: side * r * 0.13 }, 6, 5));
  }
  // The tail is the counterweight that makes it look fast rather than stubby.
  parts.push(cone(r * 0.15, r * 0.75, CHITIN_DARK, { x: -r * 0.78, y: r * 0.86, rz: Math.PI / 2 }, 7));
  parts.push(...pores(r, { x: -r * 0.1, y: r * 0.78, z: r * 0.5, count: 3, spacing: 0.2, size: 0.04 }));
  parts.push(...pores(r, { x: -r * 0.1, y: r * 0.78, z: -r * 0.5, count: 3, spacing: 0.2, size: 0.04 }));
  return { body: merge(parts), legs: legGeos(legs) };
}

function blHusk(r, c) {
  // The line unit: thick over the front, soft behind, and walking straight at
  // you. Its plates are heaviest where it is pointed.
  const legs = legRowParts(r, { count: 3, scale: 1.25, gauge: 0.7, from: -0.5, to: 0.45, y: 0.82, lift: 0.55 });
  const parts = [];
  parts.push(...carapace(r, CHITIN, { y: r * 1.0, scale: 1.05, squash: 0.66 }));
  parts.push(...carapace(r, CHITIN_LIGHT, { x: r * 0.5, y: r * 1.12, scale: 0.6, squash: 0.72 }));
  parts.push(...segments(r, {
    from: [r * 0.5, r * 1.73, 0], to: [-r * 0.75, r * 1.63, 0], count: 6, width: 0.95, rise: 0.1,
  }));
  parts.push(...spines(r, c, { x: -r * 0.25, y: r * 1.72, count: 4, len: 0.46 }));
  parts.push(...hiveMark(r, c, { x: r * 0.05, y: r * 1.76, scale: 1.0 }));
  parts.push(...pores(r, { x: -r * 0.2, y: r * 1.0, z: r * 0.68, count: 4, spacing: 0.26, size: 0.055 }));
  parts.push(...pores(r, { x: -r * 0.2, y: r * 1.0, z: -r * 0.68, count: 4, spacing: 0.26, size: 0.055 }));
  parts.push(...vein(r, { from: [r * 0.55, r * 1.25, r * 0.4], to: [-r * 0.6, r * 1.05, r * 0.55] }));
  parts.push(sphere(r * 0.1, BILE, { x: r * 0.55, y: r * 1.34 }, 8, 6));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      sphere(r * 0.3, FLESH, { sy: 0.8 }, 10),
      ...carapace(r, CHITIN_LIGHT, { x: -r * 0.06, scale: 0.34, squash: 0.9 }),
      ...maw(r, { x: r * 0.3, radius: 0.26, count: 7, len: 0.32 }),
      cone(r * 0.05, r * 0.26, CHITIN_DARK, { x: r * 0.14, y: r * 0.22, z: r * 0.16, rz: -0.5 }, 5),
      cone(r * 0.05, r * 0.26, CHITIN_DARK, { x: r * 0.14, y: r * 0.22, z: -r * 0.16, rz: -0.5 }, 5),
    ]),
    turretY: r * 1.34,
  };
}

function blSpitter(r, c) {
  // Everything about it points at the sac on its back: the body is a pump and
  // the head is a nozzle.
  const legs = legRowParts(r, { count: 3, scale: 1.2, gauge: 0.74, from: -0.5, to: 0.45, y: 0.8, lift: 0.55 });
  const parts = [];
  parts.push(...carapace(r, CHITIN, { y: r * 1.0, scale: 1.0, squash: 0.62 }));
  parts.push(...segments(r, {
    from: [r * 0.45, r * 1.66, 0], to: [-r * 0.5, r * 1.56, 0], count: 4, width: 0.8, rise: 0.08,
  }));
  parts.push(...hiveMark(r, c, { x: r * 0.3, y: r * 1.69, scale: 0.85, flanks: false }));
  // The bile sac, ribbed so it reads as full rather than as a green ball.
  parts.push(sphere(r * 0.46, BILE, { x: -r * 0.34, y: r * 1.42, sy: 0.85 }, 12));
  parts.push(sphere(r * 0.3, FLESH, { x: -r * 0.34, y: r * 1.5, sy: 0.7 }, 10));
  for (let i = 0; i < 3; i++) {
    parts.push(cylinder(r * (0.44 - i * 0.02), r * (0.44 - i * 0.02), r * 0.04, CHITIN_DARK, {
      x: -r * (0.16 + i * 0.18), y: r * 1.42, rz: Math.PI / 2,
    }, 12));
  }
  parts.push(...vein(r, { from: [-r * 0.5, r * 1.6, 0], to: [r * 0.5, r * 1.15, 0], thickness: 0.04 }));
  parts.push(...tendrils(r, c, { x: r * 0.5, y: r * 1.0, count: 3, len: 0.5, spread: 0.35 }));
  parts.push(...pores(r, { x: 0, y: r * 1.0, z: r * 0.64, count: 3, spacing: 0.22, size: 0.05 }));
  parts.push(...pores(r, { x: 0, y: r * 1.0, z: -r * 0.64, count: 3, spacing: 0.22, size: 0.05 }));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      sphere(r * 0.26, CHITIN, { sy: 0.9 }, 10),
      cone(r * 0.2, r * 0.8, FLESH, { x: r * 0.5, rz: -Math.PI / 2 }, 8),
      cylinder(r * 0.14, r * 0.14, r * 0.06, CHITIN_DARK, { x: r * 0.62, rz: Math.PI / 2 }, 8),
      cylinder(r * 0.08, r * 0.12, r * 0.16, BILE, { x: r * 0.92, rz: Math.PI / 2 }, 8),
      sphere(r * 0.055, BILE, { x: r * 0.1, y: r * 0.2, z: r * 0.14 }, 6, 5),
      sphere(r * 0.055, BILE, { x: r * 0.1, y: r * 0.2, z: -r * 0.14 }, 6, 5),
    ]),
    turretY: r * 1.3,
  };
}

function blBrute(r, c) {
  // The heavy. Four legs to a side, a back like a shield, and a head it leads
  // with. Everything is a size up from the husk rather than a different idea.
  const legs = legRowParts(r, { count: 4, scale: 1.7, gauge: 0.92, from: -0.7, to: 0.6, y: 1.05, lift: 0.6 });
  const parts = [];
  parts.push(...carapace(r, CHITIN, { y: r * 1.35, scale: 1.5, squash: 0.7 }));
  parts.push(...carapace(r, CHITIN_LIGHT, { x: r * 0.7, y: r * 1.5, scale: 0.8, squash: 0.76 }));
  parts.push(...segments(r, {
    from: [r * 0.8, r * 2.44, 0], to: [-r * 1.0, r * 2.34, 0], count: 7, width: 1.35, rise: 0.12,
  }));
  parts.push(...spines(r, c, { x: -r * 0.3, y: r * 2.43, count: 6, len: 0.8, spacing: 0.24 }));
  parts.push(...hiveMark(r, c, { x: r * 0.1, y: r * 2.47, scale: 1.45 }));
  parts.push(...pores(r, { x: -r * 0.3, y: r * 1.35, z: r * 1.0, count: 5, spacing: 0.3, size: 0.07 }));
  parts.push(...pores(r, { x: -r * 0.3, y: r * 1.35, z: -r * 1.0, count: 5, spacing: 0.3, size: 0.07 }));
  parts.push(...vein(r, { from: [r * 0.8, r * 1.8, r * 0.6], to: [-r * 0.9, r * 1.45, r * 0.8], thickness: 0.05 }));
  parts.push(...vein(r, { from: [r * 0.8, r * 1.8, -r * 0.6], to: [-r * 0.9, r * 1.45, -r * 0.8], thickness: 0.05 }));
  parts.push(...maw(r, { x: r * 1.35, y: r * 1.35, radius: 0.44, count: 10, len: 0.4 }));
  for (const side of [-1, 1]) {
    parts.push(sphere(r * 0.14, BILE, { x: r * 0.8, y: r * 1.9, z: side * r * 0.3 }, 8, 6));
    // Tusks: the read that says "heavy" from straight above, where the back
    // plates all look the same.
    parts.push(cone(r * 0.1, r * 0.66, CHITIN_LIGHT, {
      x: r * 1.3, y: r * 1.2, z: side * r * 0.4, rz: -1.2, rx: side * 0.35,
    }, 6));
  }
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      sphere(r * 0.42, FLESH, { sy: 0.8 }, 12),
      ...carapace(r, CHITIN_LIGHT, { x: -r * 0.08, scale: 0.46, squash: 0.9 }),
      ...maw(r, { x: r * 0.42, radius: 0.34, count: 9, len: 0.42 }),
      ...spines(r, c, { x: -r * 0.2, y: r * 0.32, count: 3, len: 0.4, spacing: 0.2 }),
      box(r * 0.34, r * 0.07, r * 0.3, c.primary, { x: -r * 0.05, y: r * 0.38 }),
    ]),
    turretY: r * 1.9,
  };
}

function blLobber(r, c) {
  // Siege. It is mostly a bladder on legs, and it should look like it has
  // trouble carrying itself.
  const legs = legRowParts(r, { count: 4, scale: 1.45, gauge: 0.92, from: -0.6, to: 0.5, y: 0.78, lift: 0.45 });
  const parts = [];
  parts.push(...carapace(r, CHITIN, { y: r * 1.0, scale: 1.25, squash: 0.55 }));
  parts.push(...segments(r, {
    from: [r * 0.6, r * 1.73, 0], to: [-r * 0.2, r * 1.63, 0], count: 4, width: 1.05, rise: 0.09,
  }));
  parts.push(...hiveMark(r, c, { x: r * 0.5, y: r * 1.76, scale: 1.0, flanks: false }));
  parts.push(sphere(r * 0.5, BILE, { x: -r * 0.5, y: r * 1.3, sy: 0.9 }, 12));
  parts.push(sphere(r * 0.34, FLESH, { x: -r * 0.55, y: r * 1.42, sy: 0.8 }, 10));
  for (let i = 0; i < 4; i++) {
    parts.push(cylinder(r * (0.48 - i * 0.03), r * (0.48 - i * 0.03), r * 0.045, CHITIN_DARK, {
      x: -r * (0.22 + i * 0.16), y: r * 1.3, rz: Math.PI / 2,
    }, 12));
  }
  parts.push(...pores(r, { x: r * 0.2, y: r * 1.0, z: r * 0.8, count: 4, spacing: 0.26, size: 0.06 }));
  parts.push(...pores(r, { x: r * 0.2, y: r * 1.0, z: -r * 0.8, count: 4, spacing: 0.26, size: 0.06 }));
  parts.push(...vein(r, { from: [-r * 0.8, r * 1.5, 0], to: [r * 0.7, r * 1.1, 0], thickness: 0.045 }));
  return {
    body: merge(parts),
    legs: legGeos(legs),
    turret: merge([
      sphere(r * 0.3, CHITIN, { sy: 0.85 }, 10),
      ...segments(r, { from: [r * 0.1, r * 0.24, 0], to: [-r * 0.3, r * 0.18, 0], count: 3, width: 0.5, rise: 0.06 }),
      // A short, wide throat angled up: a mortar rather than a rifle.
      cylinder(r * 0.26, r * 0.32, r * 0.7, FLESH, { x: r * 0.3, y: r * 0.26, rz: Math.PI / 2 - 0.5 }, 10),
      cylinder(r * 0.3, r * 0.3, r * 0.07, CHITIN_DARK, { x: r * 0.42, y: r * 0.32, rz: Math.PI / 2 - 0.5 }, 10),
      sphere(r * 0.18, BILE, { x: r * 0.48, y: r * 0.42 }, 8, 6),
    ]),
    turretY: r * 1.3,
  };
}

function blTap(s, c) {
  // A mouth clamped over a metal seam. It should look like it is feeding on
  // the ground rather than standing on it.
  const parts = mound(s, c, 0.12);
  parts.push(cylinder(s * 0.11, s * 0.18, s * 0.46, CHITIN, { y: s * 0.28 }, 10));
  // Ribs up the throat, so it is not a smooth funnel.
  for (let i = 0; i < 4; i++) {
    parts.push(cylinder(s * (0.13 + i * 0.015), s * (0.13 + i * 0.015), s * 0.03, CHITIN_DARK,
      { y: s * (0.12 + i * 0.11) }, 10));
  }
  parts.push(sphere(s * 0.17, CHITIN_LIGHT, { y: s * 0.56, sy: 1.2 }, 12));
  parts.push(box(s * 0.2, s * 0.05, s * 0.14, c.primary, { y: s * 0.68 }));
  parts.push(...maw(s * 0.5, { y: s * 0.72, radius: 0.3, count: 7, len: 0.2 }));
  parts.push(...tendrils(s * 0.5, c, { y: s * 0.2, count: 6, len: 0.5, spread: 0.75 }));
  // Roots gripping the ground around it.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    parts.push(...vein(s, {
      from: [Math.cos(a) * s * 0.14, s * 0.08, Math.sin(a) * s * 0.14],
      to: [Math.cos(a) * s * 0.42, s * 0.02, Math.sin(a) * s * 0.42],
      colour: CHITIN_DARK, thickness: 0.05, kinks: 1,
    }));
  }
  return { body: merge(parts) };
}

function blVent(s, c) {
  const parts = mound(s, c, 0.1);
  // Three chimneys venting biomass gas, each ribbed and leaning differently.
  for (const [x, z, h, lean] of [[-0.14, -0.1, 0.5, 0.12], [0.14, 0.06, 0.62, -0.08], [0, 0.18, 0.42, 0.05]]) {
    parts.push(cylinder(s * 0.055, s * 0.09, s * h, CHITIN_DARK,
      { x: s * x, z: s * z, y: s * h * 0.5, rz: lean }, 8));
    for (let i = 0; i < 3; i++) {
      parts.push(cylinder(s * 0.075, s * 0.075, s * 0.025, CHITIN,
        { x: s * x, z: s * z, y: s * (0.12 + i * h * 0.3), rz: lean }, 8));
    }
    parts.push(cylinder(s * 0.07, s * 0.055, s * 0.08, BILE,
      { x: s * x, z: s * z, y: s * (h + 0.03) }, 8));
  }
  parts.push(...sac(s, c, { x: -s * 0.2, z: s * 0.16, scale: 0.7 }));
  parts.push(box(s * 0.22, s * 0.05, s * 0.16, c.primary, { x: s * 0.06, z: -s * 0.22, y: s * 0.14 }));
  parts.push(...pores(s, { x: s * 0.05, y: s * 0.1, z: -s * 0.3, count: 4, spacing: 0.12, size: 0.03 }));
  return { body: merge(parts) };
}

function blBloom(s, c) {
  // The big reactor: a flower that has grown too large for itself.
  const parts = mound(s, c, 0.14);
  parts.push(sphere(s * 0.3, CHITIN, { y: s * 0.34, sy: 0.9 }, 14));
  parts.push(sphere(s * 0.22, BILE, { y: s * 0.44, sy: 0.85 }, 12));
  // Petals opening off the bulb, each with a spine up its back.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * s * 0.26;
    const pz = Math.sin(a) * s * 0.26;
    parts.push(cone(s * 0.1, s * 0.46, CHITIN_LIGHT, {
      x: px, z: pz, y: s * 0.5, rx: Math.sin(a) * 0.8, rz: -Math.cos(a) * 0.8,
    }, 7));
    parts.push(cone(s * 0.045, s * 0.5, c.primary, {
      x: px * 1.06, z: pz * 1.06, y: s * 0.54, rx: Math.sin(a) * 0.8, rz: -Math.cos(a) * 0.8,
    }, 5));
  }
  parts.push(...tendrils(s * 0.6, c, { y: s * 0.18, count: 7, len: 0.6, spread: 0.85 }));
  parts.push(...vein(s, { from: [-s * 0.3, s * 0.14, 0], to: [s * 0.3, s * 0.14, 0], thickness: 0.04, kinks: 3 }));
  return { body: merge(parts) };
}

function blGut(s, c) {
  // The converter: a stomach. Sacs feed into it and something comes out.
  const parts = mound(s, c, 0.1);
  parts.push(sphere(s * 0.26, FLESH, { y: s * 0.28, sy: 0.95 }, 12));
  for (let i = 0; i < 4; i++) {
    parts.push(cylinder(s * (0.25 - i * 0.02), s * (0.25 - i * 0.02), s * 0.03, CHITIN_DARK,
      { y: s * (0.16 + i * 0.09) }, 12));
  }
  parts.push(...maw(s * 0.6, { y: s * 0.5, radius: 0.34, count: 9, len: 0.24 }));
  parts.push(...sac(s, c, { x: s * 0.24, scale: 0.6 }));
  parts.push(...sac(s, c, { x: -s * 0.24, z: s * 0.1, scale: 0.55 }));
  // Gullets running from each sac into the stomach.
  parts.push(...vein(s, { from: [s * 0.24, s * 0.16, 0], to: [s * 0.05, s * 0.3, 0], thickness: 0.05, kinks: 1 }));
  parts.push(...vein(s, { from: [-s * 0.24, s * 0.16, s * 0.1], to: [-s * 0.05, s * 0.3, s * 0.02], thickness: 0.05, kinks: 1 }));
  parts.push(box(s * 0.18, s * 0.05, s * 0.13, c.primary, { z: -s * 0.24, y: s * 0.2 }));
  return { body: merge(parts) };
}

function blStore(s, c, metalKind) {
  const parts = mound(s, c, 0.1);
  const colour = metalKind ? CHITIN_LIGHT : BILE;
  parts.push(...sac(s, c, { x: -s * 0.16, z: -s * 0.14, scale: 1.05, colour }));
  parts.push(...sac(s, c, { x: s * 0.17, z: -s * 0.02, scale: 0.9, colour }));
  parts.push(...sac(s, c, { x: -s * 0.04, z: s * 0.19, scale: 0.8, colour }));
  // Membranes strung between the sacs: the read that makes three balls into
  // one organism rather than three balls.
  parts.push(...vein(s, { from: [-s * 0.16, s * 0.18, -s * 0.14], to: [s * 0.17, s * 0.16, -s * 0.02], thickness: 0.05, kinks: 1 }));
  parts.push(...vein(s, { from: [s * 0.17, s * 0.16, -s * 0.02], to: [-s * 0.04, s * 0.14, s * 0.19], thickness: 0.05, kinks: 1 }));
  parts.push(box(s * 0.16, s * 0.04, s * 0.12, c.primary, { z: -s * 0.3, y: s * 0.1 }));
  return { body: merge(parts) };
}

function blPit(s, c, deep) {
  // The factory: a hole in the ground that things climb out of.
  const parts = mound(s, c, deep ? 0.14 : 0.12);
  // A ring of carapace around an open pit, alternating tall and short so the
  // rim is a jaw rather than a crown.
  const teeth = deep ? 11 : 9;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tall = i % 2 === 0;
    parts.push(cone(s * (deep ? 0.09 : 0.075) * (tall ? 1 : 0.8),
      s * (deep ? 0.5 : 0.4) * (tall ? 1 : 0.7), CHITIN_LIGHT, {
        x: Math.cos(a) * s * 0.3, z: Math.sin(a) * s * 0.3, y: s * 0.2,
        rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3,
      }, 7));
  }
  parts.push(cylinder(s * 0.26, s * 0.32, s * 0.12, CHITIN_DARK, { y: s * 0.07 }, 14));
  parts.push(cylinder(s * 0.2, s * 0.2, s * 0.05, BILE, { y: s * 0.1 }, 14));
  // The marked lip on the side the units come out of.
  parts.push(box(s * 0.14, s * 0.06, s * 0.3, c.primary, { x: s * 0.33, y: s * 0.13 }));
  parts.push(...sac(s, c, { x: -s * 0.32, z: s * 0.24, scale: deep ? 0.9 : 0.7 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.7;
    parts.push(...vein(s, {
      from: [Math.cos(a) * s * 0.3, s * 0.1, Math.sin(a) * s * 0.3],
      to: [Math.cos(a) * s * 0.46, s * 0.02, Math.sin(a) * s * 0.46],
      colour: CHITIN_DARK, thickness: 0.05, kinks: 1,
    }));
  }
  if (deep) {
    parts.push(...sac(s, c, { x: s * 0.3, z: -s * 0.28, scale: 0.8 }));
    parts.push(...spines(s * 0.7, c, { x: s * 0.1, y: s * 0.42, count: 5, len: 0.5, spacing: 0.3 }));
    parts.push(...segments(s, { from: [-s * 0.3, s * 0.3, 0], to: [s * 0.1, s * 0.26, 0], count: 4, width: 0.35, rise: 0.05 }));
  }
  return { body: merge(parts) };
}

function blSpire(s, c) {
  const parts = mound(s, c, 0.09);
  parts.push(cylinder(s * 0.06, s * 0.14, s * 0.85, CHITIN, { y: s * 0.48 }, 10));
  parts.push(sphere(s * 0.12, c.primary, { y: s * 0.92, sy: 1.2 }, 10));
  parts.push(sphere(s * 0.07, BILE, { y: s * 1.0 }, 8));
  parts.push(...tendrils(s * 0.5, c, { y: s * 0.8, count: 4, len: 0.45, spread: 0.4 }));
  return { body: merge(parts) };
}

function blThorn(s, c, big) {
  const parts = mound(s, c, big ? 0.13 : 0.1);
  parts.push(sphere(s * (big ? 0.26 : 0.2), c.primary, { y: s * 0.22, sy: 0.8 }, 12));
  return {
    body: merge(parts),
    turret: merge([
      sphere(s * (big ? 0.2 : 0.15), CHITIN, { sy: 0.9 }, 10),
      cone(s * (big ? 0.13 : 0.09), s * (big ? 0.8 : 0.6), CHITIN_LIGHT,
        { x: s * (big ? 0.34 : 0.26), rz: -Math.PI / 2 }, 8),
      cylinder(s * 0.05, s * 0.07, s * 0.1, BILE,
        { x: s * (big ? 0.7 : 0.54), rz: Math.PI / 2 }, 8),
      ...spines(s * 0.6, c, { y: s * 0.14, count: 3, len: 0.3, spacing: 0.22 }),
    ]),
    turretY: s * (big ? 0.42 : 0.34),
  };
}

function blAntenna(s, c) {
  const parts = mound(s, c, 0.08);
  parts.push(cylinder(s * 0.05, s * 0.1, s * 0.6, CHITIN_DARK, { y: s * 0.34 }, 8));
  return {
    body: merge(parts),
    spinner: merge([
      sphere(s * 0.13, FLESH, { sy: 0.7 }, 10),
      ...tendrils(s * 0.8, c, { count: 5, len: 0.75, spread: 0.55 }),
      sphere(s * 0.06, BILE, { y: s * 0.08 }, 8),
    ]),
    spinnerY: s * 0.66,
    spinSpeed: 0.5,
  };
}


// -------------------------------------------------------------------- air
//
// Aircraft are read from above and from a long way off, so the silhouette has
// to do the work: an interceptor is a dart, a gunship is a fuselage slung
// under a rotor, and a bomber is a wing with weight hanging off it. Every one
// of them gets undercarriage and an intake, because the thing that makes a
// flying model look real is the parts that only matter on the ground.

/**
 * A wing panel with a root fillet, control surfaces and a tip light.
 *
 * `root` is where the fuselage side is: the fillet spans from there out to the
 * panel, because a wing that starts in mid-air reads as a detached slab rather
 * than as part of the aircraft. That is the single thing that most makes a
 * flying model look wrong.
 */
function wing(r, c, { x = 0, y = 0, z = 0, span = 1, chord = 0.6, sweep = 0.3, thick = 0.09, tip = null, root = 0.25 } = {}) {
  const side = Math.sign(z) || 1;
  // `z` arrives already scaled by r, so bring it back into the same ratio
  // space as span and root before comparing them. Mixing the two makes the
  // fillet come out an order of magnitude too big, which reads as loose
  // panels scattered around the aircraft rather than as a wing.
  const zr = Math.abs(z) / r;
  const inner = Math.max(root + 0.02, zr - span * 0.5);
  const fillet = Math.max(0.1, inner - root);
  return [
    // Fillet from the fuselage side out to the panel root.
    box(r * chord * 1.15, r * thick * 1.5, r * fillet, HULL,
      { x: x + r * chord * 0.06, y, z: side * r * (root + fillet * 0.5) }),
    box(r * chord, r * thick, r * span, HULL, { x, y, z, ry: side * sweep }),
    box(r * chord * 0.3, r * thick * 1.3, r * span * 0.4, HULL_DARK,
      { x: x + r * chord * 0.3, y, z: z - side * r * span * 0.28, ry: side * sweep }),
    // Aileron, in team colour so the wing reads at a distance.
    box(r * chord * 0.26, r * thick * 0.7, r * span * 0.5, c.primary,
      { x: x - r * chord * 0.36, y, z: z + side * r * span * 0.16, ry: side * sweep }),
    cylinder(r * 0.035, r * 0.035, r * 0.06, tip || GLOW,
      { x: x - r * chord * 0.1, y, z: z + side * r * span * 0.5 }, 6),
    ...boltLine(r, {
      from: [x + r * chord * 0.1, y + r * thick * 0.6, z - side * r * span * 0.3],
      to: [x + r * chord * 0.1, y + r * thick * 0.6, z + side * r * span * 0.3],
      count: 4, size: 0.022,
    }),
  ];
}

/** A retractable leg with a wheel, left down because these never land. */
function gearLeg(r, { x = 0, y = 0, z = 0, len = 0.3 } = {}) {
  return [
    cylinder(r * 0.035, r * 0.035, r * len, STEEL, { x, y: y - r * len * 0.5, z }, 6),
    cylinder(r * 0.09, r * 0.09, r * 0.07, GREASE, { x, y: y - r * len, z, rx: Math.PI / 2 }, 10),
    box(r * 0.1, r * 0.12, r * 0.03, HULL_DARK, { x, y: y - r * len * 0.2, z }),
  ];
}

/** A jet intake and the exhaust that goes with it. */
function jetPod(r, c, { x = 0, y = 0, z = 0, len = 0.7, rad = 0.16 } = {}) {
  return [
    cylinder(r * rad, r * rad, r * len, HULL, { x, y, z, rz: Math.PI / 2 }, 14),
    cylinder(r * rad * 1.1, r * rad * 1.1, r * 0.06, HULL_DARK, { x: x + r * len * 0.5, y, z, rz: Math.PI / 2 }, 14),
    cylinder(r * rad * 0.78, r * rad * 0.78, r * 0.05, DARK, { x: x + r * len * 0.52, y, z, rz: Math.PI / 2 }, 12),
    cylinder(r * rad * 0.9, r * rad * 0.9, r * 0.1, GREASE, { x: x - r * len * 0.52, y, z, rz: Math.PI / 2 }, 12),
    cylinder(r * rad * 0.6, r * rad * 0.6, r * 0.05, GLOW, { x: x - r * len * 0.56, y, z, rz: Math.PI / 2 }, 10),
    ...boltRing(r, { x: x + r * len * 0.46, y, z, radius: rad * 1.05, count: 8, size: 0.022 }),
  ];
}

function interceptor(r, c) {
  // A dart: long nose, swept wings well aft, twin tails.
  const parts = [];
  parts.push(cylinder(r * 0.24, r * 0.3, r * 1.5, HULL, { rz: Math.PI / 2 }, 14));
  parts.push(cone(r * 0.2, r * 0.7, HULL, { x: r * 1.05, rz: -Math.PI / 2 }, 14));
  parts.push(cone(r * 0.06, r * 0.3, HULL_LIGHT, { x: r * 1.5, rz: -Math.PI / 2 }, 8));
  // Canopy.
  parts.push(box(r * 0.5, r * 0.16, r * 0.26, GLASS, { x: r * 0.42, y: r * 0.16 }));
  parts.push(box(r * 0.56, r * 0.06, r * 0.3, HULL_DARK, { x: r * 0.4, y: r * 0.08 }));
  // Wings, sharply swept, and canards forward.
  for (const side of [-1, 1]) {
    parts.push(...wing(r, c, { x: -r * 0.2, z: side * r * 0.62, span: 0.95, chord: 0.72, sweep: 0.5, root: 0.22 }));
    parts.push(box(r * 0.3, r * 0.06, r * 0.42, HULL_DARK, { x: r * 0.56, z: side * r * 0.32, ry: side * 0.5 }));
    // Twin tails, canted outward.
    parts.push(box(r * 0.4, r * 0.5, r * 0.06, HULL, { x: -r * 0.86, z: side * r * 0.38, y: r * 0.24, rx: side * 0.35 }));
    parts.push(...jetPod(r, c, { x: -r * 0.5, z: side * r * 0.26, y: -r * 0.04, len: 0.8, rad: 0.15 }));
    parts.push(...gearLeg(r, { x: -r * 0.3, z: side * r * 0.34, y: -r * 0.2, len: 0.26 }));
  }
  parts.push(...gearLeg(r, { x: r * 0.6, y: -r * 0.2, len: 0.24 }));
  parts.push(box(r * 0.7, r * 0.04, r * 0.12, c.primary, { x: r * 0.1, y: r * 0.24 }));
  parts.push(...seam(r, { from: [-r * 0.6, r * 0.2, 0], to: [r * 0.6, r * 0.2, 0], width: 0.03 }));
  return {
    body: merge(parts),
    turret: merge([
      box(r * 0.3, r * 0.14, r * 0.3, HULL_DARK, {}),
      ...[-1, 1].map((side) =>
        cylinder(r * 0.05, r * 0.05, r * 0.5, HULL_LIGHT, { x: r * 0.3, z: side * r * 0.1, rz: Math.PI / 2 }, 8)),
    ]),
    turretY: -r * 0.12,
  };
}

function gunship(r, c) {
  // A fuselage slung under a rotor, with stub wings carrying the pods.
  const parts = [];
  parts.push(box(r * 1.5, r * 0.52, r * 0.68, HULL, { y: r * 0.1 }));
  parts.push(cone(r * 0.28, r * 0.6, HULL, { x: r * 0.98, y: r * 0.06, rz: -Math.PI / 2 }, 12));
  parts.push(box(r * 0.44, r * 0.3, r * 0.4, GLASS, { x: r * 0.62, y: r * 0.18 }));
  // Tail boom and rotor.
  parts.push(cylinder(r * 0.09, r * 0.13, r * 1.1, HULL, { x: -r * 1.15, y: r * 0.16, rz: Math.PI / 2 }, 10));
  parts.push(box(r * 0.3, r * 0.46, r * 0.05, HULL, { x: -r * 1.62, y: r * 0.34 }));
  parts.push(box(r * 0.16, r * 0.06, r * 0.36, HULL_DARK, { x: -r * 1.58, y: r * 0.5 }));
  parts.push(cylinder(r * 0.05, r * 0.05, r * 0.1, STEEL, { x: -r * 1.62, y: r * 0.2, z: r * 0.1, rx: Math.PI / 2 }, 8));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(box(r * 0.04, r * 0.24, r * 0.03, HULL_LIGHT, {
      x: -r * 1.62 + Math.cos(a) * r * 0.16, y: r * 0.2 + Math.sin(a) * r * 0.16, z: r * 0.16,
    }));
  }
  // Engine deck, exhausts and the mast the rotor turns on.
  parts.push(box(r * 0.6, r * 0.3, r * 0.5, HULL_DARK, { x: -r * 0.34, y: r * 0.36 }));
  parts.push(...grille(r, { x: -r * 0.34, y: r * 0.52, w: 0.44, d: 0.4, slats: 5 }));
  for (const side of [-1, 1]) {
    parts.push(cylinder(r * 0.09, r * 0.09, r * 0.2, GREASE,
      { x: -r * 0.66, z: side * r * 0.18, y: r * 0.36, rz: Math.PI / 2 }, 10));
    parts.push(...wing(r, c, { x: r * 0.05, y: r * 0.04, z: side * r * 0.5, span: 0.44, chord: 0.46, sweep: 0.05, thick: 0.11, root: 0.28 }));
    parts.push(box(r * 0.42, r * 0.2, r * 0.22, HULL_DARK, { x: r * 0.02, z: side * r * 0.78, y: -r * 0.06 }));
    parts.push(...[-1, 1].map((k) =>
      cylinder(r * 0.05, r * 0.05, r * 0.18, GREASE, { x: r * 0.24, z: side * r * 0.78 + k * r * 0.06, y: -r * 0.06, rz: Math.PI / 2 }, 8)));
    parts.push(...gearLeg(r, { x: -r * 0.1, z: side * r * 0.36, y: -r * 0.16, len: 0.28 }));
  }
  parts.push(cylinder(r * 0.1, r * 0.1, r * 0.3, STEEL, { x: -r * 0.05, y: r * 0.6 }, 10));
  parts.push(box(r * 0.5, r * 0.04, r * 0.1, c.primary, { x: r * 0.1, y: r * 0.36 }));
  return {
    body: merge(parts),
    turret: merge([
      cylinder(r * 0.12, r * 0.14, r * 0.12, HULL_DARK, {}, 10),
      box(r * 0.34, r * 0.14, r * 0.16, HULL, { x: r * 0.16 }),
      ...[-1, 1].map((side) =>
        cylinder(r * 0.04, r * 0.04, r * 0.36, HULL_LIGHT, { x: r * 0.38, z: side * r * 0.05, rz: Math.PI / 2 }, 8)),
    ]),
    turretY: -r * 0.2,
    // The main rotor, turning.
    spinner: merge([
      cylinder(r * 0.09, r * 0.09, r * 0.1, STEEL, {}, 10),
      ...[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return box(r * 2.3, r * 0.035, r * 0.16, HULL_DARK, { ry: a });
      }),
      ...boltRing(r, { radius: 0.08, count: 6, size: 0.022 }),
    ]),
    spinnerY: r * 0.76,
    spinSpeed: 16,
  };
}

function bomber(r, c) {
  // A wing with weight hanging off it.
  const parts = [];
  parts.push(box(r * 1.9, r * 0.46, r * 0.84, HULL, { y: r * 0.06 }));
  parts.push(cone(r * 0.38, r * 0.66, HULL, { x: r * 1.22, y: r * 0.04, rz: -Math.PI / 2 }, 14));
  parts.push(box(r * 0.5, r * 0.24, r * 0.44, GLASS, { x: r * 0.74, y: r * 0.2 }));
  parts.push(...seam(r, { from: [-r * 0.8, r * 0.28, 0], to: [r * 0.7, r * 0.28, 0], width: 0.035 }));
  // Bomb bay, open, with its load visible.
  parts.push(box(r * 0.9, r * 0.14, r * 0.44, GREASE, { x: -r * 0.1, y: -r * 0.2 }));
  for (let i = 0; i < 3; i++) {
    parts.push(cylinder(r * 0.1, r * 0.1, r * 0.3, HULL_DARK,
      { x: -r * 0.4 + i * r * 0.3, y: -r * 0.28, rz: Math.PI / 2 }, 10));
    parts.push(cone(r * 0.09, r * 0.16, '#ff9a5b',
      { x: -r * 0.24 + i * r * 0.3, y: -r * 0.28, rz: -Math.PI / 2 }, 8));
  }
  for (const side of [-1, 1]) {
    parts.push(...wing(r, c, { x: -r * 0.1, z: side * r * 0.9, span: 1.35, chord: 1.0, sweep: 0.22, thick: 0.13, root: 0.34 }));
    parts.push(...jetPod(r, c, { x: -r * 0.05, z: side * r * 0.82, y: -r * 0.16, len: 0.9, rad: 0.17 }));
    parts.push(box(r * 0.34, r * 0.44, r * 0.05, HULL, { x: -r * 1.02, z: side * r * 0.3, y: r * 0.26, rx: side * 0.25 }));
    parts.push(...gearLeg(r, { x: -r * 0.2, z: side * r * 0.5, y: -r * 0.2, len: 0.3 }));
  }
  parts.push(box(r * 0.5, r * 0.5, r * 0.06, HULL, { x: -r * 1.06, y: r * 0.3 }));
  parts.push(...gearLeg(r, { x: r * 0.8, y: -r * 0.18, len: 0.26 }));
  parts.push(box(r * 0.8, r * 0.04, r * 0.14, c.primary, { x: r * 0.1, y: r * 0.28 }));
  parts.push(...optics(r, { x: r * 0.9, y: -r * 0.14, scale: 0.6 }));
  return {
    body: merge(parts),
    turret: merge([
      cylinder(r * 0.12, r * 0.12, r * 0.1, HULL_DARK, {}, 10),
      box(r * 0.26, r * 0.12, r * 0.2, HULL, { x: r * 0.1 }),
    ]),
    turretY: r * 0.3,
  };
}

/** Air plant: an open shed with a pad, a gantry and a windsock. */
function airPlant(s, c, heavy) {
  const parts = foundation(s, c);
  parts.push(box(s * 0.8, s * 0.05, s * 0.8, '#33373d', { y: s * 0.06 }));
  // Landing circle.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    parts.push(box(s * 0.06, s * 0.02, s * 0.05, HULL_LIGHT,
      { x: Math.cos(a) * s * 0.3, z: Math.sin(a) * s * 0.3, y: s * 0.09, ry: -a }));
  }
  parts.push(box(s * 0.3, s * 0.02, s * 0.08, c.primary, { y: s * 0.09 }));
  // Hangar block along one side, with roof panels and a gantry over the pad.
  parts.push(box(s * 0.3, s * 0.34, s * 0.86, HULL, { x: -s * 0.32, y: s * 0.24 }));
  parts.push(...roofPanels(s, s * 0.42, c, { w: 0.28, d: 0.8 }));
  parts.push(...grille(s, { x: -s * 0.32, y: s * 0.42, w: 0.22, d: 0.6, slats: 6 }));
  parts.push(box(s * 0.26, s * 0.2, s * 0.5, HULL_DARK, { x: -s * 0.32, y: s * 0.14 }));
  for (const side of [-1, 1]) {
    parts.push(box(s * 0.05, s * 0.42, s * 0.05, STEEL, { x: s * 0.28, z: side * s * 0.34, y: s * 0.26 }));
    parts.push(cylinder(s * 0.03, s * 0.03, s * 0.3, STEEL, { x: -s * 0.05, z: side * s * 0.34, y: s * 0.46, rz: Math.PI / 2 }, 6));
  }
  parts.push(box(s * 0.7, s * 0.05, s * 0.08, STEEL, { x: s * 0.0, y: s * 0.48 }));
  parts.push(box(s * 0.12, s * 0.1, s * 0.14, HULL_DARK, { x: s * 0.1, y: s * 0.42 }));
  // Windsock and approach lights.
  parts.push(cylinder(s * 0.012, s * 0.012, s * 0.36, STEEL, { x: s * 0.34, z: -s * 0.34, y: s * 0.24 }, 6));
  parts.push(cone(s * 0.05, s * 0.16, '#ff9a5b', { x: s * 0.34, z: -s * 0.3, y: s * 0.4, rz: -Math.PI / 2 }, 8));
  for (const side of [-1, 1]) {
    parts.push(cylinder(s * 0.03, s * 0.03, s * 0.04, GLOW, { x: s * 0.36, z: side * s * 0.16, y: s * 0.1 }, 8));
  }
  if (heavy) {
    parts.push(box(s * 0.22, s * 0.26, s * 0.7, HULL_DARK, { x: s * 0.3, y: s * 0.2 }));
    parts.push(...boltLine(s, { from: [s * 0.3, s * 0.34, -s * 0.3], to: [s * 0.3, s * 0.34, s * 0.3], count: 5, size: 0.03 }));
  }
  return { body: merge(parts) };
}

/** Anti-air emplacement: a ring mount with barrels that point up. */
function aaTurret(s, c, { missile = false } = {}) {
  const parts = foundation(s, c);
  parts.push(cylinder(s * 0.3, s * 0.34, s * 0.2, HULL, { y: s * 0.16 }, 16));
  parts.push(...boltRing(s, { y: s * 0.27, radius: 0.26, count: 12, size: 0.03 }));
  parts.push(box(s * 0.3, s * 0.16, s * 0.24, HULL_DARK, { x: -s * 0.28, y: s * 0.14 }));
  parts.push(...grille(s, { x: -s * 0.28, y: s * 0.23, w: 0.2, d: 0.18, slats: 3 }));
  return {
    body: merge(parts),
    turret: merge(missile ? [
      cylinder(s * 0.2, s * 0.22, s * 0.14, HULL, {}, 14),
      // A rack of tubes, canted up.
      ...[-1, 1].flatMap((side) => [0, 1].map((k) =>
        cylinder(s * 0.07, s * 0.07, s * 0.5, HULL_DARK, {
          x: s * 0.04, z: side * s * 0.12, y: s * 0.18 + k * s * 0.14, rz: 0.8,
        }, 10))),
      ...[-1, 1].flatMap((side) => [0, 1].map((k) =>
        cone(s * 0.055, s * 0.12, '#9fe8ff', {
          x: s * 0.2, z: side * s * 0.12, y: s * 0.36 + k * s * 0.14, rz: 0.8 - Math.PI,
        }, 8))),
      ...optics(s, { x: -s * 0.14, y: s * 0.16, scale: 0.5 }),
      box(s * 0.24, s * 0.06, s * 0.03, c.primary, { y: s * 0.1, z: s * 0.2 }),
    ] : [
      cylinder(s * 0.2, s * 0.22, s * 0.14, HULL, {}, 14),
      box(s * 0.22, s * 0.24, s * 0.34, HULL_DARK, { y: s * 0.14 }),
      // Twin barrels at a steep elevation.
      ...[-1, 1].map((side) =>
        cylinder(s * 0.05, s * 0.045, s * 0.66, HULL_LIGHT, {
          x: s * 0.14, z: side * s * 0.09, y: s * 0.36, rz: 0.9,
        }, 10)),
      ...[-1, 1].map((side) =>
        cylinder(s * 0.07, s * 0.06, s * 0.1, GREASE, {
          x: s * 0.32, z: side * s * 0.09, y: s * 0.6, rz: 0.9,
        }, 10)),
      box(s * 0.16, s * 0.14, s * 0.12, GREASE, { x: -s * 0.12, y: s * 0.2 }),
      ...optics(s, { x: s * 0.02, z: -s * 0.2, y: s * 0.2, scale: 0.5 }),
      box(s * 0.24, s * 0.06, s * 0.03, c.primary, { y: s * 0.08, z: s * 0.2 }),
    ]),
    turretY: s * 0.3,
  };
}

/** The hive's flyers: the same silhouettes grown rather than built. */
function blFlyer(r, c, kind) {
  const parts = [];
  const big = kind === 'gorger';
  const span = kind === 'midge' ? 1.2 : big ? 1.7 : 1.4;
  parts.push(...carapace(r, c.primary, { y: 0, scale: big ? 1.2 : 0.9, squash: 0.5 }));
  parts.push(cone(r * (big ? 0.3 : 0.22), r * 0.8, CHITIN, { x: r * 0.8, rz: -Math.PI / 2 }, 10));
  parts.push(...maw(r, { x: r * 1.0, radius: 0.22, count: 6, len: 0.24 }));
  for (const side of [-1, 1]) {
    // Membrane wings on a ribbed spar.
    parts.push(box(r * 0.7, r * 0.04, r * span, FLESH, { x: -r * 0.1, z: side * r * span * 0.55, ry: side * 0.25 }));
    parts.push(cylinder(r * 0.05, r * 0.03, r * span, CHITIN_DARK,
      { x: r * 0.14, z: side * r * span * 0.55, rx: Math.PI / 2, ry: side * 0.25 }, 6));
    for (let i = 1; i <= 3; i++) {
      parts.push(cylinder(r * 0.02, r * 0.015, r * 0.5, CHITIN_DARK, {
        x: -r * 0.16, z: side * r * span * (0.2 * i), rx: Math.PI / 2, ry: side * 0.25,
      }, 5));
    }
    parts.push(cone(r * 0.05, r * 0.3, CHITIN_LIGHT, { x: -r * 0.6, z: side * r * 0.3, rz: 0.6 }, 6));
  }
  parts.push(...spines(r, c, { x: -r * 0.1, y: r * 0.2, count: big ? 5 : 3, len: 0.4 }));
  parts.push(sphere(r * 0.1, BILE, { x: r * 0.4, y: r * 0.14 }, 8));
  parts.push(...tendrils(r, c, { x: -r * 0.5, y: -r * 0.1, count: 4, len: 0.5, spread: 0.3 }));
  if (big) {
    // The load it drops.
    for (let i = 0; i < 3; i++) {
      parts.push(sphere(r * 0.14, BILE, { x: -r * 0.3 + i * r * 0.3, y: -r * 0.26, sy: 1.2 }, 8));
    }
  }
  return {
    body: merge(parts),
    turret: merge([
      sphere(r * 0.16, FLESH, { sy: 0.8 }, 10),
      ...maw(r, { x: r * 0.16, radius: 0.14, count: 5, len: 0.18 }),
    ]),
    turretY: big ? -r * 0.2 : r * 0.16,
  };
}

/** The hive's roost, and its spore thrower. */
function blRoost(s, c) {
  const parts = mound(s, c, 0.13);
  // An open cup with a ring of spines, and egg sacs around the rim.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(cone(s * 0.08, s * 0.55, c.primary, {
      x: Math.cos(a) * s * 0.32, z: Math.sin(a) * s * 0.32, y: s * 0.24,
      rx: Math.sin(a) * 0.42, rz: -Math.cos(a) * 0.42,
    }, 7));
  }
  parts.push(cylinder(s * 0.26, s * 0.3, s * 0.1, CHITIN_DARK, { y: s * 0.07 }, 14));
  parts.push(cylinder(s * 0.2, s * 0.2, s * 0.05, BILE, { y: s * 0.11 }, 14));
  parts.push(...sac(s, c, { x: -s * 0.3, z: s * 0.26, scale: 0.75 }));
  parts.push(...sac(s, c, { x: s * 0.28, z: -s * 0.3, scale: 0.6 }));
  parts.push(...tendrils(s * 0.7, c, { y: s * 0.2, count: 6, len: 0.55, spread: 0.8 }));
  return { body: merge(parts) };
}

function blSporeThrower(s, c) {
  const parts = mound(s, c, 0.1);
  parts.push(sphere(s * 0.22, c.primary, { y: s * 0.22, sy: 0.85 }, 12));
  return {
    body: merge(parts),
    turret: merge([
      sphere(s * 0.16, CHITIN, { sy: 0.9 }, 10),
      // A throat angled up, ringed with teeth.
      cylinder(s * 0.1, s * 0.14, s * 0.5, FLESH, { x: s * 0.1, y: s * 0.24, rz: 0.95 }, 10),
      ...maw(s * 0.8, { x: s * 0.24, y: s * 0.46, radius: 0.16, count: 7, len: 0.16 }),
      ...spines(s * 0.7, c, { y: s * 0.12, count: 3, len: 0.3, spacing: 0.24 }),
      sphere(s * 0.06, BILE, { x: -s * 0.1, y: s * 0.14 }, 8),
    ]),
    turretY: s * 0.3,
  };
}

// -------------------------------------------------------------- infantry
//
// A soldier is roughly a tenth the volume of a tank and is drawn at a tenth
// the pixel size, so the detail that reads on a hull is wasted here. What
// carries at this scale is silhouette: helmet, shoulders, a weapon held out
// from the body, and the gap between the legs. Everything below is shaped to
// make those four things survive being twenty pixels tall.
//
// The unit the game moves is one soldier, not a squad marker -- the squad is
// six of these walking together -- so the model is built small and cheap.

const WEBBING = '#4a4f45';
const FATIGUE = '#5d6350';
const SKIN = '#9c7b61';

/**
 * One figure, standing, facing +X with its weapon out front.
 *
 * `h` is the figure's height in world units; every proportion below is a
 * fraction of it, so the same function serves a rifleman and a heavier
 * trooper. `pose` shifts the legs so a squad does not look like a row of
 * identical statues -- the same model drawn six times is the one thing that
 * would give the trick away.
 */
function soldier(h, c, { pose = 0, kit = 'rifle', coat = FATIGUE } = {}) {
  const parts = [];
  // Proportions are taken off a real figure rather than guessed: head about a
  // seventh of the height, shoulders at 0.82, hips at 0.50, knees at 0.27.
  // The first pass used a head a fifth of the body and it read as a robot with
  // a bowl on it -- at this size the head is the one measurement that has to
  // be right, because it is the part the eye uses to judge all the others.
  const HIP = 0.5;
  const SHOULDER = 0.82;
  const HEAD = 0.9;

  // Legs: thigh, shin, boot, each leg its own part hung from the hip so the
  // view can swing it. The pose only staggers the rest stance now; the walk
  // itself is animated.
  const legs = [];
  for (const [side, phase] of [[-1, 0], [1, Math.PI]]) {
    const off = Math.sin(pose + phase) * h * 0.02;
    const z = side * h * 0.065;
    const leg = [];
    leg.push(box(h * 0.105, h * 0.24, h * 0.1, coat, {
      x: off * 0.45, y: h * 0.385, z, rz: off * 0.5 / h,
    }));
    leg.push(box(h * 0.085, h * 0.22, h * 0.085, coat, {
      x: off * 0.9, y: h * 0.16, z, rz: off * 0.3 / h,
    }));
    leg.push(box(h * 0.145, h * 0.055, h * 0.1, DARK, {
      x: off + h * 0.02, y: h * 0.03, z,
    }));
    legs.push({ parts: leg, pivot: [0, h * HIP, z], phase: side < 0 ? 0 : 1 });
  }

  // Hips and torso. The chest is a shade wider than the waist, which is what
  // separates a person from a stack of boxes.
  parts.push(box(h * 0.14, h * 0.07, h * 0.2, coat, { y: h * HIP }));
  parts.push(box(h * 0.145, h * 0.14, h * 0.21, coat, { y: h * 0.61 }));
  parts.push(box(h * 0.16, h * 0.15, h * 0.24, coat, { y: h * 0.745 }));
  // Webbing: a belt, a strap over one shoulder, and the pack behind.
  parts.push(box(h * 0.165, h * 0.035, h * 0.225, WEBBING, { y: h * 0.545 }));
  parts.push(box(h * 0.04, h * 0.2, h * 0.05, WEBBING, { x: h * 0.075, y: h * 0.69, z: -h * 0.06, rz: 0.2 }));
  parts.push(box(h * 0.1, h * 0.17, h * 0.19, WEBBING, { x: -h * 0.12, y: h * 0.7 }));
  parts.push(box(h * 0.055, h * 0.06, h * 0.06, GREASE, { x: -h * 0.15, y: h * 0.61, z: h * 0.07 }));
  // The recognition panel: a plate on the chest, not a coloured head.
  parts.push(box(h * 0.035, h * 0.075, h * 0.15, c.primary, { x: h * 0.08, y: h * 0.72 }));

  // Shoulders, then neck and head. The helmet is a dome a little wider than
  // the skull, with a brim at the front only.
  parts.push(box(h * 0.13, h * 0.07, h * 0.3, coat, { y: h * SHOULDER }));
  for (const side of [-1, 1]) {
    parts.push(sphere(h * 0.045, coat, { y: h * (SHOULDER + 0.01), z: side * h * 0.135 }, 6, 5));
  }
  parts.push(cylinder(h * 0.032, h * 0.032, h * 0.04, SKIN, { y: h * 0.858 }, 6));
  parts.push(sphere(h * 0.052, SKIN, { y: h * (HEAD - 0.005) }, 6, 5));
  parts.push(sphere(h * 0.062, coat, { y: h * (HEAD + 0.008), sy: 0.85 }, 8, 6));
  parts.push(box(h * 0.055, h * 0.014, h * 0.1, DARK, { x: h * 0.045, y: h * (HEAD - 0.01) }));
  // Team colour on the helmet is a stripe front to back, not a painted dome:
  // a coloured dome is the brightest thing on the model and swallows the head.
  parts.push(box(h * 0.11, h * 0.016, h * 0.022, c.light, { y: h * (HEAD + 0.055) }));

  // Arms. Upper arm down and slightly forward, forearm across to the weapon,
  // so the gun is held rather than growing out of the chest.
  const armKit = (side, reach) => {
    const z = side * h * 0.115;
    parts.push(box(h * 0.06, h * 0.145, h * 0.06, coat, { x: h * 0.01, y: h * 0.735, z, rz: 0.25 }));
    parts.push(box(h * 0.14, h * 0.05, h * 0.05, coat, {
      x: h * (0.075 + reach * 0.5), y: h * 0.66, z: z * 0.85, rz: -0.12,
    }));
    parts.push(sphere(h * 0.03, DARK, { x: h * (0.13 + reach), y: h * 0.655, z: z * 0.8 }, 6, 5));
  };

  if (kit === 'launcher') {
    armKit(-1, 0.05); armKit(1, 0.0);
    parts.push(cylinder(h * 0.042, h * 0.042, h * 0.4, DARK, {
      x: h * 0.1, y: h * 0.795, z: -h * 0.075, rz: Math.PI / 2,
    }, 8));
    parts.push(cylinder(h * 0.058, h * 0.046, h * 0.07, GREASE, {
      x: -h * 0.09, y: h * 0.795, z: -h * 0.075, rz: Math.PI / 2,
    }, 8));
    parts.push(cone(h * 0.05, h * 0.09, c.primary, {
      x: h * 0.34, y: h * 0.795, z: -h * 0.075, rz: -Math.PI / 2,
    }, 8));
    parts.push(box(h * 0.02, h * 0.05, h * 0.02, STEEL, { x: h * 0.02, y: h * 0.755, z: -h * 0.075 }));
  } else if (kit === 'sam') {
    armKit(-1, 0.04); armKit(1, 0.0);
    parts.push(cylinder(h * 0.045, h * 0.045, h * 0.38, GREASE, {
      x: h * 0.12, y: h * 0.86, z: -h * 0.075, rz: Math.PI / 2 - 0.55,
    }, 8));
    parts.push(cone(h * 0.052, h * 0.09, c.primary, {
      x: h * 0.29, y: h * 0.975, z: -h * 0.075, rz: -0.55,
    }, 8));
    parts.push(box(h * 0.07, h * 0.06, h * 0.06, DARK, { x: h * 0.02, y: h * 0.805, z: -h * 0.075 }));
    parts.push(sphere(h * 0.022, GLOW, { x: h * 0.06, y: h * 0.83, z: -h * 0.075 }, 6, 4));
  } else if (kit === 'support') {
    armKit(-1, 0.1); armKit(1, 0.03);
    parts.push(box(h * 0.3, h * 0.04, h * 0.04, DARK, { x: h * 0.2, y: h * 0.655 }));
    parts.push(box(h * 0.09, h * 0.055, h * 0.055, GREASE, { x: h * 0.08, y: h * 0.655 }));
    parts.push(cylinder(h * 0.055, h * 0.055, h * 0.045, GREASE, {
      x: h * 0.1, y: h * 0.605, rx: Math.PI / 2,
    }, 8));
    for (const side of [-1, 1]) {
      parts.push(box(h * 0.022, h * 0.12, h * 0.022, STEEL, {
        x: h * 0.3, y: h * 0.58, z: side * h * 0.03, rz: 0.35,
      }));
    }
  } else {
    armKit(-1, 0.09); armKit(1, 0.02);
    parts.push(box(h * 0.26, h * 0.035, h * 0.035, DARK, { x: h * 0.185, y: h * 0.665 }));
    parts.push(box(h * 0.085, h * 0.06, h * 0.05, GREASE, { x: h * 0.085, y: h * 0.665 }));
    parts.push(box(h * 0.035, h * 0.08, h * 0.03, DARK, { x: h * 0.09, y: h * 0.605, rz: 0.18 }));
    parts.push(box(h * 0.09, h * 0.045, h * 0.035, WEBBING, { x: -h * 0.005, y: h * 0.672 }));
    parts.push(box(h * 0.02, h * 0.025, h * 0.015, STEEL, { x: h * 0.14, y: h * 0.695 }));
  }
  return { parts, legs };
}

/**
 * The hive's version: the same silhouette read as a thing rather than a man.
 * Hunched, no helmet, and a carapace instead of webbing -- close enough in
 * outline that a player reads "swarm of small bodies" at a glance, different
 * enough on inspection that it is clearly not somebody's infantry.
 */
function swarmer(h, c, { pose = 0, kit = 'rifle' } = {}) {
  const parts = [];

  // Four legs rather than two, splayed low. A wider, flatter footprint is what
  // separates it from a man at the twenty-pixel size that matters.
  const legs = [];
  for (const side of [-1, 1]) {
    for (const [fx, k] of [[0.12, 0], [-0.1, 1]]) {
      const off = Math.sin(pose + k * Math.PI + (side > 0 ? 1.6 : 0)) * h * 0.02;
      const leg = [
        box(h * 0.08, h * 0.26, h * 0.07, CHITIN_DARK, {
          x: h * fx + off * 0.4, y: h * 0.2, z: side * h * 0.13, rz: 0.2 * side,
        }),
        cone(h * 0.05, h * 0.09, CHITIN_DARK, {
          x: h * fx + off, y: h * 0.05, z: side * h * 0.16, rz: Math.PI,
        }, 6),
      ];
      legs.push({ parts: leg, pivot: [h * fx, h * 0.33, side * h * 0.13], phase: (k === 0) === (side > 0) ? 0 : 1 });
    }
  }

  // A low, ridged abdomen carried horizontally.
  parts.push(sphere(h * 0.19, CHITIN, { x: -h * 0.06, y: h * 0.42 }, 8, 6));
  parts.push(box(h * 0.3, h * 0.2, h * 0.24, CHITIN, { x: h * 0.08, y: h * 0.45 }));
  for (let i = 0; i < 3; i++) {
    parts.push(box(h * 0.035, h * 0.1, h * 0.26, CHITIN_LIGHT, {
      x: h * (0.0 + i * 0.09), y: h * 0.55,
    }));
  }
  parts.push(box(h * 0.2, h * 0.09, h * 0.2, c.primary, { x: h * 0.1, y: h * 0.56 }));

  // Head: a wedge with mandibles and two glowing pits.
  parts.push(cone(h * 0.13, h * 0.2, CHITIN_LIGHT, { x: h * 0.28, y: h * 0.46, rz: -Math.PI / 2 }, 8));
  for (const side of [-1, 1]) {
    parts.push(cone(h * 0.035, h * 0.14, CHITIN_DARK, {
      x: h * 0.38, y: h * 0.42, z: side * h * 0.06, rz: -Math.PI / 2, rx: side * 0.3,
    }, 6));
    parts.push(sphere(h * 0.035, BILE, { x: h * 0.32, y: h * 0.52, z: side * h * 0.06 }, 6, 4));
  }

  if (kit === 'launcher' || kit === 'sam') {
    // A barbed spine carried over the back, angled up for the AA variant.
    const lift = kit === 'sam' ? 0.55 : 0.15;
    parts.push(cylinder(h * 0.05, h * 0.02, h * 0.46, CHITIN_LIGHT, {
      x: h * 0.06, y: h * 0.66, rz: Math.PI / 2 - lift,
    }, 8));
    parts.push(cone(h * 0.055, h * 0.12, BILE, {
      x: h * 0.26, y: h * 0.66 + h * lift * 0.5, rz: -lift,
    }, 6));
  } else if (kit === 'support') {
    parts.push(cylinder(h * 0.07, h * 0.05, h * 0.3, CHITIN_LIGHT, {
      x: h * 0.2, y: h * 0.6, rz: Math.PI / 2 - 0.2,
    }, 8));
    parts.push(sphere(h * 0.07, BILE, { x: h * 0.34, y: h * 0.66 }, 6, 4));
  }
  return { parts, legs };
}

/**
 * A squad, drawn as one model.
 *
 * Every body in a squad is its own entity in the simulation, so this is not a
 * squad marker -- it is the single figure that entity draws. It is kept as its
 * own function only so the pose can be varied by a seed taken from the def, so
 * that a line of them is not a line of identical statues.
 */
function infantryFigure(r, c, { kit = 'rifle', hive = false, seed = 0 } = {}) {
  // Infantry radius is small (6 world units); the figure stands about three
  // radii tall, which puts a soldier at roughly half a tank's height.
  const h = r * 3.1;
  const pose = seed * 1.37;
  const fig = hive ? swarmer(h, c, { pose, kit }) : soldier(h, c, { pose, kit });
  return { body: merge(fig.parts), legs: legGeos(fig.legs) };
}

/**
 * A barracks: a low drill yard rather than a hangar.
 *
 * It has to read as "infantry" from straight overhead and at a glance, which
 * means it cannot look like a smaller bot lab. What distinguishes it is that
 * it is horizontal -- huts, a parade square, a perimeter -- where every other
 * factory is a tall shed with a mouth. `hive` swaps the huts for growths.
 */
function barracks(s, c, { hive = false } = {}) {
  const shell = hive ? CHITIN : HULL;
  const shellDark = hive ? CHITIN_DARK : HULL_DARK;
  const parts = foundation(s, c, 1.6);
  const h = 1.6;

  // The square itself: a worn plate with lane markings, which is most of what
  // is visible from the game camera.
  parts.push(box(s * 0.62, s * 0.04, s * 0.78, '#26292f', { x: s * 0.06, y: h + s * 0.02 }));
  for (let i = 0; i < 4; i++) {
    parts.push(box(s * 0.5, s * 0.012, s * 0.03, '#6a7079', {
      x: s * 0.08, z: s * (-0.3 + i * 0.2), y: h + s * 0.045,
    }));
  }

  // Two barrack huts along the back edge, roofs ridged so they are not slabs.
  for (const side of [-1, 1]) {
    const z = side * s * 0.3;
    parts.push(box(s * 0.28, s * 0.22, s * 0.3, shell, { x: -s * 0.26, z, y: h + s * 0.11 }));
    parts.push(box(s * 0.3, s * 0.05, s * 0.32, shellDark, { x: -s * 0.26, z, y: h + s * 0.24 }));
    parts.push(box(s * 0.3, s * 0.05, s * 0.06, c.primary, { x: -s * 0.26, z, y: h + s * 0.27 }));
    if (hive) {
      parts.push(sphere(s * 0.1, CHITIN_LIGHT, { x: -s * 0.26, z, y: h + s * 0.3 }, 8, 6));
      parts.push(sphere(s * 0.04, BILE, { x: -s * 0.14, z, y: h + s * 0.16 }, 6, 4));
    } else {
      parts.push(box(s * 0.04, s * 0.09, s * 0.07, GLASS, { x: -s * 0.12, z, y: h + s * 0.13 }));
      parts.push(...boltLine(s, {
        from: [-s * 0.4, h + s * 0.24, z - s * 0.13],
        to: [-s * 0.12, h + s * 0.24, z - s * 0.13], count: 3, size: 0.018,
      }));
    }
  }

  // The gate the squads come out of: two posts and a lintel on +X.
  parts.push(box(s * 0.07, s * 0.3, s * 0.07, shell, { x: s * 0.36, z: -s * 0.22, y: h + s * 0.15 }));
  parts.push(box(s * 0.07, s * 0.3, s * 0.07, shell, { x: s * 0.36, z: s * 0.22, y: h + s * 0.15 }));
  parts.push(box(s * 0.09, s * 0.07, s * 0.52, c.primary, { x: s * 0.36, y: h + s * 0.32 }));
  parts.push(sphere(s * 0.045, hive ? BILE : GLOW, { x: s * 0.36, y: h + s * 0.38 }, 8, 6));

  // A perimeter of low blocks on the two open sides, so the footprint has an
  // edge rather than fading into the ground.
  for (let i = 0; i < 5; i++) {
    const z = s * (-0.36 + i * 0.18);
    parts.push(box(s * 0.08, s * 0.08, s * 0.1, shellDark, { x: s * 0.42, z, y: h + s * 0.04 }));
  }

  if (hive) {
    // Egg sacs where a human barracks would have a store and a mast.
    for (const [x, z, rr] of [[0.06, -0.36, 0.11], [0.2, 0.34, 0.09], [-0.02, 0.3, 0.07]]) {
      parts.push(sphere(s * rr, CHITIN_LIGHT, { x: s * x, z: s * z, y: h + s * rr * 0.8 }, 8, 6));
      parts.push(sphere(s * rr * 0.35, BILE, { x: s * x, z: s * z, y: h + s * rr * 1.5 }, 6, 4));
    }
  } else {
    // Quartermaster's store, a stack of crates and a flagpole: the props that
    // say people live here rather than machines being assembled.
    parts.push(box(s * 0.16, s * 0.16, s * 0.2, shellDark, { x: s * 0.1, z: -s * 0.36, y: h + s * 0.08 }));
    parts.push(box(s * 0.1, s * 0.1, s * 0.1, GREASE, { x: s * 0.22, z: s * 0.34, y: h + s * 0.05 }));
    parts.push(box(s * 0.1, s * 0.1, s * 0.1, GREASE, { x: s * 0.22, z: s * 0.34, y: h + s * 0.15 }));
    parts.push(box(s * 0.1, s * 0.1, s * 0.1, GREASE, { x: s * 0.1, z: s * 0.34, y: h + s * 0.05 }));
    parts.push(cylinder(s * 0.018, s * 0.018, s * 0.55, STEEL, { x: -s * 0.02, z: s * 0.36, y: h + s * 0.28 }, 6));
    parts.push(box(s * 0.01, s * 0.12, s * 0.16, c.light, { x: -s * 0.02, z: s * 0.44, y: h + s * 0.47 }));
    parts.push(...railing(s, {
      from: [s * 0.3, h, -s * 0.4], to: [s * 0.3, h, s * 0.4], posts: 3,
    }));
  }
  return { body: merge(parts) };
}

const BUILDERS = {
  commander: (d, c) => commander(d.radius, c, d.faction),

  // Infantry. The `seed` varies the walking pose between the three squad
  // types so a mixed force is not six copies of one statue.
  barracks: (d, c) => barracks(d.footprintPx, c),
  con_barracks: (d, c) => barracks(d.footprintPx, c),
  bl_brood: (d, c) => barracks(d.footprintPx, c, { hive: true }),
  trooper: (d, c) => infantryFigure(d.radius, c, { kit: 'rifle', seed: 0 }),
  lancer: (d, c) => infantryFigure(d.radius, c, { kit: 'launcher', seed: 1 }),
  marksman: (d, c) => infantryFigure(d.radius, c, { kit: 'support', seed: 2 }),
  con_rifles: (d, c) => infantryFigure(d.radius, c, { kit: 'rifle', seed: 3 }),
  con_at: (d, c) => infantryFigure(d.radius, c, { kit: 'launcher', seed: 4 }),
  con_aa_team: (d, c) => infantryFigure(d.radius, c, { kit: 'sam', seed: 5 }),
  bl_swarmer: (d, c) => infantryFigure(d.radius, c, { kit: 'rifle', hive: true, seed: 0 }),
  bl_barbs: (d, c) => infantryFigure(d.radius, c, { kit: 'launcher', hive: true, seed: 1 }),
  bl_screamer: (d, c) => infantryFigure(d.radius, c, { kit: 'sam', hive: true, seed: 2 }),

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
  bl_hive: (d, c) => blHive(d.radius, c),
  bl_tender: (d, c) => blTender(d.radius, c),
  bl_tender2: (d, c) => blTender(d.radius, c),
  bl_skitter: (d, c) => blSkitter(d.radius, c),
  bl_husk: (d, c) => blHusk(d.radius, c),
  bl_spitter: (d, c) => blSpitter(d.radius, c),
  bl_brute: (d, c) => blBrute(d.radius, c),
  bl_lobber: (d, c) => blLobber(d.radius, c),
  bl_tap: (d, c) => blTap(d.footprintPx, c),
  bl_vent: (d, c) => blVent(d.footprintPx, c),
  bl_bloom: (d, c) => blBloom(d.footprintPx, c),
  bl_gut: (d, c) => blGut(d.footprintPx, c),
  bl_sac: (d, c) => blStore(d.footprintPx, c, true),
  bl_bladder: (d, c) => blStore(d.footprintPx, c, false),
  bl_pit: (d, c) => blPit(d.footprintPx, c, false),
  bl_deeppit: (d, c) => blPit(d.footprintPx, c, true),
  bl_spire: (d, c) => blSpire(d.footprintPx, c),
  bl_thorn: (d, c) => blThorn(d.footprintPx, c, false),
  bl_maw: (d, c) => blThorn(d.footprintPx, c, true),
  bl_antenna: (d, c) => blAntenna(d.footprintPx, c),

  airpad: (d, c) => airPlant(d.footprintPx, c, false),
  aatower: (d, c) => aaTurret(d.footprintPx, c, { missile: false }),
  gnat: (d, c) => interceptor(d.radius, c),
  harrier: (d, c) => gunship(d.radius, c),
  hammerhead: (d, c) => bomber(d.radius, c),
  con_apron: (d, c) => airPlant(d.footprintPx, c, true),
  con_battery_aa: (d, c) => aaTurret(d.footprintPx, c, { missile: true }),
  con_needle: (d, c) => interceptor(d.radius, c),
  con_vulture: (d, c) => gunship(d.radius, c),
  con_anvil: (d, c) => bomber(d.radius, c),
  bl_roost: (d, c) => blRoost(d.footprintPx, c),
  bl_spitter_aa: (d, c) => blSporeThrower(d.footprintPx, c),
  bl_midge: (d, c) => blFlyer(d.radius, c, 'midge'),
  bl_wing: (d, c) => blFlyer(d.radius, c, 'wing'),
  bl_gorger: (d, c) => blFlyer(d.radius, c, 'gorger'),

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

/**
 * Build a model without caching or splitting out the emissive parts.
 *
 * The runtime wants the split - glowing detail is drawn with its own unlit
 * material - but the asset exporter wants the model whole, so it can group
 * triangles into one material per colour and hand an artist something
 * sensible to edit.
 */
export function buildRawModel(def, colors) {
  const build = BUILDERS[def.id];
  const m = build
    ? build(def, colors)
    : { body: box(def.radius * 1.6, def.radius * 1.6, def.radius * 1.6, colors.primary, { y: def.radius * 0.8 }) };
  m.turretY = m.turretY || 0;
  m.spinnerY = m.spinnerY || 0;
  m.spinnerX = m.spinnerX || 0;
  m.spinSpeed = m.spinSpeed || 0;
  m.spinnerAxis = m.spinnerAxis || 'y';
  return m;
}

/** The palette an exported asset is authored in, so materials can be named. */
export const PALETTE = {
  HULL, HULL_DARK, HULL_LIGHT, DARK, GLASS, GLOW, TRACK,
  STEEL, GREASE,
  CHITIN, CHITIN_DARK, CHITIN_LIGHT, FLESH, BILE,
  WEBBING, FATIGUE, SKIN,
};

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
  // The browser renderer does not animate legs; it draws them as body.
  if (m.legs && m.legs.length) {
    m.body = merge([m.body, ...m.legs.map((l) => l.geo)]);
  }

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
