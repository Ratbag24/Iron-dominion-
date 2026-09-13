// Primitive builders and a small geometry merger.
//
// Every model is assembled from coloured primitives and merged into a single
// BufferGeometry so that one unit costs one draw call when rendered through an
// InstancedMesh.

import * as THREE from '../../../vendor/three.module.js';

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _color = new THREE.Color();

/** Apply position/rotation/scale and bake a flat colour into a geometry. */
/**
 * Drop zero-area triangles.
 *
 * Cone tips generate them by construction - the apex quad collapses to a
 * point - and they have no normal to compute, which shows up as NaN in any
 * tool that processes the mesh afterwards, Godot's LOD generator included.
 */
function dropDegenerate(g) {
  const pos = g.attributes.position.array;
  const triCount = g.attributes.position.count / 3;
  const keep = [];
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const ax = pos[o + 3] - pos[o];
    const ay = pos[o + 4] - pos[o + 1];
    const az = pos[o + 5] - pos[o + 2];
    const bx = pos[o + 6] - pos[o];
    const by = pos[o + 7] - pos[o + 1];
    const bz = pos[o + 8] - pos[o + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    if (Math.hypot(cx, cy, cz) > 1e-9) keep.push(t);
  }
  if (keep.length === triCount) return g;

  const out = new Float32Array(keep.length * 9);
  keep.forEach((t, i) => out.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
  const trimmed = new THREE.BufferGeometry();
  trimmed.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.dispose();
  return trimmed;
}

function finish(geo, color, t) {
  const g = dropDegenerate(geo.toNonIndexed());
  geo.dispose();
  // Per-face normals: a chamfer should read as a distinct facet catching its
  // own highlight, not be averaged away into a soft edge.
  g.computeVertexNormals();

  if (t) {
    _v.set(t.x || 0, t.y || 0, t.z || 0);
    _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    _q.setFromEuler(_e);
    _s.set(t.sx !== undefined ? t.sx : 1, t.sy !== undefined ? t.sy : 1, t.sz !== undefined ? t.sz : 1);
    _m.compose(_v, _q, _s);
    g.applyMatrix4(_m);
  }

  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  _color.set(color);
  // Convert once; three r160 works in linear space internally.
  const r = _color.r;
  const gg = _color.g;
  const b = _color.b;
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = gg;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * Chamfered cuboid. Every hull in the game is built from these, and cutting
 * the edges is what stops them reading as plain blocks: the chamfer catches a
 * different amount of light than the faces either side of it, so edges are
 * picked out instead of vanishing into a flat silhouette.
 *
 * 24 vertices: each one sits at full extent on a single axis and is inset by
 * the bevel on the other two. That gives 6 face quads, 12 edge quads and 8
 * corner triangles.
 */
function chamferBoxGeometry(w, h, d, bevel) {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const b = Math.min(bevel, hx * 0.45, hy * 0.45, hz * 0.45);
  const ix = hx - b;
  const iy = hy - b;
  const iz = hz - b;

  const v = [];
  const push = (x, y, z) => (v.push(x, y, z), v.length / 3 - 1);
  const idx = {};
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    idx[`x${sx}${sy}${sz}`] = push(sx * hx, sy * iy, sz * iz);
    idx[`y${sx}${sy}${sz}`] = push(sx * ix, sy * hy, sz * iz);
    idx[`z${sx}${sy}${sz}`] = push(sx * ix, sy * iy, sz * hz);
  }

  const tris = [];
  const quad = (a, b2, c, dd) => { tris.push(a, b2, c, a, c, dd); };

  // Six face quads.
  quad(idx['x1-1-1'], idx['x1-11'], idx['x111'], idx['x11-1']);
  quad(idx['x-1-1-1'], idx['x-11-1'], idx['x-111'], idx['x-1-11']);
  quad(idx['y-11-1'], idx['y11-1'], idx['y111'], idx['y-111']);
  quad(idx['y-1-1-1'], idx['y-1-11'], idx['y1-11'], idx['y1-1-1']);
  quad(idx['z-1-11'], idx['z-111'], idx['z111'], idx['z1-11']);
  quad(idx['z-1-1-1'], idx['z1-1-1'], idx['z11-1'], idx['z-11-1']);

  // Twelve edge quads, one per cube edge, joining the two faces that meet there.
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    quad(idx[`x1${sy}${sz}`], idx[`y1${sy}${sz}`], idx[`y-1${sy}${sz}`], idx[`x-1${sy}${sz}`]);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    quad(idx[`y${sx}1${sz}`], idx[`z${sx}1${sz}`], idx[`z${sx}-1${sz}`], idx[`y${sx}-1${sz}`]);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    quad(idx[`z${sx}${sy}1`], idx[`x${sx}${sy}1`], idx[`x${sx}${sy}-1`], idx[`z${sx}${sy}-1`]);
  }

  // Eight corner triangles.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    tris.push(idx[`x${sx}${sy}${sz}`], idx[`y${sx}${sy}${sz}`], idx[`z${sx}${sy}${sz}`]);
  }

  // The shape is convex and centred on the origin, so "outward" is simply
  // "away from the origin". Fix any triangle wound the wrong way rather than
  // hand-deriving the winding for all 44 of them.
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b2, c] = [tris[t], tris[t + 1], tris[t + 2]];
    const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2];
    const bx = v[b2 * 3], by = v[b2 * 3 + 1], bz = v[b2 * 3 + 2];
    const cx = v[c * 3], cy = v[c * 3 + 1], cz = v[c * 3 + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const wx = cx - ax, wy = cy - ay, wz = cz - az;
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    if (nx * mx + ny * my + nz * mz < 0) {
      tris[t + 1] = c;
      tris[t + 2] = b2;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  geo.setIndex(tris);
  geo.computeVertexNormals();
  return geo;
}

/** Bevel as a fraction of the smallest dimension, clamped to sane limits. */
const BEVEL_RATIO = 0.16;
const BEVEL_MAX = 1.6;

export function box(w, h, d, color, t) {
  const bevel = Math.min(Math.min(w, h, d) * BEVEL_RATIO, BEVEL_MAX);
  // Very thin pieces (panel lines, plates) gain nothing and would self-fold.
  if (bevel < 0.12) return finish(new THREE.BoxGeometry(w, h, d), color, t);
  return finish(chamferBoxGeometry(w, h, d, bevel), color, t);
}

export function cylinder(rTop, rBottom, h, color, t, segments = 14) {
  return finish(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, t);
}

export function cone(r, h, color, t, segments = 12) {
  return finish(new THREE.ConeGeometry(r, h, segments), color, t);
}

export function sphere(r, color, t, segments = 12) {
  return finish(new THREE.SphereGeometry(r, segments, Math.max(4, segments >> 1)), color, t);
}

/** A flat plate, useful for building foundations and solar panels. */
export function plate(w, d, color, t) {
  return box(w, 0.6, d, color, t);
}

/** Merge geometries that all carry position, normal and colour attributes. */
export function merge(geoms) {
  let total = 0;
  for (const g of geoms) total += g.attributes.position.count;

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);

  let offset = 0;
  for (const g of geoms) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const c = g.attributes.color.array;
    position.set(p, offset * 3);
    normal.set(n, offset * 3);
    color.set(c, offset * 3);
    offset += g.attributes.position.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.computeBoundingSphere();
  return out;
}

