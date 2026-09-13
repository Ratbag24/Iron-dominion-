// The 3D renderer.
//
// Entities are drawn through InstancedMesh pools keyed by definition, owner
// and construction state, so a hundred assault bots cost one draw call rather
// than a hundred. Ground decals, projectiles, beams and explosions each get
// their own pool. Health bars and the selection marquee are drawn on a 2D
// overlay canvas on top of the WebGL canvas.

import * as THREE from '../../../vendor/three.module.js';
import { modelFor } from './models.js';
import {
  buildTerrainMesh, buildWaterMesh, buildMetalSpotDecals, FogSurface,
  smoothHeightAt, HEIGHT_SCALE,
} from './terrain.js';
import { ringXZ, box, sphere, merge } from './geometry.js';
import { clamp } from '../../core/math.js';

const MAX_EXPLOSIONS = 48;
const MAX_SPARKS = 900;
const MAX_BEAMS = 260;

/** A growable InstancedMesh wrapper. */
class InstancePool {
  constructor(scene, geometry, material, capacity = 32, castShadow = true) {
    this.scene = scene;
    this.geometry = geometry;
    this.material = material;
    this.castShadow = castShadow;
    this.count = 0;
    this._create(capacity);
  }

  _create(capacity) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
    }
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = this.castShadow;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }

  begin() {
    this.count = 0;
  }

  add(matrix) {
    if (this.count >= this.capacity) {
      this._create(Math.max(8, this.capacity * 2));
      // Everything written this frame is lost; the next frame refills it.
      this.count = 0;
      return;
    }
    this.mesh.setMatrixAt(this.count++, matrix);
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.count > 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}

