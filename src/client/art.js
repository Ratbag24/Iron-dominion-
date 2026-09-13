// Flat icon art for the interface.
//
// The battlefield itself is rendered in 3D (see gfx/models.js); these 2D
// silhouettes are drawn to small canvases for the build menu buttons and the
// selection panel, where a flat icon reads far better than a tiny 3D render.
// Each function draws its subject centred on the origin facing +X.

const HULL = '#8d949e';
const HULL_DARK = '#575d66';
const HULL_LIGHT = '#c2c8d0';
const TRIM = '#2b2f36';

/** Legion silhouettes are blockier; Vanguard are angular and pointed. */
function isSharp(faction) {
  return faction !== 'legion';
}

function poly(ctx, pts, fill, stroke, lineWidth = 1.2) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function circle(ctx, x, y, r, fill, stroke, lineWidth = 1.2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function rect(ctx, x, y, w, h, fill, stroke, lineWidth = 1.2) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

// ------------------------------------------------------------------- units

function drawCommander(ctx, e, c, t) {
  const r = e.radius;
  const sharp = isSharp(e.def.faction);
  // Legs
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.34;
  ctx.lineCap = 'round';
  const stride = Math.sin(t * 6 + e.id) * (e.speed > 2 ? r * 0.32 : 0);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.5); ctx.lineTo(-r * 0.5 + stride, -r * 0.78);
  ctx.moveTo(-r * 0.1, r * 0.5); ctx.lineTo(-r * 0.5 - stride, r * 0.78);
  ctx.stroke();

  // Torso
  const body = sharp
    ? [[r * 1.05, 0], [r * 0.35, -r * 0.78], [-r * 0.7, -r * 0.66], [-r * 0.9, 0], [-r * 0.7, r * 0.66], [r * 0.35, r * 0.78]]
    : [[r * 0.95, -r * 0.34], [r * 0.95, r * 0.34], [r * 0.2, r * 0.85], [-r * 0.85, r * 0.62], [-r * 0.85, -r * 0.62], [r * 0.2, -r * 0.85]];
  poly(ctx, body, c.primary, TRIM, r * 0.12);

  // Shoulder pods
  poly(ctx, [[r * 0.1, -r * 0.92], [r * 0.6, -r * 0.86], [r * 0.62, -r * 0.5], [r * 0.08, -r * 0.56]], HULL, TRIM, r * 0.08);
  poly(ctx, [[r * 0.1, r * 0.92], [r * 0.6, r * 0.86], [r * 0.62, r * 0.5], [r * 0.08, r * 0.56]], HULL, TRIM, r * 0.08);

  // Core
  circle(ctx, -r * 0.05, 0, r * 0.34, '#0b1016', null);
  const pulse = 0.55 + 0.45 * Math.sin(t * 3 + e.id);
  ctx.globalAlpha = pulse;
  circle(ctx, -r * 0.05, 0, r * 0.24, c.light, null);
  ctx.globalAlpha = 1;
}

function drawConbot(ctx, e, c, t) {
  const r = e.radius;
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round';
  const stride = Math.sin(t * 8 + e.id) * (e.speed > 2 ? r * 0.3 : 0);
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.42); ctx.lineTo(-r * 0.55 + stride, -r * 0.72);
  ctx.moveTo(-r * 0.15, r * 0.42); ctx.lineTo(-r * 0.55 - stride, r * 0.72);
  ctx.stroke();

  poly(ctx, [[r * 0.85, -r * 0.4], [r * 0.85, r * 0.4], [-r * 0.7, r * 0.6], [-r * 0.7, -r * 0.6]], c.primary, TRIM, r * 0.14);
  // Nanolathe emitter
  rect(ctx, r * 0.55, -r * 0.16, r * 0.62, r * 0.32, HULL_LIGHT, TRIM, r * 0.08);
  circle(ctx, r * 1.15, 0, r * 0.2, '#9fe8ff', TRIM, r * 0.07);
}

