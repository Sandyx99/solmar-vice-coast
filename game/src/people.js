// The people of Solmar: pedestrians strolling the sidewalks, foot police who chase and
// arrest, and the bank's guards. Pedestrians pick a sidewalk point and walk to it, and
// scatter when they hear gunfire or see a car coming at them. Cops run at the player and
// try to hold them for an arrest; guards hold a post and shoot at armed robbers.

import { PEDS, POLICE } from './config.js';

let nextId = 1;

export function makePed(city, random) {
  const p = city.randomSidewalkPoint();
  return {
    id: nextId += 1,
    kind: 'ped',
    x: p.x, y: p.y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(PEDS.walkMin, PEDS.walkMax),
    target: city.randomSidewalkPoint(),
    shirt: random.pick(['#e2622b', '#3e7cb1', '#9b59b6', '#27ae60', '#f39c12', '#e74c3c', '#16a085', '#d35400']),
    skin: random.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    health: 100,
    fleeing: 0,
    dead: false,
    fade: 0,
  };
}

export function makeCop(city, random, near) {
  const p = city.randomSidewalkPoint();
  // Spawn on a sidewalk not too far from the trouble.
  const dx = p.x - near.x;
  const dy = p.y - near.y;
  const dist = Math.hypot(dx, dy) || 1;
  const spawn = dist > 500 ? { x: near.x + (dx / dist) * 420, y: near.y + (dy / dist) * 420 } : p;
  return {
    id: nextId += 1,
    kind: 'cop',
    x: spawn.x, y: spawn.y,
    angle: 0,
    speed: POLICE.footSpeed,
    target: null,
    shirt: '#2b6cb0',
    skin: '#f1c27d',
    health: 100,
    fleeing: 0,
    dead: false,
    fade: 0,
    arrest: 0,
    shootIn: random.range(0.4, 1),
  };
}

export function makeGuard(city, random, x, y) {
  return {
    id: nextId += 1,
    kind: 'guard',
    x, y,
    angle: random.range(0, Math.PI * 2),
    speed: 150,
    target: null,
    post: { x, y },
    shirt: '#3d4451',
    skin: '#e0ac69',
    health: 100,
    fleeing: 0,
    dead: false,
    fade: 0,
    arrest: 0,
    shootIn: random.range(0.3, 0.8),
  };
}

function stepToward(city, person, tx, ty, dt) {
  const dx = tx - person.x;
  const dy = ty - person.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const want = Math.atan2(dy, dx);
  person.angle = want;
  const nx = person.x + Math.cos(want) * person.speed * dt;
  const ny = person.y + Math.sin(want) * person.speed * dt;
  if (!city.isBlocked(nx, person.y, 10)) person.x = nx;
  if (!city.isBlocked(person.x, ny, 10)) person.y = ny;
  return false;
}

/**
 * Advance one person one step. `danger` is {x, y} when gunfire or a speeding car is near
 * (pedestrians flee from it); `player` is the player state for cops and guards.
 * Returns 'arrest' when a cop has held the player long enough, else null.
 */
export function stepPerson(city, person, random, dt, danger, player) {
  if (person.dead) {
    person.fade += dt;
    return null;
  }
  if (person.kind === 'ped') {
    if (danger && person.fleeing <= 0) {
      const d = Math.hypot(person.x - danger.x, person.y - danger.y);
      if (d < 260) {
        person.fleeing = random.range(2, 4);
        const away = Math.atan2(person.y - danger.y, person.x - danger.x);
        person.target = { x: person.x + Math.cos(away) * 320, y: person.y + Math.sin(away) * 320 };
      }
    }
    if (person.fleeing > 0) {
      person.fleeing -= dt;
      person.speed = 170;
    } else {
      person.speed = random.range(PEDS.walkMin, PEDS.walkMax) * 0.6 + 20;
    }
    if (stepToward(city, person, person.target.x, person.target.y, dt)) {
      person.target = city.randomSidewalkPoint();
      person.fleeing = 0;
    }
    return null;
  }

  // Cops and guards: run at the player.
  const px = player.x;
  const py = player.y;
  const dist = Math.hypot(px - person.x, py - person.y);
  if (person.kind === 'cop') {
    person.speed = POLICE.footSpeed;
    stepToward(city, person, px, py, dt);
    if (dist < POLICE.arrestRange && !player.inCar) {
      person.arrest += dt;
      if (person.arrest >= POLICE.arrestTime) return 'arrest';
    } else {
      person.arrest = Math.max(0, person.arrest - dt * 2);
    }
  } else {
    // Guards hold near their post unless the player comes close, then they shoot.
    if (dist < 420) {
      person.angle = Math.atan2(py - person.y, px - person.x);
      person.speed = 0;
    } else {
      stepToward(city, person, person.post.x, person.post.y, dt);
    }
  }
  return null;
}

/** A cop or guard fires at the player when in range and off cooldown; returns a bullet or null. */
export function enemyShoot(person, player, dt, random) {
  person.shootIn -= dt;
  const dist = Math.hypot(player.x - person.x, player.y - person.y);
  if (person.shootIn > 0 || dist > POLICE.shootRange || person.dead) return null;
  person.shootIn = POLICE.shootCooldown * (person.kind === 'guard' ? 0.8 : 1.15);
  const aim = Math.atan2(player.y - person.y, player.x - person.x) + random.range(-0.11, 0.11);
  return {
    x: person.x + Math.cos(aim) * 18,
    y: person.y + Math.sin(aim) * 18,
    vx: Math.cos(aim) * 780,
    vy: Math.sin(aim) * 780,
    life: 0.7,
    fromEnemy: true,
    damage: POLICE.bulletDamage,
  };
}
