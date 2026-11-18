// The simulation: one fixed-step update of everything in Solmar. The player walks or
// drives, traffic and pedestrians live their own lives, the police respond to the wanted
// level, bullets and particles fly, and the story mission advances. The loop in main.js
// calls step() with the current controls; shots.js calls it with an autopilot's controls.

import { CAR, MONEY, PEDS, PLAYER, POLICE, SAVE_KEY, TRAFFIC, WANTED, WORLD } from './config.js';
import { buildCity } from './city.js';
import {
  drivePlayerCar, drivePoliceCar, driveTrafficCar, resolveCarCrash,
  spawnParkedCar, spawnPoliceCar, spawnTrafficCar,
} from './vehicles.js';
import { enemyShoot, makeCop, makeGuard, makePed, stepPerson } from './people.js';
import { createMissionRunner, MISSIONS } from './missions.js';

export const EVENT_OVER = 1;
export const EVENT_HIT = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_MISSION_FAIL = 8;
export const EVENT_CASH = 16;

const GARAGE_HEAL = 2;

export function createWorld(random, seed) {
  const state = {
    seed,
    time: 0,
    city: null,
    player: null,
    cars: [],
    people: [],
    bullets: [],
    particles: [],
    pickups: [],
    wantedHeat: 0,
    stars: 0,
    lastCrimeAt: -99,
    missionRunner: null,
    mission: null,
    missionsDone: 0,
    nextMissionAt: 0,
    over: null, // 'wasted' | 'busted' | null
    overAt: 0,
    toast: '',
    toastUntil: 0,
    stats: { earned: 0, stolen: 0, arrests: 0 },
    save: null,
    audio: null,
  };

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return { money: MONEY.start, missionsDone: 0 };
      const parsed = JSON.parse(raw);
      return { money: typeof parsed.money === 'number' ? parsed.money : MONEY.start, missionsDone: parsed.missionsDone | 0 };
    } catch {
      return { money: MONEY.start, missionsDone: 0 };
    }
  }

  function writeSave() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: state.player.money, missionsDone: state.missionsDone }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function say(text, seconds) {
    state.toast = text;
    state.toastUntil = state.time + (seconds ?? 3.5);
  }

  function addHeat(amount) {
    state.wantedHeat = Math.min(100, state.wantedHeat + amount);
    state.lastCrimeAt = state.time;
  }

  function starsFor(heat) {
    let stars = 0;
    for (let i = 0; i < WANTED.lines.length; i += 1) if (heat >= WANTED.lines[i]) stars = i + 1;
    return stars;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.25, 0.6), max: 0.6, color, size: random.range(2, 5) });
    }
  }

  function dropPickup(x, y, kind, value) {
    state.pickups.push({ x, y, kind, value: value ?? 0, bob: random.range(0, Math.PI * 2) });
  }

  function reset() {
    state.time = 0;
    state.city = buildCity(random);
    state.save = loadSave();
    state.cars = [];
    state.people = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.wantedHeat = 0;
    state.stars = 0;
    state.lastCrimeAt = -99;
    state.missionsDone = state.save.missionsDone;
    state.over = null;
    state.toast = '';
    state.toastUntil = 0;
    state.stats = { earned: 0, stolen: 0, arrests: 0 };
    const g = state.city.landmarks.garage;
    // Spawn on the grass south of the garage door, clear of the job-1 waypoint: Mara
    // starts at home, but she still has to go and find wheels.
    state.player = {
      x: g.door.x, y: g.door.y + 140,
      angle: -Math.PI / 2,
      aim: -Math.PI / 2,
      health: PLAYER.health,
      money: state.save.money,
      inCar: false,
      car: null,
      punchIn: 0,
      shootIn: 0,
      hurtIn: 0,
      healIn: 0,
      speed: 0,
    };
    for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(spawnTrafficCar(state.city, random));
    for (let i = 0; i < 6; i += 1) state.cars.push(spawnParkedCar(state.city, random));
    for (let i = 0; i < PEDS.count; i += 1) state.people.push(makePed(state.city, random));
    // Bank guards stand their post from the start.
    const bank = state.city.landmarks.bank;
    state.people.push(makeGuard(state.city, random, bank.x - 40, bank.y + bank.h / 2 + 30));
    state.people.push(makeGuard(state.city, random, bank.x + 40, bank.y + bank.h / 2 + 30));
    // Health and cash scattered where a player looks for them.
    const hospital = state.city.landmarks.hospital;
    dropPickup(hospital.x, hospital.y + hospital.h / 2 + 46, 'health', 0);
    dropPickup(g.x - 120, g.y, 'health', 0);
    dropPickup(1500, 1500, 'cash', 120);
    dropPickup(2400, 1950, 'cash', 90);
    dropPickup(600, 600, 'cash', 75);
    state.missionRunner = createMissionRunner(state.city);
    state.mission = null;
    state.nextMissionAt = 0.5;
  }

  function startNextMission() {
    if (state.missionsDone >= MISSIONS.length) {
      state.mission = null;
      say('STORY COMPLETE — Solmar is yours. Free roam, Mara.', 6);
      writeSave();
      return;
    }
    state.mission = state.missionRunner.start(state.missionsDone);
    if (state.mission) {
      if (state.mission.mission.setWanted) addHeat(WANTED.lines[state.mission.mission.setWanted - 1] + 2);
      say(`${state.mission.mission.title} — ${state.mission.mission.brief}`, 6);
    }
  }

  function completeMission() {
    const done = state.missionRunner.complete();
    if (!done) return EVENT_MISSION_DONE;
    state.player.money += done.mission.reward;
    state.stats.earned += done.mission.reward;
    state.missionsDone += 1;
    state.mission = null;
    state.nextMissionAt = state.time + 2.5;
    say(`JOB DONE — $${done.mission.reward}. ${state.missionsDone} of ${MISSIONS.length} jobs finished.`, 5);
    writeSave();
    return EVENT_MISSION_DONE;
  }

  /** After WASTED / BUSTED: half the cash is gone, the player wakes at the garage. */
  function respawn() {
    const p = state.player;
    p.money = Math.floor(p.money * MONEY.respawnKeep);
    p.health = PLAYER.health;
    if (p.car) {
      p.car.driven = false;
      p.car.parked = true;
      p.car.speed = 0;
      p.car = null;
    }
    p.inCar = false;
    const g = state.city.landmarks.garage;
    p.x = g.door.x;
    p.y = g.door.y + 140;
    p.angle = -Math.PI / 2;
    p.aim = -Math.PI / 2;
    state.wantedHeat = 0;
    state.stars = 0;
    state.over = null;
    state.bullets = [];
    state.cars = state.cars.filter((car) => !car.policeCar);
    state.people = state.people.filter((person) => person.kind !== 'cop');
    state.mission = null;
    state.nextMissionAt = state.time + 1;
    writeSave();
  }

  function failMission(reason) {
    state.missionRunner.fail();
    state.mission = null;
    state.nextMissionAt = state.time + 2;
    say(`JOB FAILED — ${reason}. Talk to Reyes and try again.`, 5);
    return EVENT_MISSION_FAIL;
  }

  function damagePlayer(amount, cause) {
    const p = state.player;
    if (p.hurtIn > 0 || state.over) return 0;
    p.health -= amount;
    p.hurtIn = 0.6;
    burst(p.x, p.y, '#e74c3c', 8, 160);
    if (p.health <= 0) {
      p.health = 0;
      state.over = cause === 'arrest' ? 'busted' : 'wasted';
      state.overAt = state.time;
      if (state.over === 'busted') state.stats.arrests += 1;
      return EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function nearestCar(maxDist, stealableOnly) {
    const p = state.player;
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (car.policeCar) continue;
      if (stealableOnly && car.driven) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    if (car.driver) {
      // Jack it: the driver bails and runs, the law notices.
      car.driver = false;
      const driver = makePed(state.city, random);
      driver.x = car.x + random.range(-30, 30);
      driver.y = car.y + random.range(-30, 30);
      driver.fleeing = 4;
      driver.target = { x: driver.x + random.range(-300, 300), y: driver.y + random.range(-300, 300) };
      state.people.push(driver);
      addHeat(WANTED.stealCar);
      say('Car jacked — the cops saw that.', 2.5);
    } else if (car.parked) {
      addHeat(WANTED.stealCar);
      say('Hot-wired. It is yours now.', 2);
    }
    car.parked = false;
    car.driven = true;
    car.road = null;
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    state.stats.stolen += 1;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    const side = car.angle + Math.PI / 2;
    const x = car.x + Math.cos(side) * 34;
    const y = car.y + Math.sin(side) * 34;
    if (!state.city.isBlocked(x, y, 12)) { p.x = x; p.y = y; }
    else { p.x = car.x - Math.cos(side) * 34; p.y = car.y - Math.sin(side) * 34; }
    p.angle = car.angle;
    car.driven = false;
    car.parked = true;
    car.speed *= 0.4;
    p.inCar = false;
    p.car = null;
  }

  function playerShoot() {
    const p = state.player;
    if (p.shootIn > 0 || p.inCar) return;
    p.shootIn = PLAYER.shootCooldown;
    const a = p.aim;
    state.bullets.push({
      x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: 0.65, fromEnemy: false, damage: PLAYER.bulletDamage,
    });
    burst(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, '#ffd23f', 3, 120);
    addHeat(WANTED.shoot * 0.4);
    state.audio?.shoot();
  }

  function playerPunch() {
    const p = state.player;
    if (p.punchIn > 0 || p.inCar) return;
    p.punchIn = PLAYER.punchCooldown;
    const ax = p.x + Math.cos(p.aim) * PLAYER.punchRange;
    const ay = p.y + Math.sin(p.aim) * PLAYER.punchRange;
    for (const person of state.people) {
      if (person.dead) continue;
      if (Math.hypot(person.x - ax, person.y - ay) < 26) {
        person.health -= PLAYER.punchDamage;
        burst(person.x, person.y, '#f4f1e8', 5, 130);
        if (person.health <= 0) {
          person.dead = true;
          person.fade = 0;
          addHeat(person.kind === 'cop' || person.kind === 'guard' ? WANTED.killCop : WANTED.killPed);
        }
        break;
      }
    }
    state.audio?.punch();
  }

  function updatePolice(dt) {
    const p = state.player;
    const wantCars = WANTED.cars[state.stars];
    const wantCops = WANTED.cops[state.stars];
    let cars = 0;
    let cops = 0;
    for (const car of state.cars) if (car.policeCar) cars += 1;
    for (const person of state.people) if (person.kind === 'cop' && !person.dead) cops += 1;
    if (cars < wantCars && random.chance(dt * 1.4)) {
      const car = spawnPoliceCar(state.city, random, p, p);
      car.policeCar = true;
      state.cars.push(car);
    }
    if (cops < wantCops && random.chance(dt * 1.2)) {
      state.people.push(makeCop(state.city, random, p));
    }
    // Police far away, or with no stars left, give up and leave.
    state.cars = state.cars.filter((car) => {
      if (!car.policeCar) return true;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      return state.stars > 0 || d < 900;
    });
    state.people = state.people.filter((person) => {
      if (person.kind !== 'cop' || person.dead) return true;
      const d = Math.hypot(person.x - p.x, person.y - p.y);
      return state.stars > 0 || d < 700;
    });
  }

  function updateTraffic(dt) {
    const p = state.player;
    let traffic = 0;
    for (const car of state.cars) if (!car.policeCar && !car.driven && !car.parked) traffic += 1;
    if (traffic < TRAFFIC.count && random.chance(dt * 0.8)) {
      const car = spawnTrafficCar(state.city, random);
      if (Math.hypot(car.x - p.x, car.y - p.y) > 500) state.cars.push(car);
    }
    let parked = 0;
    for (const car of state.cars) if (car.parked) parked += 1;
    if (parked < 6 && random.chance(dt * 0.25)) state.cars.push(spawnParkedCar(state.city, random));
  }

  function step(dt, controls) {
    if (state.over) return 0;
    state.time += dt;
    const p = state.player;
    const city = state.city;
    let events = 0;

    if (!state.mission && state.time >= state.nextMissionAt) startNextMission();
    if (state.mission) {
      const result = state.missionRunner.tick(dt);
      if (result === 'timeout') events |= failMission('Out of time.');
    }

    // Wanted level: heat decays only once the player has been clean and unseen a while.
    state.stars = starsFor(state.wantedHeat);
    if (state.time - state.lastCrimeAt > WANTED.decayDelay) {
      state.wantedHeat = Math.max(0, state.wantedHeat - WANTED.decayPerSec * dt);
    }

    p.punchIn = Math.max(0, p.punchIn - dt);
    p.shootIn = Math.max(0, p.shootIn - dt);
    p.hurtIn = Math.max(0, p.hurtIn - dt);
    if (state.stars === 0 && p.health < PLAYER.health) {
      p.healIn += dt;
      if (p.healIn > 1) { p.healIn = 0; p.health = Math.min(PLAYER.health, p.health + GARAGE_HEAL); }
    }

    // --- Player -------------------------------------------------------------
    if (controls.aim) p.aim = Math.atan2(controls.aim.y - p.y, controls.aim.x - p.x);
    if (p.inCar && p.car) {
      const car = p.car;
      const throttle = controls.move.y < 0 ? 1 : controls.move.y > 0 ? -1 : 0;
      drivePlayerCar(city, car, throttle, controls.move.x, controls.brake, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      state.audio?.update(car.speed, car.def.top, state.stars > 0);
      if (controls.enter) exitCar();
      // Ramming a pedestrian at speed is a crime the whole street sees.
      for (const person of state.people) {
        if (person.dead || person.kind === 'cop') continue;
        if (Math.abs(car.speed) > 90 && Math.hypot(person.x - car.x, person.y - car.y) < 30) {
          person.dead = true;
          person.fade = 0;
          addHeat(WANTED.hitPed);
          burst(person.x, person.y, '#e74c3c', 10, 200);
          say('You hit a pedestrian — the heat is on.', 2.5);
        }
      }
    } else {
      const mv = controls.move;
      const len = Math.hypot(mv.x, mv.y) || 1;
      const speed = controls.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const nx = p.x + (mv.x / len) * speed * dt * (mv.x || mv.y ? 1 : 0);
      const ny = p.y + (mv.y / len) * speed * dt * (mv.x || mv.y ? 1 : 0);
      if (!city.isBlocked(nx, p.y, PLAYER.radius)) p.x = nx;
      if (!city.isBlocked(p.x, ny, PLAYER.radius)) p.y = ny;
      if (mv.x || mv.y) p.angle = Math.atan2(mv.y, mv.x);
      else p.angle = p.aim;
      p.speed = (mv.x || mv.y) ? speed : 0;
      state.audio?.update(0, 1, state.stars > 0);
      if (controls.enter) {
        const car = nearestCar(PLAYER.enterCarRange, false);
        if (car) enterCar(car);
      }
      if (controls.punch) playerPunch();
      if (controls.firing) playerShoot();
    }

    // --- Cars ---------------------------------------------------------------
    for (const car of state.cars) {
      if (car.driven || car.parked) continue;
      if (car.policeCar) drivePoliceCar(city, car, p, dt);
      else driveTrafficCar(city, car, state.cars, random, dt);
    }
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const impact = resolveCarCrash(state.cars[i], state.cars[j]);
        if (impact > 260) {
          const mx = (state.cars[i].x + state.cars[j].x) / 2;
          const my = (state.cars[i].y + state.cars[j].y) / 2;
          burst(mx, my, '#f4f1e8', 6, 180);
          if (state.cars[i].driven || state.cars[j].driven) state.audio?.crash(impact);
        }
      }
    }
    // Traffic hitting the player on foot hurts.
    if (!p.inCar) {
      for (const car of state.cars) {
        if (car.parked || car.speed < 60) continue;
        if (Math.hypot(car.x - p.x, car.y - p.y) < 30) {
          events |= damagePlayer(CAR.crashDamage, 'wasted');
          const a = Math.atan2(p.y - car.y, p.x - car.x);
          p.x += Math.cos(a) * 40;
          p.y += Math.sin(a) * 40;
          break;
        }
      }
    }

    // --- People ---------------------------------------------------------------
    const danger = state.bullets.length > 0 ? { x: p.x, y: p.y } : null;
    for (const person of state.people) {
      const result = stepPerson(city, person, random, dt, danger, p);
      if (result === 'arrest') {
        events |= damagePlayer(999, 'arrest');
      }
      if ((person.kind === 'cop' || person.kind === 'guard') && !person.dead) {
        const bullet = enemyShoot(person, p, dt, random);
        if (bullet) {
          state.bullets.push(bullet);
          state.audio?.enemyShoot();
        }
      }
    }
    // The dead fade away; the living keep the streets full.
    state.people = state.people.filter((person) => !person.dead || person.fade < 4);
    let peds = 0;
    for (const person of state.people) if (person.kind === 'ped' && !person.dead) peds += 1;
    if (peds < PEDS.count && random.chance(dt * 0.6)) {
      const ped = makePed(city, random);
      if (Math.hypot(ped.x - p.x, ped.y - p.y) > 420) state.people.push(ped);
    }

    // --- Bullets --------------------------------------------------------------
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (city.isBlocked(bullet.x, bullet.y, 2)) {
        bullet.life = 0;
        burst(bullet.x, bullet.y, '#f4f1e8', 3, 90);
        continue;
      }
      if (bullet.fromEnemy) {
        if (Math.hypot(bullet.x - p.x, bullet.y - p.y) < (p.inCar ? 16 : 14)) {
          bullet.life = 0;
          events |= damagePlayer(bullet.damage, 'wasted');
        }
        continue;
      }
      for (const person of state.people) {
        if (person.dead) continue;
        if (Math.hypot(bullet.x - person.x, bullet.y - person.y) < 15) {
          bullet.life = 0;
          person.health -= bullet.damage;
          burst(person.x, person.y, '#e74c3c', 5, 140);
          if (person.health <= 0) {
            person.dead = true;
            person.fade = 0;
            addHeat(person.kind === 'cop' || person.kind === 'guard' ? WANTED.killCop : WANTED.killPed);
            if (person.kind === 'ped' && random.chance(0.35)) dropPickup(person.x, person.y, 'cash', random.int(20, 80));
          }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);

    // --- Particles and pickups --------------------------------------------------
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const pk of state.pickups) pk.bob += dt * 3;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
        if (pk.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + 35);
          say('Health +35', 2);
        } else {
          p.money += pk.value;
          state.stats.earned += pk.value;
          say(`+$${pk.value}`, 2);
          state.audio?.cash();
          events |= EVENT_CASH;
        }
        state.audio?.pickup();
        state.pickups.splice(i, 1);
      }
    }

    // --- Mission ----------------------------------------------------------------
    if (state.mission) {
      const m = state.mission;
      const wp = m.waypoint;
      const dist = Math.hypot(wp.x - p.x, wp.y - p.y);
      if (m.mission.id === 'heat-wave') {
        if (state.stars === 0) {
          events |= completeMission();
        }
      } else if (m.mission.id === 'first-wheels' && !p.inCar) {
        // Job 1 needs wheels: standing at the garage on foot does not count. The player
        // spawns right here, so this check is what keeps the job honest.
        if (dist < 110 && state.time - (m.hintAt ?? -99) > 4) {
          m.hintAt = state.time;
          say('You need wheels — jack a car with E and bring it here.', 3);
        }
      } else if (dist < 110) {
        const result = state.missionRunner.arrive();
        if (result === 'complete') {
          state.audio?.mission();
          events |= completeMission();
        } else if (result === 'progress') {
          state.audio?.pickup();
          if (m.mission.id === 'the-courier') say(`Drop ${m.dropIndex} of 3 delivered.`, 3);
          if (m.mission.id === 'bayview-job') say('Cash bag grabbed — get it to the garage!', 4);
          if (m.mission.id === 'kingpins-call') say('Case secured — deliver it to The Palms.', 4);
        }
      }
    }

    updatePolice(dt);
    updateTraffic(dt);
    return events;
  }

  return {
    state,
    reset,
    step,
    say,
    writeSave,
    loadSave,
    startNextMission,
    respawn,
    nearestCar,
    addHeat,
    /** The current mission waypoint, for the autopilot and the HUD arrow. */
    waypoint() {
      return state.mission ? state.mission.waypoint : null;
    },
  };
}