function drawScout(ctx, e, c, t) {
  const r = e.radius;
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.24;
  ctx.lineCap = 'round';
  const stride = Math.sin(t * 14 + e.id) * (e.speed > 2 ? r * 0.42 : 0);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.4); ctx.lineTo(-r * 0.45 + stride, -r * 0.8);
  ctx.moveTo(0, r * 0.4); ctx.lineTo(-r * 0.45 - stride, r * 0.8);
  ctx.stroke();
  poly(ctx, [[r * 1.15, 0], [-r * 0.35, -r * 0.62], [-r * 0.6, 0], [-r * 0.35, r * 0.62]], c.primary, TRIM, r * 0.16);
  circle(ctx, r * 0.3, 0, r * 0.22, '#101418', null);
}

function drawRifle(ctx, e, c, t) {
  const r = e.radius;
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round';
  const stride = Math.sin(t * 9 + e.id) * (e.speed > 2 ? r * 0.32 : 0);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.44); ctx.lineTo(-r * 0.5 + stride, -r * 0.76);
  ctx.moveTo(-r * 0.1, r * 0.44); ctx.lineTo(-r * 0.5 - stride, r * 0.76);
  ctx.stroke();
  const sharp = isSharp(e.def.faction);
  const body = sharp
    ? [[r * 0.95, 0], [r * 0.3, -r * 0.68], [-r * 0.72, -r * 0.52], [-r * 0.72, r * 0.52], [r * 0.3, r * 0.68]]
    : [[r * 0.8, -r * 0.55], [r * 0.8, r * 0.55], [-r * 0.75, r * 0.62], [-r * 0.75, -r * 0.62]];
  poly(ctx, body, c.primary, TRIM, r * 0.15);
  circle(ctx, -r * 0.1, 0, r * 0.2, HULL_DARK, null);
}

function drawRocket(ctx, e, c, t) {
  const r = e.radius;
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round';
  const stride = Math.sin(t * 7 + e.id) * (e.speed > 2 ? r * 0.28 : 0);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.44); ctx.lineTo(-r * 0.5 + stride, -r * 0.76);
  ctx.moveTo(-r * 0.1, r * 0.44); ctx.lineTo(-r * 0.5 - stride, r * 0.76);
  ctx.stroke();
  poly(ctx, [[r * 0.75, -r * 0.46], [r * 0.75, r * 0.46], [-r * 0.7, r * 0.58], [-r * 0.7, -r * 0.58]], c.primary, TRIM, r * 0.14);
  // Launcher box
  rect(ctx, -r * 0.45, -r * 0.72, r * 0.95, r * 0.34, HULL, TRIM, r * 0.08);
  rect(ctx, -r * 0.45, r * 0.38, r * 0.95, r * 0.34, HULL, TRIM, r * 0.08);
}

function drawHeavy(ctx, e, c, t) {
  const r = e.radius;
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.4;
  ctx.lineCap = 'round';
  const stride = Math.sin(t * 5 + e.id) * (e.speed > 2 ? r * 0.26 : 0);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.5); ctx.lineTo(-r * 0.55 + stride, -r * 0.85);
  ctx.moveTo(-r * 0.1, r * 0.5); ctx.lineTo(-r * 0.55 - stride, r * 0.85);
  ctx.stroke();
  poly(ctx, [[r * 0.9, -r * 0.5], [r * 0.95, r * 0.5], [r * 0.1, r * 0.9], [-r * 0.85, r * 0.6], [-r * 0.85, -r * 0.6], [r * 0.1, -r * 0.9]], c.primary, TRIM, r * 0.16);
  rect(ctx, r * 0.2, -r * 0.78, r * 0.7, r * 0.26, HULL_LIGHT, TRIM, r * 0.07);
  rect(ctx, r * 0.2, r * 0.52, r * 0.7, r * 0.26, HULL_LIGHT, TRIM, r * 0.07);
  circle(ctx, -r * 0.15, 0, r * 0.3, HULL_DARK, TRIM, r * 0.08);
}

function drawSiege(ctx, e, c, t) {
  const r = e.radius;
  ctx.strokeStyle = HULL_DARK;
  ctx.lineWidth = r * 0.34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.5); ctx.lineTo(-r * 0.62, -r * 0.82);
  ctx.moveTo(-r * 0.2, r * 0.5); ctx.lineTo(-r * 0.62, r * 0.82);
  ctx.stroke();
  poly(ctx, [[r * 0.55, -r * 0.52], [r * 0.55, r * 0.52], [-r * 0.8, r * 0.66], [-r * 0.8, -r * 0.66]], c.primary, TRIM, r * 0.15);
}

