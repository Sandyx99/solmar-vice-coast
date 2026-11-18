// The people on foot: pedestrians who walk the pavements and run from
// trouble, and the police officers who chase the player down and try to
// arrest them. Nothing here draws or listens.

import { PED, POLICE } from './config.js';
import { clampWorld, hitBuilding, nearestRoadPoint, onRoad, pushOutOfBuildings } from './city.js';
import { pick, range } from './random.js';

const SHIRTS = ['#e06a6a', '#6aa8e0', '#7ed07e', '#e0c06a', '#b07ee0', '#e08ab0'];

/** A pedestrian at (x, y), walking the pavement in a random direction. */
export function createPed(x, y, random) {
  return {
    x, y,
    angle: range(random, 0, Math.PI * 2),
    speed: range(random, PED.walkMin, PED.walkMax),
    state: 'walk',
    shirt: pick(random, SHIRTS),
    turnTimer: range(random, 2, 7),
    panic: 0,
    dead: false,
  };
}

/** A pedestrian on a random pavement, clear of the player. */
export function createPedNear(random, clearX, clearY) {
  for (let tries = 0; tries < 20; tries += 1) {
    const spot = nearestRoadPoint(range(random, 0, 3600), range(random, 0, 2600));
    const side = random() < 0.5 ? -1 : 1;
    const x = spot.axis === 'avenue' ? spot.x + side * 62 : spot.x + range(random, -300, 300);
    const y = spot.axis === 'avenue' ? spot.y + range(random, -300, 300) : spot.y + side * 62;
    if (Math.hypot(x - clearX, y - clearY) < 260) continue;
    if (hitBuilding(x, y, PED.radius + 2) !== null) continue;
    return createPed(x, y, random);
  }
  return createPed(clearX + 400, clearY, random);
}

/**
 * One pedestrian step. Walkers drift along the pavement and change direction
 * at random; a panicked one runs away from the scare point and calms down
 * once it is far from trouble.
 */
export function updatePed(ped, dt, scare, random) {
  if (ped.dead) return;
  if (scare !== null) {
    const dx = ped.x - scare.x;
    const dy = ped.y - scare.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 320) {
      ped.state = 'flee';
      ped.panic = 3;
      ped.angle = Math.atan2(dy, dx);
    }
  }
  if (ped.panic > 0) {
    ped.panic -= dt;
    if (ped.panic <= 0) ped.state = 'walk';
  }
  const speed = ped.state === 'flee' ? PED.fleeSpeed : ped.speed;
  ped.turnTimer -= dt;
  if (ped.turnTimer <= 0) {
    ped.turnTimer = range(random, 2, 7);
    if (ped.state === 'walk') ped.angle = range(random, 0, Math.PI * 2);
  }
  let nx = ped.x + Math.cos(ped.angle) * speed * dt;
  let ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (hitBuilding(nx, ny, PED.radius) !== null || !onRoad(nx, ny)) {
    ped.angle += Math.PI / 2;
    nx = ped.x;
    ny = ped.y;
  }
  const fixed = pushOutOfBuildings(nx, ny, PED.radius);
  const clamped = clampWorld(fixed.x, fixed.y, PED.radius + 2);
  ped.x = clamped.x;
  ped.y = clamped.y;
}

/** A police officer on foot, dropped on the road near (x, y). */
export function createCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: POLICE.footSpeed,
    arrest: 0,
    shootTimer: 1,
    health: 100,
    dead: false,
  };
}

/**
 * One officer step: run at the player, and once close, hold them for the
 * arrest. Returns 'busted' when the arrest completes, 'shot' when the
 * officer fires, otherwise null. `target` is the player's position.
 */
export function updateCop(cop, target, dt, random) {
  if (cop.dead) return null;
  const dx = target.x - cop.x;
  const dy = target.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  if (dist > POLICE.arrestRange) {
    cop.x += (dx / dist) * cop.speed * dt;
    cop.y += (dy / dist) * cop.speed * dt;
    cop.arrest = Math.max(0, cop.arrest - dt * 2);
  } else {
    cop.arrest += dt;
    if (cop.arrest >= POLICE.arrestTime) return 'busted';
  }
  const fixed = pushOutOfBuildings(cop.x, cop.y, PED.radius);
  const clamped = clampWorld(fixed.x, fixed.y, PED.radius + 2);
  cop.x = clamped.x;
  cop.y = clamped.y;
  cop.shootTimer -= dt;
  if (dist < POLICE.shootRange && cop.shootTimer <= 0 && random() < 0.6) {
    cop.shootTimer = POLICE.shootCooldown;
    return 'shot';
  }
  return null;
}
