// Axial hexagonal geometry, pointy-top. Nothing here imports Phaser, so the
// puzzle engine can be unit-tested in Node and reused by any renderer.
//
// A cell is { q, r }. The six escape directions are fixed and clockwise.

export const SQRT3 = Math.sqrt(3)

export const DIRS = [
  [1, 0], // 0 E
  [1, -1], // 1 NE
  [0, -1], // 2 NW
  [-1, 0], // 3 W
  [-1, 1], // 4 SW
  [0, 1], // 5 SE
]

export const DIR_LABELS = ['E', 'NE', 'NW', 'W', 'SW', 'SE']

export const cellKey = (q, r) => `${q},${r}`

export function parseKey(k) {
  const [q, r] = k.split(',').map(Number)
  return { q, r }
}

/** Centre of a cell in "hex units" — multiply by the render size. */
export function axialToPixel(q, r) {
  return { x: SQRT3 * (q + r / 2), y: 1.5 * r }
}

export function pixelToAxial(x, y) {
  return hexRound((SQRT3 / 3) * x - y / 3, (2 / 3) * y)
}

/** Round fractional axial coordinates back to the nearest real cell. */
export function hexRound(qf, rf) {
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

export function hexDistance(a, b) {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
}

export function neighbors(q, r) {
  return DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }))
}

export function step(q, r, dir) {
  const [dq, dr] = DIRS[((dir % 6) + 6) % 6]
  return { q: q + dq, r: r + dr }
}

/** Angle in radians the arrow should point for a direction (pointy-top). */
export function dirAngle(dir) {
  const [dq, dr] = DIRS[((dir % 6) + 6) % 6]
  const { x, y } = axialToPixel(dq, dr)
  return Math.atan2(y, x)
}

export function hexShape(radius) {
  const cells = []
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r += 1) {
      cells.push([q, r])
    }
  }
  return cells
}

/** A parallelogram-ish rectangle: `cols` cells wide, `rows` tall. */
export function rectShape(cols, rows) {
  const cells = []
  for (let r = 0; r < rows; r += 1) {
    const offset = -Math.floor(r / 2)
    for (let q = offset; q < offset + cols; q += 1) cells.push([q, r])
  }
  return cells
}

/** Only the outermost ring — a hollow board with a hole in the middle. */
export function ringShape(radius) {
  return hexShape(radius).filter(([q, r]) => hexDistance({ q, r }, { q: 0, r: 0 }) === radius)
}

/** Board shapes the catalogue can ask for. Holes are cut with the given rng. */
export function shapeCells(shape, { radius = 2, cols = 5, rows = 5, holes = 3, rng = Math.random } = {}) {
  if (shape === 'rect') return rectShape(cols, rows)
  if (shape === 'ring') return ringShape(radius)
  if (shape === 'holes') {
    const cells = hexShape(radius)
    const target = Math.min(holes, Math.max(0, Math.floor(cells.length * 0.2)))
    const out = new Map(cells.map(([q, r]) => [cellKey(q, r), [q, r]]))
    for (let i = 0; i < target && out.size > 8; i += 1) {
      const keys = [...out.keys()]
      out.delete(keys[Math.floor(rng() * keys.length)])
    }
    return [...out.values()]
  }
  return hexShape(radius)
}

/** Pixel bounds of a board, used to fit it on screen. */
export function boardBounds(cells, size = 1) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [q, r] of cells) {
    const { x, y } = axialToPixel(q, r)
    minX = Math.min(minX, x - SQRT3 * size)
    maxX = Math.max(maxX, x + SQRT3 * size)
    minY = Math.min(minY, y - 2 * size)
    maxY = Math.max(maxY, y + 2 * size)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}
