# DON'T TURN AROUND

Two-player browser horror/thriller. One player walks the building. The other watches through a supernatural channel. **One player sees the monster. The other doesn't.**

> Two players. One monster. Trust nobody.

## Game description

You and a friend enter an abandoned research site. The **Walker** explores in first person with a flashlight, keys, notes, and doors — but cannot normally see **The Hollow**. The **Watcher** flies a grainy surveillance view, switches frequencies (Normal / Spirit / Echo / Danger), and must guide the Walker. Cooperation is required. Trust is not guaranteed.

A round lasts about 10–20 minutes: restore power, find the office key, solve the security keypad, open the exit together, and leave — or don't.

## Features

- Server-authoritative rooms, roles, movement, items, puzzles, monster AI, and endings
- Create / join with a 5-character code, ready up, optional role swap
- Walker: WASD, mouse look, sprint + stamina, flashlight + battery, E to interact
- Watcher: spectral camera, four frequencies, WARN, HOLD SIGNAL
- The Hollow: idle → observe → stalk → hunt, including “do not turn around” events
- Hidden trust, rare Watcher secret objectives, four endings (Escape, Betrayal, Hollow, Loop)
- Cooperative puzzles (symbol keypad, safe breaker, simultaneous exit)
- Randomized key location, puzzle codes, and horror events
- Text chat (WebRTC voice is stubbed for later)
- Reconnect after a brief drop: in-game rooms stay alive for 90 seconds and the client rejoins automatically
- Pause freezes local movement; notes stay on screen long enough to read
- Mobile defaults to low graphics; dual-stick origins stay inside the touch zones

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Three.js, CSS |
| Multiplayer | Socket.IO |
| Backend | Node.js, Express, Socket.IO (authoritative game loop at 15 Hz) |
| Tests | Vitest |

## Installation

```bash
npm install
```

## Development commands

```bash
npm run dev          # game server (3001) + Vite client (5173)
npm run dev:client   # Vite only
npm run dev:server   # Socket.IO server only
npm test             # Vitest (rooms, puzzles, win/loss)
npm run build        # typecheck + production client build
npm start            # serve production client from /dist on port 3001
```

Open **http://localhost:5173** after `npm run dev`.

## How to test multiplayer locally

1. Run `npm run dev`.
2. Open two browser windows at `http://localhost:5173`.
3. Window A: **CREATE ROOM** → copy the code.
4. Window B: **JOIN ROOM** → paste the code → **JOIN**.
5. Optional: host presses **SWAP ROLES**.
6. Both press **READY**. Read the role intro, then **CONTINUE**.
7. Walker: click the canvas to capture the mouse. Watcher: fly with WASD, use keys **1–4** for frequencies, **Q** or **WARN** when The Hollow is behind the Walker, **HOLD SIGNAL** at the exit.

**Walker path (vertical slice):** find the generator → flip the **safe** breaker (Watcher DANGER mode) → find the key (storage / basement / children's / reception) → Watcher SPIRIT/ECHO reads the keypad sequence → Walker enters it in Security → unlock the office → both go to the exit while Watcher holds SIGNAL.

## How multiplayer works

Clients send **actions** only (`player:move`, `player:interact`, `player:flashlight`, `player:switchMode`, `player:chat`, `player:warning`, …). The server owns room membership, roles, positions, inventory, doors, puzzles, monster state, objectives, trust, and win/loss. Snapshots are sent at 15 Hz. The Walker snapshot omits The Hollow unless a brief flash is intended. The Watcher snapshot includes monster pose and (in the right mode) puzzle solutions. Movement is speed- and collision-checked on the server. Rejoin with the same room code if a partner disconnects during a match.

## Project structure

```
src/                 React client, Three.js engine, HUD
  components/        Menu, lobby, HUD, GameView
  game/              Engine, map meshes, Hollow, Walker controls
  multiplayer/       Socket.IO client, interpolation, voice stub
  systems/           Settings, audio, horror effects
  styles/            Global horror UI
server/              Express + Socket.IO authority
  rooms/             RoomManager
  gameState/         GameSession, monster AI, puzzles
  networking/        Event type re-exports
shared/              Types, map, constants (client + server)
tests/               Vitest
public/assets/       Optional audio/textures (placeholders OK)
```

## Environment variables

None required for local play. Vite proxies `/socket.io` to `http://localhost:3001`. See `.env.example`.

## Deployment

Do **not** use GitHub Pages. This game needs a Node.js process and WebSockets (Socket.IO). Static hosts cannot run the multiplayer server.

**Recommended: [Render](https://render.com)** (free web service)

1. Push this repo to GitHub (already set as `https://github.com/biswajit82232/game.git`).
2. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
3. **New + → Web Service →** select `biswajit82232/game`.
4. Use:
   - **Build command:** `npm install --include=dev && npm run build`
   - **Start command:** `npm start`
   - **Health check:** `/health`
   - **Instance:** Free
5. Deploy. Your public URL will look like `https://dont-turn-around.onrender.com`.
6. Open that URL on two phones or browsers, create a room, and play.

Other hosts that work the same way (one Node process, WebSockets, `PORT` env):

- [Railway](https://railway.app) — New project → Deploy from GitHub
- [Fly.io](https://fly.io) — `fly launch`
- Any VPS (DigitalOcean, a home PC with a tunnel) running `npm run build && npm start`

`PORT` is read from the environment (Render/Railway set this). Locally it still defaults to 3001.

Rooms are in-memory: a server restart or sleep (free-tier idle) drops matches. Horizontal scale would need a shared Socket.IO adapter (not included).

## Known limitations

- Placeholder geometry (boxes) instead of authored 3D art
- Procedural Web Audio instead of recorded soundtrack
- Voice chat is a stub (`src/multiplayer/voice.ts`)
- Mobile 3D is not a target; menus are responsive
- In-memory rooms: server restart drops matches
- No account system

## Controls

**Walker:** WASD move · mouse look · Shift sprint · F flashlight · E interact · Esc pause

**Watcher:** WASD fly · mouse look · 1–4 frequencies · Q warn · hold SIGNAL · Esc pause
