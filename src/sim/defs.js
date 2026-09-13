// Unit and structure definitions.
//
// Costs follow the Spring/Recoil convention used by Beyond All Reason:
// `metal` and `energy` are the totals drained over the build, and `buildTime`
// is the work required. A builder contributing `buildPower` finishes the job
// in buildTime / buildPower seconds and spends the cost across that window.

export const BUILD_CELL = 16; // world units per construction grid cell

/** Weapon archetypes. `kind` selects the projectile model used by combat.js. */
const W = {
  commanderCannon: {
    name: 'Disruptor Cannon', kind: 'plasma', damage: 260, reload: 1.1,
    range: 265, speed: 560, aoe: 42, spread: 0.015, color: '#8ef6ff',
  },
  lightLaser: {
    name: 'Light Laser', kind: 'laser', damage: 14, reload: 0.32,
    range: 185, speed: 1400, aoe: 0, spread: 0.05, color: '#ffe66d',
  },
  rifleLaser: {
    name: 'Pulse Laser', kind: 'laser', damage: 33, reload: 0.62,
    range: 210, speed: 1500, aoe: 0, spread: 0.035, color: '#ffd24a',
  },
  rocketPod: {
    name: 'Rocket Pod', kind: 'missile', damage: 92, reload: 1.7,
    range: 330, speed: 380, aoe: 36, spread: 0.02, color: '#ff9a5b',
  },
  towerLaser: {
    name: 'Tower Laser', kind: 'laser', damage: 58, reload: 0.55,
    range: 300, speed: 1600, aoe: 0, spread: 0.0, color: '#ff5f5f',
  },
  heavyLaser: {
    name: 'Heavy Laser', kind: 'laser', damage: 74, reload: 0.8,
    range: 275, speed: 1500, aoe: 0, spread: 0.02, color: '#ff7b4a',
  },
  siegeGun: {
    name: 'Siege Battery', kind: 'arty', damage: 190, reload: 3.4,
    range: 720, speed: 420, aoe: 96, spread: 0.045, color: '#cdd6ff',
  },
  flakTower: {
    name: 'Heavy Plasma Tower', kind: 'plasma', damage: 160, reload: 1.5,
    range: 470, speed: 520, aoe: 64, spread: 0.02, color: '#ff8ad8',
  },
};

/**
 * Every definition. `build` lists what the entity can construct, which is what
 * drives both the player's build menu and the AI's options.
 */
