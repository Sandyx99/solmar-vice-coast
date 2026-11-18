// Cars: one physics model for the player's car, traffic and police. A car has a
// heading, a speed along it, and a body type from config; traffic follows road
// centrelines and turns at intersections, police cars chase a target with the
// same steering, and parked cars sit in lots and along kerbs waiting to be stolen.

import { CAR, ROAD_W, TRAFFIC, WORLD } from './config.js';

let nextId = 1;

export function makeCar(city, random, type, x, y, angle) {
  const def = CAR.types[type];
  return {
    id: nextId += 1,
    type,
    def,
    x, y,
    angle,
    speed: 0,
    // Traffic only: which road it follows and which way along it.
    road: null,
    cruise: random ? random.range(TRAFFIC.speedMin, TRAFFIC.speedMax) : 170,
    parked: false,
    driver: true,
    // Police only: who it chases.
    target: null,
    siren: 0,
    stuck: 0,
    color: def.color,
  };
}

/** Put a traffic car on a road with a lane offset and a direction along it. */
export function spawnTrafficCar(city, random) {
  const p = city.randomRoadPoint();
  const lane = (ROAD_W / 2 - 16) * (random.chance(0.5) ? 1 : -1);
  const dir = random.chance(0.5) ? 1 : -1;
  const type = random.pick(['sedan', 'sedan', 'taxi', 'coupe', 'van', 'pickup']);
  const angle = p.horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(city, random, type,
    p.horizontal ? p.x : p.x + lane,
    p.horizontal ? p.y + lane : p.y,
    angle);
  car.road = { horizontal: p.horizontal, dir, line: p.horizontal ? p.y : p.x };
  car.speed = car.cruise * random.range(0.7, 1);
  return car;
}

/** A parked car in a lot or along a kerb: stealable, engine off. */
export function spawnParkedCar(city, random) {
  const lot = city.lots.length > 0 && random.chance(0.6) ? random.pick(city.lots) : null;
  let x; let y; let angle;
  if (lot) {
    x = random.range(lot.x + 40, lot.x + lot.w - 40);
    y = random.range(lot.y + 40, lot.y + lot.h - 40);
    angle = random.chance(0.5) ? 0 : Math.PI / 2;
  } else {
    const p = city.randomRoadPoint();
    const kerb = (ROAD_W / 2 + 14) * (random.chance(0.5) ? 1 : -1);
    x = p.horizontal ? p.x : p.x + kerb;
    y = p.horizontal ? p.y + kerb : p.y;
    angle = p.horizontal ? 0 : Math.PI / 2;
    if (random.chance(0.5)) angle += Math.PI;
  }
  const type = random.pick(['sedan', 'coupe', 'pickup', 'van', 'taxi']);
  const car = makeCar(city, random, type, x, y, angle);
  car.parked = true;
  car.driver = false;
  return car;
}

/** A police interceptor that spawns on the road nearest `near` and hunts `target`. */
export function spawnPoliceCar(city, random, near, target) {
  const p = city.nearestRoadPoint(near.x + random.range(-500, 500), near.y + random.range(-500, 500));
  const car = makeCar(city, random, 'police', p.x, p.y, random.range(0, Math.PI * 2));
  car.target = target;
  car.speed = 380;
  return car;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Move a car one step, with building/water collision as a slide along the wall. */
export function moveCar(city, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = Math.max(car.def.len, car.def.wid) / 2 - 4;
  if (!city.isBlocked(nx, car.y, r)) car.x = nx;
  else car.speed *= 0.55;
  if (!city.isBlocked(car.x, ny, r)) car.y = ny;
  else car.speed *= 0.55;
  car.x = Math.max(r, Math.min(WORLD.w - r, car.x));
  car.y = Math.max(r, Math.min(WORLD.h - r, car.y));
}

/**
 * Drive the player's car: `throttle` -1..1 (reverse to forward), `steer` -1..1,
 * `brake` for the handbrake. Steering bites harder the faster the car goes.
 */
export function drivePlayerCar(city, car, throttle, steer, brake, dt) {
  const def = car.def;
  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    car.speed += (car.speed > 30 ? -CAR.brake : def.accel * 0.55 * throttle) * dt;
  }
  // Rolling drag, and the handbrake kills speed while loosening the rear.
  car.speed -= car.speed * CAR.drag * dt;
  if (brake) car.speed -= car.speed * 2.4 * dt;
  car.speed = Math.max(-CAR.reverseTop, Math.min(def.top, car.speed));
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const grip = brake ? CAR.handbrakeGrip : def.grip;
  car.angle += steer * grip * (car.speed / def.top) * dt * (car.speed >= 0 ? 1 : -1) * 2.2;
  moveCar(city, car, dt);
}

