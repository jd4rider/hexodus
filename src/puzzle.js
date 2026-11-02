// The rules engine. Occupancy and arrows are the source of truth; rendering
// only mirrors this state, so animations can never decide a move.
//
// Plain arrow tiles are monotone: removing a tile can never block another one,
// so "some currently free tile can escape" is a complete greedy test. Locks and
// frost preserve that property. Rotors do not — they change arrows — so those
// boards are searched with memoised DFS.

import { DIRS, cellKey, hexDistance } from './hex.js'

export const KIND = {
  normal: 'normal',
  key: 'key',
  locked: 'locked',
  frozen: 'frozen',
  rotor: 'rotor',
}

export function makeState(level) {
  const cells = level.cells.map((c) => (Array.isArray(c) ? c : [c.q, c.r]))
  const board = new Set(cells.map(([q, r]) => cellKey(q, r)))
  const tiles = level.tiles.map((t, id) => {
    const kind = t.kind || KIND.normal
    return {
      id,
      q: t.q,
      r: t.r,
      dir: ((t.dir % 6) + 6) % 6,
      kind,
      group: t.group || 0,
      needs: t.needs ?? 1,
      melt: 0,
      spin: t.spin || 1,
      unlocked: kind !== KIND.locked,
      alive: true,
    }
  })
  return { board, cells, tiles, moves: 0 }
}

export function cloneState(state) {
  return { ...state, tiles: state.tiles.map((t) => ({ ...t })) }
}

export function occupancy(state) {
  const map = new Map()
  for (let i = 0; i < state.tiles.length; i += 1) {
    const t = state.tiles[i]
    if (t.alive) map.set(cellKey(t.q, t.r), i)
  }
  return map
}

export function isSolved(state) {
  return state.tiles.every((t) => !t.alive)
}

export function remainingTiles(state) {
  return state.tiles.reduce((n, t) => n + (t.alive ? 1 : 0), 0)
}

/**
 * Can this tile leave right now? Walks the ray until it leaves the board; any
 * occupied board cell on the way blocks it. Holes are empty, so rays pass
 * through them.
 */
export function escapeCheck(state, index, occ = occupancy(state)) {
  const tile = state.tiles[index]
  if (!tile || !tile.alive) return { ok: false, reason: 'gone', path: [] }
  if (tile.kind === KIND.locked && !tile.unlocked) return { ok: false, reason: 'locked', path: [] }
  if (tile.kind === KIND.frozen && tile.melt < tile.needs) return { ok: false, reason: 'frozen', path: [] }

  const path = []
  let { q, r } = tile
  const [dq, dr] = DIRS[tile.dir]
  for (let step = 0; step < 64; step += 1) {
    q += dq
    r += dr
    const k = cellKey(q, r)
    if (!state.board.has(k)) return { ok: true, path, exit: { q, r } }
    const occupant = occ.get(k)
    if (occupant !== undefined) return { ok: false, reason: 'blocked', blocker: occupant, path }
    path.push({ q, r })
  }
  return { ok: true, path, exit: { q, r } }
}

export function applyMove(state, index) {
  const check = escapeCheck(state, index)
  if (!check.ok) return null

  const tiles = state.tiles.map((t) => ({ ...t }))
  const gone = tiles[index]
  gone.alive = false

  // Every surviving neighbour reacts once, deterministically.
  for (const t of tiles) {
    if (!t.alive) continue
    if (hexDistance({ q: t.q, r: t.r }, { q: gone.q, r: gone.r }) !== 1) continue
    if (t.kind === KIND.frozen && t.melt < t.needs) t.melt += 1
    if (t.kind === KIND.rotor) t.dir = (t.dir + t.spin + 6) % 6
  }

  if (gone.kind === KIND.key) {
    for (const t of tiles) {
      if (t.alive && t.kind === KIND.locked && t.group === gone.group) t.unlocked = true
    }
  }

  return { ...state, tiles, moves: state.moves + 1, last: index, exit: check.exit }
}

export function movable(state) {
  const occ = occupancy(state)
  const out = []
  for (let i = 0; i < state.tiles.length; i += 1) {
    if (state.tiles[i].alive && escapeCheck(state, i, occ).ok) out.push(i)
  }
  return out
}

export function hasRotors(state) {
  return state.tiles.some((t) => t.alive && t.kind === KIND.rotor)
}

/**
 * Remove any free tile until nothing moves. Complete for monotone boards
 * (plain, locked, frozen) because removals only ever free more rays.
 */
