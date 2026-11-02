import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DIRS,
  axialToPixel,
  pixelToAxial,
  hexDistance,
  neighbors,
  hexShape,
  rectShape,
  ringShape,
  cellKey,
} from './hex.js'
import {
  KIND,
  applyMove,
  canSolve,
  escapeCheck,
  evaluateDifficulty,
  hint,
  isSolved,
  makeState,
  movable,
  solve,
} from './puzzle.js'
import { generatePuzzle, constructBoard } from './generator.js'
import { CHAPTERS, TOTAL_LEVELS, dailyLevel, journeyLevel, classicLevel, zenLevel } from './levels.js'
import {
  ACHIEVEMENTS,
  defaultSave,
  isLevelUnlocked,
  normalizeSave,
  recordClear,
  starsFor,
  totalStars,
} from './progress.js'

const state = (cells, tiles) => makeState({ cells, tiles })

test('axial and pixel coordinates round-trip for every cell of a board', () => {
  for (const [q, r] of hexShape(4)) {
    const { x, y } = axialToPixel(q, r)
    assert.deepEqual(pixelToAxial(x, y), { q, r }, `cell ${q},${r}`)
  }
})

test('distance and neighbours follow the axial geometry', () => {
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 }), 0)
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 }), 1)
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 }), 2)
  assert.equal(hexDistance({ q: -2, r: 1 }, { q: 1, r: -1 }), 3)
  assert.equal(neighbors(0, 0).length, 6)
  for (const n of neighbors(2, -1)) assert.equal(hexDistance({ q: 2, r: -1 }, n), 1)
})

test('board shapes are non-empty, unique and in bounds', () => {
  const shapes = [hexShape(2), hexShape(3), rectShape(5, 5), rectShape(6, 4), ringShape(3)]
  for (const cells of shapes) {
    assert.ok(cells.length > 0)
    assert.equal(new Set(cells.map(([q, r]) => cellKey(q, r))).size, cells.length)
  }
  assert.equal(hexShape(2).length, 19)
  assert.equal(ringShape(3).length, 18)
  assert.equal(rectShape(5, 5).length, 25)
  const ring = new Set(ringShape(3).map(([q, r]) => cellKey(q, r)))
  assert.ok(!ring.has('0,0'), 'the ring is hollow')
})

test('a tile escapes only when its whole ray is clear', () => {
  const cells = [[0, 0], [1, 0], [2, 0]]
  const s = state(cells, [
    { q: 0, r: 0, dir: 0 },
    { q: 1, r: 0, dir: 0 },
    { q: 2, r: 0, dir: 0 },
  ])
  assert.equal(escapeCheck(s, 0).reason, 'blocked')
  assert.equal(escapeCheck(s, 0).blocker, 1, 'the first blocker is reported')
  assert.equal(escapeCheck(s, 2).ok, true, 'the tile at the open end leaves')

  const after = applyMove(s, 2)
  assert.equal(isSolved(after), false)
  assert.equal(escapeCheck(after, 1).ok, true)
  const afterTwo = applyMove(after, 1)
  assert.equal(escapeCheck(afterTwo, 0).ok, true)
  assert.equal(isSolved(applyMove(afterTwo, 0)), true)
})

test('rays pass through holes in the board', () => {
  const cells = [[0, 0], [2, 0]]
  const s = state(cells, [{ q: 0, r: 0, dir: 0 }])
  assert.equal(escapeCheck(s, 0).ok, true)
})

test('a locked hex waits for its key, and the key unlocks only its own group', () => {
  const cells = [[0, 0], [1, 0], [0, 1]]
  const s = state(cells, [
    { q: 0, r: 0, dir: 3, kind: KIND.locked, group: 1 },
    { q: 1, r: 0, dir: 0, kind: KIND.key, group: 1 },
    { q: 0, r: 1, dir: 5, kind: KIND.locked, group: 2 },
  ])
  assert.equal(escapeCheck(s, 0).reason, 'locked')
  const unlocked = applyMove(s, 1)
  assert.equal(unlocked.tiles[0].unlocked, true)
  assert.equal(escapeCheck(unlocked, 0).ok, true)
  assert.equal(unlocked.tiles[2].unlocked, false, 'another group stays locked')
})

