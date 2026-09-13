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

  // Concord: crewed guns. Heavier shells, slower cycle, splash as standard.
  commandGun: {
    name: '120mm Command Gun', kind: 'plasma', damage: 280, reload: 1.3,
    range: 280, speed: 620, aoe: 46, spread: 0.015, color: '#ffd9a0',
  },
  machineGun: {
    name: 'Heavy Machine Gun', kind: 'laser', damage: 11, reload: 0.22,
    range: 190, speed: 1700, aoe: 0, spread: 0.06, color: '#fff0b8',
  },
  tankCannon: {
    name: '90mm Cannon', kind: 'plasma', damage: 92, reload: 1.5,
    range: 255, speed: 700, aoe: 18, spread: 0.02, color: '#ffcf8a',
  },
  heavyCannon: {
    name: '140mm Cannon', kind: 'plasma', damage: 105, reload: 1.0,
    range: 285, speed: 700, aoe: 30, spread: 0.018, color: '#ffc070',
  },
  missileRack: {
    name: 'Guided Missile Rack', kind: 'missile', damage: 135, reload: 2.0,
    range: 375, speed: 400, aoe: 40, spread: 0.015, color: '#ff9a5b',
  },
  autocannon: {
    name: 'Autocannon', kind: 'plasma', damage: 70, reload: 0.7,
    range: 300, speed: 900, aoe: 12, spread: 0.01, color: '#ffd24a',
  },
  bastionGun: {
    name: 'Bastion Cannon', kind: 'plasma', damage: 190, reload: 1.6,
    range: 480, speed: 640, aoe: 70, spread: 0.015, color: '#ffb45e',
  },
  howitzer: {
    name: 'Howitzer Battery', kind: 'arty', damage: 230, reload: 3.8,
    range: 800, speed: 430, aoe: 110, spread: 0.05, color: '#e8dcc0',
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
    role: 'builder', tier: 1, isCommander: true,
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

  // =========================================================== CONCORD
  // The human remnant. Crewed armour instead of nanolathe swarms: fewer,
  // tougher, costlier machines, ballistic guns with splash as standard, and
  // energy that comes in big lumps rather than fields of small panels.
  // Their builders are weaker than bots, and their fixed infrastructure -
  // vehicle yards and construction cranes - is stronger to compensate.

  con_commander: {
    id: 'con_commander', name: 'Command Vehicle', short: 'CMD', kind: 'unit',
    role: 'builder', tier: 1, isCommander: true, silhouette: 'command',
    metal: 2500, energy: 25000, buildTime: 75000,
    hp: 3600, radius: 16, speed: 34, turnRate: 2.6, accel: 110,
    buildPower: 300, buildRange: 145,
    los: 560, mass: 5,
    energyPerSecond: 22, flatMetalPerSecond: 2.0,
    weapons: [W.commandGun],
    wreckFraction: 0.0,
    desc: 'Your headquarters on tracks. Lose it and the campaign is over.',
    build: [
      'con_derrick', 'con_diesel', 'con_fusion', 'con_refinery',
      'con_battery', 'con_silo', 'con_yard', 'con_crane',
      'con_pillbox', 'con_radar',
    ],
  },

  // ------------------------------------------------------------- economy
  con_derrick: {
    id: 'con_derrick', name: 'Drilling Derrick', short: 'DRL', kind: 'building',
    tier: 1, silhouette: 'derrick',
    metal: 50, energy: 500, buildTime: 1800,
    hp: 640, footprint: 3, los: 210,
    needsMetalSpot: true, metalPerSecond: 1.8,
    desc: 'Must be placed on a metal spot. The backbone of your income.',
  },
  con_diesel: {
    id: 'con_diesel', name: 'Diesel Generator', short: 'GEN', kind: 'building',
    tier: 1, silhouette: 'generator',
    metal: 265, energy: 0, buildTime: 4200,
    hp: 1250, footprint: 3, los: 190,
    energyPerSecond: 32,
    desc: 'Costs no energy to build and packs 32 per second into three cells.',
  },
  con_fusion: {
    id: 'con_fusion', name: 'Fusion Reactor', short: 'FUS', kind: 'building',
    tier: 1, silhouette: 'reactor',
    metal: 1800, energy: 3000, buildTime: 22000,
    hp: 3200, footprint: 5, los: 250,
    energyPerSecond: 260,
    desc: 'One reactor replaces a field of generators. Expensive, and a target.',
  },
  con_refinery: {
    id: 'con_refinery', name: 'Ore Refinery', short: 'REF', kind: 'building',
    tier: 1, silhouette: 'refinery',
    metal: 65, energy: 1150, buildTime: 2600,
    hp: 800, footprint: 3, los: 160,
    convertsEnergy: 70, convertsToMetal: 1.0,
    desc: 'Burns 70 energy per second to make 1 metal per second.',
  },
  con_battery: {
    id: 'con_battery', name: 'Capacitor Bank', short: 'CAP', kind: 'building',
    tier: 1, silhouette: 'tank',
    metal: 55, energy: 900, buildTime: 1500,
    hp: 1400, footprint: 3, los: 160,
    energyStorage: 3000,
    desc: 'Adds 3000 energy storage to ride out a surge in demand.',
  },
  con_silo: {
    id: 'con_silo', name: 'Metal Silo', short: 'SIL', kind: 'building',
    tier: 1, silhouette: 'tank',
    metal: 280, energy: 410, buildTime: 1500,
    hp: 1400, footprint: 3, los: 160,
    metalStorage: 1000,
    desc: 'Adds 1000 metal storage.',
  },

  // ---------------------------------------------------------- production
  con_yard: {
    id: 'con_yard', name: 'Vehicle Yard', short: 'YRD', kind: 'building',
    tier: 1, silhouette: 'yard',
    metal: 700, energy: 1250, buildTime: 7000,
    hp: 3400, footprint: 6, los: 240,
    buildPower: 112, factory: true,
    desc: 'Builds faster than a bot lab. Concord assembles, it does not swarm.',
    build: ['con_engineer', 'con_jeep', 'con_tank', 'con_missile'],
  },
  con_works: {
    id: 'con_works', name: 'Armoured Works', short: 'WKS', kind: 'building',
    tier: 2, silhouette: 'yard',
    metal: 2700, energy: 5200, buildTime: 22000,
    hp: 5400, footprint: 7, los: 280,
    buildPower: 220, factory: true,
    desc: 'Tier 2 hulls: siege tanks and howitzers.',
    build: ['con_engineer2', 'con_heavytank', 'con_howitzer', 'con_tank'],
  },
  con_crane: {
    id: 'con_crane', name: 'Construction Crane', short: 'CRN', kind: 'building',
    tier: 1, silhouette: 'crane',
    metal: 130, energy: 640, buildTime: 3200,
    hp: 520, footprint: 2, los: 200,
    buildPower: 80, buildRange: 340, assistOnly: true,
    desc: 'Fixed build power. Concord leans on these harder than bots do.',
  },

  // ------------------------------------------------------------- defence
  con_pillbox: {
    id: 'con_pillbox', name: 'Gun Pillbox', short: 'PBX', kind: 'building',
    tier: 1, silhouette: 'bunker',
    metal: 145, energy: 620, buildTime: 1900,
    hp: 1450, footprint: 2, los: 330,
    weapons: [W.autocannon],
    desc: 'Dug-in autocannon. Tougher than a laser tower and it shreds raiders.',
  },
  con_bastion: {
    id: 'con_bastion', name: 'Bastion Cannon', short: 'BST', kind: 'building',
    tier: 2, silhouette: 'bunker',
    metal: 780, energy: 3600, buildTime: 7600,
    hp: 4000, footprint: 3, los: 500,
    weapons: [W.bastionGun],
    desc: 'Tier 2 emplacement with heavy splash and a long reach.',
  },
  con_radar: {
    id: 'con_radar', name: 'Sentry Radar', short: 'RAD', kind: 'building',
    tier: 1, silhouette: 'mast',
    metal: 65, energy: 350, buildTime: 1150,
    hp: 340, footprint: 2, los: 220, radar: 1750,
    desc: 'Reveals moving contacts as radar blips across a wide area.',
  },

  // -------------------------------------------------------------- hulls
  con_engineer: {
    id: 'con_engineer', name: 'Engineer Vehicle', short: 'ENG', kind: 'unit',
    role: 'builder', tier: 1, silhouette: 'engineer',
    metal: 135, energy: 240, buildTime: 3400,
    hp: 560, radius: 11, speed: 52, turnRate: 3.4, accel: 150,
    buildPower: 65, buildRange: 135, los: 400, mass: 2.0,
    weapons: [],
    desc: 'Builds, repairs and reclaims. Slower at it than a bot, and tougher.',
    build: [
      'con_derrick', 'con_diesel', 'con_fusion', 'con_refinery',
      'con_battery', 'con_silo', 'con_yard', 'con_crane',
      'con_pillbox', 'con_radar',
    ],
  },
  con_engineer2: {
    id: 'con_engineer2', name: 'Heavy Engineer', short: 'ENG2', kind: 'unit',
    role: 'builder', tier: 2, silhouette: 'engineer',
    metal: 300, energy: 700, buildTime: 7200,
    hp: 980, radius: 12, speed: 46, turnRate: 3.2, accel: 140,
    buildPower: 150, buildRange: 170, los: 440, mass: 2.6,
    weapons: [],
    desc: 'Tier 2 builder. Unlocks the Armoured Works and heavy emplacements.',
    build: [
      'con_derrick', 'con_diesel', 'con_fusion', 'con_refinery',
      'con_battery', 'con_silo', 'con_yard', 'con_works', 'con_crane',
      'con_pillbox', 'con_bastion', 'con_radar',
    ],
  },
  con_jeep: {
    id: 'con_jeep', name: 'Recon Jeep', short: 'JEP', kind: 'unit',
    role: 'raider', tier: 1, silhouette: 'jeep',
    metal: 70, energy: 110, buildTime: 1300,
    hp: 320, radius: 9, speed: 105, turnRate: 5.5, accel: 300,
    los: 720, mass: 1.0,
    weapons: [W.machineGun],
    desc: 'The fastest thing on the field, and the best pair of eyes you have.',
  },
  con_tank: {
    id: 'con_tank', name: 'Battle Tank', short: 'TNK', kind: 'unit',
    role: 'assault', tier: 1, silhouette: 'tank',
    metal: 165, energy: 250, buildTime: 2700,
    hp: 1300, radius: 12, speed: 45, turnRate: 3.0, accel: 160,
    los: 430, mass: 3.0,
    weapons: [W.tankCannon],
    desc: 'Your line of battle. Splash damage makes it brutal against crowds.',
  },
  con_missile: {
    id: 'con_missile', name: 'Missile Track', short: 'MSL', kind: 'unit',
    role: 'skirmisher', tier: 1, silhouette: 'missile',
    metal: 190, energy: 330, buildTime: 3100,
    hp: 780, radius: 11, speed: 41, turnRate: 3.2, accel: 140,
    los: 490, mass: 2.6,
    weapons: [W.missileRack],
    desc: 'Outranges tanks. Keep it behind the armour and it pays for itself.',
  },
  con_heavytank: {
    id: 'con_heavytank', name: 'Siege Tank', short: 'SGT', kind: 'unit',
    role: 'assault', tier: 2, silhouette: 'heavytank',
    metal: 1100, energy: 1750, buildTime: 10500,
    hp: 4600, radius: 15, speed: 31, turnRate: 2.4, accel: 110,
    los: 460, mass: 5.5,
    weapons: [W.heavyCannon, W.heavyCannon],
    desc: 'Tier 2 breakthrough hull. Twin cannon and armour to walk into fire.',
  },
  con_howitzer: {
    id: 'con_howitzer', name: 'Howitzer', short: 'HOW', kind: 'unit',
    role: 'artillery', tier: 2, silhouette: 'howitzer',
    metal: 820, energy: 1600, buildTime: 9000,
    hp: 1250, radius: 13, speed: 26, turnRate: 2.2, accel: 100,
    los: 520, mass: 3.4,
    weapons: [W.howitzer],
    desc: 'Flattens emplacements from outside their range. Helpless up close.',
  },
};

