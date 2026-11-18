// Mara Reyes' five jobs: what each one asks, where it sends the player, and
// how the world knows it is done. A mission is data plus a small check that
// runs every step; the world owns the timer and the stage, this file owns the
// meaning. Finishing one pays the reward and starts the next.

import { LANDMARK_DOORS, landmark } from './city.js';
import { REWARDS } from './config.js';

/** The five jobs, in story order. */
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief: 'Mara Reyes: "New in Solmar? You need wheels. Take any car — it is yours now."',
    objective: 'Steal a car',
    marker: null,
    reward: REWARDS[0],
  },
  {
    id: 'courier',
    title: 'Courier',
    brief: 'Mara Reyes: "Package for Palm Market. Drive it there, in a car, no questions."',
    objective: 'Drive the package to Palm Market',
    marker: 'Palm Market',
    reward: REWARDS[1],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    brief: 'Mara Reyes: "The heat is on you now. Lose the cops — the Garage is a good place to cool off."',
    objective: 'Lose the wanted level',
    marker: 'Reyes Garage',
    reward: REWARDS[2],
  },
  {
    id: 'bayview-job',
    title: 'The Bayview Job',
    brief: 'Mara Reyes: "Bayview Bank. Hold the door for four seconds, then bring it home to the Garage."',
    objective: 'Rob Bayview Bank, then reach the Garage',
    marker: 'Bayview Bank',
    reward: REWARDS[3],
  },
  {
    id: 'kingpins-call',
    title: "The Kingpin's Call",
    brief: 'Mara Reyes: "The Kingpin wants to meet. Marina, east side. Do not keep him waiting."',
    objective: 'Reach the Marina',
    marker: 'Marina',
    reward: REWARDS[4],
  },
];

/** The mission the player is on, or null once the story is done. */
export function currentMission(world) {
  if (world.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[world.missionIndex];
}

/** Where the current job points on the map, or null when it points nowhere. */
export function missionMarker(world) {
  const mission = currentMission(world);
  if (mission === null) return null;
  if (mission.id === 'bayview-job' && world.missionStage === 1) {
    const door = LANDMARK_DOORS['Reyes Garage'];
    return { x: door.x, y: door.y, label: 'Reyes Garage' };
  }
  if (mission.marker === null) return null;
  const door = LANDMARK_DOORS[mission.marker];
  return { x: door.x, y: door.y, label: mission.marker };
}

/** The one-line objective the HUD shows for the current job. */
export function missionObjective(world) {
  const mission = currentMission(world);
  if (mission === null) return 'Free roam — Solmar is yours';
  if (mission.id === 'bayview-job' && world.missionStage === 1) {
    return 'Bring it home to Reyes Garage';
  }
  return mission.objective;
}

/**
 * Start a job: set its stage and timer, and for the heat job, put the wanted
 * level on the player so there is something to lose.
 */
export function startMission(world, index) {
  world.missionIndex = index;
  world.missionStage = 0;
  world.missionTimer = 0;
  world.missionDone = false;
  if (index === 2) {
    world.wanted = Math.max(world.wanted, 2);
    world.wantedTimer = 0;
  }
}

/** Distance from the player (or their car) to a map point. */
function distanceTo(world, x, y) {
  const px = world.player.x;
  const py = world.player.y;
  return Math.hypot(px - x, py - y);
}

/**
 * One mission step. Returns 'done' when the job completes (the world pays
 * the reward and advances), 'failed' when a job can no longer be finished,
 * otherwise null. `dt` is the fixed step.
 */
export function updateMission(world, dt) {
  const mission = currentMission(world);
  if (mission === null) return null;
  world.missionTimer += dt;

  if (mission.id === 'first-wheels') {
    if (world.player.car !== null) return 'done';
    return null;
  }
  if (mission.id === 'courier') {
    if (world.player.car === null) return null;
    const door = LANDMARK_DOORS['Palm Market'];
    if (distanceTo(world, door.x, door.y) < 95) return 'done';
    return null;
  }
  if (mission.id === 'heat-wave') {
    if (world.wanted === 0 && world.missionTimer > 2) return 'done';
    return null;
  }
  if (mission.id === 'bayview-job') {
    if (world.missionStage === 0) {
      const door = LANDMARK_DOORS['Bayview Bank'];
      if (distanceTo(world, door.x, door.y) < 95) {
        world.missionHold += dt;
        if (world.missionHold >= 4) {
          world.missionStage = 1;
          world.missionTimer = 0;
        }
      } else {
        world.missionHold = 0;
      }
      return null;
    }
    if (world.missionStage === 1) {
      const door = LANDMARK_DOORS['Reyes Garage'];
      if (distanceTo(world, door.x, door.y) < 110) return 'done';
      return null;
    }
    return null;
  }
  if (mission.id === 'kingpins-call') {
    const door = LANDMARK_DOORS.Marina;
    if (distanceTo(world, door.x, door.y) < 95) return 'done';
    return null;
  }
  return null;
}

/** The bank hold: seconds the player has stood at the Bayview door. */
export function bankHoldTime(world) {
  if (currentMission(world)?.id !== 'bayview-job') return 0;
  if (world.missionStage !== 0) return 0;
  return world.missionHold;
}

export function bankPlace() {
  return landmark('Bayview Bank');
}
