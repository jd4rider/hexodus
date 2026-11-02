// Deterministic level construction.
//
// Boards are built by choosing an escape order and pointing each tile along a
// ray that is already empty at the moment it leaves. That guarantees the board
// is solvable by construction instead of hoping a random layout is; mechanics
// are then injected and the result is re-validated with the solver.
//
// The alternative (random arrows, then test) needs thousands of rejections on
// dense boards. This is O(n²·6) per level and never publishes a dead board.

import { DIRS, cellKey, shapeCells } from './hex.js'
import {
  KIND,
  applyMove,
  canSolve,
  evaluateDifficulty,
  makeState,
  movable,
} from './puzzle.js'

export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0
  let h = 2166136261
  const str = String(seed)
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small, fast, seeded PRNG (mulberry32). Same seed, same board. */
export function createRng(seed) {
  let a = hashSeed(seed)
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randInt = (rng, n) => Math.floor(rng() * n)

function rayClear(cell, dir, remaining, board) {
  const [dq, dr] = DIRS[dir]
  let q = cell.q
  let r = cell.r
  for (let step = 0; step < 64; step += 1) {
    q += dq
    r += dr
    const k = cellKey(q, r)
    if (!board.has(k)) return true
    if (remaining.has(k)) return false
  }
  return true
}

/** Point every tile so that the produced removal order is legal. */
export function constructBoard(seed, cells) {
  const rng = createRng(seed)
  const board = new Set(cells.map(([q, r]) => cellKey(q, r)))
  const remaining = new Map()
  for (const [q, r] of cells) remaining.set(cellKey(q, r), { q, r })

  const order = []
  const dirs = new Map()

  while (remaining.size > 0) {
    const options = []
    for (const [k, cell] of remaining) {
      const valid = []
      for (let d = 0; d < 6; d += 1) if (rayClear(cell, d, remaining, board)) valid.push(d)
      if (valid.length > 0) options.push({ k, cell, valid })
    }
    if (options.length === 0) return null

    // Uniform choice keeps orders varied; the last few picks are forced anyway.
    const chosen = options[randInt(rng, options.length)]
    const dir = chosen.valid[randInt(rng, chosen.valid.length)]
    dirs.set(chosen.k, dir)
    order.push(chosen.k)
    remaining.delete(chosen.k)
  }

  const tiles = cells.map(([q, r]) => ({ q, r, dir: dirs.get(cellKey(q, r)) }))
  return { tiles, order }
}

function shuffledAlive(state, rng) {
  const ids = []
  state.tiles.forEach((t, i) => {
    if (t.alive) ids.push(i)
  })
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, i + 1)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

function tryLock(state, rng) {
  const ids = shuffledAlive(state, rng).slice(0, 6)
  for (let a = 0; a < ids.length; a += 1) {
    for (let b = 0; b < ids.length; b += 1) {
      if (a === b) continue
      const tiles = state.tiles.map((t) => ({ ...t }))
      const group = 1
      tiles[ids[a]].kind = KIND.locked
      tiles[ids[a]].group = group
      tiles[ids[a]].unlocked = false
      tiles[ids[b]].kind = KIND.key
      tiles[ids[b]].group = group
      const next = { ...state, tiles }
      if (canSolve(next)) return next
    }
  }
  return null
}

function tryFrozen(state, rng) {
  const ids = shuffledAlive(state, rng).slice(0, 8)
  for (const id of ids) {
    const tiles = state.tiles.map((t) => ({ ...t }))
    const tile = tiles[id]
    const neighbours = tiles.filter(
      (t) => t.alive && t.id !== id && (Math.abs(t.q - tile.q) <= 1 && Math.abs(t.r - tile.r) <= 1),
    )
    if (neighbours.length === 0) continue
    tile.kind = KIND.frozen
    tile.needs = rng() < 0.45 && neighbours.length > 1 ? 2 : 1
    tile.melt = 0
    const next = { ...state, tiles }
    if (canSolve(next)) return next
  }
  return null
}

function tryRotor(state, rng) {
  const ids = shuffledAlive(state, rng).slice(0, 4)
  for (const id of ids) {
    const tiles = state.tiles.map((t) => ({ ...t }))
    tiles[id].kind = KIND.rotor
    tiles[id].spin = rng() < 0.5 ? 1 : -1
    const next = { ...state, tiles }
    if (canSolve(next, { maxNodes: 20000 })) return next
  }
  return null
}

/** Inject mechanics one at a time, keeping only changes that stay solvable. */
export function applyMechanics(state, mechanics, rng) {
  let s = state
  for (const mech of mechanics) {
    const before = s
    if (mech === 'lock') s = tryLock(s, rng) ?? before
    else if (mech === 'frozen') s = tryFrozen(s, rng) ?? before
    else if (mech === 'rotor') s = tryRotor(s, rng) ?? before
  }
  return s
}

function toTileDef(t) {
  const def = { q: t.q, r: t.r, dir: t.dir }
  if (t.kind !== KIND.normal) def.kind = t.kind
  if (t.kind === KIND.locked || t.kind === KIND.key) def.group = t.group
  if (t.kind === KIND.frozen) def.needs = t.needs
  if (t.kind === KIND.rotor) def.spin = t.spin
  return def
}

function trivialLevel(seed) {
  const tiles = [
    { q: -1, r: 0, dir: 3 },
    { q: 0, r: 0, dir: 3 },
    { q: 1, r: 0, dir: 0 },
  ]
  const cells = tiles.map((t) => [t.q, t.r])
  return {
    seed,
    cells,
    tiles,
    metrics: evaluateDifficulty(makeState({ cells, tiles })),
    fallback: true,
  }
}

/**
 * Build one solvable level. Returns the closest attempt to `target` difficulty;
 * never returns an unsolvable board (falls back to a tiny guaranteed one).
 */
export function generatePuzzle({
  seed,
  shape = 'hex',
  radius = 2,
  cols = 5,
  rows = 5,
  holes = 3,
  mechanics = [],
  target = 2,
  attempts = 40,
} = {}) {
  let best = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const rng = createRng(`${seed}:${attempt}`)
    const cells = shapeCells(shape, { radius, cols, rows, holes, rng })
    if (cells.length < 3) continue

    const built = constructBoard(`${seed}:shape`, cells)
    if (!built) continue

    let state = makeState({ cells, tiles: built.tiles })
    state = applyMechanics(state, mechanics, rng)
    if (!canSolve(state)) continue

    const metrics = evaluateDifficulty(state)
    const level = {
      seed: `${seed}:${attempt}`,
      shape,
      cells,
      tiles: state.tiles.map(toTileDef),
      metrics,
    }
    const distance = Math.abs(metrics.rating - target)
    if (!best || distance < best.distance) best = { level, distance }
    if (distance === 0) break
  }

  return best ? best.level : trivialLevel(seed)
}