// -------------------------------------------------------------- structures

function baseSlab(ctx, size, c, inset = 0.5) {
  const h = size * 0.5;
  rect(ctx, -h, -h, size, size, '#3a3f47', TRIM, size * 0.05);
  rect(ctx, -h + inset * 2, -h + inset * 2, size - inset * 4, size - inset * 4, '#4a505a', null);
  return h;
}

function drawMex(ctx, e, c, t) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c);
  circle(ctx, 0, 0, s * 0.34, HULL_DARK, TRIM, s * 0.04);
  ctx.save();
  ctx.rotate(t * 1.6);
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    poly(ctx, [[0, 0], [s * 0.3, -s * 0.08], [s * 0.3, s * 0.08]], c.primary, null);
  }
  ctx.restore();
  circle(ctx, 0, 0, s * 0.12, c.light, TRIM, s * 0.03);
}

function drawSolar(ctx, e, c, t) {
  const s = e.def.footprintPx;
  const h = baseSlab(ctx, s, c);
  ctx.fillStyle = '#16324d';
  ctx.fillRect(-h * 0.82, -h * 0.82, s * 0.82, s * 0.82);
  ctx.strokeStyle = '#2f6a9e';
  ctx.lineWidth = s * 0.025;
  for (let i = 1; i < 4; i++) {
    const p = -h * 0.82 + (s * 0.82 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(p, -h * 0.82); ctx.lineTo(p, -h * 0.82 + s * 0.82);
    ctx.moveTo(-h * 0.82, p); ctx.lineTo(-h * 0.82 + s * 0.82, p);
    ctx.stroke();
  }
  rect(ctx, -h * 0.82, -h * 0.82, s * 0.82, s * 0.82, null, c.primary, s * 0.05);
}

function drawWind(ctx, e, c, t, world) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c);
  circle(ctx, 0, 0, s * 0.16, HULL, TRIM, s * 0.04);
  const spin = world ? 0.5 + world.windStrength * 5 : 2;
  ctx.save();
  ctx.rotate(t * spin);
  ctx.strokeStyle = c.light;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.42, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawConverter(ctx, e, c, t) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c);
  circle(ctx, 0, 0, s * 0.3, HULL, TRIM, s * 0.045);
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.2 + e.id));
  ctx.globalAlpha = pulse;
  circle(ctx, 0, 0, s * 0.18, '#ffd76a', null);
  ctx.globalAlpha = 1;
  rect(ctx, -s * 0.42, -s * 0.1, s * 0.16, s * 0.2, HULL_DARK, TRIM, s * 0.03);
  rect(ctx, s * 0.26, -s * 0.1, s * 0.16, s * 0.2, HULL_DARK, TRIM, s * 0.03);
}

function drawStorage(ctx, e, c, t, world, isMetal) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c);
  circle(ctx, 0, 0, s * 0.33, isMetal ? '#9aa3ad' : '#d8b24a', TRIM, s * 0.05);
  ctx.strokeStyle = TRIM;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLab(ctx, e, c, t, world, advanced) {
  const s = e.def.footprintPx;
  const h = s * 0.5;
  rect(ctx, -h, -h, s, s, '#3a3f47', TRIM, s * 0.04);
  rect(ctx, -h * 0.88, -h * 0.88, s * 0.88, s * 0.88, '#4d535d', null);
  // Hangar mouth on the +Y side, where units come out.
  rect(ctx, -h * 0.62, h * 0.45, s * 0.62, h * 0.42, '#161a1f', c.primary, s * 0.035);
  // Gantry
  ctx.strokeStyle = c.primary;
  ctx.lineWidth = s * 0.045;
  ctx.beginPath();
  ctx.moveTo(-h * 0.7, -h * 0.3); ctx.lineTo(h * 0.7, -h * 0.3);
  ctx.moveTo(-h * 0.7, h * 0.05); ctx.lineTo(h * 0.7, h * 0.05);
  ctx.stroke();
  if (advanced) {
    circle(ctx, 0, -h * 0.55, s * 0.1, c.light, TRIM, s * 0.03);
    circle(ctx, -h * 0.55, -h * 0.55, s * 0.07, c.light, TRIM, s * 0.025);
    circle(ctx, h * 0.55, -h * 0.55, s * 0.07, c.light, TRIM, s * 0.025);
  }
  // Active-build indicator
  if (e.factoryQueue && e.factoryQueue.length > 0) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 7);
    rect(ctx, -h * 0.62, h * 0.45, s * 0.62, h * 0.42, c.light, null);
    ctx.globalAlpha = 1;
  }
}

