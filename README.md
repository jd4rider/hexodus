# Hexodus

A hexagonal escape puzzle for [Little Joy Arcade](https://littlejoyarcade.site).

Every tile carries an arrow. Tap a tile and it flies out of the board — but only
if every hex on its outward ray is already empty. Clear all the tiles and the
board is yours.

- Play: <https://hexodus.littlejoyarcade.site/play/>
- Fallback (GitHub Pages): <https://jd4rider.github.io/hexodus/play/>
- Repository: <https://github.com/jd4rider/hexodus>

## What is in the game

- **Journey** — 100 deterministic, solver-verified boards across eight chapters.
- **Daily Challenge** — one board per UTC date, identical on every device.
- **Zen** — endless gentle boards, no timers, no penalties.
- **Classic** — endless stages that grow a ring every few clears.
- **Locks & keys**, **frost**, and **rotating arrows**, introduced one at a time.
- Undo, solver-backed hints, restart, four themes, synthesised sound, keyboard
  shortcuts, and reduced-motion support.
- Local saves under `hexodus-save-v1`, mirrored to the player's Little Joy
  Arcade account by the drop-in arcade client.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules, generator and progression tests (node:test)
npm run build      # static build in dist/
npm start          # build, then open in Electron
npm run dist:mac   # DMG in release/ (also dist:win, dist:linux)
```

Node 20.19+ or 22.12+ is required by Vite 8.

## The save contract

`localStorage['hexodus-save-v1']` holds one JSON object (see `src/progress.js`):
`unlocked`, `stars`, `daily`, `achievements`, `totalCleared`, `tilesCleared`,
`zenCleared`, `classicBest`, `streak`, `settings`. `normalizeSave` repairs any
missing or malformed field, so an older save never blocks play.

## How it is built

Phaser 4 + Vite, plain ES modules, no TypeScript build step. Every other game in
this arcade ships the same way, which keeps the Pages workflow, Electron
packaging and the drop-in arcade client identical across titles. The puzzle
engine (`src/hex.js`, `src/puzzle.js`, `src/generator.js`) is dependency-free and
unit-tested in Node.

Docs: [GAME_DESIGN.md](GAME_DESIGN.md) · [PUZZLE_RULES.md](PUZZLE_RULES.md) ·
[LEVEL_GENERATION.md](LEVEL_GENERATION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[ARCADE_INTEGRATION.md](ARCADE_INTEGRATION.md) · [DEPLOYMENT.md](DEPLOYMENT.md)

## Release

Push a `v*` tag and the **Release apps** workflow builds macOS, Windows and
Linux installers. Every push to `main` deploys the web build to GitHub Pages;
`public/CNAME` claims `hexodus.littlejoyarcade.site`.
