// Every number that tunes SOLMAR — Vice Coast lives here, so the rest of the
// game never hard-codes a size, a speed or a colour. The world is one big
// top-down map; the screen shows a 1280x720 window that follows the player.

export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Seven avenues run north-south, five streets run east-west. */
export const AVENUES = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const STREETS = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 96;

/** East of this line the ground is sand; east of the second, it is sea. */
export const BEACH_X = 3080;
export const SEA_X = 3360;

/** Where the player starts: the garage forecourt, south of Reyes Garage. */
export const SPAWN = { x: 470, y: 560 };

export const PLAYER = {
  radius: 13,
  walk: 235,
  sprint: 350,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.45,
  shotCooldown: 0.22,
  bulletSpeed: 950,
  bulletDamage: 26,
  regenDelay: 5,
  regenRate: 2.5,
};

export const CAR = {
  radius: 17,
  length: 46,
  width: 22,
  accel: 430,
  brake: 760,
  reverseMax: 190,
  topSpeed: 560,
  turnRate: 2.7,
  grip: 3.2,
  health: 100,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 165,
  speedMax: 255,
  followGap: 78,
  spawnClear: 320,
};

export const PED = {
  count: 22,
  walkMin: 42,
  walkMax: 78,
  fleeSpeed: 165,
  radius: 9,
};

export const POLICE = {
  carSpeed: 590,
  footSpeed: 265,
  arrestRange: 30,
  arrestTime: 1.4,
  shootRange: 420,
  shootCooldown: 1.1,
  bulletDamage: 7,
};

export const WANTED = {
  max: 5,
  decaySeconds: 26,
  garageMultiplier: 3,
  steal: 1,
  shoot: 1,
  killPed: 1,
  punchCop: 1,
  ramCop: 1,
};

/** Cash paid for each of Mara's five jobs, in order. */
export const REWARDS = [500, 900, 1400, 2600, 5000];

/** Colours for the dusk city: warm asphalt, neon signs, sand and sea. */
export const PALETTE = {
  backdrop: '#0d0f16',
  block: '#232833',
  blockAlt: '#20242e',
  road: '#333842',
  roadEdge: '#454b58',
  roadLine: '#c8b45a',
  sidewalk: '#3a3f4b',
  sand: '#b99c6b',
  sandWet: '#a8895c',
  sea: '#1d5f86',
  seaDeep: '#174a6b',
  wave: '#7fc4e8',
  buildingRoof: '#4a5064',
  buildingSide: '#2c3040',
  buildingTrim: '#8f96ab',
  palm: '#3f7a4a',
  palmTrunk: '#6b4a2f',
  player: '#ffd23f',
  playerDark: '#c79a12',
  pedShirt: ['#e06a6a', '#6aa8e0', '#7ed07e', '#e0c06a', '#b07ee0', '#e08ab0'],
  policeCar: '#e8e8e8',
  policeDark: '#20242e',
  lightRed: '#ff3b30',
  lightBlue: '#2f7bff',
  cop: '#2f4a7a',
  bullet: '#ffe9a8',
  muzzle: '#ffd76a',
  marker: '#ffe14d',
  markerRing: '#ff9f1c',
  cash: '#7ee081',
  health: '#5ad06a',
  healthLow: '#e5534b',
  star: '#ffd23f',
  starEmpty: '#5a6070',
  text: '#eef1f5',
  muted: '#9aa1b1',
  panel: '#181c26',
  panelEdge: '#3a4152',
  banner: '#ffe14d',
  neonPink: '#ff5da2',
  neonCyan: '#37e0d8',
  neonOrange: '#ff9f1c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
