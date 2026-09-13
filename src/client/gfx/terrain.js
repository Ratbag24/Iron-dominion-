// Terrain surface, water, metal-spot decals and the fog-of-war overlay.
//
// The ground is a displaced, flat-shaded heightfield. Fog is a second, much
// coarser copy of the same surface carrying a data texture built from the
// player's fog grid, which keeps the fog edge glued to the terrain.

import * as THREE from '../../../vendor/three.module.js';
import { TERRAIN_WATER, TERRAIN_ROCK } from '../../sim/map.js';
import { clamp } from '../../core/math.js';
import { makeNoise2D, fbm } from '../../core/rng.js';
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

// Smooth noise for ground mottling. A per-cell hash was tried first and read
// as a hard checkerboard, because every triangle in a cell shares one colour:
// the variation has to be continuous across cells, not random per cell.
const groundNoise = makeNoise2D(0x51ed27);

function terrainColor(map, cx, cy, out) {
  const i = map.idx(cx, cy);
  const terrain = map.terrain[i];
  const height = map.heights[i];

  // Slope from the surrounding cells, used both for shading and to decide
  // where soil gives way to bare rock.
  const hx0 = map.heights[map.idx(Math.max(0, cx - 1), cy)];
  const hx1 = map.heights[map.idx(Math.min(map.cols - 1, cx + 1), cy)];
  const hy0 = map.heights[map.idx(cx, Math.max(0, cy - 1))];
  const hy1 = map.heights[map.idx(cx, Math.min(map.rows - 1, cy + 1))];
  const gx = (hx1 - hx0) * 0.5;
  const gy = (hy1 - hy0) * 0.5;
  const steepness = clamp(Math.hypot(gx, gy) * 22, 0, 1);
  // Only a whisper of slope shading in the albedo. The sun and the
  // environment map already light the facets; baking more in on top was what
  // produced the banded, blotchy look.
  const lightSlope = clamp((-gx - gy) * 3.0, -0.4, 0.4);

  // Two octaves at different scales: broad patches of drier ground, and a
  // finer break-up on top of them.
  const broad = fbm(groundNoise, cx * 0.045, cy * 0.045, 2);
  const fine = fbm(groundNoise, cx * 0.19, cy * 0.19, 2);

  let r, g, b;
  if (terrain === TERRAIN_WATER) {
    const d = clamp((map.waterLine - height) * 3.4, 0, 1);
    // Shallows read green, depths read almost black-blue.
    r = 0.050 + (1 - d) * 0.035 - d * 0.02;
    g = 0.135 + (1 - d) * 0.070 - d * 0.05;
    b = 0.245 + (1 - d) * 0.045 - d * 0.09;
  } else if (terrain === TERRAIN_ROCK) {
    const t = clamp((height - map.rockLine) * 3.2, 0, 1);
    const tint = 0.93 + fine * 0.14;
    r = (0.285 + t * 0.26) * tint;
    g = (0.285 + t * 0.26) * tint;
    b = (0.315 + t * 0.27) * tint;
  } else {
    // Land: damp green-brown low down, dry pale grass on the ridges, with
    // bare earth showing through wherever the ground is steep.
    const t = clamp((height - map.waterLine) / Math.max(0.01, map.rockLine - map.waterLine), 0, 1);
    // Weighted towards the low end so most of the map stays green and only
    // genuinely high ground dries out to pale grass. A linear ramp turned
    // every gentle rise into a stripe of tan.
    const e = Math.pow(t, 2.1);
    let lr = 0.112 + e * 0.215;
    let lg = 0.168 + e * 0.170;
    let lb = 0.082 + e * 0.108;

    // Mottling, kept gentle: enough to break up a wide plain, not enough to
    // read as a pattern.
    const patch = (broad - 0.5) * 0.055 + (fine - 0.5) * 0.022;
    lr += patch * 1.05;
    lg += patch * 0.85;
    lb += patch * 0.5;

    // Exposed earth on slopes.
    const soil = [0.205, 0.152, 0.104];
    r = lr + (soil[0] - lr) * steepness;
    g = lg + (soil[1] - lg) * steepness;
    b = lb + (soil[2] - lb) * steepness;
  }

  const shade = 1 + lightSlope * 0.22;
  out.setRGB(clamp(r * shade, 0, 1), clamp(g * shade, 0, 1), clamp(b * shade, 0, 1));
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

  // Ground is rough and non-metallic; it picks up colour from the sky
  // through the scene environment rather than from a second light.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true,
    roughness: 0.95, metalness: 0.0, envMapIntensity: 0.55,
  });
  const mesh = new THREE.Mesh(flat, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function buildWaterMesh(map) {
  const geo = new THREE.PlaneGeometry(map.width * 1.4, map.height * 1.4, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.width / 2, map.waterLine * HEIGHT_SCALE + 1.2, map.height / 2);
  // Smooth and slightly metallic, so the sky actually reflects off it.
  const mat = new THREE.MeshStandardMaterial({
    color: 0x24587c, transparent: true, opacity: 0.78, depthWrite: false,
    roughness: 0.12, metalness: 0.35, envMapIntensity: 1.3,
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
