# Level generation

Every board in Hexodus is a pure function of a seed string. No board is stored as
hand-authored data, and no board is published unless it can be cleared.

## Reverse-free construction

The naive approach — random arrows, then test — rejects almost everything on a
dense board, because a full board only exposes tiles whose ray leaves the board
immediately.

Instead `constructBoard` builds the *removal order* first:

1. Start with every board cell occupied.
2. Find every tile that has at least one direction whose ray hits no remaining
   tile (cells already removed are empty, so they do not block).
3. Choose one such tile/direction pair at random from the seeded PRNG, record the
   arrow, remove the tile.
4. Repeat until the board is empty; if a step has no option, discard and retry.

Because each arrow was chosen while its removal was legal, replaying the recorded
order clears the board. Cost is O(n² · 6) for n ≤ 61, so a hundred levels build
in seconds, and no candidate needs a general solver to be accepted.

## Mechanics

Mechanics are injected after construction and the result is re-validated:

- `lock` picks a locked tile and a key tile and checks solvability.
- `frozen` picks a tile with at least one neighbour, sets `needs` to 1 or 2, and
  checks solvability.
- `rotor` flips one tile's arrow on neighbour escapes; rejected unless the
  memoised search can still clear the board (20k node budget).

A rejected injection leaves the board untouched, so a chapter never loses its
solvability guarantee. Rotor chapters use small boards (19 cells) on purpose:
search cost grows with the number of arrow states.

## Solver

- **Monotone boards** (plain, lock, frozen): greedy `greedyClear` is complete and
  produces the frontier profile used for difficulty.
- **Rotor boards**: DFS over `stateKey` (alive bits + arrows + thaw + lock bits)
  with a visited set, node cap, and move ordering that tries keys first.

`canSolve` picks the cheap path unless a rotor is present, and the test suite runs
it over all 100 Journey levels plus the daily board.

## Difficulty

`evaluateDifficulty` reports the decision structure of a clear, not just size:

| field | meaning |
| --- | --- |
| `total` | tiles on the board |
| `initial` | tiles free on the first move |
| `choices` | steps where at least three tiles were free |
| `pairs` | steps with exactly two options |
| `forced` | steps with exactly one option |
| `longestForced` | longest run of forced moves |
| `special` | number of non-plain tiles |

`score = total·0.55 + initial·0.9 + choices·0.85 + pairs·0.4 + longestForced·1.1 + special·2.4`

Rating thresholds (`<38 → 1`, `<45 → 2`, `<55 → 3`, `<75 → 4`, else `5`) are
calibrated against the shipped catalogue: a 19-tile opening board rates 1 and the
61-tile finale rates 5. It is a **within-game relative scale**, not an absolute
difficulty claim — a 19-tile rotor board rates low on volume even though its
arrows move.

## Named seeds

| Mode | Seed | Shape |
| --- | --- | --- |
| Journey level `n` | `hexodus-j<n>` | chapter shape, radius from chapter (+1 every fourth level) |
| Daily `YYYY-MM-DD` | `hexodus-daily-YYYY-MM-DD` | hex / rect / ring chosen by the date hash |
| Zen | `hexodus-zen-<seed>` | hex, radius 2 or 3 |
| Classic stage `n` | `hexodus-classic-<n>` | hex, radius grows every four stages |

The daily date is the UTC date (`new Date().toISOString().slice(0, 10)`), so every
player receives the same board on the same day regardless of timezone.

## Rebuilding the catalogue

Levels are generated at load time and memoised per session, so changing a chapter
definition changes the boards. Any change must keep `npm test` green: the test
suite asserts all 100 boards are solvable and offer a first move.
