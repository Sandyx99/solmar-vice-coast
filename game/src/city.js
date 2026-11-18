// The city of Solmar: a sun-soaked coastal grid the builder lays out once from a seed.
// Avenues run north-south, streets east-west; the blocks between them hold buildings,
// parks, parking lots and plazas. Landmarks are fixed by name so missions can point at
// them: Reyes Garage (home), Bayview Bank, The Palms hotel, Solmar General hospital,
// the Neon Mile clubs and the Marina. The east edge is sand, then open water.

import { AVENUES, BEACH_X, PALETTE, ROAD_W, SIDEWALK, STREETS, WATER_X, WORLD } from './config.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];
const NEON = ['#ff2e88', '#22d3ee', '#facc15', '#a78bfa', '#34d399'];

/** The blocks between neighbouring roads, as {x, y, w, h, col, row}. */
function blockRects() {
  const rects = [];
  for (let col = 0; col < AVENUES.length - 1; col += 1) {
    for (let row = 0; row < STREETS.length - 1; row += 1) {
      const x = AVENUES[col] + ROAD_W / 2 + SIDEWALK;
      const y = STREETS[row] + ROAD_W / 2 + SIDEWALK;
      const w = AVENUES[col + 1] - AVENUES[col] - ROAD_W - SIDEWALK * 2;
      const h = STREETS[row + 1] - STREETS[row] - ROAD_W - SIDEWALK * 2;
      if (x + w > BEACH_X) continue;
      rects.push({ x, y, w, h, col, row });
    }
  }
  return rects;
}

/** A building rect inset inside `block`, with a fake height for its 3D roof shadow. */
function buildingIn(block, random, color, name) {
  const margin = 26;
  const w = random.range(block.w * 0.45, block.w - margin * 2);
  const h = random.range(block.h * 0.45, block.h - margin * 2);
  const x = block.x + (block.w - w) / 2 + random.range(-14, 14);
  const y = block.y + (block.h - h) / 2 + random.range(-14, 14);
  return { x, y, w, h, hgt: random.range(10, 30), color, name: name ?? null, kind: 'building' };
}

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lots = [];
  const landmarks = {};

  // Blocks are col 0-5 (between the 7 avenues) by row 0-3 (between the 5 streets).
  const forced = new Map([
    ['1,3', 'garage'],
    ['2,0', 'bank'],
    ['4,0', 'hotel'],
    ['1,0', 'hospital'],
    ['5,3', 'marina'],
    ['3,1', 'market'],
    ['0,2', 'park'],
    ['5,1', 'park'],
    ['2,2', 'neon'],
    ['3,2', 'neon'],
    ['4,2', 'neon'],
  ]);

  for (const block of blockRects()) {
    const key = `${block.col},${block.row}`;
    const kind = forced.get(key) ?? (random.chance(0.14) ? 'park' : random.chance(0.16) ? 'lot' : 'buildings');

    if (kind === 'park') {
      parks.push({ x: block.x, y: block.y, w: block.w, h: block.h });
      const count = random.int(7, 12);
      for (let i = 0; i < count; i += 1) {
        trees.push({ x: random.range(block.x + 20, block.x + block.w - 20), y: random.range(block.y + 20, block.y + block.h - 20), r: random.range(9, 15) });
      }
      continue;
    }
    if (kind === 'lot') {
      lots.push({ x: block.x, y: block.y, w: block.w, h: block.h });
      continue;
    }
    if (kind === 'neon') {
      // The Neon Mile: a row of small bright clubs instead of one big block.
      const n = 3;
      for (let i = 0; i < n; i += 1) {
        const w = (block.w - 40) / n;
        buildings.push({
          x: block.x + 20 + i * w, y: block.y + 30, w: w - 14, h: block.h - 60,
          hgt: random.range(14, 26), color: NEON[(block.col + i) % NEON.length], name: null, kind: 'club',
        });
      }
      continue;
    }
    if (kind === 'garage' || kind === 'bank' || kind === 'hotel' || kind === 'hospital' || kind === 'marina' || kind === 'market') {
      const names = {
        garage: 'REYES GARAGE', bank: 'BAYVIEW BANK', hotel: 'THE PALMS', hospital: 'SOLMAR GENERAL',
        marina: 'SOLMAR MARINA', market: 'PALM MARKET',
      };
      const colors = { garage: '#5b7a99', bank: '#c9a227', hotel: '#e07856', hospital: '#e8e4da', marina: '#3e7cb1', market: '#8fae7e' };
      const b = buildingIn(block, random, colors[kind], names[kind]);
      b.hgt = kind === 'hotel' ? 42 : 20;
      buildings.push(b);
      // The front door: just outside the building's south wall, where a car or a
      // pedestrian can actually stand — missions point here, never at the centre.
      landmarks[kind] = {
        x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, name: names[kind],
        door: { x: b.x + b.w / 2, y: b.y + b.h + 46 },
      };
      continue;
    }
    // Ordinary block: one or two buildings.
    const first = buildingIn(block, random, random.pick(ROOFS), null);
    buildings.push(first);
    if (random.chance(0.45)) {
      const second = buildingIn(block, random, random.pick(ROOFS), null);
      // Keep the two apart: shrink the second toward the block's far corner.
      second.x = block.x + block.w - second.w - 20;
      second.y = block.y + block.h - second.h - 20;
      if (second.x > first.x + first.w + 16 || second.y > first.y + first.h + 16) buildings.push(second);
    }
  }

  // Palm trees along the beach and a few on sidewalks.
  for (let y = 120; y < WORLD.h; y += 170) {
    trees.push({ x: random.range(BEACH_X + 30, BEACH_X + 130), y: y + random.range(-30, 30), r: random.range(10, 15) });
  }

  const city = { buildings, parks, trees, lots, landmarks };

  // --- Queries the world and the renderer share ---------------------------------

  /** True when a circle of radius `r` at (x, y) would hit a building, the water or the edge. */
  city.isBlocked = (x, y, r) => {
    if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
    if (x + r > WATER_X) return true;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  };

  /** True when the point is on asphalt (a road), not sidewalk or block. */
  city.onRoad = (x, y) => {
    for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
    return false;
  };

  /** The nearest point on a road centreline, and whether that road runs east-west. */
  city.nearestRoadPoint = (x, y) => {
    let best = null;
    for (const ax of AVENUES) {
      const d = Math.abs(x - ax);
      if (!best || d < best.d) best = { x: ax, y, horizontal: false, d };
    }
    for (const sy of STREETS) {
      const d = Math.abs(y - sy);
      if (d < best.d) best = { x, y: sy, horizontal: true, d };
    }
    return best;
  };

  /** A random point on a random road, for traffic spawns. */
  city.randomRoadPoint = () => {
    if (random.chance(0.5)) {
      return { x: random.pick(AVENUES), y: random.range(80, WORLD.h - 80), horizontal: false };
    }
    return { x: random.range(80, BEACH_X - 80), y: random.pick(STREETS), horizontal: true };
  };

  /** A random point on a sidewalk beside a road, for pedestrians. */
  city.randomSidewalkPoint = () => {
    const p = city.randomRoadPoint();
    const off = (ROAD_W / 2 + SIDEWALK / 2) * (random.chance(0.5) ? 1 : -1);
    if (p.horizontal) return { x: p.x, y: p.y + off };
    return { x: p.x + off, y: p.y };
  };

  return city;
}
