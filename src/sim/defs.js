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
  // Air, and the guns that answer it. `targets` is what makes an aircraft a
  // real unit type rather than a fast ground one: almost nothing can elevate
  // onto it, so a player who ignores anti-air gets taken apart from above.
  aaFlak: {
    name: 'Flak Battery', kind: 'plasma', damage: 88, reload: 0.75,
    range: 420, speed: 900, aoe: 40, spread: 0.04, color: '#ffd27a',
    targets: 'air',
  },
  aaMissile: {
    name: 'SAM Rack', kind: 'missile', damage: 140, reload: 2.1,
    range: 520, speed: 520, aoe: 26, spread: 0.01, color: '#9fe8ff',
    targets: 'air',
  },
  aaCannon: {
    name: 'Autocannon', kind: 'laser', damage: 26, reload: 0.2,
    range: 360, speed: 1500, aoe: 0, spread: 0.05, color: '#ffe08a',
    targets: 'air',
  },
  interceptorGun: {
    name: 'Interceptor Cannon', kind: 'laser', damage: 34, reload: 0.28,
    range: 300, speed: 1700, aoe: 0, spread: 0.035, color: '#bfe9ff',
    targets: 'air',
  },
  bombBay: {
    name: 'Bomb Bay', kind: 'arty', damage: 300, reload: 4.2,
    range: 150, speed: 300, aoe: 110, spread: 0.02, color: '#ffb257',
  },
  gunship: {
    name: 'Gunship Rockets', kind: 'missile', damage: 78, reload: 1.6,
    range: 300, speed: 400, aoe: 30, spread: 0.03, color: '#ff9a5b',
    targets: 'both',
  },

  // Blight: teeth and bile. Short reach, quick cycle, and the ones marked
  // `infects` take the killed unit rather than leaving a wreck.
  hiveLash: {
    name: 'Hive Lash', kind: 'plasma', damage: 230, reload: 1.2,
    range: 240, speed: 540, aoe: 38, spread: 0.02, color: '#b6ff6a',
  },
  claw: {
    name: 'Rending Claw', kind: 'laser', damage: 14, reload: 0.32,
    range: 145, speed: 1500, aoe: 0, spread: 0.05, color: '#a6f25a',
    infects: 0.55,
  },
  talon: {
    name: 'Talon', kind: 'laser', damage: 32, reload: 0.64,
    range: 175, speed: 1400, aoe: 0, spread: 0.035, color: '#8fe84a',
    infects: 0.45,
  },
  acidSpit: {
    name: 'Acid Spit', kind: 'missile', damage: 86, reload: 1.8,
    range: 290, speed: 360, aoe: 30, spread: 0.03, color: '#d4ff5e',
    infects: 0.22,
  },
  rendMaw: {
    name: 'Rending Maw', kind: 'laser', damage: 72, reload: 0.85,
    range: 215, speed: 1500, aoe: 0, spread: 0.02, color: '#9bf05a',
    infects: 0.38,
  },
  bileLob: {
    // No infection: a siege weapon that converted at range would never have
    // to take a risk for it.
    name: 'Bile Lob', kind: 'arty', damage: 175, reload: 3.6,
    range: 640, speed: 400, aoe: 104, spread: 0.05, color: '#ccff8a',
  },
  thornSpike: {
    name: 'Thorn Spike', kind: 'laser', damage: 60, reload: 0.6,
    range: 270, speed: 1600, aoe: 0, spread: 0.0, color: '#8fe84a',
  },
  mawBlast: {
    name: 'Maw Blast', kind: 'plasma', damage: 150, reload: 1.5,
    range: 420, speed: 500, aoe: 60, spread: 0.025, color: '#b6ff6a',
  },

  // Infantry small arms. Short reach and thin damage per shot, but a squad
  // arrives as eight of them at once, and every one of these is an
  // anti-infantry weapon in its own right -- troops are each other's answer.
  serviceRifle: {
    name: 'Service Rifle', kind: 'laser', damage: 8, reload: 0.55,
    range: 165, speed: 1500, aoe: 0, spread: 0.07, color: '#ffe9a8',
    vs: { infantry: 1.55 },
  },
  squadLauncher: {
    name: 'Shoulder Launcher', kind: 'missile', damage: 54, reload: 2.9,
    range: 255, speed: 380, aoe: 14, spread: 0.04, color: '#ffab6a',
    // A rocket made to kill armour, carried by someone who cannot take a hit.
    vs: { infantry: 0.6 },
  },
  squadMg: {
    name: 'Support Gun', kind: 'laser', damage: 6, reload: 0.24,
    range: 180, speed: 1700, aoe: 0, spread: 0.08, color: '#fff2c4',
    vs: { infantry: 1.7 },
  },
  squadStinger: {
    name: 'Shoulder SAM', kind: 'missile', damage: 62, reload: 2.2,
    range: 400, speed: 540, aoe: 12, spread: 0.02, color: '#a8e6ff',
    targets: 'air',
  },
  swarmerBite: {
    name: 'Swarmer Bite', kind: 'laser', damage: 6, reload: 0.5,
    range: 130, speed: 1500, aoe: 0, spread: 0.07, color: '#a6f25a',
    // A tenth of the infection chance the bigger teeth carry: ten mouths
    // biting at a hive weapon's usual rate would convert an entire army in a
    // single engagement, which is a win condition rather than a mechanic.
    infects: 0.12, vs: { infantry: 1.55 },
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
 * Armour classes, and what each weapon does to them.
 *
 * A shell sized to crack a tank passes straight through a squad of troops and
 * buries itself in the dirt; a machine gun that barely scratches armour plate
 * cuts the same squad apart. Without that, infantry would just be small tanks
 * with worse numbers, and there would be no reason to build any. `vs` on a
 * weapon is the multiplier applied to a target of that armour class, so the
 * table below is the whole counter triangle in one place:
 *
 *   heavy guns  ->  poor against infantry, good against armour
 *   small arms  ->  good against infantry, poor against armour
 *   splash      ->  good against infantry, fair against armour
 *
 * `standard` is the default class and takes every weapon at face value, so
 * nothing outside this table changes behaviour.
 */
export const ARMOUR_INFANTRY = 'infantry';
export const ARMOUR_STANDARD = 'standard';

/** Multiplier for `weapon` landing on a target of `armour`. 1 when unstated. */
export function armourScale(weapon, armour) {
  if (!armour || armour === ARMOUR_STANDARD) return 1;
  const vs = weapon && weapon.vs;
  if (!vs) return 1;
  const m = vs[armour];
  return m === undefined ? 1 : m;
}

// Applied to the weapon table above rather than written into each entry, so
// the numbers stay readable and a weapon's class is a single fact about it.
const ANTI_INFANTRY = { infantry: 1.55 };   // small arms: what they are for
const SPLASH_INFANTRY = { infantry: 1.25 }; // blast does not care about size
const HEAVY_INFANTRY = { infantry: 0.45 };  // punches through, wastes the shell
const SIEGE_INFANTRY = { infantry: 0.8 };   // big blast, badly aimed at movers

for (const [names, vs] of [
  [['lightLaser', 'rifleLaser', 'machineGun', 'aaCannon', 'interceptorGun',
    'towerLaser', 'claw', 'talon', 'thornSpike'], ANTI_INFANTRY],
  [['rocketPod', 'flakTower', 'aaFlak', 'gunship', 'autocannon', 'acidSpit',
    'mawBlast'], SPLASH_INFANTRY],
  [['tankCannon', 'heavyCannon', 'heavyLaser', 'missileRack', 'commanderCannon',
    'commandGun', 'hiveLash', 'rendMaw', 'bastionGun', 'aaMissile'], HEAVY_INFANTRY],
  [['siegeGun', 'howitzer', 'bileLob', 'bombBay'], SIEGE_INFANTRY],
]) {
  for (const name of names) {
    if (!W[name]) throw new Error(`armour table names a weapon that is gone: ${name}`);
    W[name].vs = vs;
  }
}

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
      'barracks', 'botlab', 'airpad', 'nano', 'llt', 'aatower', 'radar',
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
      'barracks', 'botlab', 'airpad', 'nano', 'llt', 'aatower', 'radar',
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
      'barracks', 'botlab', 'advbotlab', 'nano', 'llt', 'hlt', 'radar',
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
      'con_battery', 'con_silo', 'con_barracks', 'con_yard', 'con_crane',
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
      'con_battery', 'con_silo', 'con_barracks', 'con_yard', 'con_crane',
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
      'con_battery', 'con_silo', 'con_barracks', 'con_yard', 'con_works', 'con_crane',
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


  // ------------------------------------------------------------------- air
  //
  // Aircraft do not path and do not collide with the ground, so the map is not
  // in their way; what holds them back is that they cannot stop, and that
  // anti-air outranges them. `orbit` is the circle they hold when they have
  // nowhere to be, and `altitude` the height the renderer lifts them to.

  airpad: {
    id: 'airpad', name: 'Aircraft Plant', short: 'AIR', kind: 'building',
    tier: 1, metal: 680, energy: 1400, buildTime: 7000,
    hp: 2600, footprint: 6, los: 260,
    buildPower: 100, factory: true,
    desc: 'Produces aircraft. They fly straight over anything in the way.',
    build: ['gnat', 'harrier', 'hammerhead'],
  },
  aatower: {
    id: 'aatower', name: 'Flak Tower', short: 'FLK', kind: 'building',
    tier: 1, metal: 210, energy: 900, buildTime: 2600,
    hp: 1150, footprint: 2, los: 420,
    weapons: [W.aaFlak],
    desc: 'Shoots at aircraft and nothing else. Without one you have no answer to them.',
  },
  gnat: {
    id: 'gnat', name: 'Gnat', short: 'GNT', kind: 'unit', layer: 'air',
    role: 'fighter', tier: 1,
    metal: 110, energy: 240, buildTime: 2100,
    hp: 300, radius: 11, speed: 210, turnRate: 2.6, accel: 400,
    altitude: 110, orbit: 130,
    los: 520, mass: 1,
    weapons: [W.interceptorGun],
    wreckFraction: 0.0,
    desc: 'Interceptor. Fast, fragile, and the only cheap answer to enemy air.',
  },
  harrier: {
    id: 'harrier', name: 'Harrier', short: 'HAR', kind: 'unit', layer: 'air',
    role: 'gunship', tier: 1,
    metal: 220, energy: 460, buildTime: 3400,
    hp: 520, radius: 12, speed: 150, turnRate: 2.0, accel: 320,
    altitude: 85, orbit: 110,
    los: 480, mass: 1.4,
    weapons: [W.gunship],
    wreckFraction: 0.0,
    desc: 'Gunship. Shoots at both layers, and can hold a position by circling it.',
  },
  hammerhead: {
    id: 'hammerhead', name: 'Hammerhead', short: 'HMR', kind: 'unit', layer: 'air',
    role: 'bomber', tier: 2,
    metal: 520, energy: 1100, buildTime: 6200,
    hp: 760, radius: 14, speed: 175, turnRate: 1.5, accel: 280,
    altitude: 130, orbit: 170,
    los: 460, mass: 2.2,
    weapons: [W.bombBay],
    wreckFraction: 0.0,
    desc: 'Bomber. One heavy pass, then a long turn to come round again.',
  },

  con_apron: {
    id: 'con_apron', name: 'Airfield', short: 'FLD', kind: 'building',
    tier: 1, metal: 780, energy: 1550, buildTime: 7800,
    hp: 3000, footprint: 6, los: 260,
    buildPower: 112, factory: true,
    desc: 'Assembles aircraft. Slower than a plant, and tougher.',
    build: ['con_needle', 'con_vulture', 'con_anvil'],
  },
  con_battery_aa: {
    id: 'con_battery_aa', name: 'AA Battery', short: 'AAB', kind: 'building',
    tier: 1, metal: 230, energy: 940, buildTime: 2800,
    hp: 1250, footprint: 2, los: 440,
    weapons: [W.aaMissile],
    desc: 'Guided anti-air. Longer reach than flak, slower to cycle.',
  },
  con_needle: {
    id: 'con_needle', name: 'Needle', short: 'NDL', kind: 'unit', layer: 'air',
    role: 'fighter', tier: 1,
    metal: 125, energy: 260, buildTime: 2300,
    hp: 340, radius: 11, speed: 200, turnRate: 2.4, accel: 400,
    altitude: 110, orbit: 130,
    los: 520, mass: 1.1,
    weapons: [W.interceptorGun],
    wreckFraction: 0.0,
    desc: 'Interceptor. Crewed, so a little tougher and a little slower.',
  },
  con_vulture: {
    id: 'con_vulture', name: 'Vulture', short: 'VLT', kind: 'unit', layer: 'air',
    role: 'gunship', tier: 1,
    metal: 245, energy: 500, buildTime: 3700,
    hp: 600, radius: 13, speed: 140, turnRate: 1.9, accel: 300,
    altitude: 85, orbit: 110,
    los: 480, mass: 1.6,
    weapons: [W.gunship],
    wreckFraction: 0.0,
    desc: 'Attack helicopter. Hangs over a fight and works both layers.',
  },
  con_anvil: {
    id: 'con_anvil', name: 'Anvil', short: 'ANV', kind: 'unit', layer: 'air',
    role: 'bomber', tier: 2,
    metal: 560, energy: 1180, buildTime: 6600,
    hp: 880, radius: 15, speed: 165, turnRate: 1.4, accel: 260,
    altitude: 130, orbit: 175,
    los: 460, mass: 2.4,
    weapons: [W.bombBay],
    wreckFraction: 0.0,
    desc: 'Heavy bomber. Flattens a building a pass, if it survives the run in.',
  },

  bl_roost: {
    id: 'bl_roost', name: 'Roost', short: 'RST', kind: 'building',
    tier: 1, metal: 640, energy: 1320, buildTime: 6800,
    hp: 2500, footprint: 6, los: 260,
    buildPower: 96, factory: true,
    desc: 'Hatches flying brood.',
    build: ['bl_midge', 'bl_wing', 'bl_gorger'],
  },
  bl_spitter_aa: {
    id: 'bl_spitter_aa', name: 'Spore Thrower', short: 'SPR', kind: 'building',
    tier: 1, metal: 205, energy: 880, buildTime: 2500,
    hp: 1120, footprint: 2, los: 420,
    weapons: [W.aaCannon],
    desc: 'Throws spores at anything overhead. Rapid, and short of reach.',
  },
  bl_midge: {
    id: 'bl_midge', name: 'Midge', short: 'MDG', kind: 'unit', layer: 'air',
    role: 'fighter', tier: 1,
    metal: 104, energy: 225, buildTime: 2000,
    hp: 300, radius: 10, speed: 215, turnRate: 2.8, accel: 420,
    altitude: 105, orbit: 125,
    los: 520, mass: 0.9,
    weapons: [W.interceptorGun],
    wreckFraction: 0.0,
    desc: 'Swarming interceptor. Cheap enough to lose.',
  },
  bl_wing: {
    id: 'bl_wing', name: 'Wing', short: 'WNG', kind: 'unit', layer: 'air',
    role: 'gunship', tier: 1,
    metal: 215, energy: 450, buildTime: 3300,
    hp: 540, radius: 12, speed: 155, turnRate: 2.1, accel: 330,
    altitude: 85, orbit: 105,
    los: 480, mass: 1.3,
    weapons: [W.gunship],
    wreckFraction: 0.0,
    desc: 'Flying brood that works both layers.',
  },
  bl_gorger: {
    id: 'bl_gorger', name: 'Gorger', short: 'GRG', kind: 'unit', layer: 'air',
    role: 'bomber', tier: 2,
    metal: 505, energy: 1060, buildTime: 6000,
    hp: 800, radius: 14, speed: 180, turnRate: 1.6, accel: 290,
    altitude: 130, orbit: 165,
    los: 460, mass: 2.1,
    weapons: [W.bombBay],
    wreckFraction: 0.0,
    desc: 'Drops its load in one pass and labours round for another.',
  },

  // -------------------------------------------------------------- infantry
  //
  // Infantry are not small tanks. Three things separate them, and all three
  // have to be true at once or there is no reason to build any:
  //
  //   armour   a tank shell passes through them; a machine gun does not (see
  //            the armour table above)
  //   squads   a barracks order produces `squad` of them at once, so they
  //            arrive as a body of troops rather than as a trickle
  //   footing  they cross rock that no vehicle or walker can climb, which
  //            turns the broken ground the maps are full of into a route
  //
  // They are cheap and they die easily. What they buy is ground.

  barracks: {
    id: 'barracks', name: 'Barracks', short: 'BKS', kind: 'building',
    tier: 1, metal: 320, energy: 620, buildTime: 3600,
    hp: 2100, footprint: 5, los: 240,
    buildPower: 90, factory: true,
    desc: 'Trains infantry squads. Cheaper and quicker to raise than a bot lab.',
    build: ['trooper', 'lancer', 'marksman'],
  },
  trooper: {
    id: 'trooper', name: 'Trooper Squad', short: 'TRP', kind: 'unit',
    role: 'assault', tier: 1, armour: 'infantry', squad: 6,
    metal: 152, energy: 230, buildTime: 2900,
    hp: 84, radius: 6, speed: 58, turnRate: 12, accel: 300,
    los: 400, mass: 0.35,
    weapons: [W.serviceRifle],
    wreckFraction: 0.0,
    desc: 'Six riflemen. Individually nothing; as a squad they hold ground and cross rock.',
  },
  lancer: {
    id: 'lancer', name: 'Lancer Squad', short: 'LNC', kind: 'unit',
    role: 'skirmisher', tier: 1, armour: 'infantry', squad: 4,
    metal: 186, energy: 330, buildTime: 3400,
    hp: 78, radius: 6, speed: 52, turnRate: 12, accel: 300,
    los: 440, mass: 0.35,
    weapons: [W.squadLauncher],
    wreckFraction: 0.0,
    desc: 'Four rocket troops. They open armour and fold instantly under return fire.',
  },
  marksman: {
    id: 'marksman', name: 'Support Squad', short: 'SUP', kind: 'unit',
    role: 'support', tier: 1, armour: 'infantry', squad: 3,
    metal: 172, energy: 290, buildTime: 3100,
    hp: 88, radius: 6, speed: 46, turnRate: 11, accel: 260,
    los: 460, mass: 0.4,
    weapons: [W.squadMg, W.squadStinger],
    wreckFraction: 0.0,
    desc: 'Support gunners with a shoulder SAM. The only infantry that can touch aircraft.',
  },

  // Concord field the real thing: conscripts with rifles. Their squads are
  // larger and cheaper than anyone else's, which is the whole identity of a
  // faction that has people to spend and not much else.
  con_barracks: {
    id: 'con_barracks', name: 'Muster Hall', short: 'MST', kind: 'building',
    tier: 1, metal: 300, energy: 560, buildTime: 3300,
    hp: 2300, footprint: 5, los: 240,
    buildPower: 96, factory: true,
    desc: 'Musters infantry. The cheapest way Concord has of putting bodies on the map.',
    build: ['con_rifles', 'con_at', 'con_aa_team'],
  },
  con_rifles: {
    id: 'con_rifles', name: 'Rifle Platoon', short: 'RFL', kind: 'unit',
    role: 'assault', tier: 1, armour: 'infantry', squad: 8,
    metal: 178, energy: 250, buildTime: 3200,
    hp: 80, radius: 6, speed: 55, turnRate: 12, accel: 300,
    los: 400, mass: 0.35,
    weapons: [W.serviceRifle],
    wreckFraction: 0.0,
    desc: 'Eight rifles. Cheap, expendable, and there are always more.',
  },
  con_at: {
    id: 'con_at', name: 'AT Team', short: 'ATT', kind: 'unit',
    role: 'skirmisher', tier: 1, armour: 'infantry', squad: 4,
    metal: 182, energy: 320, buildTime: 3350,
    hp: 76, radius: 6, speed: 50, turnRate: 12, accel: 300,
    los: 440, mass: 0.35,
    weapons: [W.squadLauncher],
    wreckFraction: 0.0,
    desc: 'Anti-tank teams. A handful of them will stop an armoured push cold.',
  },
  con_aa_team: {
    id: 'con_aa_team', name: 'SAM Team', short: 'SAM', kind: 'unit',
    role: 'support', tier: 1, armour: 'infantry', squad: 3,
    metal: 176, energy: 330, buildTime: 3200,
    hp: 80, radius: 6, speed: 48, turnRate: 11, accel: 280,
    los: 470, mass: 0.4,
    weapons: [W.squadStinger, W.squadMg],
    wreckFraction: 0.0,
    desc: 'Mobile anti-air that walks with the army instead of waiting at home.',
  },

  // ----------------------------------------------------------- Blight
  //
  // A hive rather than an army. Everything is cheap, quick and short-ranged,
  // and its teeth take what they kill: see `infects` on the weapons above and
  // the conversion rule in world.js. Its structures are grown rather than
  // built, which is flavour - they cost and behave like anyone else's, because
  // the AI's build order reasons about roster slots and would have to be
  // taught a second economy otherwise.

  bl_hive: {
    id: 'bl_hive', name: 'Hive Mind', short: 'HIVE', kind: 'unit',
    role: 'builder', tier: 1, isCommander: true,
    metal: 2500, energy: 25000, buildTime: 75000,
    hp: 3400, radius: 16, speed: 36, turnRate: 4.2, accel: 130,
    buildPower: 300, buildRange: 145,
    los: 560, mass: 4,
    energyPerSecond: 22, flatMetalPerSecond: 2.0,
    weapons: [W.hiveLash],
    wreckFraction: 0.0,
    desc: 'The colony made mobile. Lose it and the hive dies with it.',
    build: [
      'bl_tap', 'bl_vent', 'bl_gut', 'bl_bladder', 'bl_sac',
      'bl_brood', 'bl_pit', 'bl_roost', 'bl_spire', 'bl_thorn', 'bl_spitter_aa',
      'bl_antenna',
    ],
  },

  bl_tap: {
    id: 'bl_tap', name: 'Spore Tap', short: 'TAP', kind: 'building',
    tier: 1, metal: 50, energy: 500, buildTime: 1800,
    hp: 600, footprint: 3, los: 200,
    needsMetalSpot: true, metalPerSecond: 1.8,
    desc: 'Draws metal from a deposit. Build on every one you can hold.',
  },
  bl_vent: {
    id: 'bl_vent', name: 'Biomass Vent', short: 'VNT', kind: 'building',
    tier: 1, metal: 175, energy: 0, buildTime: 2900,
    hp: 1050, footprint: 4, los: 160,
    energyPerSecond: 22,
    desc: 'Steady energy, and the only structure that costs none to grow.',
  },
  bl_bloom: {
    id: 'bl_bloom', name: 'Bloom', short: 'BLM', kind: 'building',
    tier: 2, metal: 1850, energy: 3100, buildTime: 22000,
    hp: 3100, footprint: 5, los: 240,
    energyPerSecond: 240,
    desc: 'A mid-game commitment. Pays for a war once the metal is flowing.',
  },
  bl_gut: {
    id: 'bl_gut', name: 'Digestion Gut', short: 'GUT', kind: 'building',
    tier: 1, metal: 60, energy: 1150, buildTime: 2600,
    hp: 760, footprint: 3, los: 140,
    convertsEnergy: 70, convertsToMetal: 1,
    desc: 'Turns surplus energy into metal. Worth it only once energy is spare.',
  },
  bl_sac: {
    id: 'bl_sac', name: 'Metal Sac', short: 'SAC', kind: 'building',
    tier: 1, metal: 280, energy: 410, buildTime: 1500,
    hp: 1400, footprint: 3, los: 140,
    metalStorage: 3000,
    desc: 'Room to bank metal instead of wasting it.',
  },
  bl_bladder: {
    id: 'bl_bladder', name: 'Energy Bladder', short: 'BLD', kind: 'building',
    tier: 1, metal: 55, energy: 900, buildTime: 1500,
    hp: 1400, footprint: 3, los: 140,
    energyStorage: 3000,
    desc: 'Room to bank energy. Cheap, and it stops a stall becoming a stop.',
  },
  bl_antenna: {
    id: 'bl_antenna', name: 'Sense Organ', short: 'SNS', kind: 'building',
    tier: 1, metal: 60, energy: 350, buildTime: 1100,
    hp: 300, footprint: 2, los: 320, radar: 1500,
    desc: 'Feels movement well beyond sight, without seeing what it is.',
  },

  bl_pit: {
    id: 'bl_pit', name: 'Spawning Pit', short: 'PIT', kind: 'building',
    tier: 1, metal: 620, energy: 1150, buildTime: 6200,
    hp: 2700, footprint: 6, los: 240,
    buildPower: 100, factory: true,
    desc: 'Grows tier 1 broods. Queue them and set a rally point.',
    build: ['bl_tender', 'bl_skitter', 'bl_husk', 'bl_spitter'],
  },
  bl_deeppit: {
    id: 'bl_deeppit', name: 'Deep Pit', short: 'DPT', kind: 'building',
    tier: 2, metal: 2500, energy: 5000, buildTime: 20500,
    hp: 4600, footprint: 7, los: 280,
    buildPower: 172, factory: true,
    desc: 'Grows the heavy brood.',
    build: ['bl_tender2', 'bl_brute', 'bl_lobber'],
  },
  bl_spire: {
    id: 'bl_spire', name: 'Nanospire', short: 'SPR', kind: 'building',
    tier: 1, metal: 128, energy: 640, buildTime: 3200,
    hp: 460, footprint: 2, los: 180,
    buildPower: 72, buildRange: 300, assistOnly: true,
    desc: 'Fixed build power. Grow them beside a pit to hurry the brood along.',
  },
  bl_thorn: {
    id: 'bl_thorn', name: 'Thorn', short: 'THN', kind: 'building',
    tier: 1, metal: 135, energy: 620, buildTime: 1800,
    hp: 1250, footprint: 2, los: 300,
    weapons: [W.thornSpike],
    desc: 'A cheap spine that holds ground against raiders.',
  },
  bl_maw: {
    id: 'bl_maw', name: 'Great Maw', short: 'MAW', kind: 'building',
    tier: 2, metal: 680, energy: 3300, buildTime: 6800,
    hp: 3300, footprint: 3, los: 380,
    weapons: [W.mawBlast],
    desc: 'Heavy emplacement. Outranges most things that walk at it.',
  },

  bl_tender: {
    id: 'bl_tender', name: 'Tender', short: 'TND', kind: 'unit',
    role: 'builder', tier: 1,
    metal: 112, energy: 205, buildTime: 3000,
    hp: 400, radius: 10, speed: 48, turnRate: 7, accel: 210,
    buildPower: 78, buildRange: 125,
    los: 340, mass: 1.3,
    desc: 'Grows structures and helps at a pit. Keep every one of them busy.',
  },
  bl_tender2: {
    id: 'bl_tender2', name: 'Greater Tender', short: 'TN2', kind: 'unit',
    role: 'builder', tier: 2,
    metal: 265, energy: 630, buildTime: 6700,
    hp: 740, radius: 12, speed: 44, turnRate: 6.4, accel: 195,
    buildPower: 175, buildRange: 165,
    los: 380, mass: 2,
    desc: 'More build power, and the only thing that can grow a deep pit.',
    build: ['bl_tap', 'bl_vent', 'bl_bloom', 'bl_gut', 'bl_bladder', 'bl_sac',
      'bl_brood', 'bl_pit', 'bl_deeppit', 'bl_roost', 'bl_spire', 'bl_thorn', 'bl_spitter_aa',
      'bl_maw', 'bl_antenna'],
  },
  bl_skitter: {
    id: 'bl_skitter', name: 'Skitter', short: 'SKT', kind: 'unit',
    role: 'raider', tier: 1,
    metal: 60, energy: 100, buildTime: 1250,
    hp: 250, radius: 8, speed: 100, turnRate: 10, accel: 330,
    los: 420, mass: 0.8,
    weapons: [W.claw],
    desc: 'Fast and frail. Runs down builders and takes them whole.',
  },
  bl_husk: {
    id: 'bl_husk', name: 'Husk', short: 'HSK', kind: 'unit',
    role: 'assault', tier: 1,
    metal: 88, energy: 148, buildTime: 1560,
    hp: 620, radius: 10, speed: 50, turnRate: 7.4, accel: 230,
    los: 400, mass: 1.4,
    weapons: [W.talon],
    desc: 'The body of the swarm. Cheap, quick, and hungry at close range.',
  },
  bl_spitter: {
    id: 'bl_spitter', name: 'Spitter', short: 'SPT', kind: 'unit',
    role: 'skirmisher', tier: 1,
    metal: 155, energy: 280, buildTime: 2500,
    hp: 540, radius: 10, speed: 42, turnRate: 6.6, accel: 205,
    los: 440, mass: 1.5,
    weapons: [W.acidSpit],
    desc: 'Lobs acid over the front rank. Rarely takes what it kills.',
  },
  bl_brute: {
    id: 'bl_brute', name: 'Brute', short: 'BRT', kind: 'unit',
    role: 'heavy', tier: 2,
    metal: 960, energy: 1600, buildTime: 9400,
    hp: 3700, radius: 15, speed: 34, turnRate: 4.6, accel: 165,
    los: 430, mass: 3.4,
    weapons: [W.rendMaw],
    desc: 'Walks into a line and comes out the far side with recruits.',
  },
  bl_lobber: {
    id: 'bl_lobber', name: 'Lobber', short: 'LOB', kind: 'unit',
    role: 'artillery', tier: 2,
    metal: 760, energy: 1450, buildTime: 8600,
    hp: 1080, radius: 13, speed: 29, turnRate: 3.6, accel: 120,
    los: 380, mass: 2.8,
    weapons: [W.bileLob],
    desc: 'Breaks emplacements from outside their reach. Helpless up close.',
  },
  // The hive's infantry are a swarm: the largest squads in the game, the
  // cheapest bodies, and teeth that keep what they kill. A brood that catches
  // a squad of anyone else's troops comes out the other side larger.
  bl_brood: {
    id: 'bl_brood', name: 'Brood Pit', short: 'BRD', kind: 'building',
    tier: 1, metal: 280, energy: 520, buildTime: 3100,
    hp: 2000, footprint: 5, los: 230,
    buildPower: 88, factory: true,
    desc: 'Spawns swarms. The cheapest structure that produces anything at all.',
    build: ['bl_swarmer', 'bl_barbs', 'bl_screamer'],
  },
  bl_swarmer: {
    id: 'bl_swarmer', name: 'Swarm', short: 'SWM', kind: 'unit',
    role: 'assault', tier: 1, armour: 'infantry', squad: 10,
    metal: 168, energy: 215, buildTime: 3000,
    hp: 62, radius: 5, speed: 66, turnRate: 14, accel: 340,
    los: 360, mass: 0.3,
    weapons: [W.swarmerBite],
    wreckFraction: 0.0,
    desc: 'Ten of them, and each bite can take what it kills.',
  },
  bl_barbs: {
    id: 'bl_barbs', name: 'Barb Cluster', short: 'BRB', kind: 'unit',
    role: 'skirmisher', tier: 1, armour: 'infantry', squad: 4,
    metal: 180, energy: 305, buildTime: 3300,
    hp: 74, radius: 6, speed: 54, turnRate: 12, accel: 300,
    los: 420, mass: 0.35,
    weapons: [W.squadLauncher],
    wreckFraction: 0.0,
    desc: 'Spits a barb heavy enough to open a hull. Nothing to it but the spit.',
  },
  bl_screamer: {
    id: 'bl_screamer', name: 'Screamer', short: 'SCR', kind: 'unit',
    role: 'support', tier: 1, armour: 'infantry', squad: 3,
    metal: 178, energy: 320, buildTime: 3200,
    hp: 78, radius: 6, speed: 50, turnRate: 11, accel: 280,
    los: 450, mass: 0.4,
    weapons: [W.squadStinger, W.squadMg],
    wreckFraction: 0.0,
    desc: 'Screams something down out of the sky. The hive walking with its own anti-air.',
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
      airFactory: 'airpad', antiAir: 'aatower',
      fighter: 'gnat', gunship: 'harrier', bomber: 'hammerhead',
      barracks: 'barracks', trooper: 'trooper', lancer: 'lancer',
      aaInfantry: 'marksman',
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
      airFactory: 'airpad', antiAir: 'aatower',
      fighter: 'gnat', gunship: 'harrier', bomber: 'hammerhead',
      barracks: 'barracks', trooper: 'trooper', lancer: 'lancer',
      aaInfantry: 'marksman',
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
      airFactory: 'con_apron', antiAir: 'con_battery_aa',
      fighter: 'con_needle', gunship: 'con_vulture', bomber: 'con_anvil',
      barracks: 'con_barracks', trooper: 'con_rifles', lancer: 'con_at',
      aaInfantry: 'con_aa_team',
    },
  },
  blight: {
    id: 'blight', name: 'Blight',
    blurb: 'A hive. Thick-skinned and short-ranged: it walks through your fire, and its teeth keep what they kill.',
    mods: { hp: 1.34, speed: 1.12, damage: 1, range: 0.95, cost: 1 },
    // Its structures and bodies infect the ground they stand on; see creep.js.
    spreadsCreep: true,
    roster: {
      commander: 'bl_hive',
      builder: 'bl_tender', builderT2: 'bl_tender2',
      factory: 'bl_pit', factoryT2: 'bl_deeppit',
      mex: 'bl_tap', energy: 'bl_vent', energyAlt: null,
      energyBig: 'bl_bloom',
      converter: 'bl_gut', mstore: 'bl_sac', estore: 'bl_bladder',
      nano: 'bl_spire', defence: 'bl_thorn', defenceT2: 'bl_maw',
      radar: 'bl_antenna',
      raider: 'bl_skitter', assault: 'bl_husk', skirmisher: 'bl_spitter',
      heavy: 'bl_brute', artillery: 'bl_lobber',
      airFactory: 'bl_roost', antiAir: 'bl_spitter_aa',
      fighter: 'bl_midge', gunship: 'bl_wing', bomber: 'bl_gorger',
      barracks: 'bl_brood', trooper: 'bl_swarmer', lancer: 'bl_barbs',
      aaInfantry: 'bl_screamer',
    },
  },
};

