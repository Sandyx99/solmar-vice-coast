// Drawing only: the world's state and the current screen in, pixels out. The
// camera follows the player across the 3600x2600 city and shows a 1280x720
// window of it; the HUD, the circular minimap and the panels are drawn in
// screen space on top. Buildings get a side face and a shadow so the flat
// map reads as a little 2.5D.

import { AVENUES, BEACH_X, FONT, PALETTE, SEA_X, STREETS, VIEW, WORLD } from './config.js';
import { BUILDINGS, TREES } from './city.js';
import { KIND_POLICE } from './vehicles.js';
import { bankHoldTime, missionMarker, missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

const PANEL = { width: 660, line: 32 };
const MAP_R = 86;
const MAP_CX = VIEW.width - 106;
const MAP_CY = 128;

/** The camera follows the player and never shows outside the world. */
function cameraFor(player) {
  const x = Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2));
  const y = Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height / 2));
  return { x, y };
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(angle) * rad;
    const py = y + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  let camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight ?? ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align ?? 'left';
    ctx.fillText(value, x, y);
  }

  function inView(x, y, margin) {
    return x > camera.x - margin && x < camera.x + VIEW.width + margin
      && y > camera.y - margin && y < camera.y + VIEW.height + margin;
  }

  function drawGround() {
    const vx = camera.x;
    const vy = camera.y;
    const vw = VIEW.width;
    const vh = VIEW.height;
    ctx.fillStyle = PALETTE.block;
    ctx.fillRect(vx, vy, vw, vh);
    // Beach and sea on the east edge.
    if (BEACH_X < vx + vw) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(Math.max(BEACH_X, vx), vy, vw, vh);
      ctx.fillStyle = PALETTE.sandWet;
      ctx.fillRect(Math.max(SEA_X - 60, vx), vy, 60, vh);
    }
    if (SEA_X < vx + vw) {
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(Math.max(SEA_X, vx), vy, vw, vh);
      ctx.fillStyle = PALETTE.seaDeep;
      ctx.fillRect(Math.max(SEA_X, vx), vy, vw, 60);
      ctx.strokeStyle = PALETTE.wave;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = vy - (vy % 90) + 45; y < vy + vh; y += 90) {
        for (let x = Math.max(SEA_X + 20, vx); x < vx + vw; x += 140) {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 22, y - 8, x + 44, y);
        }
      }
      ctx.stroke();
    }
    // Roads: asphalt strips with pale edges and a dashed centre line.
    for (const centre of AVENUES) {
      if (centre + 48 < vx || centre - 48 > vx + vw) continue;
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(centre - 48, vy, 96, vh);
      ctx.fillStyle = PALETTE.roadEdge;
      ctx.fillRect(centre - 48, vy, 4, vh);
      ctx.fillRect(centre + 44, vy, 4, vh);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(centre - 58, vy, 10, vh);
      ctx.fillRect(centre + 48, vy, 10, vh);
      ctx.fillStyle = PALETTE.roadLine;
      for (let y = vy - (vy % 64); y < vy + vh; y += 64) {
        ctx.fillRect(centre - 2, y, 4, 30);
      }
    }
    for (const centre of STREETS) {
      if (centre + 48 < vy || centre - 48 > vy + vh) continue;
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(vx, centre - 48, vw, 96);
      ctx.fillStyle = PALETTE.roadEdge;
      ctx.fillRect(vx, centre - 48, vw, 4);
      ctx.fillRect(vx, centre + 44, vw, 4);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(vx, centre - 58, vw, 10);
      ctx.fillRect(vx, centre + 48, vw, 10);
      ctx.fillStyle = PALETTE.roadLine;
      for (let x = vx - (vx % 64); x < vx + vw; x += 64) {
        ctx.fillRect(x, centre - 2, 30, 4);
      }
    }
  }

  function drawBuildings() {
    for (const b of BUILDINGS) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      // Shadow, then the side face (the 2.5D), then the roof.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 8, b.y + 12, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingSide;
      ctx.fillRect(b.x, b.y + b.h - 10, b.w, 10);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h - 10);
      ctx.strokeStyle = PALETTE.buildingTrim;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 12);
      if (b.sign) {
        text(b.sign, b.x + b.w / 2, b.y + b.h / 2 - 4, 17, '#ffffff', 'center', '700');
      }
    }
    for (const tree of TREES) {
      if (!inView(tree.x, tree.y, 20)) continue;
      ctx.fillStyle = PALETTE.palmTrunk;
      ctx.fillRect(tree.x - 2, tree.y - 2, 4, 12);
      ctx.fillStyle = PALETTE.palm;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y - 4, tree.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(marker, time) {
    if (marker === null) return;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    ctx.strokeStyle = PALETTE.markerRing;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
    ctx.fill();
    // A guide arrow at the screen edge when the marker is out of view.
    if (!inView(marker.x, marker.y, 0)) {
      const sx = Math.max(40, Math.min(VIEW.width - 40, marker.x - camera.x));
      const sy = Math.max(40, Math.min(VIEW.height - 40, marker.y - camera.y));
      const angle = Math.atan2(marker.y - (camera.y + sy), marker.x - (camera.x + sx));
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCar(car, time) {
    if (!inView(car.x, car.y, 60)) return;
    const wrecked = car.dead;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(3, 5, 26, 14, car.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(car.angle);
    if (wrecked) {
      ctx.fillStyle = '#5a5f6a';
      ctx.fillRect(-23, -11, 46, 22);
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(-8, -4, 10 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#101216';
      ctx.fillRect(-24, -13, 48, 26);
      ctx.fillStyle = car.color;
      ctx.fillRect(-22, -10, 44, 20);
      ctx.fillStyle = '#20242e';
      ctx.fillRect(-6, -9, 12, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(8, -9, 8, 18);
      if (car.kind === KIND_POLICE) {
        const flash = Math.floor(time * 6) % 2 === 0;
        ctx.fillStyle = flash ? PALETTE.lightRed : PALETTE.lightBlue;
        ctx.fillRect(-4, -11, 8, 22);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(-22, -10, 6, 20);
      }
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, isCop, time) {
    if (!inView(x, y, 30)) return;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isCop ? '#dfe6f2' : '#20242e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13);
    ctx.stroke();
  }

  function drawBullets(state) {
    ctx.strokeStyle = PALETTE.bullet;
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawWorld(state, time) {
    drawGround();
    drawBuildings();
    drawMarker(missionMarker(state), time);
    for (const car of state.cars) drawCar(car, time);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, false, time);
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, '#2f4a7a', true, time);
    const player = state.player;
    if (player.car === null) {
      drawPerson(player.x, player.y, player.angle, PALETTE.player, false, time);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawBullets(state);
  }

  function drawMinimap(state, time) {
    const scale = (MAP_R * 2) / WORLD.width;
    ctx.save();
    ctx.beginPath();
    ctx.arc(MAP_CX, MAP_CY, MAP_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1b1e26';
    ctx.fillRect(MAP_CX - MAP_R, MAP_CY - MAP_R, MAP_R * 2, MAP_R * 2);
    const ox = MAP_CX - MAP_R;
    const oy = MAP_CY - MAP_R;
    const sy = (WORLD.height / WORLD.width) * MAP_R * 2;
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(ox + SEA_X * scale, oy, MAP_R * 2, sy);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(ox + BEACH_X * scale, oy, (SEA_X - BEACH_X) * scale, sy);
    ctx.strokeStyle = '#565d6d';
    ctx.lineWidth = 2;
    for (const centre of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(ox + centre * scale, oy);
      ctx.lineTo(ox + centre * scale, oy + sy);
      ctx.stroke();
    }
    for (const centre of STREETS) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + centre * scale);
      ctx.lineTo(ox + MAP_R * 2, oy + centre * scale);
      ctx.stroke();
    }
    const marker = missionMarker(state);
    if (marker !== null) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(ox + marker.x * scale, oy + marker.y * scale, 5 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== KIND_POLICE) continue;
      ctx.fillStyle = PALETTE.lightRed;
      ctx.beginPath();
      ctx.arc(ox + car.x * scale, oy + car.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(ox + state.player.x * scale, oy + state.player.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(MAP_CX, MAP_CY, MAP_R, 0, Math.PI * 2);
    ctx.stroke();
    text('SOLMAR', MAP_CX, MAP_CY + MAP_R + 20, 13, PALETTE.muted, 'center');
  }

  function drawHud(state, time) {
    const player = state.player;
    ctx.textBaseline = 'top';
    text(`$${state.cash.toLocaleString('en-US')}`, 24, 18, 30, PALETTE.cash, 'left', '700');
    const objective = missionObjective(state);
    text(objective, 24, 56, 18, PALETTE.text, 'left');
    if (state.storyDone) {
      text('THE CITY IS YOURS', 24, 80, 16, PALETTE.banner, 'left', '700');
    }
    const hold = bankHoldTime(state);
    if (hold > 0) {
      text(`Hold the door… ${Math.min(4, Math.ceil(hold))}/4`, 24, 104, 18, PALETTE.marker, 'left', '700');
    }
    for (let star = 0; star < 5; star += 1) {
      ctx.fillStyle = star < state.wanted ? PALETTE.star : PALETTE.starEmpty;
      starPath(ctx, VIEW.width / 2 - 80 + star * 40, 34, 15);
      ctx.fill();
    }
    drawMinimap(state, time);
    // Health bar, bottom left.
    text('HEALTH', 24, VIEW.height - 52, 14, PALETTE.muted, 'left', '700');
    ctx.fillStyle = '#20242e';
    ctx.fillRect(24, VIEW.height - 32, 220, 16);
    ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(24, VIEW.height - 32, 220 * Math.max(0, player.health / 100), 16);
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, VIEW.height - 32, 220, 16);
    if (player.car !== null) {
      const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
      text(`${kmh} km/h`, VIEW.width - 24, VIEW.height - 52, 26, PALETTE.text, 'right', '700');
      text('E — get out', VIEW.width - 24, VIEW.height - 26, 14, PALETTE.muted, 'right');
    } else {
      text('E — steal a car', VIEW.width - 24, VIEW.height - 52, 16, PALETTE.muted, 'right');
      text('Click — shoot · F — punch', VIEW.width - 24, VIEW.height - 26, 14, PALETTE.muted, 'right');
    }
    text('WASD move · Shift run · P pause', VIEW.width / 2, VIEW.height - 26, 14, PALETTE.muted, 'center');
  }

  function drawBanner(banner, time) {
    if (banner === null || time > banner.until) return;
    const width = 560;
    const x = (VIEW.width - width) / 2;
    ctx.fillStyle = 'rgba(24,28,38,0.92)';
    ctx.fillRect(x, 120, width, 56);
    ctx.strokeStyle = PALETTE.banner;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, 120, width, 56);
    text(banner.text, VIEW.width / 2, 138, 22, PALETTE.banner, 'center', '700');
  }

  function drawPanel(title, lines, prompt, titleColor) {
    const height = 150 + lines.length * PANEL.line + 70;
    const width = PANEL.width;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(24,28,38,0.94)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 74, 52, titleColor ?? PALETTE.text, 'center', '800');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + 132 + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.banner, 'center', '700');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen. */
  function draw(state, screen, save, banner, time) {
    camera = cameraFor(state.player);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - camera.x * view.scale, view.y - camera.y * view.scale);
    drawWorld(state, time);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'A top-down open-world crime story in Solmar.',
        'Steal cars, lose the heat, run five jobs for Mara Reyes.',
        `Cash saved: $${(save?.cash ?? 0).toLocaleString('en-US')} · Jobs done: ${save?.missionIndex ?? 0} / 5`,
        '',
        'WASD move & drive · E steal a car · Click shoot',
        'F punch · Shift run · P pause',
      ];
      drawPanel('SOLMAR', lines, 'Press Space or click to start', PALETTE.banner);
      return;
    }
    drawHud(state, time);
    drawBanner(banner, time);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', [
        `Cash kept: $${state.cash.toLocaleString('en-US')}`,
        `Jobs done: ${state.missionIndex} / 5`,
      ], 'Press Space to try again', PALETTE.healthLow);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'The Solmar PD caught up with you.',
        `Cash kept: $${state.cash.toLocaleString('en-US')} · Jobs done: ${state.missionIndex} / 5`,
      ], 'Press Space to try again', PALETTE.lightBlue);
    }
  }

  /** Turn a point on the page (CSS pixels) into a point in the world. */
  function toWorld(clientX, clientY) {
    return {
      x: (clientX * view.ratio - view.x) / view.scale + camera.x,
      y: (clientY * view.ratio - view.y) / view.scale + camera.y,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld };
}
