// Export every unit and structure as a .glb asset.
//
//   node tools/export-models.mjs
//
// The procedural models were only ever editable by changing JavaScript. This
// turns each one into a real glTF binary that opens in Blender, with the
// triangles grouped into one named material per colour - Hull, Team, Glow,
// Track and so on - rather than a single mesh of baked vertex colours. Team
// colour is exported as a neutral placeholder and tinted by the engine, which
// is how an RTS asset is expected to work.
//
// Node hierarchy matches what the game needs: a `body` node, plus `turret`
// and `spinner` nodes positioned at their pivots, so the engine can rotate
// them independently without knowing anything about how the model was made.

import * as THREE from '../vendor/three.module.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DEFS, getDef } from '../src/sim/defs.js';
import { buildRawModel, PALETTE } from '../src/client/gfx/models.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Both builds need these, and Godot can only read what is inside its own
// project directory, so they are written twice. Writing only the first copy is
// how the two quietly drift apart.
const OUTPUTS = [join(ROOT, 'assets/models'), join(ROOT, 'godot/assets/models')];
const OUT = OUTPUTS[0];

/** Authoring colours for the team slots; replaced at runtime by the engine. */
const TEAM = { primary: '#8f8f8f', dark: '#5a5a5a', light: '#c4c4c4' };

/** Colour -> material name. Anything unlisted gets a name from its hex. */
const NAMED = new Map();
const name = (hex, materialName, extra = {}) => {
  const c = new THREE.Color(hex);
  NAMED.set(`${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)}`,
    { name: materialName, hex, ...extra });
};

name(TEAM.primary, 'Team', { team: 'primary' });
name(TEAM.dark, 'TeamDark', { team: 'dark' });
name(TEAM.light, 'TeamLight', { team: 'light' });
name(PALETTE.HULL, 'Hull');
name(PALETTE.HULL_DARK, 'HullDark');
name(PALETTE.HULL_LIGHT, 'HullLight');
name(PALETTE.DARK, 'Trim');
name(PALETTE.GLASS, 'Glass');
name(PALETTE.GLOW, 'Glow', { emissive: true });
name(PALETTE.TRACK, 'Track');
name('#ff9a5b', 'Warhead', { emissive: true });
name('#ffd76a', 'Indicator', { emissive: true });
name('#9fe8ff', 'GlowCool', { emissive: true });
name('#8ef6ff', 'Glow', { emissive: true });

// A handful of extra slots for shades the models use that are not in the
// runtime palette, so the whole asset set shares one small material list.
name('#5b6068', 'Concrete');
name('#33373d', 'Deck');
name(PALETTE.STEEL, 'Steel');
name(PALETTE.GREASE, 'Rubber');
name('#9aa3ad', 'StoreMetal');
// Infantry cloth and skin. Soldiers are drawn at a tenth of a tank's size, so
// these are the only materials on them that carry: without their own slots
// they snap to the nearest hull grey and a squad reads as small machines.
name(PALETTE.FATIGUE, 'Fatigue');
name(PALETTE.WEBBING, 'Webbing');
name(PALETTE.SKIN, 'Skin');
name('#d8b24a', 'StoreEnergy');

// The hive is grown rather than built, so it has its own shades. Without
// these they export as anonymous Paint6D6456-style materials, which is the
// one thing this naming exists to prevent.
name(PALETTE.CHITIN, 'Chitin');
name(PALETTE.CHITIN_DARK, 'ChitinDark');
name(PALETTE.CHITIN_LIGHT, 'ChitinLight');
name(PALETTE.FLESH, 'Flesh');
name(PALETTE.BILE, 'Bile', { emissive: true });

/**
 * Snap near-identical shades onto the named palette.
 *
 * Left alone, the models produce nearly thirty separate greys that differ by
 * a few values each - useless to an artist, who wants to recolour "Hull" once
 * and have it take. Anything close to a named colour becomes that colour;
 * anything genuinely distinct keeps a name of its own.
 */
const SNAP_DISTANCE = 0.055;
const canonical = [...NAMED.entries()].map(([key, mat]) => {
  const [r, g, b] = key.split(',').map(Number);
  return { r, g, b, mat };
});

