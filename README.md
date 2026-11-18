# SOLMAR — Vice Coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun · gta6-01 · Sandyx99/solmar-vice-coast · rank](https://make.fun/badge/gta6-01/Sandyx99/solmar-vice-coast/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun · gta6-01 · Sandyx99/solmar-vice-coast · reward](https://make.fun/badge/gta6-01/Sandyx99/solmar-vice-coast/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down 2.5D open-world crime game in the spirit of GTA 6, built
for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.
Vanilla JavaScript on canvas — no libraries, no network, no build step.

You are Mara Reyes, wheelwoman of Solmar, a sun-soaked coastal city of seven
avenues, five streets, a beach and a marina. Steal cars, outrun the Solmar PD,
and work five story jobs for Reyes — from your first hot-wire to the Kingpin's
Call — while the wanted level climbs from a quiet street to a five-star
manhunt.

## Play

Serve it locally, then open http://localhost:8080:

```sh
node serve.ts
```

Or open `game/index.html` directly in a desktop browser. No build step, no
dependencies.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot / drive |
| E | Steal the nearest car / get out |
| Mouse | Aim |
| Click | Shoot |
| F | Punch |
| Shift | Sprint |
| Space | Handbrake (in a car) |
| P / Esc | Pause |
| M | Mute |

## Features

- Open city 3600×2600: 7 avenues × 5 streets, beach + sea to the east,
  landmarks Reyes Garage, Bayview Bank, The Palms, Solmar General, Palm
  Market, the Neon Mile and the Marina
- On foot and by car — steal parked cars or jack traffic, with traffic and
  pedestrians living their own lives
- Wanted levels 0–5 stars: foot police who chase and arrest, police
  interceptors with sirens that surround you
- Five story missions for Mara Reyes, in order: First Wheels, The Courier,
  Heat Wave, The Bayview Job, The Kingpin's Call — with timers, drops and a
  cash bag to deliver
- Combat: mouse to shoot, F to punch; bank guards shoot back
- HUD with money, health, wanted stars, mission panel + timer, toasts, a live
  circular minimap and an off-screen waypoint arrow
- Start / pause / WASTED / BUSTED screens, localStorage save (money and jobs
  completed carry over), synthesized WebAudio sound (engine, sirens, gunfire,
  a bass loop on the Neon Mile)
- Deterministic world: the same seed (20261118) builds the same city every run

## Files

```
game/
  index.html        Page that loads the game
  src/
    config.js       Constants: city, player, cars, wanted levels, money
    random.js       Seeded RNG (xorshift32)
    city.js         City layout: blocks, buildings, parks, landmarks
    world.js        The simulation: player, police, missions, bullets
    people.js       Pedestrians, foot police, bank guards
    vehicles.js     Car physics, traffic, police pursuit
    input.js        Keyboard + mouse
    audio.js        Synthesized WebAudio sound
    render.js       Canvas rendering, HUD, minimap, screens
    missions.js     The five jobs of Mara Reyes
    shots.js        Scripted poses for the four screenshots
    main.js         Boot, game loop, screen state machine
screenshots/        1-start, 2-play, 3-chase, 4-mission (1280×720)
main.ts             Entrypoint: builds /output/dossier.json
serve.ts            Tiny static server for local play
vendor/
  makefun-game.ts   make.fun dossier library (vendored kit file)
shots.json          The four screenshot poses
LICENSE             MIT
```

## License

MIT — see [LICENSE](LICENSE).
