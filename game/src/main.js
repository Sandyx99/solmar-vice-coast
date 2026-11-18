// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), the
// renderer paints what is there, and the audio follows the car and the heat.
// The game moves between five screens: title, play, paused, wasted and
// busted. Progress (cash and jobs done) is saved in local storage.
//
// ?seed=N fixes the traffic and the pedestrians. ?shot=start|play|chase|
// mission (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { CAR, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_MISSION, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { currentMission, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** How long a banner stays on screen, in seconds. */
const BANNER_SECONDS = 4.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed), loadSave());
// A debug handle for live playtests (read the state, never write it).
window.__solmar = world;
const renderer = createRenderer(canvas);
const audio = createAudio();

/** The controls when nothing is pressed (the title screen's backdrop). */
const IDLE = {
  moveX: 0, moveY: 0, sprint: false,
  driveThrottle: 0, driveSteer: 0, driveBrake: false,
  enter: false, punch: false, shoot: false, aimX: 0, aimY: 0,
};

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw === null) return { cash: 0, missionIndex: 0 };
    const parsed = JSON.parse(raw);
    return {
      cash: Number(parsed.cash) || 0,
      missionIndex: Math.max(0, Math.min(MISSIONS.length, Number(parsed.missionIndex) || 0)),
    };
  } catch {
    return { cash: 0, missionIndex: 0 };
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      missionIndex: world.state.missionIndex,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, loadSave(), null, world.state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let banner = null;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function showBanner(text) {
    banner = { text, until: world.state.elapsed + BANNER_SECONDS };
  }

  function missionBanner() {
    const mission = currentMission(world.state);
    if (mission === null) return;
    showBanner(`${mission.title} — ${mission.objective}`);
    announce(`Mara Reyes: ${mission.brief}`);
  }

  function startGame() {
    audio.ensure();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    missionBanner();
  }

  function endGame(kind) {
    screen = kind;
    saveGame();
    if (kind === SCREEN_WASTED) announce(`Wasted. Cash kept $${world.state.cash}.`);
    else announce('Busted. The Solmar PD caught up with you.');
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & (EVENT_HIT | EVENT_CRASH)) audio.crash();
    if (events & EVENT_STEAL) {
      audio.steal();
      showBanner('The car is yours now');
    }
    if (events & EVENT_MISSION) {
      audio.jingle();
      const done = world.state.missionIndex - 1;
      const mission = MISSIONS[done];
      showBanner(`Job done: ${mission.title} — +$${mission.reward.toLocaleString('en-US')}`);
      saveGame();
      if (world.state.storyDone) {
        showBanner('THE CITY IS YOURS — free roam, Solmar');
      } else {
        missionBanner();
      }
    }
    if (events & EVENT_BUSTED) endGame(SCREEN_BUSTED);
    else if (events & EVENT_WASTED) endGame(SCREEN_WASTED);
    void EVENT_CASH;
  }

  function buildInput() {
    const snap = input.snapshot();
    const state = world.state;
    const aim = snap.mouseSeen
      ? renderer.toWorld(snap.mouseX, snap.mouseY)
      : { x: state.player.x + Math.cos(state.player.angle) * 120, y: state.player.y + Math.sin(state.player.angle) * 120 };
    const inCar = state.player.car !== null;
    return {
      moveX: snap.moveX,
      moveY: snap.moveY,
      sprint: snap.sprint,
      driveThrottle: inCar ? -snap.moveY : 0,
      driveSteer: inCar ? snap.moveX : 0,
      driveBrake: false,
      enter: false,
      punch: false,
      shoot: snap.shoot,
      aimX: aim.x,
      aimY: aim.y,
    };
  }

  function step(actions, first) {
    const frameInput = buildInput();
    frameInput.enter = first && (actions & ACTION_ENTER) !== 0;
    frameInput.punch = first && (actions & ACTION_PUNCH) !== 0;
    const events = world.step(STEP, frameInput, false);
    react(events);
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM) {
      audio.ensure();
      if (screen === SCREEN_TITLE || screen === SCREEN_WASTED || screen === SCREEN_BUSTED) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, IDLE, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        step(actions, first);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    const player = world.state.player;
    const driving = player.car !== null;
    audio.update(STEP, driving, driving ? Math.abs(player.car.speed) / CAR.topSpeed : 0, world.state.wanted);
    renderer.draw(world.state, screen, loadSave(), banner, world.state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting it run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR — Vice Coast. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