test('frozen hexes thaw one step per adjacent escape and stop at their need', () => {
  const cells = [[0, 0], [1, 0], [0, 1], [1, -1]]
  const s = state(cells, [
    { q: 0, r: 0, dir: 3, kind: KIND.frozen, needs: 2 },
    { q: 1, r: 0, dir: 1 },
    { q: 0, r: 1, dir: 5 },
    { q: 1, r: -1, dir: 1 },
  ])
  assert.equal(escapeCheck(s, 0).reason, 'frozen')
  const one = applyMove(s, 1)
  assert.equal(one.tiles[0].melt, 1)
  assert.equal(escapeCheck(one, 0).reason, 'frozen', 'still frozen at one of two')
  const two = applyMove(one, 2)
  assert.equal(two.tiles[0].melt, 2)
  assert.equal(escapeCheck(two, 0).ok, true)
})

test('rotors turn when a neighbour escapes, not when anything else does', () => {
  const cells = [[0, 0], [1, 0], [0, 1]]
  const s = state(cells, [
    { q: 0, r: 0, dir: 3 },
    { q: 1, r: 0, dir: 0, kind: KIND.rotor, spin: 1 },
    { q: 0, r: 1, dir: 5, kind: KIND.rotor, spin: -1 },
  ])
  const after = applyMove(s, 0)
  assert.equal(after.tiles[1].dir, 1, 'adjacent rotor turned clockwise')
  assert.equal(after.tiles[2].dir, 4, 'the other adjacent rotor turned the other way')
})

test('a deadlock is reported as unsolvable, a clear line is not', () => {
  const stuck = state([[0, 0], [1, 0]], [
    { q: 0, r: 0, dir: 0 },
    { q: 1, r: 0, dir: 3 },
  ])
  assert.equal(movable(stuck).length, 0)
  assert.equal(canSolve(stuck), false)
  assert.equal(solve(stuck).solvable, false)

  const open = state([[0, 0], [1, 0]], [
    { q: 0, r: 0, dir: 3 },
    { q: 1, r: 0, dir: 0 },
  ])
  assert.equal(canSolve(open), true)
  assert.equal(hint(open), 0)
})

test('generated boards are solvable and deterministic for a seed', () => {
  const spec = { seed: 'unit-test', shape: 'hex', radius: 3, target: 3 }
  const a = generatePuzzle(spec)
  const b = generatePuzzle(spec)
  assert.deepEqual(a, b)
  assert.equal(canSolve(makeState(a)), true)
  assert.ok(a.metrics.rating >= 1 && a.metrics.rating <= 5)
})

test('construction never emits an unsolvable board, even on odd shapes', () => {
  for (const cells of [hexShape(2), rectShape(5, 5), ringShape(3), [[0, 0], [1, 0], [2, 0], [3, 0]]]) {
    const built = constructBoard(`shape-${cells.length}-${cells[0].join(',')}`, cells)
    assert.ok(built, 'a full board is always constructible')
    assert.equal(canSolve(makeState({ cells, tiles: built.tiles })), true)
  }
})

test('every Journey level is solvable, has a hint, and is stable', () => {
  assert.equal(TOTAL_LEVELS, 100)
  assert.equal(CHAPTERS.reduce((n, c) => n + c.count, 0), 100)
  for (let n = 1; n <= TOTAL_LEVELS; n += 1) {
    const level = journeyLevel(n)
    assert.equal(level.id, n)
    assert.ok(level.tiles.length > 0, `level ${n} has tiles`)
    const s = makeState(level)
    assert.equal(canSolve(s), true, `level ${n} is solvable`)
    assert.ok(movable(s).length > 0, `level ${n} offers a first move`)
    assert.ok(!level.metrics.cleared || level.metrics.cleared === true)
    assert.deepEqual(journeyLevel(n).tiles, level.tiles, 'cached level is stable')
  }
})