/**
 * Factions.
 *
 * `roster` maps generic slots to definition ids. Everything that reasons about
 * a faction without caring which one it is - the AI's build order, the opening
 * spawn, unit composition - goes through these slots, so adding a faction is a
 * matter of writing its definitions and listing them here.
 *
 * `mods` are stat multipliers applied on top of the definitions. Vanguard and
 * Legion share one bot roster and are separated by their modifiers; Concord has
 * its own hulls and so needs none.
 */
export const FACTIONS = {
  vanguard: {
    id: 'vanguard', name: 'Vanguard',
    blurb: 'Agile war machines. Better range and speed, thinner armour.',
    mods: { hp: 0.91, speed: 1.09, damage: 0.95, range: 1.06, cost: 0.985 },
    roster: {
      commander: 'commander',
      builder: 'conbot', builderT2: 'adv_conbot',
      factory: 'botlab', factoryT2: 'advbotlab',
      mex: 'mex', energy: 'solar', energyAlt: 'wind', energyBig: null,
      converter: 'converter', mstore: 'mstore', estore: 'estore',
      nano: 'nano', defence: 'llt', defenceT2: 'hlt', radar: 'radar',
      raider: 'scout', assault: 'rifle', skirmisher: 'rocket',
      heavy: 'heavy', artillery: 'siege',
    },
  },
  legion: {
    id: 'legion', name: 'Legion',
    blurb: 'Heavy war machines. More armour and punch, slower to move.',
    mods: { hp: 1.15, speed: 0.93, damage: 1.11, range: 0.98, cost: 1.015 },
    roster: {
      commander: 'commander',
      builder: 'conbot', builderT2: 'adv_conbot',
      factory: 'botlab', factoryT2: 'advbotlab',
      mex: 'mex', energy: 'solar', energyAlt: 'wind', energyBig: null,
      converter: 'converter', mstore: 'mstore', estore: 'estore',
      nano: 'nano', defence: 'llt', defenceT2: 'hlt', radar: 'radar',
      raider: 'scout', assault: 'rifle', skirmisher: 'rocket',
      heavy: 'heavy', artillery: 'siege',
    },
  },
  concord: {
    id: 'concord', name: 'Concord',
    blurb: 'The human remnant. Crewed armour, splash damage and dug-in guns.',
    mods: { hp: 1, speed: 1, damage: 1, range: 1, cost: 1 },
    roster: {
      commander: 'con_commander',
      builder: 'con_engineer', builderT2: 'con_engineer2',
      factory: 'con_yard', factoryT2: 'con_works',
      mex: 'con_derrick', energy: 'con_diesel', energyAlt: null,
      energyBig: 'con_fusion',
      converter: 'con_refinery', mstore: 'con_silo', estore: 'con_battery',
      nano: 'con_crane', defence: 'con_pillbox', defenceT2: 'con_bastion',
      radar: 'con_radar',
      raider: 'con_jeep', assault: 'con_tank', skirmisher: 'con_missile',
      heavy: 'con_heavytank', artillery: 'con_howitzer',
    },
  },
};