export function greedyClear(state) {
  let s = state
  const path = []
  const frontiers = []
  for (let guard = 0; guard < state.tiles.length + 2; guard += 1) {
    const moves = movable(s)
    if (moves.length === 0) break
    frontiers.push(moves.length)
    s = applyMove(s, moves[0])
    path.push(moves[0])
  }
  return { cleared: isSolved(s), path, frontiers, state: s }
}

export function stateKey(state) {
  let key = ''
  for (const t of state.tiles) {
    key += t.alive ? '1' : '0'
    key += String(t.dir)
    key += t.kind === KIND.frozen ? String(t.melt) : ''
    key += t.kind === KIND.locked ? (t.unlocked ? 'u' : 'l') : ''
  }
  return key
}

/** DFS with memoisation for boards whose arrows can change. */
export function solve(state, { maxNodes = 60000 } = {}) {
  const seen = new Set()
  const path = []
  let nodes = 0
  let capped = false

  function dfs(s) {
    if (isSolved(s)) return true
    if (nodes >= maxNodes) {
      capped = true
      return false
    }
    const key = stateKey(s)
    if (seen.has(key)) return false
    seen.add(key)
    nodes += 1

    const moves = movable(s)
    // Keys and tiles next to frost/rotors change the board most, so try them first.
    const score = (i) => {
      const t = s.tiles[i]
      let n = t.kind === KIND.key ? 3 : t.kind === KIND.frozen ? 2 : 0
      const occ = null
      void occ
      return n
    }
    moves.sort((a, b) => score(b) - score(a))

    for (const i of moves) {
      const next = applyMove(s, i)
      if (!next) continue
      path.push(i)
      if (dfs(next)) return true
      path.pop()
    }
    return false
  }

  const solvable = dfs(state)
  return { solvable, path: solvable ? [...path] : [], nodes, capped }
}

/** Solvability test that stays cheap for the common monotone boards. */
export function canSolve(state, options) {
  if (hasRotors(state)) return solve(state, options).solvable
  return greedyClear(state).cleared
}

/** Frontier counts along a known solution, used for difficulty. */
export function pathProfile(state, path) {
  let s = state
  const frontiers = []
  for (const i of path) {
    frontiers.push(movable(s).length)
    const next = applyMove(s, i)
    if (!next) break
    s = next
  }
  return { cleared: isSolved(s), path, frontiers, state: s }
}

/**
 * Difficulty is about decisions, not tile count: how many rays are open at the
 * start, how often there is a real choice, and how long forced runs get.
 */
export function evaluateDifficulty(state) {
  const profile = hasRotors(state)
    ? (() => {
        const res = solve(state)
        return res.solvable ? pathProfile(state, res.path) : { frontiers: [], cleared: false }
      })()
    : greedyClear(state)

  const frontiers = profile.frontiers
  const total = state.tiles.length
  const initial = frontiers[0] ?? 0
  let forced = 0
  let pairs = 0
  let choices = 0
  let run = 0
  let longestForced = 0
  for (const n of frontiers) {
    if (n === 1) {
      forced += 1
      run += 1
      longestForced = Math.max(longestForced, run)
    } else {
      run = 0
      if (n === 2) pairs += 1
      else if (n >= 3) choices += 1
    }
  }
  const special = state.tiles.filter((t) => t.kind !== KIND.normal).length
  const raw =
    total * 0.55 +
    initial * 0.9 +
    choices * 0.85 +
    pairs * 0.4 +
    longestForced * 1.1 +
    special * 2.4
  // Thresholds are calibrated against the shipped catalogue (see
  // LEVEL_GENERATION.md): a small plain board rates 1, the sixty-one-tile
  // finale rates 5. Relative, not absolute — it is a within-game scale.
  const rating = raw < 38 ? 1 : raw < 45 ? 2 : raw < 55 ? 3 : raw < 75 ? 4 : 5
  return {
    total,
    initial,
    forced,
    pairs,
    choices,
    longestForced,
    special,
    cleared: profile.cleared,
    rating,
    score: Math.round(raw * 10) / 10,
  }
}

/** A hint is always a move that is actually legal right now. */
export function hint(state) {
  const moves = movable(state)
  if (moves.length === 0) return null
  if (!hasRotors(state)) return moves[0]
  const res = solve(state)
  return res.solvable && res.path.length > 0 ? res.path[0] : moves[0]
}
