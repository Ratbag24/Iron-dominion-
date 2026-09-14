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
  const parts = legPair(r, c, { gauge: 0.46, scale: 0.9 });
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
  const parts = legPair(r, c, { gauge: 0.5, scale: 0.85, splay: 0.2 });
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
  const parts = legPair(r, c, { gauge: 0.48, scale: 0.95 });

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
  const parts = legPair(r, c, { gauge: 0.5, scale: 1.0 });
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
  const parts = legPair(r, c, { gauge: 0.62, scale: 1.35, splay: 0.16 });
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
  const parts = legPair(r, c, { gauge: 0.66, scale: 1.2, splay: 0.24 });
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
function legPair(r, c, { gauge = 0.5, scale = 1, splay = 0.12 } = {}) {
  const parts = [];
  const s = scale;
  for (const side of [-gauge, gauge]) {
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
  }
  return parts;
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
function conTankStore(s, c, metalKind) {
  const parts = foundation(s, c);
  const tint = metalKind ? HULL : '#d8b24a';
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
  const parts = foundation(s, c);
  parts.push(cylinder(s * 0.22, s * 0.24, s * 0.7, HULL, { x: -s * 0.16, y: s * 0.42 }, 10));
  parts.push(cylinder(s * 0.15, s * 0.16, s * 0.5, HULL_LIGHT, { x: s * 0.22, z: s * 0.18, y: s * 0.32 }, 8));
  parts.push(cylinder(s * 0.12, s * 0.12, s * 0.1, '#ffd76a', { x: -s * 0.16, y: s * 0.8 }, 10));
  parts.push(box(s * 0.5, s * 0.07, s * 0.07, HULL_DARK, { x: s * 0.04, z: -s * 0.2, y: s * 0.5 }));
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

// --------------------------------------------------------------- hive units

function blHive(r, c) {
  const parts = crawlerLegs(r, c, { scale: 1.3, gauge: 0.7, count: 4 });
  parts.push(...carapace(r, c.primary, { y: r * 1.5, scale: 1.5, squash: 0.72 }));
  parts.push(...carapace(r, c.dark, { x: -r * 0.5, y: r * 2.1, scale: 0.9 }));
  parts.push(...spines(r, c, { x: -r * 0.2, y: r * 2.3, count: 5, len: 0.8, spacing: 0.26 }));
  parts.push(...maw(r, { x: r * 1.25, y: r * 1.4, radius: 0.45, count: 10, len: 0.36 }));
  parts.push(sphere(r * 0.2, BILE, { x: r * 0.7, y: r * 2.0 }, 10));
  parts.push(...tendrils(r, c, { x: r * 0.9, y: r * 0.9, count: 6, len: 0.9, spread: 0.6 }));
  return {
    body: merge(parts),
    turret: merge([
      ...carapace(r, c.light, { scale: 0.5, squash: 0.8 }),
      cylinder(r * 0.16, r * 0.2, r * 0.9, CHITIN, { x: r * 0.6, rz: Math.PI / 2 }, 10),
      cylinder(r * 0.1, r * 0.1, r * 0.22, BILE, { x: r * 1.06, rz: Math.PI / 2 }, 8),
    ]),
    turretY: r * 2.15,
  };
}

function blTender(r, c) {
  const parts = crawlerLegs(r, c, { scale: 0.9, gauge: 0.6 });
  parts.push(...carapace(r, c.primary, { y: r * 0.95, scale: 0.95 }));
  parts.push(...tendrils(r, c, { x: r * 0.7, y: r * 0.85, count: 4, len: 0.75, spread: 0.4 }));
  parts.push(sphere(r * 0.16, BILE, { x: r * 0.3, y: r * 1.28 }, 8));
  parts.push(...spines(r, c, { x: -r * 0.3, y: r * 1.24, count: 3, len: 0.36, spacing: 0.22 }));
  return { body: merge(parts) };
}

function blSkitter(r, c) {
  // All legs and jaw. Nothing here is meant to survive being shot at.
  const parts = crawlerLegs(r, c, { scale: 1.1, gauge: 0.75, count: 3 });
  parts.push(...carapace(r, c.primary, { y: r * 0.8, scale: 0.8, squash: 0.5 }));
  parts.push(...maw(r, { x: r * 0.72, y: r * 0.78, radius: 0.3, count: 6, len: 0.28 }));
  parts.push(sphere(r * 0.1, BILE, { x: r * 0.3, y: r * 1.02 }, 8));
  parts.push(cone(r * 0.14, r * 0.6, CHITIN_DARK, { x: -r * 0.7, y: r * 0.85, rz: Math.PI / 2 }, 7));
  return { body: merge(parts) };
}

function blHusk(r, c) {
  const parts = crawlerLegs(r, c, { scale: 1, gauge: 0.62, count: 3 });
  parts.push(...carapace(r, c.primary, { y: r * 1.0, scale: 1.05 }));
  parts.push(...carapace(r, c.dark, { x: r * 0.42, y: r * 1.12, scale: 0.6, squash: 0.7 }));
  parts.push(...spines(r, c, { x: -r * 0.25, y: r * 1.36, count: 4, len: 0.46 }));
  parts.push(sphere(r * 0.12, BILE, { x: r * 0.5, y: r * 1.3 }, 8));
  return {
    body: merge(parts),
    turret: merge([
      sphere(r * 0.3, FLESH, { sy: 0.8 }, 10),
      ...maw(r, { x: r * 0.3, radius: 0.26, count: 7, len: 0.3 }),
    ]),
    turretY: r * 1.32,
  };
}

function blSpitter(r, c) {
  const parts = crawlerLegs(r, c, { scale: 1, gauge: 0.66, count: 3 });
  parts.push(...carapace(r, c.primary, { y: r * 1.0, scale: 1.0 }));
  // The bile sac it fires from, carried high on the back.
  parts.push(sphere(r * 0.46, BILE, { x: -r * 0.34, y: r * 1.42, sy: 0.85 }, 12));
  parts.push(sphere(r * 0.3, FLESH, { x: -r * 0.34, y: r * 1.5, sy: 0.7 }, 10));
  parts.push(...tendrils(r, c, { x: r * 0.5, y: r * 1.0, count: 3, len: 0.5, spread: 0.35 }));
  return {
    body: merge(parts),
    turret: merge([
      sphere(r * 0.26, CHITIN, { sy: 0.9 }, 10),
      cone(r * 0.2, r * 0.8, FLESH, { x: r * 0.5, rz: -Math.PI / 2 }, 8),
      cylinder(r * 0.08, r * 0.12, r * 0.16, BILE, { x: r * 0.92, rz: Math.PI / 2 }, 8),
    ]),
    turretY: r * 1.3,
  };
}

function blBrute(r, c) {
  const parts = crawlerLegs(r, c, { scale: 1.5, gauge: 0.8, count: 4 });
  parts.push(...carapace(r, c.primary, { y: r * 1.35, scale: 1.5, squash: 0.7 }));
  parts.push(...carapace(r, c.dark, { x: r * 0.6, y: r * 1.5, scale: 0.85, squash: 0.75 }));
  parts.push(...spines(r, c, { x: -r * 0.3, y: r * 2.0, count: 6, len: 0.8, spacing: 0.24 }));
  parts.push(...maw(r, { x: r * 1.35, y: r * 1.35, radius: 0.44, count: 10, len: 0.4 }));
  parts.push(sphere(r * 0.14, BILE, { x: r * 0.8, y: r * 1.9, z: r * 0.3 }, 8));
  parts.push(sphere(r * 0.14, BILE, { x: r * 0.8, y: r * 1.9, z: -r * 0.3 }, 8));
  return {
    body: merge(parts),
    turret: merge([
      sphere(r * 0.42, FLESH, { sy: 0.8 }, 12),
      ...maw(r, { x: r * 0.42, radius: 0.34, count: 9, len: 0.42 }),
      ...spines(r, c, { x: -r * 0.2, y: r * 0.28, count: 3, len: 0.4, spacing: 0.2 }),
    ]),
    turretY: r * 1.85,
  };
}

function blLobber(r, c) {
  const parts = crawlerLegs(r, c, { scale: 1.3, gauge: 0.8, count: 4 });
  parts.push(...carapace(r, c.primary, { y: r * 1.0, scale: 1.25, squash: 0.55 }));
  parts.push(sphere(r * 0.5, BILE, { x: -r * 0.5, y: r * 1.3, sy: 0.9 }, 12));
  parts.push(...tendrils(r, c, { x: r * 0.6, y: r * 0.8, count: 4, len: 0.6, spread: 0.5 }));
  return {
    body: merge(parts),
    turret: merge([
      sphere(r * 0.34, CHITIN, { sy: 0.9 }, 10),
      // A mortar throat, angled up.
      cylinder(r * 0.26, r * 0.18, r * 1.2, FLESH, { x: r * 0.4, y: r * 0.4, rz: -0.9 }, 10),
      cylinder(r * 0.28, r * 0.28, r * 0.14, CHITIN_LIGHT, { x: r * 0.76, y: r * 0.82, rz: -0.9 }, 10),
    ]),
    turretY: r * 1.2,
  };
}

// ---------------------------------------------------------- hive structures

function blTap(s, c) {
  const parts = mound(s, c, 0.12);
  parts.push(cylinder(s * 0.1, s * 0.16, s * 0.5, CHITIN, { y: s * 0.3 }, 10));
  parts.push(sphere(s * 0.17, c.primary, { y: s * 0.56, sy: 1.2 }, 12));
  parts.push(...maw(s * 0.5, { y: s * 0.72, radius: 0.3, count: 7, len: 0.2 }));
  parts.push(...tendrils(s * 0.5, c, { y: s * 0.2, count: 6, len: 0.5, spread: 0.75 }));
  return { body: merge(parts) };
}

function blVent(s, c) {
  const parts = mound(s, c, 0.1);
  // Three chimneys venting biomass gas.
  for (const [x, z, h] of [[-0.14, -0.1, 0.5], [0.14, 0.06, 0.62], [0, 0.18, 0.42]]) {
    parts.push(cylinder(s * 0.055, s * 0.09, s * h, CHITIN_DARK,
      { x: s * x, z: s * z, y: s * h * 0.5 }, 8));
    parts.push(cylinder(s * 0.07, s * 0.055, s * 0.08, BILE,
      { x: s * x, z: s * z, y: s * (h + 0.03) }, 8));
  }
  parts.push(...sac(s, c, { x: -s * 0.2, z: s * 0.16, scale: 0.7 }));
  return { body: merge(parts) };
}

function blBloom(s, c) {
  const parts = mound(s, c, 0.14);
  parts.push(sphere(s * 0.3, c.primary, { y: s * 0.34, sy: 0.9 }, 14));
  parts.push(sphere(s * 0.22, BILE, { y: s * 0.44, sy: 0.85 }, 12));
  // Petals opening off the bulb.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(cone(s * 0.1, s * 0.46, c.dark, {
      x: Math.cos(a) * s * 0.26, z: Math.sin(a) * s * 0.26, y: s * 0.5,
      rx: Math.sin(a) * 0.8, rz: -Math.cos(a) * 0.8,
    }, 7));
  }
  parts.push(...tendrils(s * 0.6, c, { y: s * 0.18, count: 7, len: 0.6, spread: 0.85 }));
  return { body: merge(parts) };
}

