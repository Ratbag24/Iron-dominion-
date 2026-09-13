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
function finish(geo, color, t) {
  const g = geo.toNonIndexed();
  geo.dispose();

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

export function box(w, h, d, color, t) {
  return finish(new THREE.BoxGeometry(w, h, d), color, t);
}

export function cylinder(rTop, rBottom, h, color, t, segments = 10) {
  return finish(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, t);
}

export function cone(r, h, color, t, segments = 8) {
  return finish(new THREE.ConeGeometry(r, h, segments), color, t);
}

export function sphere(r, color, t, segments = 8) {
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

/** Flat ring lying in the XZ plane, used for selection and range decals. */
export function ringXZ(inner, outer, color, segments = 32) {
  const geo = new THREE.RingGeometry(inner, outer, segments);
  geo.rotateX(-Math.PI / 2);
  return finish(geo, color, null);
}
