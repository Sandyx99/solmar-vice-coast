// The story of Mara Reyes, wheelwoman of Solmar: five jobs that teach the
// city, then pay for it. Each mission is a small state machine with a title, a
// briefing, a target point (or a list of them), a timer, and a reward. The
// world asks the mission where the marker goes and what counts as done; the
// mission never touches the renderer directly.

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'JOB 1 — FIRST WHEELS',
    brief: 'Reyes needs wheels. Jack any parked car and bring it to the garage.',
    reward: 200,
    startAt: 'garage',
    needsCar: true,
  },
  {
    id: 'the-courier',
    title: 'JOB 2 — THE COURIER',
    brief: 'Three drops, one clock. Deliver the packages around the Neon Mile before time runs out.',
    reward: 350,
    timer: 150,
    drops: 3,
  },
  {
    id: 'heat-wave',
    title: 'JOB 3 — HEAT WAVE',
    brief: 'The Solmar PD is on you — three stars. Lose them: break line of sight and stay clean.',
    reward: 400,
    timer: 75,
    setWanted: 3,
  },
  {
    id: 'bayview-job',
    title: 'JOB 4 — THE BAYVIEW JOB',
    brief: 'Hit Bayview Bank, grab the cash bag, and get it back to Reyes Garage. The guards shoot back.',
    reward: 800,
    needsBag: true,
  },
  {
    id: 'kingpins-call',
    title: 'JOB 5 — THE KINGPIN\u2019S CALL',
    brief: 'One last run: pick up the case at the Marina and deliver it to The Palms. Five stars will follow.',
    reward: 1500,
    timer: 180,
    setWanted: 2,
  },
];

/**
 * A live mission: `index` into MISSIONS, `phase` ('go' | 'deliver' | 'done'),
 * the current waypoint, remaining time, and how many drops are left. `make`
 * starts the next mission from the city's landmarks; `update` is called by the
 * world with what the player just did.
 */
export function createMissionRunner(city) {
  const L = city.landmarks;
  let current = null;

  // Waypoints are the landmarks' front doors (walkable, outside the walls) or
  // points on a street — never a building's centre, where no car or pedestrian
  // can stand.
  function waypointFor(mission, phase, dropIndex) {
    if (mission.id === 'first-wheels') return { x: L.garage.door.x, y: L.garage.door.y, label: 'REYES GARAGE' };
    if (mission.id === 'the-courier') {
      const spots = [
        { x: L.market.door.x, y: L.market.door.y, label: 'PALM MARKET' },
        { x: 2160, y: 1260, label: 'NEON MILE — CLUB NOVA' },
        { x: 1035, y: 1260, label: 'PALM COURT PARK' },
      ];
      return spots[dropIndex % spots.length];
    }
    if (mission.id === 'heat-wave') return { x: L.garage.door.x, y: L.garage.door.y, label: 'LAY LOW AT THE GARAGE' };
    if (mission.id === 'bayview-job') {
      return phase === 'go'
        ? { x: L.bank.door.x, y: L.bank.door.y, label: 'BAYVIEW BANK' }
        : { x: L.garage.door.x, y: L.garage.door.y, label: 'REYES GARAGE' };
    }
    if (mission.id === 'kingpins-call') {
      return phase === 'go'
        ? { x: L.marina.door.x, y: L.marina.door.y, label: 'SOLMAR MARINA' }
        : { x: L.hotel.door.x, y: L.hotel.door.y, label: 'THE PALMS' };
    }
    return { x: L.garage.door.x, y: L.garage.door.y, label: 'REYES GARAGE' };
  }

  return {
    current,
    start(index) {
      const mission = MISSIONS[index];
      if (!mission) return null;
      current = {
        index,
        mission,
        phase: 'go',
        dropIndex: 0,
        dropsLeft: mission.drops ?? 0,
        timeLeft: mission.timer ?? 0,
        hasBag: false,
        waypoint: waypointFor(mission, 'go', 0),
        failed: false,
      };
      return current;
    },
    /** Called when the player reaches the waypoint. Returns 'progress' | 'complete' | null. */
    arrive() {
      if (!current) return null;
      const m = current.mission;
      if (m.id === 'first-wheels') return 'complete';
      if (m.id === 'the-courier') {
        current.dropsLeft -= 1;
        current.dropIndex += 1;
        if (current.dropsLeft <= 0) return 'complete';
        current.waypoint = waypointFor(m, 'go', current.dropIndex);
        return 'progress';
      }
      if (m.id === 'heat-wave') return null; // Done by the timer, not by arriving.
      if (m.id === 'bayview-job') {
        if (current.phase === 'go') {
          current.phase = 'deliver';
          current.hasBag = true;
          current.waypoint = waypointFor(m, 'deliver', 0);
          return 'progress';
        }
        return 'complete';
      }
      if (m.id === 'kingpins-call') {
        if (current.phase === 'go') {
          current.phase = 'deliver';
          current.hasBag = true;
          current.waypoint = waypointFor(m, 'deliver', 0);
          return 'progress';
        }
        return 'complete';
      }
      return null;
    },
    /** Tick the mission clock. Returns 'timeout' when a timed mission runs out. */
    tick(dt) {
      if (!current || !current.mission.timer) return null;
      current.timeLeft -= dt;
      if (current.timeLeft <= 0) {
        current.failed = true;
        return 'timeout';
      }
      return null;
    },
    complete() {
      const done = current;
      current = null;
      return done;
    },
    fail() {
      current = null;
    },
  };
}
