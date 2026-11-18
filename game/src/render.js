// Everything drawn on the canvas: the city seen from above with a fixed
// north-up map and a camera that follows the player; the HUD; the circular
// minimap; the mission marker and the off-screen waypoint arrow; and the start,
// pause, WASTED and BUSTED screens. Colours come from config's PALETTE so the
// map and the screenshots share one look.

import { AVENUES, BEACH_X, PALETTE, ROAD_W, SIDEWALK, STREETS, WATER_X, WORLD } from './config.js';

const MINIMAP_X = 1000;
const MINIMAP_Y = 100;
const MINIMAP_R = 76;

function fmtMoney(n) {
  return `$${Math.floor(n).toLocaleString('en-US')}`;
}

function fmtTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Screen coordinates of a world point given the camera's top-left corner. */
function toScreen(x, y, cam) {
  return { x: x - cam.x, y: y - cam.y };
}

function drawCar(ctx, car, cam, selected) {
  const s = toScreen(car.x, car.y, cam);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(car.angle);
  const len = car.def.len;
  const wid = car.def.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,28,40,0.9)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.18, -wid / 2 + 5, len * 0.36, wid - 10, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 5, 3, 5);
  ctx.fillRect(len / 2 - 3, wid / 2 - 10, 3, 5);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-len / 2, -wid / 2 + 5, 3, 5);
  ctx.fillRect(-len / 2, wid / 2 - 10, 3, 5);
  if (car.policeCar) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-len * 0.28, -wid / 2, len * 0.56, wid);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PD', 0, 0);
  }
  if (car.policeCar && Math.floor(car.siren * 2) % 2 === 0) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(-len / 4, -wid / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (car.policeCar) {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(len / 4, -wid / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (selected) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.strokeRect(-len / 2 - 6, -wid / 2 - 6, len + 12, wid + 12);
  }
  ctx.restore();
}

function drawPerson(ctx, person, cam, now) {
  const s = toScreen(person.x, person.y, cam);
  ctx.save();
  ctx.translate(s.x, s.y);
  if (person.dead) {
    ctx.globalAlpha = Math.max(0, 1 - person.fade / 4);
    ctx.rotate(person.angle + Math.PI / 2);
  } else {
    ctx.rotate(person.angle);
  }
  const bob = person.dead ? 0 : Math.sin(now * 9 + person.id * 2.1) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.shirt;
  ctx.beginPath();
  ctx.arc(Math.cos(0) * 4 + bob * 0.3, Math.sin(0) * 4, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (person.kind === 'cop') {
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.arc(0, 0, 8, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-5, -2, 10, 2);
  }
  if (person.kind === 'guard') {
    ctx.fillStyle = '#111827';
    ctx.fillRect(-3, -9, 6, 4);
  }
  ctx.restore();
}

function drawWorld(ctx, world, cam, now) {
  const st = world.state;
  const city = st.city;

  // Ground: grass, then sand, then sea.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, 1280, 720);
  const beach = toScreen(BEACH_X, 0, cam);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(beach.x, 0, 1280 - beach.x, 720);
  const water = toScreen(WATER_X, 0, cam);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(water.x, 0, 1280 - water.x, 720);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const wy = ((now * 24 + i * 190) % 900) - 90;
    ctx.beginPath();
    ctx.moveTo(water.x + 6, wy);
    ctx.quadraticCurveTo(water.x + 34, wy + 14, water.x + 6, wy + 28);
    ctx.stroke();
  }

  // Blocks: sidewalks, then parks, lots and buildings.
  for (const ax of AVENUES) {
    const s = toScreen(ax, 0, cam);
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(s.x - ROAD_W / 2 - SIDEWALK, 0, ROAD_W + SIDEWALK * 2, 720);
  }
  for (const sy of STREETS) {
    const s = toScreen(0, sy, cam);
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(0, s.y - ROAD_W / 2 - SIDEWALK, 1280, ROAD_W + SIDEWALK * 2);
  }
  for (const park of city.parks) {
    const s = toScreen(park.x, park.y, cam);
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(s.x, s.y, park.w, park.h);
  }
  for (const lot of city.lots) {
    const s = toScreen(lot.x, lot.y, cam);
    ctx.fillStyle = PALETTE.lot;
    ctx.fillRect(s.x, s.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (let bx = s.x + 16; bx < s.x + lot.w - 16; bx += 44) {
      ctx.beginPath();
      ctx.moveTo(bx, s.y + 8);
      ctx.lineTo(bx, s.y + 34);
      ctx.stroke();
    }
  }
  for (const b of city.buildings) {
    const s = toScreen(b.x, b.y, cam);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(s.x + b.hgt * 0.4, s.y + b.hgt * 0.5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(s.x, s.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(s.x, s.y, b.w, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x, s.y, b.w, b.h);
    if (b.name) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name, s.x + b.w / 2, s.y + b.h / 2);
    }
  }
  for (const tree of city.trees) {
    const s = toScreen(tree.x, tree.y, cam);
    if (s.x < -20 || s.x > 1300 || s.y < -20 || s.y > 740) continue;
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(s.x, s.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(s.x - 3, s.y - 3, tree.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads: asphalt, then centre dashes, then the kerb.
  for (const ax of AVENUES) {
    const s = toScreen(ax, 0, cam);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(s.x - ROAD_W / 2, 0, ROAD_W, 720);
  }
  for (const sy of STREETS) {
    const s = toScreen(0, sy, cam);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(0, s.y - ROAD_W / 2, 1280, ROAD_W);
  }
  ctx.strokeStyle = PALETTE.dash;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const ax of AVENUES) {
    const s = toScreen(ax, 0, cam);
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, 720);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    const s = toScreen(0, sy, cam);
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(1280, s.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Pickups: a green cross for health, a gold $ for cash.
  for (const pk of st.pickups) {
    const s = toScreen(pk.x, pk.y, cam);
    if (s.x < -30 || s.x > 1310 || s.y < -30 || s.y > 750) continue;
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.fillStyle = pk.kind === 'health' ? '#22c55e' : '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : '$', 0, 1);
    ctx.restore();
  }

  // Mission waypoint: a pulsing ring with a bouncing chevron.
  const wp = world.waypoint();
  if (wp) {
    const s = toScreen(wp.x, wp.y, cam);
    const pulse = 1 + Math.sin(now * 4) * 0.18;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -44 - Math.sin(now * 4) * 5);
    ctx.lineTo(-10, -28 - Math.sin(now * 4) * 5);
    ctx.lineTo(10, -28 - Math.sin(now * 4) * 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(wp.label, 0, -52);
    ctx.restore();
  }

  // Parked and traffic cars first, then people, then the driven car on top.
  for (const car of st.cars) {
    if (!car.driven && !car.policeCar) drawCar(ctx, car, cam, false);
  }
  for (const person of st.people) drawPerson(ctx, person, cam, now);
  for (const car of st.cars) {
    if (car.policeCar) drawCar(ctx, car, cam, false);
  }
  const driven = st.cars.find((c) => c.driven);
  if (driven) drawCar(ctx, driven, cam, true);

  // The player on foot: Mara in a red jacket, with an aim line when armed.
  const p = st.player;
  if (!p.inCar) {
    const s = toScreen(p.x, p.y, cam);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(p.angle);
    const bob = Math.sin(now * 10) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d64545';
    ctx.beginPath();
    ctx.arc(4 + bob * 0.3, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(-4, -5, 2.5, 0, Math.PI * 2);
    ctx.arc(-4, 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(250,204,21,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x + Math.cos(p.aim) * 18, s.y + Math.sin(p.aim) * 18);
    ctx.lineTo(s.x + Math.cos(p.aim) * 44, s.y + Math.sin(p.aim) * 44);
    ctx.stroke();
  }

  // Bullets and particles.
  for (const bullet of st.bullets) {
    const s = toScreen(bullet.x, bullet.y, cam);
    ctx.strokeStyle = bullet.fromEnemy ? '#f87171' : '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x - bullet.vx * 0.012, s.y - bullet.vy * 0.012);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }
  for (const pt of st.particles) {
    const s = toScreen(pt.x, pt.y, cam);
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A hurt player sees red at the edges.
  if (p.hurtIn > 0 && !p.inCar) {
    ctx.fillStyle = `rgba(220,38,38,${Math.min(0.35, p.hurtIn * 0.3)})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
}

function drawHud(ctx, world, now) {
  const st = world.state;
  const p = st.player;
  // Top-left: money, health bar, stars.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(16, 14, 260, 84, 10);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fmtMoney(p.money), 30, 48);
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.roundRect(30, 58, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 40 ? '#22c55e' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(30, 58, Math.max(0, (p.health / 100) * 150), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 190, 68);
  // Wanted stars: filled gold, empty dark.
  ctx.font = '26px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < st.stars ? '★' : '☆';
  ctx.fillStyle = st.stars > 0 ? '#facc15' : 'rgba(255,255,255,0.45)';
  ctx.fillText(stars, 30, 92);

  // Mission panel, top-centre.
  if (st.mission) {
    const m = st.mission;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(360, 14, 560, 58, 10);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.mission.title, 640, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    let line = m.waypoint.label;
    if (m.mission.id === 'the-courier') line += ` — drops left: ${m.dropsLeft}`;
    if (m.mission.timer) line += ` — ${fmtTime(m.timeLeft)}`;
    ctx.fillText(line, 640, 58);
  } else if (st.missionsDone >= 5) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(360, 14, 560, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STORY COMPLETE — free roam', 640, 40);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(360, 14, 560, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Next job from Reyes coming up…', 640, 40);
  }
  ctx.textAlign = 'left';

  // Controls reminder, bottom-left.
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  ctx.beginPath();
  ctx.roundRect(16, 668, 420, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E steal car · Mouse shoot · F punch · P pause · M mute', 28, 691);

  // Toast, bottom-centre.
  if (st.toast && now < st.toastUntil) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(st.toast).width + 32;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.beginPath();
    ctx.roundRect(640 - w / 2, 600, w, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(st.toast, 640, 624);
    ctx.textAlign = 'left';
  }

  // Off-screen waypoint arrow, on the screen edge.
  const wp = world.waypoint();
  if (wp) {
    const sx = wp.x - (st.player.x - 640);
    const sy = wp.y - (st.player.y - 360);
    if (sx < 60 || sx > 1220 || sy < 60 || sy > 660) {
      const cx = Math.max(70, Math.min(1210, sx));
      const cy = Math.max(70, Math.min(650, sy));
      const a = Math.atan2(sy - 360, sx - 640);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawMinimap(ctx, world) {
  const st = world.state;
  const p = st.player;
  const cx = MINIMAP_X;
  const cy = MINIMAP_Y;
  const r = MINIMAP_R;
  const scale = (r * 2) / WORLD.w;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1c2b1a';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Sea and sand, player-relative like everything else on the minimap.
  ctx.fillStyle = '#f2d8a7';
  ctx.fillRect(cx + (BEACH_X - p.x) * scale, cy - r, r * 2, r * 2);
  ctx.fillStyle = '#2f6fb2';
  ctx.fillRect(cx + (WATER_X - p.x) * scale, cy - r, r * 2, r * 2);
  // Roads.
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 3;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(cx + (ax - p.x) * scale, cy - r);
    ctx.lineTo(cx + (ax - p.x) * scale, cy + r);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + (sy - p.y) * scale);
    ctx.lineTo(cx + r, cy + (sy - p.y) * scale);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = '#facc15';
  for (const key of Object.keys(st.city.landmarks)) {
    const L = st.city.landmarks[key];
    ctx.beginPath();
    ctx.arc(cx + (L.x - p.x) * scale, cy + (L.y - p.y) * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission waypoint.
  const wp = world.waypoint();
  if (wp) {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(cx + (wp.x - p.x) * scale, cy + (wp.y - p.y) * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police cars.
  ctx.fillStyle = '#3b82f6';
  for (const car of st.cars) {
    if (!car.policeCar) continue;
    ctx.beginPath();
    ctx.arc(cx + (car.x - p.x) * scale, cy + (car.y - p.y) * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The player, always dead centre, as a white triangle.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.inCar ? p.car.angle : p.aim);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR', cx, cy + r + 16);
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, world, screen) {
  const st = world.state;
  if (screen === 'start') {
    ctx.fillStyle = 'rgba(8,12,20,0.82)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR', 640, 210);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('VICE COAST', 640, 258);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText('An open-world crime story. Mara Reyes needs wheels, cash and a way out.', 640, 300);
    ctx.fillText('Five jobs. Five stars of heat. One city that never sleeps.', 640, 326);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PRESS ENTER TO START', 640, 400);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD move / drive · E steal a car · Mouse aim + click to shoot · F punch · P pause · M mute', 640, 440);
    if (st.save && st.save.missionsDone > 0) {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Save found — ${st.save.missionsDone} of 5 jobs done · $${st.save.money}`, 640, 478);
    }
    ctx.textAlign = 'left';
    return;
  }
  if (screen === 'pause') {
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 640, 330);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText('Press P or Esc to resume · Enter to restart the run', 640, 372);
    ctx.textAlign = 'left';
    return;
  }
  if (screen === 'wasted' || screen === 'busted') {
    ctx.fillStyle = screen === 'wasted' ? 'rgba(120,10,10,0.72)' : 'rgba(10,30,80,0.72)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(screen === 'wasted' ? 'WASTED' : 'BUSTED', 640, 330);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('Half your cash is gone. Mara wakes up at Reyes Garage.', 640, 372);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PRESS ENTER TO GET BACK OUT THERE', 640, 420);
    ctx.textAlign = 'left';
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0 };

  function cameraFor(player) {
    cam.x = Math.max(0, Math.min(WORLD.w - 1280, player.x - 640));
    cam.y = Math.max(0, Math.min(WORLD.h - 720, player.y - 360));
  }

  return {
    /** Draw one frame. `screen` is 'play' | 'start' | 'pause' | 'wasted' | 'busted'. */
    draw(world, screen, now) {
      const st = world.state;
      cameraFor(st.player);
      drawWorld(ctx, world, cam, now);
      drawHud(ctx, world, now);
      drawMinimap(ctx, world);
      if (screen !== 'play') drawOverlay(ctx, world, screen);
    },
    /** Convert a screen pixel into a world point, for aiming with the mouse. */
    screenToWorld(sx, sy) {
      return { x: sx + cam.x, y: sy + cam.y };
    },
  };
}
