// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed), seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
world.state.audio = audio;

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // The first gesture unlocks sound; the music starts with the first job.
  function unlockSound() {
    audio.unlock();
    audio.startMusic();
  }
  window.addEventListener('pointerdown', unlockSound, { once: true });
  window.addEventListener('keydown', unlockSound, { once: true });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.audio = audio;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Mara Reyes, Solmar. Follow the gold marker.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.wasted();
    announce(world.state.over === 'busted' ? 'Busted. Press Enter to get back out there.' : 'Wasted. Press Enter to get back out there.');
  }

  // One-shot presses, taken once per frame and shared by the screen logic and the step.
  let pendingEnter = false;
  let pendingPunch = false;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (actions & ACTION_PUNCH) pendingPunch = true;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      if (screen === SCREEN_OVER) world.respawn();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function controls() {
    const move = input.move();
    const mouse = input.mouse();
    const taken = { enter: pendingEnter, punch: pendingPunch };
    pendingEnter = false;
    pendingPunch = false;
    return {
      move,
      sprint: input.sprint(),
      brake: input.brake(),
      aim: renderer.mouseToWorld(mouse.x, mouse.y),
      firing: mouse.down,
      enter: taken.enter,
      punch: taken.punch,
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      if (!world.state.over) {
        world.step(STEP, { move: { x: 0, y: 0 }, sprint: false, brake: false, enter: false, punch: false, firing: false, aim: null });
      }
      return;
    }
    const events = world.step(STEP, controls());
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_MISSION_DONE) announce('Job done.');
    else if (events & EVENT_MISSION_FAIL) announce('Job failed.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen);
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  world.reset();
  world.state.audio = audio;
  announce('Solmar, Vice Coast. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