function materialFor(r, g, b) {
  const key = `${r.toFixed(4)},${g.toFixed(4)},${b.toFixed(4)}`;
  const exact = NAMED.get(key);
  if (exact) return exact;

  let best = null;
  let bestD = Infinity;
  for (const c of canonical) {
    const d = Math.hypot(c.r - r, c.g - g, c.b - b);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best && bestD < SNAP_DISTANCE) return best.mat;

  const to255 = (v) => Math.round(THREE.MathUtils.clamp(v, 0, 1) ** (1 / 2.2) * 255);
  const hex = '#' + [r, g, b].map((v) => to255(v).toString(16).padStart(2, '0')).join('');
  return { name: 'Paint' + hex.slice(1).toUpperCase(), hex };
}

/** Split a geometry into one primitive per distinct vertex colour. */
function groupByColour(geo) {
  const pos = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  const col = geo.attributes.color.array;
  const triCount = geo.attributes.position.count / 3;

  const groups = new Map();
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const mat = materialFor(col[o], col[o + 1], col[o + 2]);
    let g = groups.get(mat.name);
    if (!g) {
      g = { mat, tris: [] };
      groups.set(mat.name, g);
    }
    g.tris.push(t);
  }

  for (const g of groups.values()) {
    const n = g.tris.length;
    g.position = new Float32Array(n * 9);
    g.normal = new Float32Array(n * 9);
    g.tris.forEach((t, i) => {
      g.position.set(pos.subarray(t * 9, t * 9 + 9), i * 9);
      g.normal.set(nrm.subarray(t * 9, t * 9 + 9), i * 9);
    });
  }
  return [...groups.values()];
}

/** Minimal glTF 2.0 binary writer, enough for static coloured meshes. */
class GlbBuilder {
  constructor() {
    this.json = {
      asset: { version: '2.0', generator: 'Iron Dominion model exporter' },
      scene: 0, scenes: [{ nodes: [] }],
      nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [],
    };
    this.chunks = [];
    this.offset = 0;
  }

  _view(array, target) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    // glTF requires 4-byte alignment for buffer views.
    const pad = (4 - (this.offset % 4)) % 4;
    if (pad) { this.chunks.push(new Uint8Array(pad)); this.offset += pad; }
    const index = this.json.bufferViews.length;
    this.json.bufferViews.push({
      buffer: 0, byteOffset: this.offset, byteLength: bytes.byteLength, target,
    });
    this.chunks.push(bytes);
    this.offset += bytes.byteLength;
    return index;
  }

  _accessor(array, type, componentType, count) {
    const view = this._view(array, 34962);
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    const min = new Array(comps).fill(Infinity);
    const max = new Array(comps).fill(-Infinity);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < comps; k++) {
        const v = array[i * comps + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    const index = this.json.accessors.length;
    this.json.accessors.push({ bufferView: view, componentType, count, type, min, max });
    return index;
  }

  material(mat) {
    const existing = this.json.materials.findIndex((m) => m.name === mat.name);
    if (existing >= 0) return existing;
    const c = new THREE.Color(mat.hex || '#ffffff');
    const m = {
      name: mat.name,
      pbrMetallicRoughness: {
        baseColorFactor: [c.r, c.g, c.b, 1],
        metallicFactor: mat.emissive ? 0 : (/Track|Glass/.test(mat.name) ? 0.3 : 0.7),
        roughnessFactor: mat.emissive ? 1 : (/Track/.test(mat.name) ? 0.85 : 0.42),
      },
      doubleSided: false,
    };
    if (mat.emissive) m.emissiveFactor = [c.r, c.g, c.b];
    this.json.materials.push(m);
    return this.json.materials.length - 1;
  }

  /** Add a node holding one mesh built from colour groups. */
  addPart(partName, geo, translation) {
    const groups = groupByColour(geo);
    const primitives = groups.map((g) => {
      const count = g.position.length / 3;
      return {
        attributes: {
          POSITION: this._accessor(g.position, 'VEC3', 5126, count),
          NORMAL: this._accessor(g.normal, 'VEC3', 5126, count),
        },
        material: this.material(g.mat),
        mode: 4,
      };
    });
    const mesh = this.json.meshes.length;
    this.json.meshes.push({ name: partName + 'Mesh', primitives });
    const node = this.json.nodes.length;
    this.json.nodes.push({ name: partName, mesh, translation });
    this.json.scenes[0].nodes.push(node);
    return { node, materials: groups.map((g) => g.mat.name), tris: geo.attributes.position.count / 3 };
  }

  build() {
    const bin = Buffer.concat(this.chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
    const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    this.json.buffers = [{ byteLength: binPadded.length }];

    const jsonText = Buffer.from(JSON.stringify(this.json), 'utf8');
    const jsonPadded = Buffer.concat([jsonText, Buffer.alloc((4 - (jsonText.length % 4)) % 4, 0x20)]);

    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);                       // "glTF"
    header.writeUInt32LE(2, 4);                                 // version
    header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonPadded.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);                    // "JSON"

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binPadded.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);                     // "BIN"

    return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
  }
}

