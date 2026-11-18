// Solmar's map: seven avenues, five streets, a beach and sea to the east, and
// the named places the story happens in. The layout is fixed (built once from
// a fixed seed), so the same city is there on every visit and every screenshot.

import { AVENUES, BEACH_X, ROAD_W, SEA_X, STREETS, WORLD } from './config.js';
import { createRandom, int, pick, range } from './random.js';

/** The named places: x, y is the top-left corner, w and h the footprint. */
export const LANDMARKS = [
  { name: 'Reyes Garage', x: 380, y: 360, w: 200, h: 100, roof: '#7a5a3a', sign: 'GARAGE' },
  { name: 'Bayview Bank', x: 1200, y: 380, w: 180, h: 130, roof: '#5a6e8a', sign: 'BANK' },
  { name: 'Palm Market', x: 800, y: 1200, w: 200, h: 120, roof: '#6e8a4f', sign: 'MARKET' },
  { name: 'The Palms', x: 2000, y: 1180, w: 220, h: 160, roof: '#8a5a6e', sign: 'HOTEL' },
  { name: 'Solmar General', x: 1600, y: 1600, w: 200, h: 140, roof: '#e8e8e8', sign: 'HOSPITAL' },
  { name: 'Neon Mile', x: 1960, y: 1560, w: 90, h: 60, roof: '#ff5da2', sign: 'NEON' },
  { name: 'Neon Mile', x: 2080, y: 1560, w: 90, h: 60, roof: '#37e0d8', sign: 'NEON' },
  { name: 'Neon Mile', x: 2200, y: 1560, w: 90, h: 60, roof: '#ff9f1c', sign: 'NEON' },
  { name: 'Marina', x: 3180, y: 2100, w: 120, h: 90, roof: '#4f7a8a', sign: 'MARINA' },
];

/** Front-door markers: where a mission sends the player, for each named place. */
export const LANDMARK_DOORS = {
  'Reyes Garage': { x: 480, y: 500 },
  'Bayview Bank': { x: 1290, y: 540 },
  'Palm Market': { x: 900, y: 1350 },
  'The Palms': { x: 2110, y: 1370 },
  'Solmar General': { x: 1700, y: 1770 },
  'Neon Mile': { x: 2125, y: 1650 },
  Marina: { x: 3240, y: 2220 },
};

export function landmark(name) {
  return LANDMARKS.find((place) => place.name === name) ?? null;
}

/** The blocks between the roads: columns and rows the buildings sit in. */
const BLOCK_X = [348, 748, 1148, 1548, 1948, 2348, 2748];
const BLOCK_W = [304, 304, 304, 304, 304, 304, 284];
const BLOCK_Y = [348, 748, 1148, 1548, 1948];
const BLOCK_H = [304, 304, 304, 304, 604];

/** Blocks already holding a landmark: no generic building goes there. */
const TAKEN = new Set(['0,0', '2,0', '1,2', '4,2', '3,3', '4,3']);

const ROOFS = ['#5a6274', '#6b5a6e', '#4f6b5e', '#7a6a4f', '#5e6b7a', '#715a5e', '#4a5a6e'];

function buildCity() {
  const rng = createRandom(1337);
  const buildings = [];
  for (const place of LANDMARKS) {
    buildings.push({ x: place.x, y: place.y, w: place.w, h: place.h, roof: place.roof, name: place.name, sign: place.sign });
  }
  for (let col = 0; col < BLOCK_X.length; col += 1) {
    for (let row = 0; row < BLOCK_Y.length; row += 1) {
      if (TAKEN.has(`${col},${row}`)) continue;
      const bx = BLOCK_X[col];
      const by = BLOCK_Y[row];
      const bw = BLOCK_W[col];
      const bh = BLOCK_H[row];
      const count = bh > 400 || bw > 280 ? 2 : 1;
      for (let n = 0; n < count; n += 1) {
        const w = int(rng, 90, Math.min(200, bw - 60));
        const h = int(rng, 70, Math.min(150, bh - 60));
        const x = Math.round(bx + 26 + rng() * Math.max(1, bw - w - 52));
        const y = Math.round(by + 26 + rng() * Math.max(1, bh - h - 52));
        buildings.push({ x, y, w, h, roof: pick(rng, ROOFS), name: null, sign: null });
      }
    }
  }
  const trees = [];
  for (let y = 120; y < WORLD.height - 80; y += 130) {
    trees.push({ x: Math.round(3130 + rng() * 160), y: Math.round(y + range(rng, -30, 30)), r: 11 });
  }
  for (let n = 0; n < 10; n += 1) {
    trees.push({ x: Math.round(1960 + rng() * 320), y: Math.round(1100 + rng() * 60), r: 10 });
  }
  return { buildings, trees };
}