/** Traffic: follow its road's lane, brake for the car ahead, turn at intersections. */
export function driveTrafficCar(city, car, cars, random, dt) {
  if (!car.road) return;
  const ahead = { x: car.x + Math.cos(car.angle) * 70, y: car.y + Math.sin(car.angle) * 70 };
  let blocked = city.isBlocked(ahead.x, ahead.y, 20);
  if (!blocked) {
    for (const other of cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 78 && side < 30) { blocked = true; break; }
    }
  }
  const want = blocked ? 0 : car.cruise;
  car.speed += Math.max(-420, Math.min(260, want - car.speed)) * dt;
  if (car.speed < 0) car.speed = 0;

  // The lane it drives: the road's centreline, offset to the right-hand side.
  const laneOff = (ROAD_W / 2 - 16) * (car.road.dir > 0 ? 1 : -1);
  const baseAngle = car.road.horizontal ? (car.road.dir > 0 ? 0 : Math.PI) : (car.road.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const lanePos = car.road.line + laneOff;
  const off = car.road.horizontal ? car.y - lanePos : car.x - lanePos;
  const steerTo = baseAngle - Math.max(-0.5, Math.min(0.5, off * 0.012));
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, wrapAngle(steerTo - car.angle)));

  // At an intersection, sometimes turn onto the crossing road.
  if (random.chance(0.0016)) {
    const p = city.nearestRoadPoint(car.x, car.y);
    if (p.d < 34 && p.horizontal !== car.road.horizontal) {
      car.road = { horizontal: p.horizontal, dir: random.chance(0.5) ? 1 : -1, line: p.horizontal ? p.y : p.x };
    }
  }
  moveCar(city, car, dt);
}

/**
 * Police pursuit: close fast, then hold a standoff ring and circle the target
 * instead of grinding into it — a pile of interceptors should surround the
 * player, not pin them against a wall forever. When the target is inside a
 * block (a garage forecourt, a parking lot), the car holds on the nearest road
 * and waits there: interceptors do not drive through buildings. The siren wails
 * the whole time.
 */
export function drivePoliceCar(city, car, target, dt) {
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  car.siren += dt;
  if (!city.onRoad(target.x, target.y) && dist < 280) {
    const road = city.nearestRoadPoint(target.x, target.y);
    const holdDist = Math.hypot(road.x - car.x, road.y - car.y);
    const want = Math.atan2(road.y - car.y, road.x - car.x);
    const diff = wrapAngle(want - car.angle);
    car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
    const wantSpeed = holdDist < 60 ? 0 : car.def.top * 0.7;
    car.speed += Math.max(-500, Math.min(460, wantSpeed - car.speed)) * dt;
    moveCar(city, car, dt);
    return;
  }
  let want;
  let wantSpeed;
  if (dist < 130) {
    // Circle the target at arm's length, leaving it room to break away.
    const orbit = Math.atan2(target.y - car.y, target.x - car.x) + Math.PI / 2.4;
    want = orbit;
    wantSpeed = car.def.top * 0.55;
  } else {
    want = Math.atan2(target.y - car.y, target.x - car.x);
    wantSpeed = car.def.top;
  }
  const diff = wrapAngle(want - car.angle);
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
  car.speed += Math.max(-500, Math.min(460, wantSpeed - car.speed)) * dt;
  moveCar(city, car, dt);
}

/**
 * Push two overlapping cars apart and trade a little speed: a cheap fender-bender.
 * A driven car is the heavier one — the other car takes most of the shove, so a
 * traffic car cannot pin the player's car in place by leaning on it.
 */
export function resolveCarCrash(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const min = (a.def.len + b.def.len) / 2 - 8;
  if (dist >= min) return 0;
  const overlap = min - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  const shareA = a.driven ? 0.25 : b.driven ? 0.75 : 0.5;
  a.x -= nx * overlap * shareA;
  a.y -= ny * overlap * shareA;
  b.x += nx * overlap * (1 - shareA);
  b.y += ny * overlap * (1 - shareA);
  const impact = Math.abs(a.speed - b.speed) + 40;
  a.speed *= 0.82;
  b.speed *= 0.82;
  return impact;
}
