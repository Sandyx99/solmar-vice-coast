// The game's rules and state, with no drawing and no browser in it. The
// player, the cars, the people, the bullets, the wanted level and Mara's
// jobs all live here; step() advances one fixed step and returns what
// happened as bit flags, so the caller can play sounds and announce without
// the world knowing about screens or speakers.

import { CAR, PED, PLAYER, POLICE, SPAWN, TRAFFIC, WANTED } from './config.js';
import { LANDMARK_DOORS, PARKED_SPOTS, clampWorld, hitBuilding, inSea, nearestRoadPoint, pushOutOfBuildings } from './city.js';
import {
  KIND_PARKED, KIND_PLAYER, KIND_POLICE, KIND_TRAFFIC,
  createCar, createPoliceCar, createTrafficCar, damageCar, drivePlayerCar, separateCars, updatePoliceCar, updateTrafficCar,
} from './vehicles.js';
import { createCop, createPed, createPedNear, updateCop, updatePed } from './people.js';
import { currentMission, startMission, updateMission } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_HIT = 4;
export const EVENT_CRIME = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_CASH = 128;
export const EVENT_STEAL = 256;
export const EVENT_CRASH = 512;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Raise the wanted level by `amount` stars (capped) and restart the decay clock. */
function raiseWanted(state, amount) {
  if (amount <= 0) return;
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.wantedTimer = 0;
}

