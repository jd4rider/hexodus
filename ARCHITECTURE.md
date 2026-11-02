# Architecture

```
src/
  hex.js              axial geometry, shapes, rays            (no Phaser)
  puzzle.js           rules, escapes, solver, difficulty      (no Phaser)
  generator.js        deterministic board construction        (no Phaser)
  levels.js           chapters, Journey/Daily/Zen/Classic     (no Phaser)
  progress.js         stars, unlocks, achievements            (no Phaser)
  save.js             localStorage wrapper over progress.js
  sound.js            synthesised Web Audio effects
  puzzle.test.js      node:test suite for everything above
  phaser/
    main.js           entry point
    scene.js          game config + boot scene
    common.js         palettes, buttons, panels, textures
    MenuScene.js      title, modes, theme and sound shortcuts
    LevelsScene.js    chapter pager and level grid
    GameScene.js      board rendering, input, undo, hint, win
    SettingsScene.js   sound, motion, theme, reset
    AchievementsScene.js
```

## Data flow

`level` (cells + tile definitions) → `makeState()` → an immutable-ish state with
`{ board, tiles, moves }`. Every successful tap produces a **new** state via
`applyMove`; the scene swaps its reference and repaints. Nothing in the renderer
can mutate a tile's `alive`, `dir`, `unlocked` or `melt` directly, and the solver
uses the same functions as gameplay, so a hint can never suggest an illegal move.

```
tap → escapeCheck → blocked? shake + pulse
                  → applyMove → tween exit → repaint survivors → solved? → record
```

`busy` is set while an exit tween runs, so rapid tapping cannot interleave two
moves. Undo replaces the whole state with a snapshot and rebuilds the board.

## Rendering

The board is drawn with `Phaser.Graphics` — hexagon faces, arrows, padlocks,
frost cracks and rotor arcs — into a container per tile. Hex size is computed
from the board's pixel bounds so every shape fits the same play area on any
screen. The canvas is 640×940 and uses `Phaser.Scale.FIT`, which keeps the game
fully visible in portrait on phones and desktop windows alike.

Particles are short-lived circles created per escape (and skipped entirely when
reduced motion is on), so there is no unbounded object pool.

## Determinism

Nothing uses `Math.random()` for level content; `createRng(seed)` (mulberry32) is
the only source, and every level carries its seed. Visual particles may use
`Math.random()` because they never affect state.

## Testing

`npm test` runs `src/puzzle.test.js` with `node:test`: coordinate round-trips,
ray blocking, holes, locks, frost, rotors, deadlocks, construction on four board
shapes, all 100 Journey boards, daily determinism, star maths, streak handling,
save normalisation and achievement evaluation.
