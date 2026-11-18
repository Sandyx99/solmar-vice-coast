// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player across Solmar at a fixed zoom; the city, cars, people, bullets and
// particles are painted in world space, then the HUD, the minimap and any panel in screen
// space. Nothing here changes the simulation.

import { AVENUES, BEACH_X, FONT, PALETTE, ROAD_W, SIDEWALK, STREETS, WATER_X, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1180; // World units across the screen at the default zoom.
const MINIMAP_R = 96;

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0, scale: 1 };
  const fonts = new Map();
  let miniBase = null;
  let miniCity = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    cam.scale = canvas.width / VIEW_W;
  }

  function font(size, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, weight) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align ?? 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** Screen (CSS) pixels to world units, for the mouse aim point. */
  function mouseToWorld(mx, my) {
    const ratio = window.devicePixelRatio || 1;
    const px = mx * ratio;
    const py = my * ratio;
    return { x: cam.x + (px - canvas.width / 2) / cam.scale, y: cam.y + (py - canvas.height / 2) / cam.scale };
  }

  function inView(x, y, margin) {
    const halfW = canvas.width / cam.scale / 2 + margin;
    const halfH = canvas.height / cam.scale / 2 + margin;
    return x > cam.x - halfW && x < cam.x + halfW && y > cam.y - halfH && y < cam.y + halfH;
  }

  function drawCity(state) {
    const city = state.city;
    // Grass base for the whole island, then sand and water on the east edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, WORLD.h);
    const wave = Math.sin(state.time * 0.8) * 6;
    const grad = ctx.createLinearGradient(WATER_X, 0, WORLD.w, 0);
    grad.addColorStop(0, PALETTE.water);
    grad.addColorStop(1, PALETTE.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(WATER_X, 0, WORLD.w - WATER_X, WORLD.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let y = 40; y < WORLD.h; y += 130) {
      ctx.beginPath();
      ctx.moveTo(WATER_X + 8, y + wave);
      ctx.quadraticCurveTo(WATER_X + 40, y + wave + 10, WATER_X + 70, y + wave);
      ctx.stroke();
    }

    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(park.x, park.y, park.w, 10);
    }
    // Parking lots.
    for (const lot of city.lots) {
      ctx.fillStyle = '#6b6f78';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 14);
        ctx.lineTo(x, lot.y + 44);
        ctx.stroke();
      }
    }

    // Roads: sidewalk band, asphalt, centre dashes.
    for (const ax of AVENUES) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(ax - ROAD_W / 2 - SIDEWALK, 0, ROAD_W + SIDEWALK * 2, WORLD.h);
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.h);
    }
    for (const sy of STREETS) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, sy - ROAD_W / 2 - SIDEWALK, WORLD.w, ROAD_W + SIDEWALK * 2);
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(0, sy - ROAD_W / 2, WORLD.w, ROAD_W);
    }
    ctx.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = 0; y < WORLD.h; y += 64) ctx.fillRect(ax - 2, y + 14, 4, 30);
    }
    for (const sy of STREETS) {
      for (let x = 0; x < WORLD.w; x += 64) ctx.fillRect(x + 14, sy - 2, 30, 4);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(ax + i * 12 - 4, sy - ROAD_W / 2 - 4, 8, 10);
          ctx.fillRect(ax + i * 12 - 4, sy + ROAD_W / 2 - 6, 8, 10);
        }
      }
    }

    // Buildings: a drop shadow for height, the roof, windows, and the landmark's name.
    for (const b of city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      ctx.fillStyle = PALETTE.buildingEdge;
      ctx.fillRect(b.x + b.hgt * 0.45, b.y + b.hgt * 0.55, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 12 + cx * 34, b.y + 12 + cy * 34, 16, 12);
        }
      }
      if (b.name) {
        text(b.name, b.x + b.w / 2, b.y + b.h / 2 - 4, 15, 'rgba(255,255,255,0.92)', 'center', '700 ');
        text(b.kind === 'club' ? 'CLUB' : 'SOLMAR', b.x + b.w / 2, b.y + b.h / 2 + 14, 11, 'rgba(255,255,255,0.7)', 'center');
      }
    }

    // Trees: trunk and two-tone canopy.
    for (const t of city.trees) {
      if (!inView(t.x, t.y, 40)) continue;
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 6);
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.5, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, time) {
    const def = car.def;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#14161c';
    const wl = def.len * 0.32;
    const ww = def.wid / 2 + 1;
    ctx.fillRect(-wl, -ww - 3, 16, 6);
    ctx.fillRect(wl - 8, -ww - 3, 16, 6);
    ctx.fillRect(-wl, ww - 3, 16, 6);
    ctx.fillRect(wl - 8, ww - 3, 16, 6);
    // Body.
    ctx.fillStyle = car.policeCar ? '#e8e8e8' : car.color;
    roundRect(ctx, -def.len / 2, -def.wid / 2, def.len, def.wid, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (car.policeCar) {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(-def.len / 2 + 6, -def.wid / 2, def.len * 0.32, def.wid);
      ctx.fillRect(def.len / 2 - 14, -def.wid / 2, 8, def.wid);
    }
    // Windshield and roof.
    ctx.fillStyle = 'rgba(180,220,235,0.9)';
    ctx.fillRect(-def.len * 0.18, -def.wid / 2 + 3, def.len * 0.16, def.wid - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(def.len * 0.05, -def.wid / 2 + 4, def.len * 0.22, def.wid - 8);
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(def.len / 2 - 3, -def.wid / 2 + 4, 3, 5);
    ctx.fillRect(def.len / 2 - 3, def.wid / 2 - 9, 3, 5);
    // Police light bar, flashing red/blue.
    if (car.policeCar) {
      const red = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = red ? '#ff2e2e' : '#2e7dff';
      ctx.beginPath();
      ctx.arc(-2, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = red ? '#2e7dff' : '#ff2e2e';
      ctx.beginPath();
      ctx.arc(-2, 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(person, time) {
    if (person.dead && person.fade > 3) return;
    ctx.save();
    ctx.globalAlpha = person.dead ? Math.max(0, 1 - person.fade / 4) : 1;
    ctx.translate(person.x, person.y);
    if (person.dead) {
      ctx.rotate(person.angle + Math.PI / 2);
      ctx.fillStyle = person.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = person.skin;
      ctx.beginPath();
      ctx.arc(12, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(time * 9 + person.id * 2) * 1.5;
    ctx.rotate(person.angle);
    ctx.fillStyle = person.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(5 + bob * 0.3, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    if (person.kind === 'cop' || person.kind === 'guard') {
      ctx.fillStyle = '#14161c';
      ctx.fillRect(2, -7, 8, 14);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(8, -2, 3, 4);
    }
    ctx.restore();
  }

  function drawPlayer(state, time) {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.inCar) { ctx.restore(); return; }
    const blink = p.hurtIn > 0 && Math.floor(time * 14) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;
    ctx.rotate(p.aim);
    // Shadow, body, head, cap — Mara in her yellow jacket.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(6, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c94f6d';
    ctx.fillRect(2, -7, 8, 14);
    // The pistol points where the mouse is.
    ctx.fillStyle = '#22252d';
    ctx.fillRect(12, -2, 12, 4);
    ctx.restore();
  }

  function drawWorld(state) {
    drawCity(state);
    // Mission waypoint beacon.
    const wp = state.mission ? state.mission.waypoint : null;
    if (wp) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      // The label sits above the beacon, on its own dark pill, clear of the building name.
      ctx.font = font(13, '700 ');
      const lw = ctx.measureText(wp.label).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, wp.x - lw / 2, wp.y - 62, lw, 26, 13);
      ctx.fill();
      text(wp.label, wp.x, wp.y - 44, 13, '#ffd23f', 'center', '700 ');
    }
    for (const pk of state.pickups) {
      const bobY = Math.sin(pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bobY);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2.5, -8, 5, 16);
        ctx.fillRect(-8, -2.5, 16, 5);
      } else {
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        text('$', 0, 5, 15, '#fff', 'center', '700 ');
      }
      ctx.restore();
    }
    for (const car of state.cars) {
      if (inView(car.x, car.y, 80)) drawCar(car, state.time);
    }
    for (const person of state.people) {
      if (inView(person.x, person.y, 40)) drawPerson(person, state.time);
    }
    drawPlayer(state, state.time);
    // Bullets as bright streaks.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function buildMinimapBase(city) {
    const size = MINIMAP_R * 2;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const c = off.getContext('2d');
    const s = size / WORLD.w;
    c.fillStyle = '#3d6b45';
    c.fillRect(0, 0, size, size);
    c.fillStyle = '#2fa8c9';
    c.fillRect(WATER_X * s, 0, (WORLD.w - WATER_X) * s, size);
    c.fillStyle = '#e8d5a4';
    c.fillRect(BEACH_X * s, 0, (WATER_X - BEACH_X) * s, size);
    c.fillStyle = '#5d9b52';
    for (const park of city.parks) c.fillRect(park.x * s, park.y * s, park.w * s, park.h * s);
    c.strokeStyle = '#565d66';
    c.lineWidth = 2.5;
    for (const ax of AVENUES) {
      c.beginPath(); c.moveTo(ax * s, 0); c.lineTo(ax * s, size); c.stroke();
    }
    for (const sy of STREETS) {
      c.beginPath(); c.moveTo(0, sy * s); c.lineTo(size, sy * s); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.65)';
    for (const b of city.buildings) c.fillRect(b.x * s, b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
    return off;
  }

  function drawMinimap(state) {
    const city = state.city;
    if (miniCity !== city) {
      miniBase = buildMinimapBase(city);
      miniCity = city;
    }
    const cx = 116;
    const cy = canvas.height / (window.devicePixelRatio || 1) - 132;
    const r = MINIMAP_R;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(miniBase, cx - r, cy - r);
    const s = (r * 2) / WORLD.w;
    const p = state.player;
    const wp = state.mission ? state.mission.waypoint : null;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const car of state.cars) {
      if (car.policeCar) continue;
      ctx.fillRect(cx - r + car.x * s - 1, cy - r + car.y * s - 1, 2, 2);
    }
    for (const car of state.cars) {
      if (!car.policeCar) continue;
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath();
      ctx.arc(cx - r + car.x * s, cy - r + car.y * s, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
    }
    for (const person of state.people) {
      if (person.kind !== 'cop' || person.dead) continue;
      ctx.fillStyle = '#2e7dff';
      ctx.beginPath();
      ctx.arc(cx - r + person.x * s, cy - r + person.y * s, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (wp) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.3;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(cx - r + wp.x * s, cy - r + wp.y * s, 4 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player: a white arrow that turns with them.
    ctx.save();
    ctx.translate(cx - r + p.x * s, cy - r + p.y * s);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    text('SOLMAR', cx, cy + r + 18, 12, 'rgba(255,255,255,0.8)', 'center', '700 ');
  }

  function drawHud(state) {
    const p = state.player;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Top-left: cash and health.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 14, 14, 252, 74, 10);
    ctx.fill();
    text(`$${p.money.toLocaleString('en-US')}`, 28, 44, 26, PALETTE.hudGold, 'left', '800 ');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, 28, 58, 190, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#4ade80' : '#ef4444';
    roundRect(ctx, 28, 58, 190 * (p.health / 100), 12, 6);
    ctx.fill();
    text(`${Math.ceil(p.health)} HP`, 224, 70, 12, '#fff', 'left', '700 ');

    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, w - 208, 14, 194, 46, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.stars ? PALETTE.star : PALETTE.starOff;
      starPath(ctx, w - 186 + i * 36, 37, 13);
      ctx.fill();
    }

    // Top-centre: the job. The panel is sized to the longer of its two lines, so the
    // briefing never runs past the panel's edge.
    if (state.mission) {
      const m = state.mission;
      const sub = m.mission.timer ? `${m.mission.brief}  —  ${Math.max(0, Math.ceil(m.timeLeft))}s` : m.mission.brief;
      ctx.font = font(17, '800 ');
      const titleW = ctx.measureText(m.mission.title).width;
      ctx.font = font(12);
      const briefW = ctx.measureText(sub).width;
      const panelW = Math.min(w - 520, Math.max(360, titleW + 48, briefW + 48));
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, w / 2 - panelW / 2, 14, panelW, 62, 10);
      ctx.fill();
      text(m.mission.title, w / 2, 40, 17, '#fff', 'center', '800 ');
      text(sub, w / 2, 62, 12, 'rgba(255,255,255,0.75)', 'center');
    } else if (state.missionsDone >= 5) {
      text('FREE ROAM — STORY COMPLETE', w / 2, 40, 16, PALETTE.hudGold, 'center', '800 ');
    }

    // Toast under the job panel.
    if (state.time < state.toastUntil && state.toast) {
      ctx.font = font(15, '600 ');
      const tw = ctx.measureText(state.toast).width + 28;
      ctx.fillStyle = 'rgba(12,16,24,0.8)';
      roundRect(ctx, w / 2 - tw / 2, 88, tw, 32, 8);
      ctx.fill();
      text(state.toast, w / 2, 110, 15, '#fff', 'center', '600 ');
    }

    // Bottom-right: speed when driving, hint when on foot.
    if (p.inCar && p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
      text(`${kmh}`, w - 30, h - 84, 44, '#fff', 'right', '800 ');
      text('km/h', w - 30, h - 60, 14, 'rgba(255,255,255,0.7)', 'right');
      text('E — leave car   SPACE — handbrake', w - 30, h - 34, 13, 'rgba(255,255,255,0.75)', 'right');
    } else {
      text('WASD — move   SHIFT — sprint   E — steal car   CLICK — shoot   F — punch   P — pause', w / 2, h - 18, 13, 'rgba(255,255,255,0.8)', 'center');
    }

    // Off-screen waypoint arrow at the screen edge.
    const wp = state.mission ? state.mission.waypoint : null;
    if (wp) {
      const dx = wp.x - p.x;
      const dy = wp.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 620) {
        const a = Math.atan2(dy, dx);
        const ex = w / 2 + Math.cos(a) * (Math.min(w, h) * 0.32);
        const ey = h / 2 + Math.sin(a) * (Math.min(w, h) * 0.32);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = PALETTE.hudGold;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        text(`${Math.round(dist / 10)}m`, ex, ey + 30, 13, PALETTE.hudGold, 'center', '700 ');
      }
    }

    drawMinimap(state);

    // Hurt flash.
    if (p.hurtIn > 0) {
      ctx.fillStyle = `rgba(220,38,38,${(p.hurtIn / 0.6) * 0.22})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,12,20,0.62)';
    ctx.fillRect(0, 0, w, h);
    const pw = 640;
    const ph = 150 + lines.length * 30;
    const x = (w - pw) / 2;
    const y = (h - ph) / 2;
    ctx.fillStyle = 'rgba(12,16,24,0.92)';
    roundRect(ctx, x, y, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = accent ?? PALETTE.hudGold;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(title, w / 2, y + 72, 52, accent ?? PALETTE.hudGold, 'center', '800 ');
    lines.forEach((line, i) => {
      text(line, w / 2, y + 118 + i * 30, 17, 'rgba(255,255,255,0.85)', 'center');
    });
    text(prompt, w / 2, y + ph - 28, 18, '#ffd23f', 'center', '700 ');
    ctx.restore();
  }

  function drawTitle(state, best) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(8,14,24,0.25)');
    grad.addColorStop(0.55, 'rgba(8,14,24,0.05)');
    grad.addColorStop(1, 'rgba(8,14,24,0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    text('SOLMAR', w / 2, h * 0.34, 96, '#ffd23f', 'center', '800 ');
    text('VICE COAST', w / 2, h * 0.34 + 44, 30, '#fff', 'center', '700 ');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(w / 2 - 120, h * 0.34 + 62, 240, 2);
    const lines = [
      'Mara Reyes came home to Solmar with nothing but a fast pair of hands.',
      'Five jobs. One city. Every car yours for the taking — if you can lose the cops.',
      '',
      'WASD move / drive    SHIFT sprint    E steal & leave car    CLICK shoot    F punch',
      'SPACE handbrake    P pause    M mute    The job marker is gold — follow it.',
    ];
    lines.forEach((line, i) => text(line, w / 2, h * 0.52 + i * 28, 16, 'rgba(255,255,255,0.9)', 'center'));
    const save = state.save ?? { money: 50, missionsDone: 0 };
    text(`Save: $${save.money}   •   Jobs done: ${save.missionsDone} of 5`, w / 2, h * 0.52 + lines.length * 28 + 18, 15, '#ffd23f', 'center', '700 ');
    const blink = Math.floor(state.time * 1.6) % 2 === 0;
    if (blink) text('PRESS ENTER TO START', w / 2, h * 0.86, 24, '#fff', 'center', '800 ');
    text('An original game. No Rockstar / GTA content — every street, face and song is ours.', w / 2, h - 22, 12, 'rgba(255,255,255,0.55)', 'center');
    ctx.restore();
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen) {
    const p = state.player;
    const ratio = window.devicePixelRatio || 1;
    cam.x = Math.max((canvas.width / cam.scale) / 2, Math.min(WORLD.w - (canvas.width / cam.scale) / 2, p.x));
    cam.y = Math.max((canvas.height / cam.scale) / 2, Math.min(WORLD.h - (canvas.height / cam.scale) / 2, p.y));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(cam.scale, 0, 0, cam.scale, canvas.width / 2 - cam.x * cam.scale, canvas.height / 2 - cam.y * cam.scale);
    drawWorld(state);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, 0);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits. Your wanted level does not grow while paused.'], 'Press P to keep driving', '#7fb3d5');
    } else if (screen === SCREEN_OVER) {
      const wasted = state.over === 'wasted';
      drawPanel(wasted ? 'WASTED' : 'BUSTED',
        [wasted ? 'Solmar General patched you up. Half your cash is gone.' : 'The Solmar PD took you in. Half your cash is gone.',
         `Jobs done: ${state.missionsDone} of 5   •   Cash earned: $${state.stats.earned}`],
        'Press ENTER to get back out there', wasted ? '#e74c3c' : '#2e7dff');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, mouseToWorld, resize };
}