export function createWorld(random, save) {
  const state = {
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, health: PLAYER.health,
      car: null, punchTimer: 0, shotTimer: 0, lastDamageAt: -99, shotCrimeTimer: 0,
      moveSpeed: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    wanted: 0,
    wantedTimer: 0,
    cash: save?.cash ?? 0,
    missionIndex: save?.missionIndex ?? 0,
    missionStage: 0,
    missionTimer: 0,
    missionHold: 0,
    missionDone: false,
    storyDone: false,
    elapsed: 0,
    scare: null,
    stats: { stolen: 0, shots: 0, kills: 0 },
  };
  if (state.missionIndex >= 5) state.storyDone = true;

  function spawnTraffic() {
    let guard = 0;
    while (state.cars.filter((c) => c.kind === KIND_TRAFFIC).length < TRAFFIC.count && guard < 60) {
      guard += 1;
      const car = createTrafficCar(random);
      if (distance(car, state.player) < TRAFFIC.spawnClear) continue;
      state.cars.push(car);
    }
  }

  function spawnPeds() {
    let guard = 0;
    while (state.peds.filter((p) => !p.dead).length < PED.count && guard < 80) {
      guard += 1;
      const ped = createPedNear(random, state.player.x, state.player.y);
      state.peds.push(ped);
    }
  }

  function reset() {
    state.player.x = SPAWN.x;
    state.player.y = SPAWN.y;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.car = null;
    state.player.punchTimer = 0;
    state.player.shotTimer = 0;
    state.player.lastDamageAt = -99;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.bullets = [];
    state.wanted = 0;
    state.wantedTimer = 0;
    state.scare = null;
    for (const spot of PARKED_SPOTS) {
      state.cars.push(createCar(spot.x, spot.y, spot.angle, spot.color, KIND_PARKED));
    }
    spawnTraffic();
    spawnPeds();
    state.elapsed = 0;
  }

  /** Bring the police presence in line with the wanted level. */
  function ensurePolice() {
    // The stars keep climbing to 5, but the cars on the road cap at three —
    // more than that boxes the player in and there is no way out.
    const wantCars = Math.min(state.wanted, 3);
    let haveCars = state.cars.filter((c) => c.kind === KIND_POLICE && !c.dead).length;
    let guard = 0;
    while (haveCars < wantCars && guard < 8) {
      guard += 1;
      const spot = nearestRoadPoint(
        state.player.x + (random() < 0.5 ? -1 : 1) * (420 + random() * 260),
        state.player.y + (random() < 0.5 ? -1 : 1) * (420 + random() * 260),
      );
      state.cars.push(createPoliceCar(spot.x, spot.y, random));
      haveCars += 1;
    }
    const wantCops = Math.min(Math.max(0, state.wanted - 1), 2);
    let haveCops = state.cops.filter((c) => !c.dead).length;
    guard = 0;
    while (haveCops < wantCops && guard < 8) {
      guard += 1;
      const spot = nearestRoadPoint(
        state.player.x + (random() < 0.5 ? -1 : 1) * (240 + random() * 160),
        state.player.y + (random() < 0.5 ? -1 : 1) * (240 + random() * 160),
      );
      state.cops.push(createCop(spot.x, spot.y));
      haveCops += 1;
    }
  }

  function clearPolice() {
    state.cars = state.cars.filter((c) => c.kind !== KIND_POLICE);
    state.cops = [];
  }

  function hurtPlayer(amount) {
    const player = state.player;
    if (player.health <= 0) return;
    player.health -= amount;
    player.lastDamageAt = state.elapsed;
    if (player.health <= 0) player.health = 0;
  }

  function fireBullet(from, x, y, angle, speed, damage) {
    state.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, from, damage, life: 1.6 });
  }

  /**
   * One fixed step. `input` carries the frame's controls (see main.js);
   * with `harmless` set the world idles behind the title screen — traffic
   * and pedestrians move, but nothing can be hurt and no job advances.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    const player = state.player;

    if (harmless) {
      for (const car of state.cars) {
        if (car.kind === KIND_TRAFFIC) updateTrafficCar(car, dt, random, state.cars);
      }
      for (const ped of state.peds) updatePed(ped, dt, null, random);
      return events;
    }

    player.punchTimer = Math.max(0, player.punchTimer - dt);
    player.shotTimer = Math.max(0, player.shotTimer - dt);
    player.shotCrimeTimer = Math.max(0, player.shotCrimeTimer - dt);

    // --- the player ---
    if (player.car !== null) {
      const car = player.car;
      drivePlayerCar(car, { throttle: input.driveThrottle, steer: input.driveSteer, brake: input.driveBrake }, dt);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.moveSpeed = Math.abs(car.speed);
      if (input.enter) {
        player.car = null;
        player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
        player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
        const fixed = pushOutOfBuildings(player.x, player.y, PLAYER.radius);
        player.x = fixed.x;
        player.y = fixed.y;
        car.speed = 0;
      }
    } else {
      const moving = Math.hypot(input.moveX, input.moveY);
      const speed = input.sprint ? PLAYER.sprint : PLAYER.walk;
      player.moveSpeed = moving > 0 ? speed : 0;
      if (moving > 0) {
        const nx = player.x + (input.moveX / moving) * speed * dt;
        const ny = player.y + (input.moveY / moving) * speed * dt;
        const fixed = pushOutOfBuildings(nx, ny, PLAYER.radius);
        player.x = fixed.x;
        player.y = fixed.y;
        if (inSea(player.x, player.y)) player.x = Math.min(player.x, 3346);
        const clamped = clampWorld(player.x, player.y, PLAYER.radius + 2);
        player.x = clamped.x;
        player.y = clamped.y;
        player.angle = Math.atan2(input.moveY, input.moveX);
      }
      if (input.enter) {
        let best = null;
        let bestD = 78;
        for (const car of state.cars) {
          if (car.dead) continue;
          const d = distance(car, player);
          if (d < bestD) {
            bestD = d;
            best = car;
          }
        }
        if (best !== null) {
          const wasPolice = best.kind === KIND_POLICE;
          const wasOwned = best.kind === KIND_PLAYER;
          best.kind = KIND_PLAYER;
          best.route = null;
          player.car = best;
          player.x = best.x;
          player.y = best.y;
          player.angle = best.angle;
          if (!wasOwned) {
            state.stats.stolen += 1;
            raiseWanted(state, wasPolice ? 2 : WANTED.steal);
            events |= EVENT_STEAL | EVENT_CRIME;
          }
        }
      }
      if (input.punch && player.punchTimer <= 0) {
        player.punchTimer = PLAYER.punchCooldown;
        player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
        events |= EVENT_PUNCH;
        let victim = null;
        let victimD = PLAYER.punchRange;
        for (const ped of state.peds) {
          if (ped.dead) continue;
          const d = distance(ped, player);
          if (d < victimD) {
            victimD = d;
            victim = { kind: 'ped', who: ped };
          }
        }
        for (const cop of state.cops) {
          if (cop.dead) continue;
          const d = distance(cop, player);
          if (d < victimD) {
            victimD = d;
            victim = { kind: 'cop', who: cop };
          }
        }
        if (victim !== null) {
          if (victim.kind === 'ped') {
            victim.who.dead = true;
            state.stats.kills += 1;
            state.scare = { x: victim.who.x, y: victim.who.y, until: state.elapsed + 2 };
            raiseWanted(state, WANTED.killPed);
            events |= EVENT_CRIME;
          } else {
            victim.who.health -= PLAYER.punchDamage;
            if (victim.who.health <= 0) victim.who.dead = true;
            raiseWanted(state, WANTED.punchCop);
            events |= EVENT_CRIME;
          }
        }
      }
      if (input.shoot && player.shotTimer <= 0) {
        player.shotTimer = PLAYER.shotCooldown;
        player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
        const gx = player.x + Math.cos(player.angle) * (PLAYER.radius + 6);
        const gy = player.y + Math.sin(player.angle) * (PLAYER.radius + 6);
        fireBullet('player', gx, gy, player.angle, PLAYER.bulletSpeed, PLAYER.bulletDamage);
        state.stats.shots += 1;
        state.scare = { x: player.x, y: player.y, until: state.elapsed + 2 };
        if (player.shotCrimeTimer <= 0) {
          player.shotCrimeTimer = 4;
          raiseWanted(state, WANTED.shoot);
          events |= EVENT_CRIME;
        }
        events |= EVENT_SHOT;
      }
    }

    // Slow health recovery after a quiet spell.
    if (player.health > 0 && state.elapsed - player.lastDamageAt > PLAYER.regenDelay) {
      player.health = Math.min(PLAYER.health, player.health + PLAYER.regenRate * dt);
    }

    // --- bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let spent = b.life <= 0;
      if (!spent && hitBuilding(b.x, b.y, 2) !== null) spent = true;
      if (!spent && (b.x < 0 || b.x > 3600 || b.y < 0 || b.y > 2600)) spent = true;
      if (!spent && b.from === 'player') {
        for (const ped of state.peds) {
          if (ped.dead) continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < PED.radius + 4) {
            ped.dead = true;
            state.stats.kills += 1;
            state.scare = { x: ped.x, y: ped.y, until: state.elapsed + 2 };
            raiseWanted(state, WANTED.killPed);
            events |= EVENT_CRIME;
            spent = true;
            break;
          }
        }
        if (!spent) {
          for (const cop of state.cops) {
            if (cop.dead) continue;
            if (Math.hypot(cop.x - b.x, cop.y - b.y) < PED.radius + 4) {
              cop.health -= b.damage;
              if (cop.health <= 0) cop.dead = true;
              spent = true;
              break;
            }
          }
        }
        if (!spent) {
          for (const car of state.cars) {
            if (car.dead || car === player.car) continue;
            if (Math.hypot(car.x - b.x, car.y - b.y) < CAR.radius + 4) {
              damageCar(car, b.damage);
              if (car.kind === KIND_POLICE && car.dead) {
                raiseWanted(state, WANTED.ramCop);
                events |= EVENT_CRIME;
              }
              spent = true;
              break;
            }
          }
        }
      }
      if (!spent && b.from === 'cop') {
        if (player.car === null && Math.hypot(player.x - b.x, player.y - b.y) < PLAYER.radius + 4) {
          hurtPlayer(b.damage);
          events |= EVENT_HIT;
          spent = true;
        } else if (player.car !== null && Math.hypot(player.car.x - b.x, player.car.y - b.y) < CAR.radius + 4) {
          damageCar(player.car, b.damage);
          spent = true;
        }
      }
      if (spent) state.bullets.splice(i, 1);
    }

    // --- traffic ---
    for (const car of state.cars) {
      if (car.kind === KIND_TRAFFIC && !car.dead) updateTrafficCar(car, dt, random, state.cars);
    }
    // Keep the streets full: replace wrecks and empty spots far from the player.
    if (state.cars.filter((c) => c.kind === KIND_TRAFFIC && !c.dead).length < TRAFFIC.count) {
      spawnTraffic();
    }
    state.cars = state.cars.filter((c) => !c.dead || c.kind === KIND_PLAYER);
    state.peds = state.peds.filter((p) => !p.dead);
    if (state.peds.length < PED.count) spawnPeds();

    // --- police ---
    ensurePolice();
    for (const car of state.cars) {
      if (car.kind !== KIND_POLICE || car.dead) continue;
      const rammed = updatePoliceCar(car, player, dt, random);
      if (rammed && player.car !== null) {
        damageCar(player.car, 10 * dt);
        if (player.car.dead) {
          player.car = null;
          events |= EVENT_CRASH;
        }
      }
    }
    for (const cop of state.cops) {
      if (cop.dead) continue;
      const result = updateCop(cop, player, dt, random);
      if (result === 'busted' && player.car === null) {
        events |= EVENT_BUSTED;
      } else if (result === 'shot') {
        const angle = Math.atan2(player.y - cop.y, player.x - cop.x);
        fireBullet('cop', cop.x, cop.y, angle, 640, POLICE.bulletDamage);
        events |= EVENT_SHOT;
      }
    }
    state.cops = state.cops.filter((c) => !c.dead);

    // --- pedestrians: run from gunfire and from fast cars ---
    const scare = state.scare !== null && state.elapsed < state.scare.until ? state.scare : null;
    for (const ped of state.peds) {
      if (ped.state === 'walk' && player.car !== null && Math.abs(player.car.speed) > 120) {
        const d = distance(ped, player.car);
        if (d < 70) {
          ped.state = 'flee';
          ped.panic = 2;
          ped.angle = Math.atan2(ped.y - player.car.y, ped.x - player.car.x);
        }
      }
      updatePed(ped, dt, scare, random);
    }

    // A fast car mowing down a pedestrian is a crime, and it slows the car.
    if (player.car !== null && Math.abs(player.car.speed) > 90) {
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - player.car.x, ped.y - player.car.y) < CAR.radius + PED.radius) {
          ped.dead = true;
          state.stats.kills += 1;
          player.car.speed *= 0.72;
          raiseWanted(state, WANTED.killPed);
          events |= EVENT_CRIME;
        }
      }
    }

    // Cars bumping into each other, and into the player on foot.
    for (let a = 0; a < state.cars.length; a += 1) {
      for (let b = a + 1; b < state.cars.length; b += 1) {
        const ca = state.cars[a];
        const cb = state.cars[b];
        if (ca.dead || cb.dead) continue;
        if (separateCars(ca, cb) > 120) events |= EVENT_CRASH;
      }
    }
    if (player.car === null && player.health > 0) {
      for (const car of state.cars) {
        if (car.dead) continue;
        if (Math.abs(car.speed) < 40) continue;
        if (Math.hypot(car.x - player.x, car.y - player.y) < CAR.radius + PLAYER.radius) {
          hurtPlayer(10 + Math.abs(car.speed) / 40);
          player.x += (player.x - car.x) * 0.4;
          player.y += (player.y - car.y) * 0.4;
          events |= EVENT_HIT | EVENT_CRASH;
        }
      }
    }

    // --- wanted decay: lay low and the heat fades; the Garage cools it faster ---
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      const door = LANDMARK_DOORS['Reyes Garage'];
      const nearGarage = Math.hypot(player.x - door.x, player.y - door.y) < 220;
      const interval = WANTED.decaySeconds / (nearGarage ? WANTED.garageMultiplier : 1);
      if (state.wantedTimer >= interval) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        if (state.wanted === 0) clearPolice();
      }
    }

    // --- missions ---
    const mission = currentMission(state);
    if (mission !== null) {
      const result = updateMission(state, dt);
      if (result === 'done') {
        state.cash += mission.reward;
        state.missionIndex += 1;
        events |= EVENT_MISSION | EVENT_CASH;
        if (state.missionIndex >= 5) {
          state.storyDone = true;
        } else {
          startMission(state, state.missionIndex);
        }
      }
    }

    if (player.health <= 0) events |= EVENT_WASTED;
    return events;
  }

  reset();
  startMission(state, state.missionIndex);
  return { state, reset, step };
}