function drawNano(ctx, e, c, t) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c, 0.3);
  circle(ctx, 0, 0, s * 0.22, HULL, TRIM, s * 0.06);
  ctx.save();
  ctx.rotate(e.turretAngle - e.heading);
  rect(ctx, 0, -s * 0.09, s * 0.55, s * 0.18, HULL_LIGHT, TRIM, s * 0.05);
  circle(ctx, s * 0.55, 0, s * 0.1, '#9fe8ff', TRIM, s * 0.04);
  ctx.restore();
}

function drawTurret(ctx, e, c, t, world, heavy) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c, 0.3);
  circle(ctx, 0, 0, s * (heavy ? 0.32 : 0.28), c.primary, TRIM, s * 0.06);
  ctx.save();
  ctx.rotate(e.turretAngle - e.heading);
  const len = heavy ? s * 0.62 : s * 0.55;
  rect(ctx, 0, -s * (heavy ? 0.13 : 0.09), len, s * (heavy ? 0.26 : 0.18), HULL_LIGHT, TRIM, s * 0.05);
  if (heavy) rect(ctx, len * 0.75, -s * 0.18, s * 0.12, s * 0.36, HULL, TRIM, s * 0.04);
  ctx.restore();
}

function drawRadar(ctx, e, c, t) {
  const s = e.def.footprintPx;
  baseSlab(ctx, s, c, 0.3);
  circle(ctx, 0, 0, s * 0.14, HULL, TRIM, s * 0.05);
  ctx.save();
  ctx.rotate(t * 1.1);
  ctx.beginPath();
  ctx.ellipse(s * 0.18, 0, s * 0.34, s * 0.13, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.primary;
  ctx.fill();
  ctx.strokeStyle = TRIM;
  ctx.lineWidth = s * 0.04;
  ctx.stroke();
  ctx.restore();
}


// ------------------------------------------------------- silhouette shapes
// Definitions may name a `silhouette` instead of getting a bespoke drawing.
// New factions then get sensible icons without a hand-drawn entry each, and
// the shapes here are deliberately vehicular so Concord does not read as bots.

function trackedBody(ctx, r, c, len, wide) {
  ctx.fillStyle = '#31353b';
  ctx.fillRect(-len * r, -wide * r, len * 2 * r, wide * 0.42 * r);
  ctx.fillRect(-len * r, wide * 0.58 * r, len * 2 * r, wide * 0.42 * r);
  poly(ctx, [
    [len * 0.9 * r, -wide * 0.55 * r], [len * 0.9 * r, wide * 0.55 * r],
    [-len * 0.95 * r, wide * 0.6 * r], [-len * 0.95 * r, -wide * 0.6 * r],
  ], c.primary, TRIM, r * 0.13);
}

function barrel(ctx, r, length, width, fill) {
  rect(ctx, r * 0.1, -width * 0.5, length, width, fill || HULL_LIGHT, TRIM, r * 0.07);
}

const SHAPES = {
  command(ctx, e, c) {
    const r = e.radius;
    trackedBody(ctx, r, c, 0.95, 0.85);
    rect(ctx, -r * 0.5, -r * 0.42, r * 0.8, r * 0.84, c.dark, TRIM, r * 0.1);
    circle(ctx, r * 0.05, 0, r * 0.3, HULL, TRIM, r * 0.09);
    barrel(ctx, r, r * 1.15, r * 0.22);
  },
  engineer(ctx, e, c) {
    const r = e.radius;
    trackedBody(ctx, r, c, 0.85, 0.78);
    rect(ctx, -r * 0.45, -r * 0.38, r * 0.6, r * 0.76, HULL, TRIM, r * 0.09);
    barrel(ctx, r, r * 1.0, r * 0.16);
    circle(ctx, r * 1.15, 0, r * 0.17, '#9fe8ff', TRIM, r * 0.07);
  },
  jeep(ctx, e, c) {
    const r = e.radius;
    ctx.fillStyle = '#31353b';
    for (const [x, y] of [[0.55, -0.62], [0.55, 0.62], [-0.55, -0.62], [-0.55, 0.62]]) {
      circle(ctx, x * r, y * r, r * 0.26, '#31353b', null);
    }
    poly(ctx, [
      [r * 0.95, -r * 0.42], [r * 0.95, r * 0.42],
      [-r * 0.85, r * 0.5], [-r * 0.85, -r * 0.5],
    ], c.primary, TRIM, r * 0.13);
    rect(ctx, -r * 0.4, -r * 0.34, r * 0.5, r * 0.68, c.dark, null);
    barrel(ctx, r, r * 0.7, r * 0.12);
  },
  tank(ctx, e, c) {
    const r = e.radius;
    trackedBody(ctx, r, c, 1.0, 0.88);
    poly(ctx, [
      [r * 0.62, -r * 0.34], [r * 0.62, r * 0.34],
      [-r * 0.45, r * 0.42], [-r * 0.45, -r * 0.42],
    ], c.dark, TRIM, r * 0.1);
    barrel(ctx, r, r * 1.25, r * 0.18);
  },
  heavytank(ctx, e, c) {
    const r = e.radius;
    trackedBody(ctx, r, c, 1.05, 1.0);
    poly(ctx, [
      [r * 0.68, -r * 0.44], [r * 0.68, r * 0.44],
      [-r * 0.55, r * 0.5], [-r * 0.55, -r * 0.5],
    ], c.dark, TRIM, r * 0.11);
    rect(ctx, r * 0.1, -r * 0.44, r * 1.25, r * 0.17, HULL_LIGHT, TRIM, r * 0.06);
    rect(ctx, r * 0.1, r * 0.27, r * 1.25, r * 0.17, HULL_LIGHT, TRIM, r * 0.06);
  },
  missile(ctx, e, c) {
    const r = e.radius;
    trackedBody(ctx, r, c, 0.9, 0.82);
    rect(ctx, -r * 0.5, -r * 0.5, r * 0.95, r * 1.0, HULL, TRIM, r * 0.09);
    for (const dy of [-0.3, 0, 0.3]) {
      poly(ctx, [
        [r * 0.45, (dy - 0.09) * r], [r * 0.78, dy * r], [r * 0.45, (dy + 0.09) * r],
      ], '#ff9a5b', null);
    }
  },
  howitzer(ctx, e, c) {
    const r = e.radius;
    trackedBody(ctx, r, c, 0.85, 0.8);
    rect(ctx, -r * 0.45, -r * 0.36, r * 0.6, r * 0.72, c.dark, TRIM, r * 0.09);
    barrel(ctx, r, r * 1.75, r * 0.16);
  },
  derrick(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c);
    ctx.strokeStyle = HULL;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(dx * s * 0.3, dy * s * 0.3);
      ctx.lineTo(0, 0);
    }
    ctx.stroke();
    rect(ctx, -s * 0.32, -s * 0.05, s * 0.64, s * 0.1, c.light, TRIM, s * 0.03);
    circle(ctx, 0, 0, s * 0.1, HULL_LIGHT, TRIM, s * 0.03);
  },
  generator(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c);
    rect(ctx, -s * 0.33, -s * 0.28, s * 0.66, s * 0.56, HULL, TRIM, s * 0.04);
    rect(ctx, -s * 0.33, -s * 0.28, s * 0.66, s * 0.1, c.primary, null);
    ctx.strokeStyle = '#22262b';
    ctx.lineWidth = s * 0.035;
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.24 + i * s * 0.16;
      ctx.beginPath(); ctx.moveTo(x, -s * 0.12); ctx.lineTo(x, s * 0.24); ctx.stroke();
    }
    circle(ctx, -s * 0.38, -s * 0.2, s * 0.06, HULL_DARK, TRIM, s * 0.02);
    circle(ctx, -s * 0.38, s * 0.2, s * 0.06, HULL_DARK, TRIM, s * 0.02);
  },
  reactor(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c);
    circle(ctx, 0, 0, s * 0.3, c.primary, TRIM, s * 0.045);
    circle(ctx, 0, 0, s * 0.17, '#8ef6ff', null);
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      circle(ctx, dx * s * 0.34, dy * s * 0.34, s * 0.1, HULL_LIGHT, TRIM, s * 0.03);
    }
  },
  refinery(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c);
    circle(ctx, -s * 0.14, 0, s * 0.22, HULL, TRIM, s * 0.04);
    circle(ctx, s * 0.2, s * 0.16, s * 0.14, HULL_LIGHT, TRIM, s * 0.035);
    circle(ctx, -s * 0.14, 0, s * 0.1, '#ffd76a', null);
    rect(ctx, -s * 0.3, -s * 0.26, s * 0.5, s * 0.06, HULL_DARK, null);
  },
  yard(ctx, e, c) {
    const s = e.def.footprintPx;
    const h = s * 0.5;
    rect(ctx, -h, -h, s, s, '#3a3f47', TRIM, s * 0.04);
    rect(ctx, -h * 0.9, -h * 0.9, s * 0.9, s * 0.9, '#4d535d', null);
    rect(ctx, -h * 0.66, h * 0.36, s * 0.66, h * 0.5, '#1b1f24', c.primary, s * 0.035);
    ctx.strokeStyle = c.primary;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-h * 0.72, -h * 0.3); ctx.lineTo(h * 0.72, -h * 0.3);
    ctx.moveTo(-h * 0.72, h * 0.06); ctx.lineTo(h * 0.72, h * 0.06);
    ctx.stroke();
  },
  crane(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c, 0.3);
    rect(ctx, -s * 0.1, -s * 0.1, s * 0.2, s * 0.2, HULL, TRIM, s * 0.05);
    rect(ctx, 0, -s * 0.05, s * 0.55, s * 0.1, HULL_LIGHT, TRIM, s * 0.04);
    circle(ctx, s * 0.55, 0, s * 0.09, '#9fe8ff', TRIM, s * 0.03);
  },
  bunker(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c, 0.3);
    poly(ctx, [
      [-s * 0.33, -s * 0.33], [s * 0.33, -s * 0.26],
      [s * 0.33, s * 0.26], [-s * 0.33, s * 0.33],
    ], '#5b6068', TRIM, s * 0.05);
    rect(ctx, 0, -s * 0.08, s * 0.5, s * 0.16, HULL_LIGHT, TRIM, s * 0.04);
  },
  mast(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c, 0.3);
    ctx.strokeStyle = HULL;
    ctx.lineWidth = s * 0.04;
    ctx.strokeRect(-s * 0.12, -s * 0.12, s * 0.24, s * 0.24);
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.12); ctx.lineTo(s * 0.12, s * 0.12);
    ctx.moveTo(s * 0.12, -s * 0.12); ctx.lineTo(-s * 0.12, s * 0.12);
    ctx.stroke();
    poly(ctx, [
      [s * 0.08, -s * 0.3], [s * 0.42, -s * 0.1],
      [s * 0.42, s * 0.1], [s * 0.08, s * 0.3],
    ], c.primary, TRIM, s * 0.035);
  },
  tank_store(ctx, e, c) {
    const s = e.def.footprintPx;
    baseSlab(ctx, s, c);
    circle(ctx, 0, -s * 0.17, s * 0.2, '#9aa3ad', TRIM, s * 0.04);
    circle(ctx, 0, s * 0.17, s * 0.2, '#9aa3ad', TRIM, s * 0.04);
  },
};

