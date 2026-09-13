// HUD: resource readouts, build menu, selection panel and alerts.
// Built from DOM elements declared in index.html and updated each frame.

import { getDef, BUILD_HOTKEYS, DEFS } from '../sim/defs.js';
import { shortNum, clamp } from '../core/math.js';
import { drawEntity } from './art.js';

const iconCache = new Map();

/** Render a definition to a small canvas for use as a build-menu icon. */
function iconFor(defId, faction, colors) {
  const key = defId + '|' + faction + '|' + colors.primary;
  if (iconCache.has(key)) return iconCache.get(key);

  const size = 52;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const def = getDef(defId, faction);

  const proto = {
    id: 1, defId, def, radius: def.kind === 'building' ? def.footprintPx * 0.5 : def.radius,
    speed: 0, heading: 0, turretAngle: 0, weapons: (def.weapons || []).map(() => ({})),
    factoryQueue: [], isBuilding: def.kind === 'building',
  };

  const extent = def.kind === 'building' ? def.footprintPx : def.radius * 2.6;
  const scale = (size * 0.78) / extent;

  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.rotate(-Math.PI / 2);
  drawEntity(ctx, proto, colors, 0, null);

  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      metalFill: document.getElementById('metal-fill'),
      metalValue: document.getElementById('metal-value'),
      metalRate: document.getElementById('metal-rate'),
      energyFill: document.getElementById('energy-fill'),
      energyValue: document.getElementById('energy-value'),
      energyRate: document.getElementById('energy-rate'),
      buildMenu: document.getElementById('build-menu'),
      selInfo: document.getElementById('selection-info'),
      messages: document.getElementById('messages'),
      clock: document.getElementById('clock'),
      speed: document.getElementById('speed-label'),
      stats: document.getElementById('stats-label'),
      alerts: document.getElementById('alerts'),
      gameOver: document.getElementById('gameover'),
      gameOverText: document.getElementById('gameover-text'),
      windLabel: document.getElementById('wind-label'),
    };
    this.lastBuildOptions = '';
    this.lastSelectionKey = '';
    this._bindButtons();
  }

  _bindButtons() {
    const g = this.game;
    document.getElementById('btn-pause').onclick = () => g.togglePause();
    document.getElementById('btn-slower').onclick = () => g.setSpeed(g.speed - 1);
    document.getElementById('btn-faster').onclick = () => g.setSpeed(g.speed + 1);
    const help = document.getElementById('help-panel');
    document.getElementById('btn-help').onclick = () => {
      help.classList.toggle('hidden');
    };
    document.getElementById('btn-close-help').onclick = () => help.classList.add('hidden');
  }

  update() {
    const g = this.game;
    const p = g.player;

    // Resources
    const mFrac = clamp(p.metal / Math.max(1, p.metalStorage), 0, 1);
    const eFrac = clamp(p.energy / Math.max(1, p.energyStorage), 0, 1);
    this.el.metalFill.style.width = (mFrac * 100).toFixed(1) + '%';
    this.el.energyFill.style.width = (eFrac * 100).toFixed(1) + '%';
    this.el.metalValue.textContent = shortNum(p.metal) + ' / ' + shortNum(p.metalStorage);
    this.el.energyValue.textContent = shortNum(p.energy) + ' / ' + shortNum(p.energyStorage);

    const mNet = p.metalIncome + p.metalReclaim - p.metalDrain;
    const eNet = p.energyIncome - p.energyDrain;
    this.el.metalRate.textContent =
      `+${p.metalIncome.toFixed(1)}  -${p.metalDrain.toFixed(1)}`;
    this.el.energyRate.textContent =
      `+${p.energyIncome.toFixed(0)}  -${p.energyDrain.toFixed(0)}`;
    this.el.metalRate.className = 'rate ' + (mNet >= 0 ? 'good' : 'bad');
    this.el.energyRate.className = 'rate ' + (eNet >= 0 ? 'good' : 'bad');

    this.el.metalFill.classList.toggle('stalling', !!(p.stalling && p.stalling.metal));
    this.el.energyFill.classList.toggle('stalling', !!(p.stalling && p.stalling.energy));

    // Clock and status
    const t = g.world.time;
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    this.el.clock.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    this.el.speed.textContent = g.paused ? 'PAUSED' : `${g.speedMultiplier}x`;
    this.el.speed.className = g.paused ? 'paused' : '';
    this.el.windLabel.textContent = `WIND ${(2 + 20 * g.world.windStrength).toFixed(0)}`;
    this.el.stats.textContent =
      `${g.world.unitsOf(0).length} units  ·  ${Math.round(g.fps)} fps`;

    this._updateAlerts(p);
    this._updateBuildMenu();
    this._updateSelectionLive();
  }

  _updateAlerts(p) {
    const alerts = [];
    if (p.stalling && p.stalling.metal) alerts.push(['METAL STALL', 'metal']);
    if (p.stalling && p.stalling.energy) alerts.push(['ENERGY STALL', 'energy']);
    if (p.metalWasted > 1) alerts.push(['METAL OVERFLOW', 'waste']);
    if (p.energyWasted > 20) alerts.push(['ENERGY OVERFLOW', 'waste']);

    const key = alerts.map((a) => a[0]).join(',');
    if (key === this._alertKey) return;
    this._alertKey = key;
    this.el.alerts.innerHTML = alerts
      .map(([text, cls]) => `<div class="alert ${cls}">${text}</div>`)
      .join('');
  }

  setMessages(messages) {
    this.el.messages.innerHTML = messages
      .slice(-4)
      .map((m) => `<div class="message">${escapeHtml(m.text)}</div>`)
      .join('');
  }

  // ----------------------------------------------------------- build menu

  _updateBuildMenu() {
    const g = this.game;
    const options = g.currentBuildOptions();
    const key = options.join(',');
    if (key === this.lastBuildOptions) {
      this._updateBuildAffordability(options);
      return;
    }
    this.lastBuildOptions = key;

    if (!options.length) {
      this.el.buildMenu.innerHTML = '<div class="menu-hint">Select a builder or factory</div>';
      return;
    }

    const faction = g.player.faction;
    const colors = g.player.color;
    this.el.buildMenu.innerHTML = options.map((id) => {
      const def = getDef(id, faction);
      const hotkey = BUILD_HOTKEYS[id] || '';
      return `
        <button class="build-btn" data-def="${id}" title="${escapeHtml(def.name)}">
          <img src="${iconFor(id, faction, colors)}" alt="">
          <span class="hk">${hotkey}</span>
          <span class="bname">${escapeHtml(def.short || def.name)}</span>
          <span class="cost"><i class="m"></i>${def.metal}<i class="e"></i>${def.energy}</span>
        </button>`;
    }).join('');

    for (const btn of this.el.buildMenu.querySelectorAll('.build-btn')) {
      btn.onclick = () => g.chooseBuildOption(btn.dataset.def);
      btn.onmouseenter = () => this._showTooltip(btn.dataset.def);
      btn.onmouseleave = () => this._hideTooltip();
    }
  }

  _updateBuildAffordability(options) {
    const p = this.game.player;
    for (const btn of this.el.buildMenu.querySelectorAll('.build-btn')) {
      const def = getDef(btn.dataset.def, p.faction);
      // Dim what we are a long way from being able to start paying for.
      const poor = p.metal < def.metal * 0.12 || (def.energy > 0 && p.energy < def.energy * 0.06);
      btn.classList.toggle('poor', poor);
    }
  }

  _showTooltip(defId) {
    const def = getDef(defId, this.game.player.faction);
    let tip = document.getElementById('tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'tooltip';
      document.body.appendChild(tip);
    }
    const rows = [];
    rows.push(`<div class="tt-name">${escapeHtml(def.name)}</div>`);
    rows.push(`<div class="tt-cost"><b>${def.metal}</b> metal &nbsp; <b>${def.energy}</b> energy &nbsp; <b>${(def.buildTime / 100).toFixed(0)}</b> work</div>`);
    if (def.hp) rows.push(`<div class="tt-stat">Health ${def.hp}</div>`);
    if (def.maxWeaponRange) {
      const w = def.weapons[0];
      rows.push(`<div class="tt-stat">${escapeHtml(w.name)} — ${w.damage} dmg / ${w.reload}s, range ${w.range}</div>`);
    }
    if (def.buildPower) rows.push(`<div class="tt-stat">Build power ${def.buildPower}</div>`);
    if (def.metalPerSecond) rows.push(`<div class="tt-stat">+${def.metalPerSecond} metal/s on a spot</div>`);
    if (def.energyPerSecond) rows.push(`<div class="tt-stat">+${def.energyPerSecond} energy/s</div>`);
    if (def.windPowered) rows.push('<div class="tt-stat">Energy varies with wind</div>');
    if (def.convertsEnergy) rows.push(`<div class="tt-stat">${def.convertsEnergy} energy/s → ${def.convertsToMetal} metal/s</div>`);
    if (def.metalStorage) rows.push(`<div class="tt-stat">+${def.metalStorage} metal storage</div>`);
    if (def.energyStorage) rows.push(`<div class="tt-stat">+${def.energyStorage} energy storage</div>`);
    if (def.radar) rows.push(`<div class="tt-stat">Radar coverage ${def.radar}</div>`);
    if (def.speed) rows.push(`<div class="tt-stat">Speed ${def.speed.toFixed(0)}</div>`);
    if (def.desc) rows.push(`<div class="tt-desc">${escapeHtml(def.desc)}</div>`);
    tip.innerHTML = rows.join('');
    tip.classList.add('visible');

    const menuRect = this.el.buildMenu.getBoundingClientRect();
    tip.style.left = menuRect.left + 'px';
    tip.style.bottom = (window.innerHeight - menuRect.top + 8) + 'px';
  }

  _hideTooltip() {
    const tip = document.getElementById('tooltip');
    if (tip) tip.classList.remove('visible');
  }

  // ------------------------------------------------------ selection panel

  refreshSelection() {
    this.lastSelectionKey = '';
    this._updateSelectionLive();
  }

  _updateSelectionLive() {
    const g = this.game;
    const sel = g.selection;
    const key = sel.length === 1
      ? 'one:' + sel[0].id
      : sel.map((e) => e.defId).sort().join(',');

    if (!sel.length) {
      if (this.lastSelectionKey !== 'none') {
        this.lastSelectionKey = 'none';
        this.el.selInfo.innerHTML = '<div class="menu-hint">Nothing selected</div>';
      }
      return;
    }

    if (sel.length === 1) {
      this.lastSelectionKey = key;
      this.el.selInfo.innerHTML = this._singleHtml(sel[0]);
      return;
    }

    if (key !== this.lastSelectionKey) this.lastSelectionKey = key;
    const counts = new Map();
    for (const e of sel) counts.set(e.defId, (counts.get(e.defId) || 0) + 1);
    const faction = g.player.faction;
    const colors = g.player.color;
    this.el.selInfo.innerHTML =
      `<div class="sel-title">${sel.length} units selected</div><div class="sel-grid">` +
      [...counts.entries()].map(([id, n]) =>
        `<div class="sel-chip"><img src="${iconFor(id, faction, colors)}"><span>${n}</span></div>`
      ).join('') + '</div>';
  }

  _singleHtml(e) {
    const def = e.def;
    const faction = this.game.world.players[e.player].faction;
    const colors = this.game.world.players[e.player].color;
    const hpPct = clamp(e.hp / e.maxHp, 0, 1) * 100;
    const rows = [];

    rows.push(`<div class="sel-head">
        <img class="sel-icon" src="${iconFor(e.defId, faction, colors)}">
        <div>
          <div class="sel-title">${escapeHtml(def.name)}</div>
          <div class="sel-sub">${escapeHtml(this.game.world.players[e.player].name)}</div>
        </div>
      </div>`);
    rows.push(`<div class="hpbar"><div class="hpfill" style="width:${hpPct}%"></div>
        <span>${Math.ceil(e.hp)} / ${e.maxHp}</span></div>`);

    if (e.underConstruction) {
      rows.push(`<div class="hpbar build"><div class="hpfill" style="width:${e.buildProgress * 100}%"></div>
        <span>building ${(e.buildProgress * 100).toFixed(0)}%</span></div>`);
    }

    const stats = [];
    if (def.maxWeaponRange) {
      const w = def.weapons[0];
      stats.push(`${w.damage} dmg`, `range ${w.range}`);
    }
    if (def.buildPower) stats.push(`${def.buildPower} build power`);
    if (def.speed) stats.push(`speed ${def.speed.toFixed(0)}`);
    if (def.metalPerSecond && e.metalSpot) stats.push(`+${(def.metalPerSecond * e.metalSpot.yield).toFixed(1)} metal/s`);
    if (def.energyPerSecond) stats.push(`+${def.energyPerSecond} energy/s`);
    if (def.windPowered) stats.push(`+${(2 + 20 * this.game.world.windStrength).toFixed(0)} energy/s`);
    if (stats.length) rows.push(`<div class="sel-stats">${stats.map(escapeHtml).join(' · ')}</div>`);

    if (e.def.factory) {
      const q = e.factoryQueue;
      if (q.length) {
        rows.push('<div class="queue">' + q.map((item, i) => {
          const pct = i === 0 ? (e.factoryProgress * 100).toFixed(0) : 0;
          return `<div class="qitem" data-idx="${i}">
            <img src="${iconFor(item.defId, faction, colors)}">
            <span class="qn">${item.count}</span>
            <div class="qbar" style="width:${pct}%"></div>
          </div>`;
        }).join('') + '</div>');
        rows.push(`<button class="mini-btn" id="btn-clear-queue">Clear queue</button>`);
      }
      rows.push(`<button class="mini-btn ${e.repeat ? 'on' : ''}" id="btn-repeat">Repeat ${e.repeat ? 'ON' : 'OFF'}</button>`);
    }

    if (e.orders.length) {
      rows.push(`<div class="sel-orders">${e.orders.length} order${e.orders.length > 1 ? 's' : ''} queued — ${escapeHtml(e.orders[0].type)}</div>`);
    }
    if (def.desc) rows.push(`<div class="sel-desc">${escapeHtml(def.desc)}</div>`);

    const html = rows.join('');
    // Re-bind the factory buttons after each rewrite.
    queueMicrotask(() => {
      const clear = document.getElementById('btn-clear-queue');
      if (clear) clear.onclick = () => { e.factoryQueue.length = 0; e.factoryProgress = 0; this.refreshSelection(); };
      const rep = document.getElementById('btn-repeat');
      if (rep) rep.onclick = () => { e.repeat = !e.repeat; this.refreshSelection(); };
    });
    return html;
  }

  refreshTopBar() { /* speed label is refreshed every frame in update() */ }

  showGameOver(won) {
    this.el.gameOverText.textContent = won ? 'VICTORY' : 'DEFEAT';
    this.el.gameOverText.className = won ? 'won' : 'lost';
    const p = this.game.player;
    const enemy = this.game.world.players[1];
    document.getElementById('gameover-stats').innerHTML = `
      <div>Time survived: <b>${Math.floor(this.game.world.time / 60)}m ${Math.floor(this.game.world.time % 60)}s</b></div>
      <div>Units built: <b>${p.stats.built}</b> · lost: <b>${p.stats.lost}</b> · killed: <b>${p.stats.killed}</b></div>
      <div>Metal produced: <b>${Math.round(p.stats.metalProduced)}</b> · reclaimed: <b>${Math.round(p.stats.metalReclaimed)}</b></div>
      <div class="dim">Enemy built ${enemy.stats.built}, lost ${enemy.stats.lost}</div>`;
    this.el.gameOver.classList.remove('hidden');
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
