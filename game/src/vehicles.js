// Cars: how they move, how traffic follows the roads, and how the police
// chase the player. A car is a point with a heading and a speed; its body is
// a rectangle the renderer draws around it. Nothing here draws or listens.

import { AVENUES, CAR, STREETS, TRAFFIC } from './config.js';
import { clampWorld, inSea, nearestRoadPoint, pushOutOfBuildings, roadPoint } from './city.js';
import { pick, range } from './random.js';

export const KIND_PLAYER = 'player';
export const KIND_TRAFFIC = 'traffic';
export const KIND_POLICE = 'police';
export const KIND_PARKED = 'parked';

const TRAFFIC_COLORS = ['#c94f4f', '#4f7ec9', '#c9a44f', '#7ec94f', '#c94fa8', '#4fc9c9', '#d8d8d8', '#8a6ec9'];

/** A fresh car at (x, y), facing `angle`, of the given kind and colour. */
export function createCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color, kind,
    health: CAR.health,
    route: null,
    stuck: 0,
    siren: 0,
    dead: false,
  };
}

/** A traffic car on a random road, already moving with the flow. */
export function createTrafficCar(random) {
  const useAvenue = random() < 0.55;
  const centre = useAvenue ? pick(random, AVENUES) : pick(random, STREETS);
  const along = range(random, 0.05, 0.95);
  const spot = roadPoint(useAvenue ? 'avenue' : 'street', centre, along);
  const dir = random() < 0.5 ? 1 : -1;
  const lane = (random() < 0.5 ? -1 : 1) * 22;
  const car = createCar(
    useAvenue ? spot.x + lane : spot.x,
    useAvenue ? spot.y : spot.y + lane,
    useAvenue ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    pick(random, TRAFFIC_COLORS),
    KIND_TRAFFIC,
  );
  car.speed = range(random, TRAFFIC.speedMin, TRAFFIC.speedMax);
  car.route = { axis: useAvenue ? 'avenue' : 'street', centre, dir, lane };
  return car;
}

/** A police car on the road nearest (x, y), lights already flashing. */
export function createPoliceCar(x, y, random) {
  const spot = nearestRoadPoint(x, y);
  const car = createCar(spot.x, spot.y, range(random, 0, Math.PI * 2), '#e8e8e8', KIND_POLICE);
  car.speed = 200;
  return car;
}