// --------------------------------------------------------------- dispatch

const DRAW = {
  commander: drawCommander,
  conbot: drawConbot,
  adv_conbot: (ctx, e, c, t) => { drawConbot(ctx, e, c, t); circle(ctx, -e.radius * 0.3, 0, e.radius * 0.22, c.light, TRIM, e.radius * 0.08); },
  scout: drawScout,
  rifle: drawRifle,
  rocket: drawRocket,
  heavy: drawHeavy,
  siege: drawSiege,
  mex: drawMex,
  solar: drawSolar,
  wind: drawWind,
  converter: drawConverter,
  mstore: (ctx, e, c, t, w) => drawStorage(ctx, e, c, t, w, true),
  estore: (ctx, e, c, t, w) => drawStorage(ctx, e, c, t, w, false),
  botlab: (ctx, e, c, t, w) => drawLab(ctx, e, c, t, w, false),
  advbotlab: (ctx, e, c, t, w) => drawLab(ctx, e, c, t, w, true),
  nano: drawNano,
  llt: (ctx, e, c, t, w) => drawTurret(ctx, e, c, t, w, false),
  hlt: (ctx, e, c, t, w) => drawTurret(ctx, e, c, t, w, true),
  radar: drawRadar,
};

/**
 * Draw an entity. Caller has already translated and rotated into place.
 * A bespoke drawing wins; otherwise the definition's silhouette picks a shape.
 */
