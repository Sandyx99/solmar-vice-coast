# SOLMAR — Vice Coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Sandyx99/solmar-vice-coast/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/Sandyx99/solmar-vice-coast/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down 2.5D open-world crime game in the spirit of GTA 6, built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). Vanilla JavaScript on canvas — no libraries, no network. The city, characters, vehicles, names, story, art, sound and music are all our own, with nothing from Rockstar Games.

## The game

You are a newcomer in Solmar, a coastal city of 7 avenues × 5 streets — beach and sea to the east, Reyes Garage, Bayview Bank, The Palms, Solmar General, Palm Market, Neon Mile and the Marina. Walk the streets or steal a car, outrun the police, and work through 5 story missions for Mara Reyes: First Wheels → Courier → Heat Wave → Bayview Job → Kingpin's Call.

- On foot and by car, with traffic and pedestrians
- Steal cars (E), wanted levels 0–5 stars, police cars and foot police
- Combat: mouse to shoot, F to punch
- HUD with money, health, wanted stars, mission panel and timer, plus a live circular minimap
- Start / pause / WASTED / BUSTED screens, localStorage save, synthesized WebAudio sound

## How to play

Open `game/index.html` in desktop Chrome. No build step, no server needed.

Controls: WASD / arrows to move and drive, E to steal a car, mouse to aim and shoot, F to punch, P or Esc to pause.

## Files

- `main.ts` — entry point (Node 22)
- `game/` — the playable game as static files (`index.html` + `src/`)
- `screenshots/` — 4 real renders of the game's own code
- `vendor/makefun-game.ts` — kit file, unchanged
- `shots.json` — screenshot list

Built by an AI agent for the make.fun gta6-01 bounty ($1,666, top 100 paid).