/**
 * Split a geometry into the parts painted in `emissiveColors` and everything
 * else, so glowing detail can be drawn with an unlit material that blooms
 * while the hull is lit normally. Returns { solid, glow }; either may be null.
 */
export function splitEmissive(geo, emissiveColors) {
  const targets = emissiveColors.map((hex) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  });

  const pos = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  const col = geo.attributes.color.array;
  const triCount = geo.attributes.position.count / 3;

  const isEmissive = (tri) => {
    const o = tri * 9; // first vertex of the triangle, 3 floats each
    for (const [r, g, b] of targets) {
      if (Math.abs(col[o] - r) < 0.002
        && Math.abs(col[o + 1] - g) < 0.002
        && Math.abs(col[o + 2] - b) < 0.002) return true;
    }
    return false;
  };

  let glowTris = 0;
  for (let t = 0; t < triCount; t++) if (isEmissive(t)) glowTris++;
  if (glowTris === 0) return { solid: geo, glow: null };
  if (glowTris === triCount) return { solid: null, glow: geo };

  const make = (count) => ({
    position: new Float32Array(count * 9),
    normal: new Float32Array(count * 9),
    color: new Float32Array(count * 9),
    n: 0,
  });
  const glow = make(glowTris);
  const solid = make(triCount - glowTris);

  for (let t = 0; t < triCount; t++) {
    const dst = isEmissive(t) ? glow : solid;
    const from = t * 9;
    const to = dst.n * 9;
    for (let k = 0; k < 9; k++) {
      dst.position[to + k] = pos[from + k];
      dst.normal[to + k] = nrm[from + k];
      dst.color[to + k] = col[from + k];
    }
    dst.n++;
  }
  geo.dispose();

  const build = (d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.normal, 3));
    g.setAttribute('color', new THREE.BufferAttribute(d.color, 3));
    g.computeBoundingSphere();
    return g;
  };
  return { solid: build(solid), glow: build(glow) };
}

/** Flat ring lying in the XZ plane, used for selection and range decals. */
export function ringXZ(inner, outer, color, segments = 32) {
  const geo = new THREE.RingGeometry(inner, outer, segments);
  geo.rotateX(-Math.PI / 2);
  return finish(geo, color, null);
}