export function drawEntity(ctx, e, colors, time, world) {
  let key = e.def && e.def.silhouette;
  if (key === 'tank' && e.isBuilding) key = 'tank_store';
  const fn = DRAW[e.defId] || SHAPES[key];
  if (fn) fn(ctx, e, colors, time, world);
  else circle(ctx, 0, 0, e.radius, colors.primary, TRIM, 2);
}

/**
 * Turret barrel for bot units, drawn unrotated by the body so it can track
 * a target independently.
 */
export function drawUnitTurret(ctx, e, colors) {
  if (!e.weapons.length || e.isBuilding) return;
  const r = e.radius;
  ctx.save();
  ctx.rotate(e.turretAngle);
  const w = e.defId === 'siege' ? r * 0.26 : r * 0.2;
  const len = e.defId === 'siege' ? r * 1.7 : e.defId === 'scout' ? r * 0.8 : r * 1.0;
  rect(ctx, r * 0.2, -w * 0.5, len, w, HULL_LIGHT, TRIM, r * 0.08);
  ctx.restore();
}

/**
 * Nanoframe: a wireframe that fills upward as the structure is built. This is
 * the visual language BAR uses for anything under construction.
 */
export function drawNanoframe(ctx, e, colors, time) {
  const size = e.isBuilding ? e.def.footprintPx : e.radius * 2;
  const h = size * 0.5;
  const p = e.buildProgress;

  ctx.save();
  ctx.globalAlpha = 0.30;
  rect(ctx, -h, -h, size, size, '#0d1218', null);
  ctx.globalAlpha = 1;

  // Filled portion
  ctx.save();
  ctx.beginPath();
  ctx.rect(-h, h - size * p, size, size * p);
  ctx.clip();
  ctx.globalAlpha = 0.55;
  drawEntity(ctx, e, colors, time, null);
  ctx.restore();

  // Wireframe cage
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = colors.light;
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.setLineDash([size * 0.12, size * 0.08]);
  ctx.strokeRect(-h, -h, size, size);
  ctx.setLineDash([]);

  // Scan line at the build front
  const y = h - size * p;
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 9);
  ctx.strokeStyle = '#b9f2ff';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(-h, y);
  ctx.lineTo(h, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Wreckage left behind by a destroyed unit or building. */
export function drawWreck(ctx, wreck, time) {
  const size = wreck.isBuilding ? wreck.radius * 1.7 : wreck.radius * 1.6;
  const frac = wreck.metal > 0 ? wreck.metalLeft / wreck.metal : 1;
  ctx.save();
  ctx.rotate(wreck.heading || 0);
  ctx.globalAlpha = 0.35 + 0.5 * frac;
  poly(ctx, [
    [size * 0.5, -size * 0.28], [size * 0.18, -size * 0.5],
    [-size * 0.5, -size * 0.2], [-size * 0.34, size * 0.44], [size * 0.34, size * 0.4],
  ], '#5b5148', '#2a251f', Math.max(1, size * 0.06));
  ctx.globalAlpha = 1;
  ctx.restore();
}

export const ART_COLORS = { HULL, HULL_DARK, HULL_LIGHT, TRIM };