function blGut(s, c) {
  const parts = mound(s, c, 0.1);
  parts.push(sphere(s * 0.26, FLESH, { y: s * 0.28, sy: 0.95 }, 12));
  parts.push(...maw(s * 0.6, { y: s * 0.5, radius: 0.34, count: 9, len: 0.24 }));
  parts.push(...sac(s, c, { x: s * 0.24, scale: 0.6 }));
  parts.push(...sac(s, c, { x: -s * 0.24, z: s * 0.1, scale: 0.55 }));
  return { body: merge(parts) };
}

function blStore(s, c, metalKind) {
  const parts = mound(s, c, 0.1);
  const colour = metalKind ? CHITIN_LIGHT : BILE;
  parts.push(...sac(s, c, { x: -s * 0.16, z: -s * 0.14, scale: 1.05, colour }));
  parts.push(...sac(s, c, { x: s * 0.17, z: -s * 0.02, scale: 0.9, colour }));
  parts.push(...sac(s, c, { x: -s * 0.04, z: s * 0.19, scale: 0.8, colour }));
  return { body: merge(parts) };
}

function blPit(s, c, deep) {
  const parts = mound(s, c, deep ? 0.14 : 0.12);
  // A ring of carapace around an open pit.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push(cone(s * (deep ? 0.09 : 0.075), s * (deep ? 0.5 : 0.4), c.primary, {
      x: Math.cos(a) * s * 0.3, z: Math.sin(a) * s * 0.3, y: s * 0.2,
      rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3,
    }, 7));
  }
  parts.push(cylinder(s * 0.26, s * 0.3, s * 0.1, CHITIN_DARK, { y: s * 0.06 }, 14));
  parts.push(cylinder(s * 0.2, s * 0.2, s * 0.05, BILE, { y: s * 0.1 }, 14));
  parts.push(...sac(s, c, { x: -s * 0.32, z: s * 0.24, scale: deep ? 0.9 : 0.7 }));
  if (deep) {
    parts.push(...sac(s, c, { x: s * 0.3, z: -s * 0.28, scale: 0.8 }));
    parts.push(...spines(s * 0.7, c, { x: s * 0.1, y: s * 0.42, count: 5, len: 0.5, spacing: 0.3 }));
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
