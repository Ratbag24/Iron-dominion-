// Terrain surface, water, metal-spot decals and the fog-of-war overlay.
//
// The ground is a displaced, flat-shaded heightfield. Fog is a second, much
// coarser copy of the same surface carrying a data texture built from the
// player's fog grid, which keeps the fog edge glued to the terrain.

import * as THREE from '../../../vendor/three.module.js';
import { TERRAIN_WATER, TERRAIN_ROCK } from '../../sim/map.js';
import { clamp } from '../../core/math.js';
import { ringXZ, merge } from './geometry.js';

/** World units of elevation for the full normalised height range. */
export const HEIGHT_SCALE = 190;

export function terrainHeightAt(map, x, y) {
  return map.heightAt(x, y) * HEIGHT_SCALE;
}

/** Bilinear height sample, so units glide rather than step between cells. */
export function smoothHeightAt(map, x, y) {
  const cell = map.cell;
  const fx = x / cell - 0.5;
  const fy = y / cell - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const cx = (i) => clamp(i, 0, map.cols - 1);
  const cy = (i) => clamp(i, 0, map.rows - 1);
  const h00 = map.heights[map.idx(cx(x0), cy(y0))];
  const h10 = map.heights[map.idx(cx(x0 + 1), cy(y0))];
  const h01 = map.heights[map.idx(cx(x0), cy(y0 + 1))];
  const h11 = map.heights[map.idx(cx(x0 + 1), cy(y0 + 1))];
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return (a + (b - a) * ty) * HEIGHT_SCALE;
}

function terrainColor(map, cx, cy, out) {
  const i = map.idx(cx, cy);
  const terrain = map.terrain[i];
  const height = map.heights[i];
  const hx = map.heights[map.idx(Math.max(0, cx - 1), cy)];
  const hy = map.heights[map.idx(cx, Math.max(0, cy - 1))];
  const slope = clamp(((height - hx) + (height - hy)) * 4.5, -0.45, 0.45);

  let r, g, b;
  if (terrain === TERRAIN_WATER) {
    const d = clamp((map.waterLine - height) * 3.4, 0, 1);
    r = 0.055 - d * 0.025; g = 0.13 - d * 0.055; b = 0.24 - d * 0.09;
  } else if (terrain === TERRAIN_ROCK) {
    const t = clamp((height - map.rockLine) * 3.2, 0, 1);
    r = 0.30 + t * 0.26; g = 0.30 + t * 0.26; b = 0.33 + t * 0.27;
  } else {
    // Land runs from damp green-brown in the low ground to dry pale grass on
    // the ridges, which reads clearly from directly above.
    const t = clamp((height - map.waterLine) / Math.max(0.01, map.rockLine - map.waterLine), 0, 1);
    const e = t * t * (3 - 2 * t);
    r = 0.115 + e * 0.34;
    g = 0.175 + e * 0.30;
    b = 0.085 + e * 0.20;
  }
  const s = 1 + slope * 0.85;
  out.setRGB(clamp(r * s, 0, 1), clamp(g * s, 0, 1), clamp(b * s, 0, 1));
}

/** The displaced, flat-shaded ground mesh. */
export function buildTerrainMesh(map) {
  const geo = new THREE.PlaneGeometry(map.width, map.height, map.cols - 1, map.rows - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.width / 2, 0, map.height / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const cx = clamp(Math.round(x / map.cell - 0.5), 0, map.cols - 1);
    const cy = clamp(Math.round(z / map.cell - 0.5), 0, map.rows - 1);
    pos.setY(i, map.heights[map.idx(cx, cy)] * HEIGHT_SCALE);
  }

  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();

  // One colour per triangle gives crisp facets and makes cliffs legible.
  const p = flat.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let tri = 0; tri < p.count; tri += 3) {
    let sx = 0;
    let sz = 0;
    for (let k = 0; k < 3; k++) { sx += p.getX(tri + k); sz += p.getZ(tri + k); }
    const cx = clamp(Math.floor((sx / 3) / map.cell), 0, map.cols - 1);
    const cy = clamp(Math.floor((sz / 3) / map.cell), 0, map.rows - 1);
    terrainColor(map, cx, cy, c);
    for (let k = 0; k < 3; k++) {
      colors[(tri + k) * 3] = c.r;
      colors[(tri + k) * 3 + 1] = c.g;
      colors[(tri + k) * 3 + 2] = c.b;
    }
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(flat, mat);
  mesh.receiveShadow = false;
  mesh.name = 'terrain';
  return mesh;
}

