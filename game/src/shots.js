// Screenshot poses: scripted playthroughs that set the world up and drive it
// to a good frame for each of the four shots. They run through the same step()
// the game loop uses, so what you see in a screenshot is what a player would
// see. `window.__solmarShots` drives them from the page: each pose runs for a
// number of frames, then the page snapshots the canvas.

/** Drive toward a point: throttle forward, steer toward it, brake close in. */
function driveTo(world, target) {
  const p = world.state.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 60) return { move: { x: 0, y: 0 }, brake: true };
  const want = Math.atan2(dy, dx);
  const angle = p.inCar ? p.car.angle : p.angle;
  let diff = want - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    move: { x: Math.max(-1, Math.min(1, diff * 2.2)), y: diff < -2.2 || diff > 2.2 ? 1 : -1 },
    brake: dist < 160,
  };
}

/** Walk toward a point on foot. */
function walkTo(world, target) {
  const p = world.state.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 24) return { move: { x: 0, y: 0 } };
  return { move: { x: Math.abs(dx) > 12 ? Math.sign(dx) : 0, y: Math.abs(dy) > 12 ? Math.sign(dy) : 0 } };
}

const POSES = {
  start(world) {
    // Mara on foot outside Reyes Garage, early morning light, no heat.
    // 40 frames lets the first job's briefing land before the capture.
    world.reset();
    return {
      frames: 40,
      controls() {
        return { move: { x: 0, y: 0 } };
      },
    };
  },
  play(world) {
    // Mara drives a stolen sedan down Ocean Avenue, traffic around her.
    world.reset();
    const car = world.state.cars.find((c) => c.parked);
    if (car) world.state.player.x = car.x;
    world.state.player.y = car.y;
    world.step(0, { move: { x: 0, y: 0 }, enter: true });
    return {
      frames: 170,
      controls() {
        return driveTo(world, { x: 1500, y: 600 });
      },
    };
  },
  chase(world) {
    // Three stars: two interceptors and a foot cop close in on Mara's car.
    world.reset();
    const car = world.state.cars.find((c) => c.parked);
    if (car) {
      world.state.player.x = car.x;
      world.state.player.y = car.y;
    }
    world.step(0, { move: { x: 0, y: 0 }, enter: true });
    world.addHeat(70);
    world.step(0.5, { move: { x: 0, y: 0 } });
    world.step(0.5, { move: { x: 0, y: 0 } });
    world.step(0.5, { move: { x: 0, y: 0 } });
    return {
      frames: 220,
      controls() {
        return driveTo(world, { x: 2100, y: 1300 });
      },
    };
  },
  mission(world) {
    // The Bayview Job: Mara walks into the bank forecourt, cash bag in sight.
    world.reset();
    const p = world.state.player;
    p.x = 1060;
    p.y = 340;
    world.startNextMission();
    for (let i = 0; i < 3; i += 1) world.step(0, { move: { x: 0, y: 0 } });
    world.state.missionRunner.complete();
    world.state.missionsDone = 3;
    world.state.save = { money: p.money, missionsDone: 3 };
    world.startNextMission();
    return {
      frames: 150,
      controls() {
        const wp = world.waypoint();
        return walkTo(world, wp ?? { x: 1050, y: 430 });
      },
    };
  },
};

export function runPose(world, name) {
  const pose = POSES[name];
  if (!pose) throw new Error(`Unknown pose: ${name}`);
  return pose(world);
}

export function poseNames() {
  return Object.keys(POSES);
}
