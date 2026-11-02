# Hexodus — game design

## Pitch

A calm, tactile hex puzzle: read the arrows, find the tile whose path is clear,
and watch it slip away. The board is the puzzle; there is nothing to collect and
nothing to lose.

## Feel

- **Tactile**: each tile is a bevelled hex with a soft shadow; escapes leave a
  short trail and a small burst.
- **Legible**: a blocked tap shakes the tile and pulses the exact blocker, so a
  mistake teaches rather than punishes.
- **Quiet**: no timer in Journey or Zen, no move limit, no fail state, no ads
  during play.

## Modes

| Mode | Boards | Timers | Notes |
| --- | --- | --- | --- |
| Journey | 100 fixed | none | Eight chapters; progress and stars saved |
| Daily | 1 per UTC date | none | Same board for everyone; streak tracked |
| Zen | endless | none | Gentle boards, fresh seed each time |
| Classic | endless stages | none | Radius grows every four stages |

## Chapters

1. **First Escape** — plain hexes, radius 2.
2. **Tangled Paths** — rectangles; longer queues behind each ray.
3. **Locked Away** — padlocks and keys.
4. **Frozen Hexes** — frost that thaws one neighbour at a time.
5. **Twisting Arrows** — rotors that turn when neighbours leave.
6. **Chain Reactions** — a hollow ring; frost around the rim.
7. **Mixed Signals** — locks and frost on a board with holes.
8. **The Great Hexodus** — 61 tiles, every mechanic.

## Progression

Stars measure care (hints and blocked taps), never speed. Clearing a level
unlocks the next; stars only improve. Achievements cover first clears, volume,
chapter milestones, dailies and streaks. Everything is local-first: progress is
written to `localStorage` before any network call, and the arcade client mirrors
it to the account when the player is signed in.

## Visual identity

Four original palettes — Candy Pastel, Ocean Glass, Golden Honeycomb, Midnight
Galaxy — all drawn from code: no image assets, no icon fonts, no externally
hosted textures. The app icon and favicon are a hexagon with an escaping arrow.

## Accessibility

- Reduced-motion setting drops drifting motes and skips travel animations.
- Large tap targets (a full hex is the hit area), safe-area padding, and no
  required keyboard input.
- Contrast-checked text on every theme; symbols (lock, key, cracks, rotor arc)
  carry meaning alongside colour.
- Sound is optional and synthesised; there is no background music to mute.

## Deliberately not built yet

Portals, one-way gates, countdowns and chain hexes are described in the brief and
were left out rather than half-tested. They need solver support and their own
unit tests before they can ship. Purchases and premium themes are also planned;
see `ARCADE_INTEGRATION.md` for what exists today.