/** A copy of the geometry moved by (dx, dy, dz). Normals and colours are kept. */
function translateGeometry(geo, dx, dy, dz) {
  const src = geo.attributes.position.array;
  const position = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    position[i] = src[i] + dx;
    position[i + 1] = src[i + 1] + dy;
    position[i + 2] = src[i + 2] + dz;
  }
  return {
    attributes: {
      position: { array: position, count: geo.attributes.position.count },
      normal: geo.attributes.normal,
      color: geo.attributes.color,
    },
  };
}

// ------------------------------------------------------------------ export
for (const dir of OUTPUTS) await mkdir(dir, { recursive: true });

const manifest = {};
let totalTris = 0;
const allMaterials = new Set();

for (const id of Object.keys(DEFS)) {
  const faction = DEFS[id].id.startsWith('con_') ? 'concord' : 'vanguard';
  const def = getDef(id, faction);
  const model = buildRawModel(def, TEAM);

  const glb = new GlbBuilder();
  const parts = {};
  let tris = 0;

  const added = glb.addPart('body', model.body, [0, 0, 0]);
  parts.body = { materials: added.materials };
  tris += added.tris;

  if (model.turret) {
    const t = glb.addPart('turret', model.turret, [0, model.turretY, 0]);
    parts.turret = { pivotY: model.turretY, materials: t.materials };
    tris += t.tris;
  }
  // Legs: one node each, hung from its pivot, named so the view can find them
  // and knows which half of the gait each is on ("a" swings while "b" plants).
  // The geometry is authored in model space; it is shifted back by the pivot
  // so the node's own translation puts it where it was drawn.
  if (model.legs) {
    parts.legs = [];
    model.legs.forEach((leg, i) => {
      const shifted = translateGeometry(leg.geo, -leg.pivot[0], -leg.pivot[1], -leg.pivot[2]);
      const name = `leg_${i}_${leg.phase ? 'b' : 'a'}`;
      const l = glb.addPart(name, shifted, leg.pivot);
      parts.legs.push({ node: name, pivot: leg.pivot, phase: leg.phase, materials: l.materials });
      tris += l.tris;
    });
  }
  if (model.spinner) {
    const s = glb.addPart('spinner', model.spinner,
      [model.spinnerX || 0, model.spinnerY, 0]);
    parts.spinner = {
      pivotY: model.spinnerY, pivotX: model.spinnerX || 0,
      axis: model.spinnerAxis, speed: model.spinSpeed,
      materials: s.materials,
    };
    tris += s.tris;
  }

  for (const p of Object.values(parts)) {
    for (const part of Array.isArray(p) ? p : [p]) for (const m of part.materials) allMaterials.add(m);
  }

  const bytes = glb.build();
  for (const dir of OUTPUTS) await writeFile(join(dir, id + '.glb'), bytes);
  manifest[id] = { file: id + '.glb', parts, triangles: tris };
  totalTris += tris;
}

for (const dir of OUTPUTS) {
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

console.log(`exported ${Object.keys(manifest).length} models, ${totalTris} triangles`);
console.log(`materials: ${[...allMaterials].sort().join(', ')}`);