function moveCar(car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Keep a car out of buildings, the sea and the world's edge. */
function collideCar(car) {
  const fixed = pushOutOfBuildings(car.x, car.y, CAR.radius);
  car.x = fixed.x;
  car.y = fixed.y;
  if (inSea(car.x, car.y)) {
    car.x = Math.min(car.x, 3352);
    car.speed = Math.min(car.speed, 120);
  }
  const clamped = clampWorld(car.x, car.y, CAR.radius + 4);
  car.x = clamped.x;
  car.y = clamped.y;
}

/**
 * Drive the player's car. `drive` is { throttle (-1..1), steer (-1..1),
 * brake } where throttle 1 is the gas and -1 is reverse. Steering only
 * bites while the car is moving, and it grips harder at low speed.
 */
export function drivePlayerCar(car, drive, dt) {
  if (drive.brake) {
    car.speed -= Math.sign(car.speed) * CAR.brake * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  } else if (drive.throttle > 0) {
    car.speed += CAR.accel * drive.throttle * dt;
  } else if (drive.throttle < 0) {
    car.speed += CAR.accel * drive.throttle * dt * 0.62;
  } else {
    car.speed -= Math.sign(car.speed) * CAR.accel * 0.22 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  const top = drive.throttle < 0 && car.speed < 0 ? -CAR.reverseMax : CAR.topSpeed;
  car.speed = Math.max(-CAR.reverseMax, Math.min(top, car.speed));
  const moving = Math.abs(car.speed);
  // Steering bites even at a crawl, and the car can pivot from a stop while
  // the driver steers — otherwise a hard brake for a sharp turn leaves it
  // facing the wrong way with no way to turn at all.
  const grip = Math.min(1, Math.max(0.25, moving / 170));
  const dir = car.speed < 0 ? -1 : 1;
  car.angle += drive.steer * CAR.turnRate * grip * dir * dt;
  moveCar(car, dt);
  collideCar(car);
}

/**
 * One traffic step: keep to the route's road and lane, slow down for the car
 * ahead, and at a junction pick a new road at random. `others` is every car,
 * for the gap check.
 */
export function updateTrafficCar(car, dt, random, others) {
  const route = car.route;
  if (route === null) return;
  let wanted = (TRAFFIC.speedMin + TRAFFIC.speedMax) / 2;
  for (const other of others) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < TRAFFIC.followGap && side < 30) {
      wanted = Math.min(wanted, Math.max(0, other.speed - 40));
    }
  }
  car.speed += Math.sign(wanted - car.speed) * 260 * dt;
  if (Math.abs(car.speed - wanted) < 8) car.speed = wanted;

  // Steer back onto the route's lane.
  const laneX = route.axis === 'avenue' ? route.centre + route.lane : car.x;
  const laneY = route.axis === 'street' ? route.centre + route.lane : car.y;
  const wantAngle = route.axis === 'avenue'
    ? (route.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (route.dir > 0 ? 0 : Math.PI);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const drift = route.axis === 'avenue' ? (laneX - car.x) * 0.6 : (laneY - car.y) * 0.6;
  car.angle += Math.max(-1.2 * dt, Math.min(1.2 * dt, drift * 0.02));

  const before = { x: car.x, y: car.y };
  moveCar(car, dt);
  const hit = pushOutOfBuildings(car.x, car.y, CAR.radius);
  if (hit.x !== car.x || hit.y !== car.y) {
    car.x = before.x;
    car.y = before.y;
    car.stuck += dt;
  } else {
    car.stuck = 0;
  }
  if (inSea(car.x, car.y)) {
    car.x = before.x;
    car.y = before.y;
    car.stuck += dt;
  }
  const clamped = clampWorld(car.x, car.y, CAR.radius + 4);
  car.x = clamped.x;
  car.y = clamped.y;

  // At a junction (or stuck against something), choose a new road.
  const nearJunction = route.axis === 'avenue'
    ? STREETS.some((s) => Math.abs(car.y - s) < 60)
    : AVENUES.some((a) => Math.abs(car.x - a) < 60);
  if ((nearJunction && random() < 0.02) || car.stuck > 1.2) {
    reroute(car, random);
  }
}

/** Pick a fresh road for a traffic car, keeping its current heading in mind. */
function reroute(car, random) {
  const useAvenue = random() < 0.5;
  const centre = useAvenue ? pick(random, AVENUES) : pick(random, STREETS);
  const dir = random() < 0.5 ? 1 : -1;
  const lane = (random() < 0.5 ? -1 : 1) * 22;
  car.route = { axis: useAvenue ? 'avenue' : 'street', centre, dir, lane };
  car.stuck = 0;
}

/**
 * One police step: steer hard at the target and floor it, with a little
 * wobble so two cruisers do not stack on the same line. Returns true when
 * the cruiser is close enough to ram.
 */
export function updatePoliceCar(car, target, dt, random) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
  car.siren += dt;
  const cruise = dist > 320 ? 560 : 480;
  car.speed += Math.sign(cruise - car.speed) * 520 * dt;
  if (random() < 0.01) car.angle += range(random, -0.2, 0.2);
  moveCar(car, dt);
  collideCar(car);
  return dist < CAR.radius + 26;
}

/** Damage a car; a wrecked car stops and smokes. */
export function damageCar(car, amount) {
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
  }
}

/** Two cars bumping: push both apart and trade a little speed. */
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const min = CAR.radius * 2;
  if (dist >= min) return 0;
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  a.speed *= 0.82;
  b.speed *= 0.82;
  return impact;
}