export function buildWaterMesh(map) {
  const geo = new THREE.PlaneGeometry(map.width * 1.4, map.height * 1.4, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.width / 2, map.waterLine * HEIGHT_SCALE + 1.2, map.height / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0x2e6f9e, transparent: true, opacity: 0.72, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.renderOrder = 1;
  return mesh;
}

/** Painted rings marking every metal spot. Merged into a single draw call. */
export function buildMetalSpotDecals(map) {
  const geoms = [];
  for (const s of map.metalSpots) {
    const r = 20 + s.yield * 6;
    const ring = ringXZ(r * 0.78, r, '#e8d08c', 20);
    ring.translate(s.x, smoothHeightAt(map, s.x, s.y) + 1.6, s.y);
    geoms.push(ring);
    const core = ringXZ(0, r * 0.34, '#c9ab68', 12);
    core.translate(s.x, smoothHeightAt(map, s.x, s.y) + 1.5, s.y);
    geoms.push(core);
  }
  if (!geoms.length) return null;
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const mesh = new THREE.Mesh(merge(geoms), mat);
  mesh.renderOrder = 2;
  mesh.name = 'metalSpots';
  return mesh;
}

/**
 * Fog surface: a coarse copy of the terrain carrying a texture built from the
 * fog grid. Unexplored is near-opaque, explored-but-unseen is dimmed.
 */
export class FogSurface {
  constructor(map, fog) {
    this.map = map;
    this.fog = fog;

    const segs = 110;
    const geo = new THREE.PlaneGeometry(map.width, map.height, segs, segs);
    geo.rotateX(-Math.PI / 2);
    geo.translate(map.width / 2, 0, map.height / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Lift slightly so the fog never z-fights with the ground.
      pos.setY(i, smoothHeightAt(map, pos.getX(i), pos.getZ(i)) + 2.5);
    }
    geo.computeVertexNormals();

    this.data = new Uint8Array(fog.cols * fog.rows * 4);
    this.texture = new THREE.DataTexture(this.data, fog.cols, fog.rows, THREE.RGBAFormat);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 5;
    this.mesh.name = 'fog';
  }

  update() {
    const { fog, data } = this;
    // The plane's V axis runs opposite to the fog grid's rows.
    for (let y = 0; y < fog.rows; y++) {
      const srcRow = (fog.rows - 1 - y) * fog.cols;
      const dstRow = y * fog.cols;
      for (let x = 0; x < fog.cols; x++) {
        const i = srcRow + x;
        const o = (dstRow + x) * 4;
        data[o] = 2;
        data[o + 1] = 4;
        data[o + 2] = 8;
        data[o + 3] = fog.visible[i] ? 0 : fog.explored[i] ? 125 : 242;
      }
    }
    this.texture.needsUpdate = true;
  }
}

/** Top-down raster of the map, used by the minimap. */
export function renderMapThumbnail(map, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const c = new THREE.Color();

  for (let py = 0; py < size; py++) {
    const cy = Math.min(map.rows - 1, Math.floor((py / size) * map.rows));
    for (let px = 0; px < size; px++) {
      const cx = Math.min(map.cols - 1, Math.floor((px / size) * map.cols));
      terrainColor(map, cx, cy, c);
      const o = (py * size + px) * 4;
      data[o] = Math.min(255, c.r * 300);
      data[o + 1] = Math.min(255, c.g * 300);
      data[o + 2] = Math.min(255, c.b * 300);
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const scale = size / map.width;
  for (const s of map.metalSpots) {
    ctx.beginPath();
    ctx.arc(s.x * scale, s.y * scale, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235,210,140,0.85)';
    ctx.fill();
  }
  return canvas;
}
