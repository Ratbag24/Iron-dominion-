// Sky and image-based lighting.
//
// Metal only looks like metal if it has something to reflect. A procedural
// sky gradient is generated once, used as the visible dome, and pre-filtered
// into an environment map that every surface samples for reflections.

import * as THREE from '../../../vendor/three.module.js';

export const SKY = {
  zenith: '#0e1a2b',
  horizon: '#4a5f78',
  haze: '#6f8095',
  ground: '#16181a',
  sun: '#ffe9c4',
};

/** Vertical gradient painted into an equirectangular texture. */
function skyTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0.00, SKY.zenith);
  g.addColorStop(0.38, SKY.horizon);
  g.addColorStop(0.50, SKY.haze);
  g.addColorStop(0.52, SKY.ground);
  g.addColorStop(1.00, SKY.ground);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // A soft sun disc, so highlights on curved metal have somewhere to come from.
  const sunX = canvas.width * 0.62;
  const sunY = canvas.height * 0.24;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, canvas.height * 0.34);
  sun.addColorStop(0, 'rgba(255, 240, 210, 0.95)');
  sun.addColorStop(0.25, 'rgba(255, 224, 175, 0.45)');
  sun.addColorStop(1, 'rgba(255, 224, 175, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build the environment map and the visible sky dome.
 * Returns { environment, sky } - assign `environment` to scene.environment.
 */
export function buildEnvironment(renderer) {
  const tex = skyTexture();

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();

  // The dome itself is drawn separately so it can sit behind the fog without
  // being fogged into a flat colour.
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;

  return { environment, sky, skyTexture: tex };
}