export const FACTION_IDS = Object.keys(FACTIONS);

// How far, in build cells, each of the hive's things infects the ground around
// it. Applied here rather than written into thirty definitions: the rule is
// simple (structures reach past their footprint, bodies leave a trail, the
// hive itself is the wellspring) and the numbers only mean anything relative
// to each other.
for (const [id, d] of Object.entries(DEFS)) {
  if (!id.startsWith('bl_')) continue;
  if (d.isCommander) d.creep = 7;
  else if (d.kind === 'building') d.creep = Math.round(((d.footprint || 2) * 0.9 + 2.2) * 10) / 10;
  else if (d.layer === 'air') d.creep = 0;
  else d.creep = d.armour === 'infantry' ? 0.8 : 1.4;
}

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
  // Which layers this thing can shoot at, worked out once rather than walked
  // per tick: the AI reads it to decide whether it needs anti-air, and target
  // scoring reads it to know what an aircraft should kill first.
  d.layer = base.layer || 'ground';
  // Armour class decides what a shell landing on this thing is worth. Infantry
  // are the only class that differs from standard today, but the field is on
  // everything so the damage path never has to ask whether it exists.
  d.armour = base.armour || ARMOUR_STANDARD;
  d.isInfantry = d.armour === ARMOUR_INFANTRY;
  d.hitsAir = !!(d.weapons || []).some((w) => w.targets === 'air' || w.targets === 'both');
  d.hitsGround = !!(d.weapons || []).some((w) => (w.targets || 'ground') !== 'air');
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

  // Blight, on the same keys slot for slot again
  bl_tap: 'Q', bl_vent: 'W', bl_bloom: 'T', bl_gut: 'Y',
  bl_bladder: 'U', bl_sac: 'I',
  bl_pit: 'Z', bl_deeppit: 'X', bl_spire: 'C',
  bl_thorn: 'V', bl_maw: 'B', bl_antenna: 'N',
  bl_tender: 'Q', bl_skitter: 'W', bl_husk: 'T', bl_spitter: 'Y',
  bl_tender2: 'Q', bl_brute: 'T', bl_lobber: 'Y',
};