export const FACTION_IDS = Object.keys(FACTIONS);

/** The roster for a faction, falling back to Vanguard for an unknown id. */
export function rosterOf(factionId) {
  return (FACTIONS[factionId] || FACTIONS.vanguard).roster;
}

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

/**
 * Hotkeys shown on the build menu buttons. These deliberately avoid A/S/D/F/E/R,
 * which are reserved for the command hotkeys (attack-move, stop, guard,
 * patrol, reclaim, repair).
 */
export const BUILD_HOTKEYS = {
  // structures
  mex: 'Q', solar: 'W', wind: 'T', converter: 'Y', estore: 'U', mstore: 'I',
  botlab: 'Z', advbotlab: 'X', nano: 'C', llt: 'V', hlt: 'B', radar: 'N',
  // units
  conbot: 'Q', scout: 'W', rifle: 'T', rocket: 'Y',
  adv_conbot: 'Q', heavy: 'T', siege: 'Y',

  // Concord, on the same keys slot for slot
  con_derrick: 'Q', con_diesel: 'W', con_fusion: 'T', con_refinery: 'Y',
  con_battery: 'U', con_silo: 'I',
  con_yard: 'Z', con_works: 'X', con_crane: 'C',
  con_pillbox: 'V', con_bastion: 'B', con_radar: 'N',
  con_engineer: 'Q', con_jeep: 'W', con_tank: 'T', con_missile: 'Y',
  con_engineer2: 'Q', con_heavytank: 'T', con_howitzer: 'Y',
};
