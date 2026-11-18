// The screenshot scenes behind ?shot=start|play|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by an autopilot that drives the player's car along the
// roads, so the frame is what a short game really looks like and the same
// seed always gives the same frame.

import { AVENUES, STEP, STREETS } from './config.js';
import { avenueAt, LANDMARK_DOORS, nearestRoadPoint, streetAt } from './city.js';
import { KIND_PLAYER } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createRandom } from './random.js';
import { startMission } from './missions.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 22;
const CHASE_SECONDS = 15;
const MISSION_SECONDS = 8;

/** Clamp a steering demand to the -1..1 the world expects. */
function clampSteer(value) {
  return Math.max(-1, Math.min(1, value));
}

/** The signed smallest angle from `from` to `to`, in radians. */
function angleDiff(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * An autopilot for the player's car. It follows the road grid: it keeps a
 * current road (an avenue or a street and a direction), steers at a point
 * ahead on that road, and at each junction either keeps going (cruise) or
 * turns toward the target (goto). It brakes for the car right ahead.
 */
function makePilot(world, mode, target, random) {
  const pilot = { mode, target, road: null };

  function currentRoad(car) {
    const avenue = avenueAt(car.x);
    const street = streetAt(car.y);
    if (avenue >= 0 && street >= 0) {
      // On a crossing: keep the road that matches the heading.
      return Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle))
        ? { axis: 'street', centre: street, dir: Math.cos(car.angle) > 0 ? 1 : -1 }
        : { axis: 'avenue', centre: avenue, dir: Math.sin(car.angle) > 0 ? 1 : -1 };
    }
    if (avenue >= 0) return { axis: 'avenue', centre: avenue, dir: Math.sin(car.angle) > 0 ? 1 : -1 };
    if (street >= 0) return { axis: 'street', centre: street, dir: Math.cos(car.angle) > 0 ? 1 : -1 };
    return null;
  }

  /** The junction on `road` nearest the target, or null when already there. */
  function junctionToward(road, target) {
    if (road.axis === 'avenue') {
      let best = STREETS[0];
      for (const s of STREETS) {
        if (Math.abs(s - target.y) < Math.abs(best - target.y)) best = s;
      }
      return { x: road.centre, y: best };
    }
    let best = AVENUES[0];
    for (const a of AVENUES) {
      if (Math.abs(a - target.x) < Math.abs(best - target.x)) best = a;
    }
    return { x: best, y: road.centre };
  }

  function onTargetRoad(road, target) {
    if (road.axis === 'avenue') return Math.abs(target.x - road.centre) < 70;
    return Math.abs(target.y - road.centre) < 70;
  }

  function carAhead(car) {
    for (const other of world.state.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 78 && side < 34) return true;
    }
    return false;
  }

  /** Is the car still on this road (with a little slack at junctions)? */
  function onRoad(car, road) {
    if (road.axis === 'avenue') return Math.abs(car.x - road.centre) < 68;
    return Math.abs(car.y - road.centre) < 68;
  }

  /** The next junction on `road` in the direction the car is travelling,
   * or null when the road ends (the beach, the sea wall). */
  function nextJunction(road, car) {
    if (road.axis === 'avenue') {
      let best = null;
      for (const s of STREETS) {
        if (road.dir === 1 && s > car.y + 40 && (best === null || s < best)) best = s;
        if (road.dir === -1 && s < car.y - 40 && (best === null || s > best)) best = s;
      }
      if (best === null) return null;
      return { x: road.centre, y: best };
    }
    let best = null;
    for (const a of AVENUES) {
      if (road.dir === 1 && a > car.x + 40 && (best === null || a < best)) best = a;
      if (road.dir === -1 && a < car.x - 40 && (best === null || a > best)) best = a;
    }
    if (best === null) return null;
    return { x: best, y: road.centre };
  }

  /** Is the car at the last junction in the direction it is travelling,
   * where the road grid ends and the beach begins? */
  function atGridEdge(road, car) {
    if (road.axis === 'avenue') {
      if (road.dir === 1) return Math.abs(car.y - STREETS[STREETS.length - 1]) < 180;
      return Math.abs(car.y - STREETS[0]) < 180;
    }
    if (road.dir === 1) return Math.abs(car.x - AVENUES[AVENUES.length - 1]) < 180;
    return Math.abs(car.x - AVENUES[0]) < 180;
  }

  function drive(car) {
    const here = currentRoad(car);
    if (pilot.road !== null && !onRoad(car, pilot.road)) {
      // Left the road we were following: follow the one we are on now.
      pilot.road = here;
    }
    if (pilot.road === null) pilot.road = here;
    if (pilot.road === null) {
      // Off the roads (a forecourt, the beach): steer at the nearest road.
      const point = nearestRoadPoint(car.x, car.y);
      const want = Math.atan2(point.y - car.y, point.x - car.x);
      return { throttle: 0.7, steer: clampSteer(angleDiff(car.angle, want) * 2), brake: false };
    }
    const road = pilot.road;
    let waypoint;
    if (pilot.mode === 'goto' && pilot.target !== null && onTargetRoad(road, pilot.target)) {
      waypoint = { x: pilot.target.x, y: pilot.target.y };
    } else if (pilot.mode === 'goto' && pilot.target !== null) {
      waypoint = junctionToward(road, pilot.target);
    } else {
      // Cruise: the next junction straight ahead on this road.
      const next = nextJunction(road, car);
      if (next === null) {
        // The road ends here (the beach, the sea wall): turn around.
        waypoint = road.axis === 'avenue'
          ? { x: road.centre, y: car.y - road.dir * 200 }
          : { x: car.x - road.dir * 200, y: road.centre };
        road.dir = -road.dir;
        pilot.road = road;
      } else {
        waypoint = next;
      }
    }
    const dist = Math.hypot(waypoint.x - car.x, waypoint.y - car.y);
    if (dist < 95 && pilot.mode === 'goto' && pilot.target !== null && !onTargetRoad(road, pilot.target)) {
      // Reached the junction: turn onto the road that leads at the target.
      const nextAxis = road.axis === 'avenue' ? 'street' : 'avenue';
      const nextCentre = road.axis === 'avenue' ? waypoint.y : waypoint.x;
      const nextDir = nextAxis === 'avenue'
        ? (pilot.target.y > car.y ? 1 : -1)
        : (pilot.target.x > car.x ? 1 : -1);
      pilot.road = { axis: nextAxis, centre: nextCentre, dir: nextDir };
      waypoint = pilot.target;
    } else if (dist < 95 && pilot.mode === 'cruise') {
      // At a junction: mostly straight on, sometimes turn.
      // At the edge of the road grid, always turn back into the city.
      const roll = random();
      if (atGridEdge(road, car) || roll < 0.22) {
        const nextAxis = road.axis === 'avenue' ? 'street' : 'avenue';
        const nextCentre = road.axis === 'avenue' ? car.y : car.x;
        const snapped = nextAxis === 'avenue'
          ? AVENUES.reduce((a, b) => (Math.abs(b - nextCentre) < Math.abs(a - nextCentre) ? b : a))
          : STREETS.reduce((a, b) => (Math.abs(b - nextCentre) < Math.abs(a - nextCentre) ? b : a));
        const nextDir = nextAxis === 'avenue'
          ? (random() < 0.5 ? 1 : -1)
          : (random() < 0.5 ? 1 : -1);
        pilot.road = { axis: nextAxis, centre: snapped, dir: nextDir };
      }
      waypoint = { x: car.x + Math.cos(car.angle) * 200, y: car.y + Math.sin(car.angle) * 200 };
    }
    const want = Math.atan2(waypoint.y - car.y, waypoint.x - car.x);
    const diff = angleDiff(car.angle, want);
    let throttle = pilot.mode === 'cruise' ? 0.75 : 1;
    let brake = false;
    if (Math.abs(diff) > 0.75) throttle = 0.45;
    // A sharp turn: brake while fast, but crawl while slow — braking to a
    // dead stop leaves the car facing the wrong way with no way to turn.
    if (Math.abs(diff) > 1.4) {
      if (Math.abs(car.speed) > 150) { throttle = 0; brake = true; }
      else { throttle = 0.35; brake = false; }
    }
    if (carAhead(car)) throttle = -0.3;
    return { throttle, steer: clampSteer(diff * 2.2), brake };
  }

  function walkToCar(player) {
    let best = null;
    let bestD = Infinity;
    for (const car of world.state.cars) {
      if (car.dead || car.kind === KIND_PLAYER) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best === null) return { moveX: 0, moveY: 0, sprint: false, enter: false, punch: false, shoot: false };
    const angle = Math.atan2(best.y - player.y, best.x - player.x);
    return {
      moveX: Math.cos(angle),
      moveY: Math.sin(angle),
      sprint: false,
      enter: bestD < 70,
      punch: false,
      shoot: false,
    };
  }

  return {
    /** The world's input for one step. */
    input() {
      const player = world.state.player;
      if (player.car === null) {
        const walk = walkToCar(player);
        return {
          ...walk,
          driveThrottle: 0, driveSteer: 0, driveBrake: false,
          aimX: player.x, aimY: player.y,
        };
      }
      const car = player.car;
      const controls = drive(car);
      return {
        moveX: 0, moveY: 0, sprint: false,
        driveThrottle: controls.throttle,
        driveSteer: controls.steer,
        driveBrake: controls.brake,
        enter: false, punch: false, shoot: false,
        aimX: player.x, aimY: player.y,
      };
    },
  };
}

