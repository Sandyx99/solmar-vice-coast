// SOLMAR — Vice Coast: entry point. Boots the world, owns the game loop and
// the screen state machine (start / play / pause / wasted / busted), and runs
// the screenshot poses when the page is asked to. The world does the
// simulating; this file does the wiring.

import { createRng } from './random.js';
import { createWorld, EVENT_CASH, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_OVER } from './world.js';
import { createRenderer } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';
import { runPose, poseNames } from './shots.js';

const canvas = document.getElementById('game');
const rng = createRng(20261118);
const world = createWorld(rng, 20261118);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
// The world plays its own sound effects (gunfire, crashes, pickups, the
// mission jingle) and the engine hum through this audio object.
world.state.audio = audio;

let screen = 'start';
let lastTime = 0;
let overTimer = 0;

function startGame() {
  audio.unlock();
  audio.startMusic();
  world.reset();
  screen = 'play';
}

function applyEvents(events) {
  if (events & EVENT_OVER) {
    screen = world.state.over === 'busted' ? 'busted' : 'wasted';
    overTimer = 0;
    audio.stopMusic();
    if (screen === 'busted') audio.fail();
    else audio.wasted();
  } else if (events & EVENT_MISSION_DONE) {
    audio.mission();
  } else if (events & EVENT_MISSION_FAIL) {
    audio.fail();
  } else if (events & EVENT_CASH) {
    audio.cash();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  const actions = input.takeActions();
  const mouse = input.mouse();

  if (actions & ACTION_MUTE) {
    audio.unlock();
    const muted = audio.toggleMute();
    world.say(muted ? 'Sound off' : 'Sound on', 1.5);
  }

  if (screen === 'start') {
    if (actions & ACTION_CONFIRM) startGame();
    renderer.draw(world, 'start', now / 1000);
    return;
  }
  if (screen === 'pause') {
    if (actions & ACTION_PAUSE) {
      screen = 'play';
      audio.unlock();
    }
    if (actions & ACTION_CONFIRM) startGame();
    renderer.draw(world, 'pause', now / 1000);
    return;
  }
  if (screen === 'wasted' || screen === 'busted') {
    overTimer += dt;
    if ((actions & ACTION_CONFIRM) && overTimer > 0.8) {
      world.respawn();
      audio.unlock();
      audio.startMusic();
      screen = 'play';
    }
    renderer.draw(world, screen, now / 1000);
    return;
  }

  if (actions & ACTION_PAUSE) {
    screen = 'pause';
    renderer.draw(world, 'pause', now / 1000);
    return;
  }

  const st = world.state;
  const mouseWorld = renderer.screenToWorld(mouse.x, mouse.y);
  const controls = {
    move: input.move(),
    sprint: input.sprint(),
    brake: input.brake(),
    aim: mouseWorld,
    firing: mouse.down,
    punch: Boolean(actions & ACTION_PUNCH),
    enter: Boolean(actions & ACTION_ENTER),
  };
  const events = world.step(dt, controls);
  applyEvents(events);
  renderer.draw(world, 'play', now / 1000);
}

// Screenshot poses, for the entry's four shots: the page is opened with
// ?shot=<name>, the pose runs, and window.__shotReady flips true when the
// frame is ready to capture.
function runShotPose() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  audio.unlock();
  const pose = runPose(world, shot);
  let frames = 0;
  const stepMs = 1000 / 60;
  const interval = setInterval(() => {
    const events = world.step(stepMs / 1000, pose.controls());
    applyEvents(events);
    frames += 1;
    renderer.draw(world, 'play', frames / 60);
    if (frames >= pose.frames) {
      clearInterval(interval);
      renderer.draw(world, 'play', frames / 60);
      window.__shotReady = true;
    }
  }, stepMs);
  return true;
}

world.reset();
window.__solmar = { world, renderer, input, audio, poseNames: poseNames() };
if (!runShotPose()) requestAnimationFrame(frame);