export class Renderer3D {
  constructor(canvas, overlay, world, camera3d) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.world = world;
    this.cam = camera3d;
    this.time = 0;
    this.showRanges = false;
    this.quality = 'high';

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x070a0f, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a1018, 3800, 9000);

    this._setupLights();
    this._setupWorldMeshes();
    this._setupPools();

    this.pools = new Map();
    this._matrix = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._screen = {};

    this.explosions = [];
    this.sparks = [];
    this.beamData = [];
  }

  // --------------------------------------------------------------- setup

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0x7d94b4, 0x24261c, 0.72);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeed0, 1.85);
    sun.position.set(-500, 900, -420);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 4200;
    sun.shadow.bias = -0.0016;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  _setupWorldMeshes() {
    const map = this.world.map;
    this.terrain = buildTerrainMesh(map);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    this.water = buildWaterMesh(map);
    this.scene.add(this.water);

    const spots = buildMetalSpotDecals(map);
    if (spots) this.scene.add(spots);

    this.fogSurface = null; // created once we know which player is viewing
  }

  setViewer(playerIndex) {
    if (this.fogSurface) this.scene.remove(this.fogSurface.mesh);
    this.viewer = playerIndex;
    this.fogSurface = new FogSurface(this.world.map, this.world.fog[playerIndex]);
    this.scene.add(this.fogSurface.mesh);
  }

  _setupPools() {
    const scene = this.scene;

    this.bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.frameMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true, transparent: true, opacity: 0.62,
      emissive: new THREE.Color(0x18414f),
    });
    this.glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.decalMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, depthTest: true,
    });

    // Selection and range decals
    this.selectionPool = new InstancePool(scene, ringXZ(0.86, 1.0, '#7dffa8', 28), this.decalMaterial, 64, false);
    this.selectionPool.mesh.renderOrder = 3;
    this.enemySelectionPool = new InstancePool(scene, ringXZ(0.86, 1.0, '#ff8f7d', 28), this.decalMaterial, 8, false);
    this.enemySelectionPool.mesh.renderOrder = 3;

    // Projectiles
    this.laserPool = new InstancePool(scene, box(1, 1, 1, '#ffe66d'), this.glowMaterial, 128, false);
    this.shellPool = new InstancePool(scene, sphere(1, '#cdd6ff', null, 6), this.glowMaterial, 96, false);
    this.missilePool = new InstancePool(scene, merge([
      box(1.6, 0.5, 0.5, '#d6dae0'),
      box(0.5, 0.22, 0.22, '#ff9a5b', { x: -1.0 }),
    ]), this.glowMaterial, 96, false);

    // Sparks as a single Points cloud
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    this.sparkGeo = sparkGeo;
    this.sparkPoints = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
      size: 7, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.sparkPoints.frustumCulled = false;
    scene.add(this.sparkPoints);

    // Nanolathe beams and command lines as line segment batches
    this.beamGeo = new THREE.BufferGeometry();
    this.beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_BEAMS * 6), 3));
    this.beamGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_BEAMS * 6), 3));
    this.beams = new THREE.LineSegments(this.beamGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false,
    }));
    this.beams.frustumCulled = false;
    scene.add(this.beams);

    this.orderGeo = new THREE.BufferGeometry();
    this.orderGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 6), 3));
    this.orderGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(600 * 6), 3));
    this.orderLines = new THREE.LineSegments(this.orderGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false,
    }));
    this.orderLines.renderOrder = 8;
    this.orderLines.frustumCulled = false;
    scene.add(this.orderLines);

    // Explosion pool: individual meshes so each can fade independently.
    const expGeo = new THREE.SphereGeometry(1, 10, 8);
    this.explosionMeshes = [];
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffb64a, transparent: true, opacity: 0, depthWrite: false,
      });
      const mesh = new THREE.Mesh(expGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.explosionMeshes.push(mesh);
    }

    // Build placement ghost
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.32, depthWrite: false })
    );
    this.ghost.visible = false;
    this.ghost.renderOrder = 7;
    scene.add(this.ghost);

    this.ghostRing = new THREE.Mesh(
      ringXZ(0.97, 1.0, '#ff7a5e', 64),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false })
    );
    this.ghostRing.visible = false;
    this.ghostRing.renderOrder = 7;
    scene.add(this.ghostRing);
  }

  resize(width, height, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.overlay.width = Math.floor(width * dpr);
    this.overlay.height = Math.floor(height * dpr);
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cam.resize(width, height);
    this.viewW = width;
    this.viewH = height;
    this.dpr = dpr;
  }

  setQuality(level) {
    this.quality = level;
    this.renderer.shadowMap.enabled = level !== 'low';
    if (this.sun) this.sun.castShadow = level !== 'low';
    this.scene.traverse((o) => { if (o.isInstancedMesh) o.castShadow = level !== 'low'; });
  }

  // -------------------------------------------------------------- pooling

  _poolFor(key, geometry, material, castShadow = true) {
    let pool = this.pools.get(key);
    if (!pool) {
      pool = new InstancePool(this.scene, geometry, material, 32, castShadow);
      this.pools.set(key, pool);
    }
    return pool;
  }

  _compose(x, y, z, rotY, scale = 1, scaleY = scale) {
    this._pos.set(x, y, z);
    this._euler.set(0, rotY, 0);
    this._quat.setFromEuler(this._euler);
    this._scale.set(scale, scaleY, scale);
    this._matrix.compose(this._pos, this._quat, this._scale);
    return this._matrix;
  }

  // --------------------------------------------------------------- render

  render(dt, view) {
    this.time += dt;
    const world = this.world;
    const map = world.map;
    const fog = world.fog[view.playerIndex];
    const myTeam = world.players[view.playerIndex].team;

    if (this.viewer !== view.playerIndex) this.setViewer(view.playerIndex);

    this._drainEffects();
    this._updateEffects(dt);
    this.fogSurface.update();
    this._updateSun();

    for (const pool of this.pools.values()) pool.begin();
    this.selectionPool.begin();
    this.enemySelectionPool.begin();
    this.laserPool.begin();
    this.shellPool.begin();
    this.missilePool.begin();

    const visibleEntities = [];

    for (const e of world.entities) {
      if (!e.alive) continue;
      const team = world.players[e.player].team;
      if (team !== myTeam && !fog.isVisible(e.x, e.y)) continue;

      const ground = smoothHeightAt(map, e.x, e.y);
      const colors = world.players[e.player].color;
      const model = modelFor(e.def, colors);
      const rotY = -e.heading;

      const bodyKey = e.defId + '|' + e.player + (e.underConstruction ? '|f' : '');
      const material = e.underConstruction ? this.frameMaterial : this.bodyMaterial;
      const pool = this._poolFor(bodyKey, model.body, material, !e.underConstruction);
      const grow = e.underConstruction ? Math.max(0.06, e.buildProgress) : 1;
      pool.add(this._compose(e.x, ground, e.y, rotY, 1, grow));

      if (!e.underConstruction) {
        if (model.turret) {
          const tp = this._poolFor(e.defId + '|' + e.player + '|t', model.turret, this.bodyMaterial);
          tp.add(this._compose(e.x, ground + model.turretY, e.y, -e.turretAngle));
        }
        if (model.spinner) {
          const sp = this._poolFor(e.defId + '|' + e.player + '|s', model.spinner, this.bodyMaterial);
          const spin = this.time * model.spinSpeed * (e.defId === 'wind' ? 0.4 + world.windStrength * 2 : 1);
          if (model.spinnerAxis === 'x') {
            this._pos.set(e.x + Math.cos(rotY) * model.spinnerX, ground + model.spinnerY, e.y - Math.sin(rotY) * model.spinnerX);
            this._euler.set(spin, rotY, 0, 'YXZ');
            this._quat.setFromEuler(this._euler);
            this._scale.set(1, 1, 1);
            sp.add(this._matrix.compose(this._pos, this._quat, this._scale));
          } else {
            sp.add(this._compose(e.x, ground + model.spinnerY, e.y, spin));
          }
        }
      }

      if (e.selected) {
        const r = (e.isBuilding ? e.def.footprintPx * 0.62 : e.radius * 1.7);
        const target = team === myTeam ? this.selectionPool : this.enemySelectionPool;
        target.add(this._compose(e.x, ground + 2.2, e.y, 0, r));
      }

      visibleEntities.push({ e, ground });
    }

    this._renderProjectiles(fog);

    for (const pool of this.pools.values()) pool.end();
    this.selectionPool.end();
    this.enemySelectionPool.end();
    this.laserPool.end();
    this.shellPool.end();
    this.missilePool.end();

    this._renderBeams();
    this._renderSparks();
    this._renderOrderLines(view);
    this._renderGhost(view);

    this.cam.update(dt);
    this.renderer.render(this.scene, this.cam.camera);

    this._renderOverlay(view, visibleEntities, fog, myTeam);
  }

  _updateSun() {
    // Keep the shadow frustum tight around whatever the camera is looking at.
    const cx = this.cam.targetX;
    const cz = this.cam.targetZ;
    const span = clamp(this.cam.distance * 0.9, 400, 2000);
    this.sun.position.set(cx - 520, 1100, cz - 440);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.target.updateMatrixWorld();
    const cam = this.sun.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.updateProjectionMatrix();
  }

  _renderProjectiles(fog) {
    const map = this.world.map;
    for (const p of this.world.projectiles) {
      if (!fog.isVisible(p.x, p.y)) continue;
      const ground = smoothHeightAt(map, p.x, p.y);

      if (p.kind === 'laser') {
        const angle = Math.atan2(p.vy, p.vx);
        this._pos.set(p.x, ground + 14, p.y);
        this._euler.set(0, -angle, 0);
        this._quat.setFromEuler(this._euler);
        this._scale.set(26, 1.5, 1.5);
        this.laserPool.add(this._matrix.compose(this._pos, this._quat, this._scale));
      } else if (p.kind === 'missile') {
        const angle = Math.atan2(p.vy, p.vx);
        this._pos.set(p.x, ground + 14, p.y);
        this._euler.set(0, -angle, 0);
        this._quat.setFromEuler(this._euler);
        this._scale.set(5, 5, 5);
        this.missilePool.add(this._matrix.compose(this._pos, this._quat, this._scale));
      } else {
        const size = p.kind === 'arty' ? 6 : 4.6;
        this.shellPool.add(this._compose(p.x, ground + 10 + p.z, p.y, 0, size));
      }
    }
  }

  // -------------------------------------------------------------- effects

  _drainEffects() {
    const map = this.world.map;
    for (const fx of this.world.effects) {
      const ground = smoothHeightAt(map, fx.x, fx.y);
      switch (fx.type) {
        case 'explosion':
          this._spawnExplosion(fx.x, ground + fx.size * 0.25, fx.y, fx.size, fx.big, fx.nuke);
          this._spawnSparks(fx.x, ground + 10, fx.y, fx.big ? 22 : 9, fx.big ? 200 : 110);
          break;
        case 'impact':
          this._spawnSparks(fx.x, ground + 10, fx.y, 4, 70, fx.color);
          break;
        case 'muzzle':
          this._spawnSparks(fx.x, ground + 14, fx.y, 2, 60, fx.color);
          break;
        case 'nanolathe':
          if (this.beamData.length < MAX_BEAMS) {
            this.beamData.push({
              x: fx.x, y: ground + 16, z: fx.y,
              tx: fx.tx, ty: smoothHeightAt(map, fx.tx, fx.ty) + 14, tz: fx.ty,
              age: 0, life: 0.16, reclaim: !!fx.reclaim,
            });
          }
          break;
        case 'buildDone':
        case 'unitDone':
          this._spawnSparks(fx.x, ground + 12, fx.y, 8, 80, '#9fe8ff');
          break;
      }
    }
    this.world.effects.length = 0;
  }

  _spawnExplosion(x, y, z, size, big, nuke) {
    let slot = this.explosions.find((e) => !e.active);
    if (!slot) {
      if (this.explosions.length >= MAX_EXPLOSIONS) return;
      slot = { active: false, mesh: this.explosionMeshes[this.explosions.length] };
      this.explosions.push(slot);
    }
    slot.active = true;
    slot.age = 0;
    slot.life = big ? 0.75 : 0.42;
    slot.size = size * (nuke ? 1.6 : 1.0);
    slot.mesh.position.set(x, y, z);
    slot.mesh.material.color.setHex(nuke ? 0xfff4c2 : 0xffb64a);
    slot.mesh.visible = true;
  }

  _spawnSparks(x, y, z, count, speed, color) {
    const c = new THREE.Color(color || '#ffd27a');
    for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.3 + Math.random() * 0.9;
      const sp = speed * (0.35 + Math.random() * 0.9);
      this.sparks.push({
        x, y, z,
        vx: Math.cos(a) * sp, vy: up * sp, vz: Math.sin(a) * sp,
        age: 0, life: 0.35 + Math.random() * 0.55,
        r: c.r, g: c.g, b: c.b,
      });
    }
  }

  _updateEffects(dt) {
    for (const e of this.explosions) {
      if (!e.active) continue;
      e.age += dt;
      const k = e.age / e.life;
      if (k >= 1) {
        e.active = false;
        e.mesh.visible = false;
        continue;
      }
      const s = e.size * (0.3 + 0.8 * k);
      e.mesh.scale.set(s, s * 0.8, s);
      e.mesh.material.opacity = (1 - k) * 0.85;
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.life) { this.sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 420 * dt;
      s.vx *= 0.96;
      s.vz *= 0.96;
    }

    for (let i = this.beamData.length - 1; i >= 0; i--) {
      this.beamData[i].age += dt;
      if (this.beamData[i].age >= this.beamData[i].life) this.beamData.splice(i, 1);
    }
  }

  _renderSparks() {
    const pos = this.sparkGeo.attributes.position.array;
    const col = this.sparkGeo.attributes.color.array;
    const n = Math.min(this.sparks.length, MAX_SPARKS);
    for (let i = 0; i < n; i++) {
      const s = this.sparks[i];
      const fade = 1 - s.age / s.life;
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
      col[i * 3] = s.r * fade;
      col[i * 3 + 1] = s.g * fade;
      col[i * 3 + 2] = s.b * fade;
    }
    this.sparkGeo.setDrawRange(0, n);
    this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparkGeo.attributes.color.needsUpdate = true;
    this.sparkPoints.visible = n > 0;
  }

  _renderBeams() {
    const pos = this.beamGeo.attributes.position.array;
    const col = this.beamGeo.attributes.color.array;
    const n = Math.min(this.beamData.length, MAX_BEAMS);
    for (let i = 0; i < n; i++) {
      const b = this.beamData[i];
      const o = i * 6;
      pos[o] = b.x; pos[o + 1] = b.y; pos[o + 2] = b.z;
      pos[o + 3] = b.tx; pos[o + 4] = b.ty; pos[o + 5] = b.tz;
      const fade = 1 - b.age / b.life;
      const r = b.reclaim ? 1.0 : 0.5;
      const g = b.reclaim ? 0.82 : 0.91;
      const bl = b.reclaim ? 0.48 : 1.0;
      for (let k = 0; k < 2; k++) {
        col[o + k * 3] = r * fade;
        col[o + k * 3 + 1] = g * fade;
        col[o + k * 3 + 2] = bl * fade;
      }
    }
    this.beamGeo.setDrawRange(0, n * 2);
    this.beamGeo.attributes.position.needsUpdate = true;
    this.beamGeo.attributes.color.needsUpdate = true;
    this.beams.visible = n > 0;
  }

  _renderOrderLines(view) {
    const map = this.world.map;
    const pos = this.orderGeo.attributes.position.array;
    const col = this.orderGeo.attributes.color.array;
    let n = 0;
    const push = (x0, y0, z0, x1, y1, z1, r, g, b) => {
      if (n >= 600) return;
      const o = n * 6;
      pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = z0;
      pos[o + 3] = x1; pos[o + 4] = y1; pos[o + 5] = z1;
      for (let k = 0; k < 2; k++) {
        col[o + k * 3] = r; col[o + k * 3 + 1] = g; col[o + k * 3 + 2] = b;
      }
      n++;
    };

    if (view.selection) {
      for (const e of view.selection) {
        if (!e.alive) continue;
        let px = e.x;
        let pz = e.y;
        for (const o of e.orders) {
          const p = orderPoint(this.world, o);
          if (!p) continue;
          const attack = o.type === 'attack' || o.type === 'attackMove';
          const build = o.type === 'build';
          push(
            px, smoothHeightAt(map, px, pz) + 14, pz,
            p.x, smoothHeightAt(map, p.x, p.y) + 14, p.y,
            attack ? 1.0 : build ? 0.45 : 0.55,
            attack ? 0.42 : build ? 0.88 : 1.0,
            attack ? 0.35 : build ? 1.0 : 0.7
          );
          px = p.x;
          pz = p.y;
        }
        if (e.rally) {
          push(
            e.x, smoothHeightAt(map, e.x, e.y) + 14, e.y,
            e.rally.x, smoothHeightAt(map, e.rally.x, e.rally.y) + 14, e.rally.y,
            0.55, 1.0, 0.7
          );
        }
      }
    }

    this.orderGeo.setDrawRange(0, n * 2);
    this.orderGeo.attributes.position.needsUpdate = true;
    this.orderGeo.attributes.color.needsUpdate = true;
    this.orderLines.visible = n > 0;
  }

  _renderGhost(view) {
    const p = view.placement;
    if (!p) {
      this.ghost.visible = false;
      this.ghostRing.visible = false;
      return;
    }
    const map = this.world.map;
    const size = p.def.footprint * map.cell;
    const ground = smoothHeightAt(map, p.x, p.y);
    this.ghost.visible = true;
    this.ghost.position.set(p.x, ground + size * 0.22, p.y);
    this.ghost.scale.set(size, size * 0.45, size);
    this.ghost.material.color.setHex(p.valid ? 0x7fe9ff : 0xff6a52);

    const range = p.def.maxWeaponRange || p.def.radar || p.def.buildRange || 0;
    if (range > 0) {
      this.ghostRing.visible = true;
      this.ghostRing.position.set(p.x, ground + 3, p.y);
      this.ghostRing.scale.set(range, 1, range);
    } else {
      this.ghostRing.visible = false;
    }
  }

  // -------------------------------------------------------------- overlay

  _renderOverlay(view, visibleEntities, fog, myTeam) {
    const ctx = this.octx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.clearRect(0, 0, w, h);

    // Health and build bars
    for (const { e, ground } of visibleEntities) {
      const hurt = e.hp < e.maxHp * 0.999;
      if (!hurt && !e.selected && !e.underConstruction) continue;
      const top = ground + (e.isBuilding ? e.def.footprintPx * 0.45 : e.radius * 2.6);
      const s = this.cam.worldToScreen(e.x, top, e.y, this._screen);
      if (s.behind || s.x < -60 || s.x > w + 60 || s.y < -40 || s.y > h + 40) continue;

      const scale = clamp(1100 / this.cam.distance, 0.45, 1.6);
      const bw = Math.max(16, (e.isBuilding ? 34 : 24) * scale);
      const bh = Math.max(2.5, 4 * scale);
      const x = s.x - bw / 2;
      const y = s.y - bh - 4;
      const frac = clamp(e.hp / e.maxHp, 0, 1);

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = frac > 0.6 ? '#53d96a' : frac > 0.3 ? '#e8c34a' : '#e8564a';
      ctx.fillRect(x, y, bw * frac, bh);

      if (e.underConstruction) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x - 1, y + bh + 1, bw + 2, bh + 2);
        ctx.fillStyle = '#63d5ff';
        ctx.fillRect(x, y + bh + 2, bw * e.buildProgress, bh);
      }
    }

    // Radar contacts: seen by radar but not by sight.
    ctx.strokeStyle = '#ff5a4a';
    ctx.lineWidth = 1.8;
    for (const e of this.world.entities) {
      if (!e.alive || this.world.players[e.player].team === myTeam) continue;
      if (fog.isVisible(e.x, e.y) || !fog.hasRadar(e.x, e.y)) continue;
      const ground = smoothHeightAt(this.world.map, e.x, e.y);
      const s = this.cam.worldToScreen(e.x, ground + 20, e.y, this._screen);
      if (s.behind) continue;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.lineTo(s.x + r, s.y);
      ctx.lineTo(s.x, s.y + r);
      ctx.lineTo(s.x - r, s.y);
      ctx.closePath();
      ctx.stroke();
    }

    // Attack pings in the world, for anything currently on screen.
    if (view.pings) {
      for (const ping of view.pings) {
        const g = smoothHeightAt(this.world.map, ping.x, ping.y);
        const s = this.cam.worldToScreen(ping.x, g + 20, ping.y, this._screen);
        if (s.behind) continue;
        const k = (ping.age % 1);
        ctx.globalAlpha = (1 - k) * (1 - ping.age / 4);
        ctx.strokeStyle = '#ff5a4a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 14 + k * 44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Command feedback pings
    if (view.commandMarkers) {
      for (const mk of view.commandMarkers) {
        const g = smoothHeightAt(this.world.map, mk.x, mk.y);
        const s = this.cam.worldToScreen(mk.x, g + 6, mk.y, this._screen);
        if (s.behind) continue;
        const k = mk.age / 0.6;
        const scale = clamp(1100 / this.cam.distance, 0.4, 1.8);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = mk.kind === 'attack' ? '#ff6a52' : '#7dffa8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, (6 + k * 20) * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Selection marquee
    if (view.marquee) {
      const m = view.marquee;
      const x = Math.min(m.sx, m.cx);
      const y = Math.min(m.sy, m.cy);
      const mw = Math.abs(m.cx - m.sx);
      const mh = Math.abs(m.cy - m.sy);
      ctx.strokeStyle = '#7dffa8';
      ctx.fillStyle = 'rgba(125,255,168,0.10)';
      ctx.lineWidth = 1.4;
      ctx.fillRect(x, y, mw, mh);
      ctx.strokeRect(x, y, mw, mh);
    }
  }
}

function orderPoint(world, o) {
  if (o.x !== undefined && o.y !== undefined) return { x: o.x, y: o.y };
  if (o.targetId) {
    const t = world.get(o.targetId);
    if (t) return { x: t.x, y: t.y };
  }
  if (o.wreckId) {
    const wk = world.wrecks.find((w) => w.id === o.wreckId);
    if (wk) return { x: wk.x, y: wk.y };
  }
  if (o.points && o.points.length) return o.points[o.index % o.points.length];
  return null;
}