test('daily challenges are identical for a date and solvable', () => {
  const a = dailyLevel('2026-11-02')
  const b = dailyLevel('2026-11-02')
  assert.deepEqual(a.tiles, b.tiles)
  assert.notDeepEqual(dailyLevel('2026-11-03').tiles, a.tiles)
  assert.equal(canSolve(makeState(a)), true)
})

test('zen and classic boards are solvable', () => {
  for (const level of [zenLevel(1), zenLevel(2), classicLevel(1), classicLevel(9)]) {
    assert.equal(canSolve(makeState(level)), true)
  }
})

test('difficulty sees size and decisions', () => {
  const small = makeState(journeyLevel(1))
  const big = makeState(journeyLevel(95))
  const a = evaluateDifficulty(small)
  const b = evaluateDifficulty(big)
  assert.ok(b.total > a.total)
  assert.ok(b.score > a.score)
})

test('stars reward care, not speed', () => {
  assert.equal(starsFor(19, 19), 3)
  assert.equal(starsFor(21, 19), 3)
  assert.equal(starsFor(25, 19), 2)
  assert.equal(starsFor(19, 19, 1), 2)
  assert.equal(starsFor(19, 19, 2), 1)
  assert.equal(starsFor(40, 19), 1)
})

test('progress records clears, unlocks levels and never mutates its input', () => {
  const start = defaultSave()
  const after = recordClear(start, { mode: 'journey', levelId: 1, stars: 3, tiles: 5 })
  assert.equal(start.totalCleared, 0, 'input untouched')
  assert.equal(after.totalCleared, 1)
  assert.equal(after.tilesCleared, 5)
  assert.equal(after.stars['1'], 3)
  assert.equal(after.unlocked, 2)
  assert.ok(after.achievements.includes('first_ray'))

  const lower = recordClear(after, { mode: 'journey', levelId: 1, stars: 1 })
  assert.equal(lower.stars['1'], 3, 'a worse replay never removes stars')

  assert.equal(isLevelUnlocked(after, 2), true)
  assert.equal(isLevelUnlocked(after, 3), false)
  assert.equal(totalStars(after), 3)
})

test('dailies build a streak and survive normalisation', () => {
  let save = defaultSave()
  save = recordClear(save, { mode: 'daily', levelId: 'daily-2026-11-01', stars: 2 })
  save = recordClear(save, { mode: 'daily', levelId: 'daily-2026-11-02', stars: 3 })
  assert.equal(save.streak.count, 2)
  assert.equal(save.streak.last, '2026-11-02')
  assert.equal(save.daily['2026-11-02'].stars, 3)

  const restored = normalizeSave(JSON.parse(JSON.stringify(save)))
  assert.equal(restored.streak.count, 2)
  assert.equal(restored.daily['2026-11-01'].stars, 2)
})

test('a corrupted save still normalises to a playable one', () => {
  const broken = normalizeSave({ stars: { x: 'nope', 4: 9 }, unlocked: 'abc', daily: { bad: 1 }, settings: null })
  assert.equal(broken.unlocked, 1)
  assert.deepEqual(broken.stars, { 4: 3 })
  assert.deepEqual(broken.daily, {})
  assert.equal(broken.settings.sound, true)
  assert.equal(normalizeSave(null).unlocked, 1)
})

test('every achievement is evaluable on a fresh save', () => {
  const fresh = defaultSave()
  for (const achievement of ACHIEVEMENTS) assert.equal(typeof achievement.check(fresh), 'boolean')
  assert.ok(ACHIEVEMENTS.every((a) => !a.check(fresh)), 'a new save unlocks nothing')
})

test('directions stay inside the six-value range', () => {
  assert.equal(DIRS.length, 6)
  const s = state([[0, 0]], [{ q: 0, r: 0, dir: 9 }])
  assert.equal(s.tiles[0].dir, 3)
})
