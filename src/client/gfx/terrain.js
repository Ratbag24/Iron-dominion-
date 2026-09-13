// Terrain surface, water, metal-spot decals and the fog-of-war overlay.
//
// The ground is a displaced, flat-shaded heightfield. Fog is a second, much
// coarser copy of the same surface carrying a data texture built from the
// player's fog grid, which keeps the fog edge glued to the terrain.

import * as THREE from '../../../vendor/three.module.js';
import { TERRAIN_WATER, TERRAIN_ROCK } from '../../sim/map.js';
import { clamp } from '../../core/math.js';
import { makeNoise2D, fbm, makeRng } from '../../core/rng.js';
import { ringXZ, merge } from './geometry.js';

/** World units of elevation for the full normalised height range. */
export const HEIGHT_SCALE = 190;

export function terrainHeightAt(map, x, y) {
  return map.heightAt(x, y) * HEIGHT_SCALE;
}

/** Detail octaves added to the visual surface only. */
const detailNoise = makeNoise2D(0x9e3d71);

/**
 * Build a finer heightfield for rendering.
 *
 * The simulation's grid is 16 world units per cell, which is the right
 * resolution for pathing and footprints but far too coarse to look at: it
 * makes the ground a field of big flat facets. This resamples it at several
 * times that density and folds in high-frequency noise, so the ground has
 * grain without changing a single thing the simulation reasons about.
 *
 * Everything visual and interactive - the mesh, where units stand, where the
 * cursor lands - reads back through this field, so they all agree.
 */
export function buildRenderHeightfield(map, scale = 2) {
  const cols = map.cols * scale + 1;
  const rows = map.rows * scale + 1;
  const cell = map.cell / scale;
  const heights = new Float32Array(cols * rows);

  // Amplitude in normalised height units, tuned by measurement rather than by
  // eye: this works out at roughly one world unit of grain on average and two
  // and a half at the peaks, against a tank radius of twelve.
  const coarse = 0.085;
  const fine = 0.032;
  const smoothstep = (a, b, t) => {
    const k = clamp((t - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cell;
      const y = j * cell;
      const base = bilinearBase(map, x, y);

      // Grain belongs on open ground. Cliffs already have shape of their own,
      // and anything below the waterline would only poke through the surface.
      const slope = Math.hypot(
        bilinearBase(map, x + map.cell, y) - bilinearBase(map, x - map.cell, y),
        bilinearBase(map, x, y + map.cell) - bilinearBase(map, x, y - map.cell)
      );
      const flatness = 1 - smoothstep(0.02, 0.075, slope);
      const dry = smoothstep(map.waterLine - 0.01, map.waterLine + 0.04, base);
      const fade = flatness * dry;

      const a = fbm(detailNoise, x * 0.020, y * 0.020, 3) - 0.5;
      const b = fbm(detailNoise, x * 0.085, y * 0.085, 2) - 0.5;
      heights[j * cols + i] = base + (a * coarse + b * fine) * fade;
    }
  }

  map._render = { cols, rows, cell, heights, scale };
  return map._render;
}

/** Bilinear sample of the simulation heightfield, in normalised units. */
function bilinearBase(map, x, y) {
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
  return a + (b - a) * ty;
}

/**
 * Surface height in world units. Reads the fine render field once it has been
 * built, so units stand on the detailed ground the player can see rather than
 * on the coarse grid underneath it.
 */
export function smoothHeightAt(map, x, y) {
  const r = map._render;
  if (!r) return bilinearBase(map, x, y) * HEIGHT_SCALE;

  const fx = x / r.cell;
  const fy = y / r.cell;
  let x0 = Math.floor(fx);
  let y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  x0 = clamp(x0, 0, r.cols - 2);
  y0 = clamp(y0, 0, r.rows - 2);
  const i = y0 * r.cols + x0;
  const h00 = r.heights[i];
  const h10 = r.heights[i + 1];
  const h01 = r.heights[i + r.cols];
  const h11 = r.heights[i + r.cols + 1];
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

/**
 * A tiling normal map, so the ground has surface grain that geometry alone
 * would need millions of triangles to express. Built from periodic value
 * noise - the lattice wraps - so the tile repeats without a visible seam.
 */
function groundNormalMap(size = 256, tiles = 6) {
  const rand = makeRng(0x5eed14);
  const lattice = new Float32Array(tiles * tiles);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();

  const smooth = (t) => t * t * (3 - 2 * t);
  const wrap = (v) => ((v % tiles) + tiles) % tiles;

  /** Value noise on a wrapping lattice, so every octave tiles seamlessly. */
  const octave = (u, v, freq) => {
    const fx = u * tiles * freq;
    const fy = v * tiles * freq;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const at = (a, b) => lattice[wrap(b) * tiles + wrap(a)];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return top + (bot - top) * ty;
  };

  const height = (u, v) => octave(u, v, 1) * 0.62 + octave(u, v, 3) * 0.26 + octave(u, v, 7) * 0.12;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const step = 1 / size;
  const strength = 2.6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Central differences give the slope; the wrapping lattice means the
      // samples either side of an edge come from the far side of the tile.
      const dx = (height(u + step, v) - height(u - step, v)) * strength;
      const dy = (height(u, v + step) - height(u, v - step)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const o = (y * size + x) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255;
      d[o + 1] = (ny * 0.5 + 0.5) * 255;
      d[o + 2] = (nz * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The ground mesh, built from the fine render heightfield.
 *
 * Indexed and smooth-shaded: at this density, faceting reads as noise rather
 * than as style, and smooth normals let the normal map carry the detail.
 */
export function buildTerrainMesh(map) {
  const r = map._render || buildRenderHeightfield(map);
  const segX = r.cols - 1;
  const segY = r.rows - 1;

  const geo = new THREE.PlaneGeometry(map.width, map.height, segX, segY);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.width / 2, 0, map.height / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, smoothHeightAt(map, x, z));

    const cx = clamp(Math.floor(x / map.cell), 0, map.cols - 1);
    const cy = clamp(Math.floor(z / map.cell), 0, map.rows - 1);
    terrainColor(map, cx, cy, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const normalMap = groundNormalMap();
  const tile = 110; // world units per repeat of the detail texture
  normalMap.repeat.set(map.width / tile, map.height / tile);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94, metalness: 0.0, envMapIntensity: 0.5,
    normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
  });
  const mesh = new THREE.Mesh(geo, mat);
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