export const DEFS = {
  // ---------------------------------------------------------------- commander
  commander: {
    id: 'commander', name: 'Commander', short: 'COM', kind: 'unit',
    role: 'builder', tier: 1,
    metal: 2500, energy: 25000, buildTime: 75000,
    hp: 3600, radius: 15, speed: 38, turnRate: 4.5, accel: 140,
    buildPower: 300, buildRange: 145,
    los: 560, mass: 4,
    // A commander is a small power plant in its own right; this is what pays
    // for the opening build order before any extractors are up.
    energyPerSecond: 22, flatMetalPerSecond: 2.0,
    weapons: [W.commanderCannon],
    wreckFraction: 0.0,
    desc: 'Your avatar and first builder. Lose it and the battle is lost.',
    build: [
      'mex', 'solar', 'wind', 'converter', 'estore', 'mstore',
      'botlab', 'nano', 'llt', 'radar',
    ],
  },

  // -------------------------------------------------------------- economy
  mex: {
    id: 'mex', name: 'Metal Extractor', short: 'MEX', kind: 'building',
    tier: 1, metal: 50, energy: 500, buildTime: 1800,
    hp: 620, footprint: 3, los: 210,
    needsMetalSpot: true,
    metalPerSecond: 1.8, // multiplied by the spot's yield
    desc: 'Must be placed on a metal spot. The backbone of your income.',
  },
  solar: {
    id: 'solar', name: 'Solar Collector', short: 'SOL', kind: 'building',
    tier: 1, metal: 155, energy: 0, buildTime: 2800,
    hp: 1100, footprint: 4, los: 190,
    energyPerSecond: 20,
    desc: 'Steady 20 energy per second. Cheap, bulky, reliable.',
  },
  wind: {
    id: 'wind', name: 'Wind Turbine', short: 'WND', kind: 'building',
    tier: 1, metal: 45, energy: 175, buildTime: 1600,
    hp: 320, footprint: 3, los: 190,
    windPowered: true,
    desc: 'Output rises and falls with the wind. Cheap early energy.',
  },
  converter: {
    id: 'converter', name: 'Energy Converter', short: 'CNV', kind: 'building',
    tier: 1, metal: 60, energy: 1150, buildTime: 2600,
    hp: 780, footprint: 3, los: 160,
    convertsEnergy: 70, convertsToMetal: 1.0,
    desc: 'Burns 70 energy per second to make 1 metal per second.',
  },
  estore: {
    id: 'estore', name: 'Energy Storage', short: 'EST', kind: 'building',
    tier: 1, metal: 55, energy: 900, buildTime: 1500,
    hp: 1400, footprint: 3, los: 160,
    energyStorage: 3000,
    desc: 'Adds 3000 energy storage to buffer against stalls.',
  },
  mstore: {
    id: 'mstore', name: 'Metal Storage', short: 'MST', kind: 'building',
    tier: 1, metal: 280, energy: 410, buildTime: 1500,
    hp: 1400, footprint: 3, los: 160,
    metalStorage: 1000,
    desc: 'Adds 1000 metal storage.',
  },

  // -------------------------------------------------------------- production
  botlab: {
    id: 'botlab', name: 'Bot Lab', short: 'LAB', kind: 'building',
    tier: 1, metal: 600, energy: 1100, buildTime: 6000,
    hp: 2900, footprint: 6, los: 240,
    buildPower: 100, factory: true,
    desc: 'Produces tier 1 bots. Queue units and set a rally point.',
    build: ['conbot', 'scout', 'rifle', 'rocket'],
  },
  advbotlab: {
    id: 'advbotlab', name: 'Advanced Bot Lab', short: 'T2', kind: 'building',
    tier: 2, metal: 2400, energy: 4800, buildTime: 20000,
    hp: 4800, footprint: 7, los: 280,
    buildPower: 200, factory: true,
    desc: 'Unlocks tier 2 bots: heavier armour and siege range.',
    build: ['adv_conbot', 'heavy', 'siege', 'rifle'],
  },
  nano: {
    id: 'nano', name: 'Construction Turret', short: 'NANO', kind: 'building',
    tier: 1, metal: 115, energy: 600, buildTime: 3000,
    hp: 480, footprint: 2, los: 200,
    buildPower: 70, buildRange: 330, assistOnly: true,
    desc: 'Stationary build power. Assists anything within 330 range.',
  },

  // -------------------------------------------------------------- defence
  llt: {
    id: 'llt', name: 'Laser Tower', short: 'LLT', kind: 'building',
    tier: 1, metal: 125, energy: 600, buildTime: 1700,
    hp: 1300, footprint: 2, los: 330,
    weapons: [W.towerLaser],
    desc: 'Cheap perimeter defence. Strong against raiders.',
  },
  hlt: {
    id: 'hlt', name: 'Plasma Battery', short: 'HLT', kind: 'building',
    tier: 2, metal: 700, energy: 3400, buildTime: 7000,
    hp: 3400, footprint: 3, los: 500,
    weapons: [W.flakTower],
    desc: 'Tier 2 defence with splash damage and long reach.',
  },
  radar: {
    id: 'radar', name: 'Radar Tower', short: 'RAD', kind: 'building',
    tier: 1, metal: 60, energy: 350, buildTime: 1100,
    hp: 320, footprint: 2, los: 220, radar: 1750,
    desc: 'Reveals moving contacts as radar blips across a wide area.',
  },

  // -------------------------------------------------------------- bots
  conbot: {
    id: 'conbot', name: 'Construction Bot', short: 'CON', kind: 'unit',
    role: 'builder', tier: 1,
    metal: 110, energy: 200, buildTime: 3000,
    hp: 420, radius: 10, speed: 46, turnRate: 6, accel: 190,
    buildPower: 80, buildRange: 130, los: 400, mass: 1.4,
    weapons: [],
    desc: 'Builds, repairs, reclaims and assists. Build more than you think.',
    build: [
      'mex', 'solar', 'wind', 'converter', 'estore', 'mstore',
      'botlab', 'nano', 'llt', 'radar',
    ],
  },
  adv_conbot: {
    id: 'adv_conbot', name: 'Advanced Construction Bot', short: 'ACON',
    kind: 'unit', role: 'builder', tier: 2,
    metal: 260, energy: 620, buildTime: 6600,
    hp: 780, radius: 11, speed: 42, turnRate: 6, accel: 190,
    buildPower: 180, buildRange: 165, los: 440, mass: 1.8,
    weapons: [],
    desc: 'Tier 2 builder. Unlocks advanced structures.',
    build: [
      'mex', 'solar', 'wind', 'converter', 'estore', 'mstore',
      'botlab', 'advbotlab', 'nano', 'llt', 'hlt', 'radar',
    ],
  },
  scout: {
    id: 'scout', name: 'Scout Bot', short: 'SCT', kind: 'unit',
    role: 'raider', tier: 1,
    metal: 62, energy: 100, buildTime: 1250,
    hp: 290, radius: 8, speed: 98, turnRate: 9, accel: 320,
    los: 660, mass: 0.8,
    weapons: [W.lightLaser],
    desc: 'Fast, cheap eyes. Snipe builders and outrun trouble.',
  },
  rifle: {
    id: 'rifle', name: 'Assault Bot', short: 'ASL', kind: 'unit',
    role: 'assault', tier: 1,
    metal: 88, energy: 145, buildTime: 1550,
    hp: 720, radius: 10, speed: 49, turnRate: 7, accel: 220,
    los: 420, mass: 1.5,
    weapons: [W.rifleLaser],
    desc: 'The line infantry of your army. Cost efficient in numbers.',
  },
  rocket: {
    id: 'rocket', name: 'Rocket Bot', short: 'RKT', kind: 'unit',
    role: 'skirmisher', tier: 1,
    metal: 145, energy: 265, buildTime: 2450,
    hp: 600, radius: 10, speed: 41, turnRate: 6, accel: 180,
    los: 480, mass: 1.6,
    weapons: [W.rocketPod],
    desc: 'Outranges assault bots. Keep it behind the front line.',
  },
  heavy: {
    id: 'heavy', name: 'Heavy Bot', short: 'HVY', kind: 'unit',
    role: 'assault', tier: 2,
    metal: 900, energy: 1500, buildTime: 9000,
    hp: 4300, radius: 14, speed: 33, turnRate: 4.5, accel: 140,
    los: 460, mass: 3.4,
    weapons: [W.heavyLaser, W.heavyLaser],
    desc: 'Tier 2 brawler. Twin lasers and enough armour to hold a push.',
  },
  siege: {
    id: 'siege', name: 'Siege Bot', short: 'SGE', kind: 'unit',
    role: 'artillery', tier: 2,
    metal: 720, energy: 1400, buildTime: 8200,
    hp: 1150, radius: 12, speed: 29, turnRate: 4, accel: 120,
    los: 520, mass: 2.4,
    weapons: [W.siegeGun],
    desc: 'Long range splash artillery. Cracks defences from outside their reach.',
  },
};

