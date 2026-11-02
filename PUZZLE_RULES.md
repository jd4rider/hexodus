# Hexodus rules

The board is a set of axial hex cells `{ q, r }` on a pointy-top grid. Cells that
are not part of the board are holes: a ray passes straight through them, and a
tile leaves the board once its ray reaches one.

## Escape

Six directions, fixed and clockwise:

| index | direction | axial step |
| --- | --- | --- |
| 0 | E | `(+1, 0)` |
| 1 | NE | `(+1, −1)` |
| 2 | NW | `(0, −1)` |
| 3 | W | `(−1, 0)` |
| 4 | SW | `(−1, +1)` |
| 5 | SE | `(0, +1)` |

A tile may leave when **every board cell on its outward ray is empty**. The check
walks one step at a time and stops at the first occupied cell; that cell is
reported as the blocker so the UI can pulse it. Sprite positions never decide a
move: `escapeCheck` works from `state.tiles`, and the renderer only mirrors the
result.

Blocked taps are harmless: a short shake, a quiet tone, and no state change. Only
successful escapes count as moves.

## Mechanics

**Locked** — cannot leave until a key of the same `group` escapes. The lock shows
a padlock; the key shows a key glyph. Unlocking is permanent.

**Key** — an ordinary escape tile that, on leaving, unlocks every locked tile in
its group.

**Frozen** — needs `melt` adjacent escapes, where `melt` starts at 0 and `needs`
is 1 or 2. Every surviving neighbour of an escaping tile adds one thaw step, up
to `needs`. The face shows cracks and one dot per required thaw.

**Rotor** — after any adjacent tile escapes, its arrow turns by `spin` (+1 or −1,
i.e. 60° clockwise or anticlockwise). It has no effect on itself when it leaves.

All reactions are deterministic and bounded: at most one step per surviving
neighbour per escape, and no mechanic can create a tile.

## Why plain boards are monotone

Removing a tile can only empty cells, so a tile that is blocked can never become
*more* blocked. Therefore "repeatedly remove any free tile" clears the board if
and only if the board is solvable, and any currently free tile is a safe first
move. Locks and frost preserve this property (they only ever become more free).
Rotors do not — they change arrows — so those boards use memoised DFS.

`hint()` returns `moves[0]` on monotone boards (always safe) and the first move of
a found solution on rotor boards.

## Undo

Undo restores a full snapshot taken before each successful escape: positions,
arrows, lock state, thaw counters and `moves`. Blocked taps are not recorded,
and undo does not refund taps already spent (stars still reflect care).

## Stars

Every tile must leave, so the number of successful moves is always the tile
count; stars therefore measure accuracy, not speed:

- **3 stars** — no hints and at most 2 blocked taps.
- **2 stars** — at most 1 hint and at most `max(4, 40% of tiles)` extra taps.
- **1 star** — anything else.

Replaying a level never lowers its best star count.

## Board shapes

Hexagonal (radius rings), rectangular (offset rows), hollow ring, and hexagons
with cells removed. Because escape rays are computed from board occupancy rather
than a rectangle, all shapes behave identically — holes are simply empty space.
