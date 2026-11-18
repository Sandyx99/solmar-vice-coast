// SOLMAR — tuning numbers, colours and save keys in one place. The world is a fixed-size
// city (WORLD.w by WORLD.h world units); the renderer scales the view to the window, so no
// rule below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = { w: 3600, h: 2600 };

// Road centrelines: avenues run north-south, streets east-west. ROAD_W is the asphalt width;
// sidewalks sit on both sides of every road.
export const ROAD_W = 96;
export const SIDEWALK = 26;
export const AVENUES = [360, 810, 1260, 1710, 2160, 2610, 3060];
export const STREETS = [360, 810, 1260, 1710, 2160];

// East edge: sand then open water. Everything west of BEACH_X is drivable city.
export const BEACH_X = 3300;
export const WATER_X = 3480;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  punchDamage: 20,
  punchRange: 34,
  punchCooldown: 0.45,
  shootCooldown: 0.22,
  bulletDamage: 34,
  bulletSpeed: 950,
  enterCarRange: 70,
};

export const CAR = {
  // Per body type: length, width, top speed, acceleration, grip (steering strength).
  types: {
    sedan: { len: 58, wid: 28, top: 520, accel: 300, grip: 2.6, color: '#d8b13c' },
    taxi: { len: 58, wid: 28, top: 500, accel: 290, grip: 2.6, color: '#f2c230' },
    coupe: { len: 54, wid: 27, top: 620, accel: 380, grip: 3.1, color: '#c94f6d' },
    van: { len: 68, wid: 30, top: 430, accel: 230, grip: 2.1, color: '#7fa8c9' },
    pickup: { len: 62, wid: 29, top: 540, accel: 320, grip: 2.7, color: '#5da271' },
    police: { len: 58, wid: 28, top: 640, accel: 420, grip: 3.2, color: '#20242e' },
  },
  reverseTop: 170,
  drag: 0.55,
  brake: 620,
  handbrakeGrip: 1.4,
  crashDamage: 14,
};

export const TRAFFIC = { count: 11, speedMin: 130, speedMax: 215, spawnGap: 240 };
export const PEDS = { count: 26, walkMin: 34, walkMax: 66 };

export const WANTED = {
  stealCar: 16,
  hitPed: 12,
  shoot: 10,
  killPed: 20,
  killCop: 26,
  // Heat above these lines shows that many stars.
  lines: [10, 26, 46, 66, 86],
  decayPerSec: 1.6,
  decayDelay: 5,
  // How many police cars / foot cops chase at each star level (index = stars).
  cars: [0, 1, 2, 3, 4, 5],
  cops: [0, 0, 2, 3, 4, 5],
};

export const POLICE = {
  carSight: 760,
  footSpeed: 235,
  arrestRange: 42,
  arrestTime: 1.4,
  shootRange: 320,
  shootCooldown: 0.9,
  bulletDamage: 7,
};

export const MONEY = { start: 50, respawnKeep: 0.5 };

export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6da05c',
  sand: '#e8d5a4',
  water: '#2fa8c9',
  waterDeep: '#1f7fa8',
  asphalt: '#3a3f4a',
  asphaltDark: '#333743',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  roofA: '#e07856',
  roofB: '#e8a94f',
  roofC: '#7fb3d5',
  roofD: '#c97b9a',
  roofE: '#8fae7e',
  park: '#5d9b52',
  tree: '#2f7d3a',
  treeLight: '#4da34a',
  buildingEdge: 'rgba(0,0,0,0.28)',
  player: '#ffd23f',
  cop: '#2b6cb0',
  pedShirt: ['#e2622b', '#3e7cb1', '#9b59b6', '#27ae60', '#f39c12', '#e74c3c', '#16a085', '#d35400'],
  hudBg: 'rgba(12,16,24,0.72)',
  hudText: '#f4f1e8',
  hudGold: '#ffd23f',
  star: '#ffd23f',
  starOff: 'rgba(255,255,255,0.25)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
