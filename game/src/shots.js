// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (walk to the nearest car, jack it, drive at the gold marker, brake for the
// car ahead), so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { AVENUES, STEP, STREETS } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 26;
const CHASE_DRIVE_SECONDS = 12;
const CHASE_SECONDS = 13;
const MISSION_SECONDS = 58;
const SAMPLE = STEP;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Stuck recovery: when the car has barely moved while trying to drive, back out.
// Displacement, not speed, is the test — a car grinding into a wall still reports speed.
let stuckCheck = null;
let reverseTimer = 0;

function nearestLine(lines, value) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/**
 * Road following for the autopilot's car: drive on the streets to the target instead of
 * cutting across blocks. Returns the next point to steer at — the road ahead, the turn
 * at the next intersection, or the target itself once it is close and in the open.
 */
function roadVia(city, car, target) {
  const rp = city.nearestRoadPoint(car.x, car.y);
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  if (rp.d > 50) return { x: rp.x, y: rp.y };
  if (dist < 220) return target;
  if (rp.horizontal) {
    if (Math.abs(target.x - car.x) > 130) {
      return { x: car.x + Math.sign(target.x - car.x) * 250, y: rp.y };
    }
    return { x: nearestLine(AVENUES, target.x), y: rp.y };
  }
  if (Math.abs(target.y - car.y) > 130) {
    return { x: rp.x, y: car.y + Math.sign(target.y - car.y) * 250 };
  }
  return { x: rp.x, y: nearestLine(STREETS, target.y) };
}

/**
 * One step of autopilot controls for the current state: on foot it walks to the nearest
 * car and jacks it; in a car it steers at the mission marker and brakes when close.
 * `aimAt` steers the pistol at the nearest cop when one is near, else down the road.
 */
function autopilot(world) {
  const state = world.state;
  const p = state.player;
  const wp = world.waypoint();
  const controls = { move: { x: 0, y: 0 }, sprint: false, brake: false, enter: false, punch: false, firing: false, aim: null };
  let target = wp;
  if (!p.inCar) {
    const car = world.nearestCar(600, false);
    if (car) {
      target = { x: car.x, y: car.y };
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < 60) controls.enter = true;
    }
  }
  if (!target) target = { x: 1710, y: 1260 };
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (p.inCar) {
    const car = p.car;
    const via = roadVia(world.state.city, car, target);
    const vdx = via.x - p.x;
    const vdy = via.y - p.y;
    const want = Math.atan2(vdy, vdx);
    const diff = wrapAngle(want - car.angle);
    // Nose against a wall near the marker: back out to open ground.
    const blockedAhead = world.state.city.isBlocked(
      p.x + Math.cos(car.angle) * 70, p.y + Math.sin(car.angle) * 70, 20);
    if (reverseTimer > 0) {
      // Backing out of whatever wedged the car, steering the other way.
      reverseTimer -= SAMPLE;
      controls.move.x = -clamp(diff * 2.2, -1, 1);
      controls.move.y = 1;
    } else if (blockedAhead && Math.abs(car.speed) < 80 && dist < 320) {
      reverseTimer = 0.9;
      controls.move.x = -clamp(diff * 2.2, -1, 1);
      controls.move.y = 1;
    } else {
      if (!stuckCheck) stuckCheck = { x: p.x, y: p.y, t: 0 };
      stuckCheck.t += SAMPLE;
      if (stuckCheck.t >= 1.5) {
        const moved = Math.hypot(p.x - stuckCheck.x, p.y - stuckCheck.y);
        if (moved < 20 && dist > 120) reverseTimer = 1.2;
        stuckCheck = { x: p.x, y: p.y, t: 0 };
      }
      controls.move.x = clamp(diff * 2.2, -1, 1);
      controls.move.y = dist < 110 ? 0.2 : -1;
      controls.brake = dist < 70;
    }
    controls.aim = { x: p.x + Math.cos(car.angle) * 100, y: p.y + Math.sin(car.angle) * 100 };
  } else {
    const want = Math.atan2(dy, dx);
    controls.move.x = clamp(Math.cos(want) * 1.4, -1, 1);
    controls.move.y = clamp(Math.sin(want) * 1.4, -1, 1);
    controls.sprint = dist > 200;
    controls.aim = { x: target.x, y: target.y };
  }
  // Shoot at the nearest cop when one is close enough to matter.
  let nearestCop = null;
  let nearestD = 340;
  for (const person of state.people) {
    if ((person.kind !== 'cop' && person.kind !== 'guard') || person.dead) continue;
    const d = Math.hypot(person.x - p.x, person.y - p.y);
    if (d < nearestD) { nearestD = d; nearestCop = person; }
  }
  if (nearestCop && !p.inCar) {
    controls.aim = { x: nearestCop.x, y: nearestCop.y };
    controls.firing = true;
  }
  return controls;
}

function runFor(world, seconds) {
  for (let t = 0; t < seconds; t += SAMPLE) {
    world.step(SAMPLE, autopilot(world));
    if (world.state.over) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over a living city. play: Mara driving her first stolen car to the
 * garage. chase: three stars, interceptors closing in. mission: the Bayview job, cash
 * bag in hand, guards on the street.
 */
export function stageShot(name, world) {
  stuckCheck = null;
  reverseTimer = 0;
  world.reset();
  if (name === 'play') {
    runFor(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    runFor(world, CHASE_DRIVE_SECONDS);
    world.addHeat(60);
    runFor(world, CHASE_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Jump the story to job 4: the Bayview job.
    world.state.missionsDone = 3;
    world.state.nextMissionAt = 0;
    runFor(world, MISSION_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  runFor(world, START_SECONDS);
  return { screen: SCREEN_TITLE };
}