const { buildings, trees } = buildCity();

export const BUILDINGS = buildings;
export const TREES = trees;

/** Cars parked around the city that the player can steal. */
export const PARKED_SPOTS = [
  { x: 520, y: 620, angle: Math.PI / 2, color: '#c94f4f' },
  { x: 600, y: 620, angle: Math.PI / 2, color: '#4f7ec9' },
  { x: 860, y: 1340, angle: 0, color: '#c9a44f' },
  { x: 2040, y: 1660, angle: Math.PI, color: '#7ec94f' },
  { x: 2140, y: 1660, angle: Math.PI, color: '#c94fa8' },
  { x: 3220, y: 2200, angle: -Math.PI / 2, color: '#4fc9c9' },
];

/** The avenue whose strip `x` sits in, or -1. */
export function avenueAt(x) {
  for (const centre of AVENUES) {
    if (Math.abs(x - centre) <= ROAD_W / 2) return centre;
  }
  return -1;
}

/** The street whose strip `y` sits in, or -1. */
export function streetAt(y) {
  for (const centre of STREETS) {
    if (Math.abs(y - centre) <= ROAD_W / 2) return centre;
  }
  return -1;
}

export function onRoad(x, y) {
  return avenueAt(x) >= 0 || streetAt(y) >= 0;
}

export function inSea(x, y) {
  return x >= SEA_X;
}

export function onSand(x, y) {
  return x >= BEACH_X && x < SEA_X;
}

/** The closest point on any road centre line to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const centre of AVENUES) {
    const py = Math.max(0, Math.min(WORLD.height, y));
    const d = Math.hypot(x - centre, y - py);
    if (d < bestD) {
      bestD = d;
      best = { x: centre, y: py, axis: 'avenue' };
    }
  }
  for (const centre of STREETS) {
    const px = Math.max(0, Math.min(WORLD.width, x));
    const d = Math.hypot(x - px, y - centre);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: centre, axis: 'street' };
    }
  }
  return best;
}

/** A point on a named road: `along` runs 0..1 down its length. */
export function roadPoint(axis, centre, along) {
  if (axis === 'avenue') return { x: centre, y: along * WORLD.height };
  return { x: along * WORLD.width, y: centre };
}

/** The first building rect a circle of radius `r` at (x, y) overlaps, or null. */
export function hitBuilding(x, y, r) {
  for (const b of BUILDINGS) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/**
 * Push a circle out of every building it overlaps. Runs a few passes so a
 * corner shared by two buildings still resolves. Returns the corrected spot.
 */
export function pushOutOfBuildings(x, y, r) {
  for (let pass = 0; pass < 3; pass += 1) {
    const b = hitBuilding(x, y, r);
    if (b === null) break;
    const pushLeft = x + r - b.x;
    const pushRight = b.x + b.w - (x - r);
    const pushUp = y + r - b.y;
    const pushDown = b.y + b.h - (y - r);
    const smallest = Math.min(pushLeft, pushRight, pushUp, pushDown);
    if (smallest === pushLeft) x = b.x - r;
    else if (smallest === pushRight) x = b.x + b.w + r;
    else if (smallest === pushUp) y = b.y - r;
    else y = b.y + b.h + r;
  }
  return { x, y };
}

/** Keep a point inside the world, `r` clear of the edges. */
export function clampWorld(x, y, r) {
  return {
    x: Math.max(r, Math.min(WORLD.width - r, x)),
    y: Math.max(r, Math.min(WORLD.height - r, y)),
  };
}