/** Faction flavour. Mirrors Armada/Cortex: agile and cheap vs tough and heavy. */
export const FACTIONS = {
  vanguard: {
    id: 'vanguard', name: 'Vanguard',
    blurb: 'Mobile and efficient. Better range and speed, thinner armour.',
    mods: { hp: 0.92, speed: 1.10, damage: 0.95, range: 1.08, cost: 0.96 },
  },
  legion: {
    id: 'legion', name: 'Legion',
    blurb: 'Heavy and durable. More armour and punch, slower to move.',
    mods: { hp: 1.14, speed: 0.93, damage: 1.10, range: 0.96, cost: 1.05 },
  },
};

/** Resolve a definition with its owning faction's modifiers baked in. */
const resolved = new Map();
export function getDef(defId, factionId) {
  const key = defId + '|' + factionId;
  let d = resolved.get(key);
  if (d) return d;

  const base = DEFS[defId];
  if (!base) throw new Error('Unknown unit definition: ' + defId);
  const m = (FACTIONS[factionId] || FACTIONS.vanguard).mods;

  d = Object.assign({}, base);
  d.faction = factionId;
  d.hp = Math.round(base.hp * m.hp);
  d.metal = Math.round(base.metal * m.cost);
  d.energy = Math.round(base.energy * m.cost);
  d.buildTime = Math.round(base.buildTime * m.cost);
  if (base.speed) d.speed = base.speed * m.speed;
  if (base.weapons) {
    d.weapons = base.weapons.map((w) => Object.assign({}, w, {
      damage: Math.round(w.damage * m.damage),
      range: Math.round(w.range * m.range),
    }));
  }
  d.maxWeaponRange = d.weapons ? d.weapons.reduce((a, w) => Math.max(a, w.range), 0) : 0;
  d.footprintPx = base.footprint ? base.footprint * BUILD_CELL : 0;
  if (base.kind === 'building') d.radius = d.footprintPx * 0.5;
  d.wreckMetal = Math.round(d.metal * (base.wreckFraction !== undefined ? base.wreckFraction : 0.4));

  resolved.set(key, d);
  return d;
}

/** Hotkey hints shown in the build menu, roughly in BAR's layout spirit. */
export const BUILD_HOTKEYS = {
  mex: 'Q', solar: 'W', wind: 'E', converter: 'R',
  estore: 'T', mstore: 'Y', botlab: 'A', advbotlab: 'S',
  nano: 'D', llt: 'F', hlt: 'G', radar: 'C',
  conbot: 'Q', scout: 'W', rifle: 'E', rocket: 'R',
  adv_conbot: 'Q', heavy: 'E', siege: 'R',
};