/** Put the player behind the wheel of the parked car nearest the spawn. */
function giveCar(world) {
  const player = world.state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.state.cars) {
    if (car.dead || car.kind === KIND_PLAYER) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (best === null) return;
  best.kind = KIND_PLAYER;
  best.route = null;
  player.car = best;
  player.x = best.x;
  player.y = best.y;
  player.angle = best.angle;
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const random = createRandom(7);
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, {
        moveX: 0, moveY: 0, sprint: false,
        driveThrottle: 0, driveSteer: 0, driveBrake: false,
        enter: false, punch: false, shoot: false, aimX: 0, aimY: 0,
      }, true);
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'mission') {
    // The Bayview Job is the set-piece — the player drives to the bank,
    // holds the door, then runs for the Garage — so the frame catches the
    // job in progress rather than the moment it is already done.
    startMission(world.state, 3);
    giveCar(world);
    const door = LANDMARK_DOORS['Bayview Bank'];
    const pilot = makePilot(world, 'goto', { x: door.x, y: door.y }, random);
    for (let index = 0; index < MISSION_SECONDS / STEP; index += 1) {
      world.step(STEP, pilot.input(), false);
    }
    return { screen: SCREEN_PLAY };
  }
  giveCar(world);
  if (name === 'chase') {
    world.state.wanted = 3;
    world.state.wantedTimer = 0;
    const pilot = makePilot(world, 'cruise', null, random);
    for (let index = 0; index < CHASE_SECONDS / STEP; index += 1) {
      world.step(STEP, pilot.input(), false);
    }
    return { screen: SCREEN_PLAY };
  }
  const pilot = makePilot(world, 'cruise', null, random);
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    world.step(STEP, pilot.input(), false);
  }
  return { screen: SCREEN_PLAY };
}
