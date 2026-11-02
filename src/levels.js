// The Journey: eight chapters, one hundred validated boards. Every level is a
// pure function of its number, so a player's level 37 is the same board on every
// device and the tests can check all of them.

import { generatePuzzle, hashSeed } from './generator.js'

export const CHAPTERS = [
  {
    id: 1,
    name: 'First Escape',
    tagline: 'One clear ray is all a hex needs.',
    count: 12,
    shape: 'hex',
    radius: 2,
    mechanics: [],
    target: 1,
  },
  {
    id: 2,
    name: 'Tangled Paths',
    tagline: 'Rectangles hide longer queues.',
    count: 12,
    shape: 'rect',
    cols: 5,
    rows: 5,
    mechanics: [],
    target: 3,
  },
  {
    id: 3,
    name: 'Locked Away',
    tagline: 'Find the key before the door.',
    count: 12,
    shape: 'hex',
    radius: 3,
    mechanics: ['lock'],
    target: 4,
  },
  {
    id: 4,
    name: 'Frozen Hexes',
    tagline: 'Thaw from the outside in.',
    count: 12,
    shape: 'rect',
    cols: 6,
    rows: 6,
    mechanics: ['frozen'],
    target: 4,
  },
  {
    id: 5,
    name: 'Twisting Arrows',
    tagline: 'Every neighbour turns the aim.',
    count: 12,
    shape: 'hex',
    radius: 2,
    mechanics: ['rotor'],
    target: 1,
  },
  {
    id: 6,
    name: 'Chain Reactions',
    tagline: 'A hollow ring, frosted at the edges.',
    count: 12,
    shape: 'ring',
    radius: 3,
    mechanics: ['frozen'],
    target: 2,
  },
  {
    id: 7,
    name: 'Mixed Signals',
    tagline: 'Locks and frost on a board with holes.',
    count: 12,
    shape: 'holes',
    radius: 3,
    holes: 3,
    mechanics: ['lock', 'frozen'],
    target: 4,
  },
  {
    id: 8,
    name: 'The Great Hexodus',
    tagline: 'Sixty-one tiles. Every rule at once.',
    count: 16,
    shape: 'hex',
    radius: 4,
    mechanics: ['lock', 'frozen'],
    target: 5,
  },
]

export const TOTAL_LEVELS = CHAPTERS.reduce((sum, chapter) => sum + chapter.count, 0)

export function chapterStart(chapterId) {
  let start = 1
  for (const chapter of CHAPTERS) {
    if (chapter.id === chapterId) return start
    start += chapter.count
  }
  return start
}

export function chapterOf(level) {
  const n = Math.max(1, Math.min(TOTAL_LEVELS, Math.round(level)))
  let end = 0
  for (const chapter of CHAPTERS) {
    end += chapter.count
    if (n <= end) return chapter
  }
  return CHAPTERS[CHAPTERS.length - 1]
}

export function levelsInChapter(chapterId) {
  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0]
  const start = chapterStart(chapter.id)
  return Array.from({ length: chapter.count }, (_, i) => start + i)
}

const journeyCache = new Map()

/** Level numbers are 1-based and stable forever. */
export function journeyLevel(level) {
  const id = Math.max(1, Math.min(TOTAL_LEVELS, Math.round(level)))
  if (journeyCache.has(id)) return journeyCache.get(id)

  const chapter = chapterOf(id)
  const within = id - chapterStart(chapter.id)
  // The last board of every four gets one extra ring, so chapters breathe.
  const radius = Math.min(4, (chapter.radius ?? 2) + (within % 4 === 3 ? 1 : 0))

  const generated = generatePuzzle({
    seed: `hexodus-j${id}`,
    shape: chapter.shape,
    radius,
    cols: chapter.cols,
    rows: chapter.rows,
    holes: chapter.holes,
    mechanics: chapter.mechanics,
    target: chapter.target,
  })

  const entry = {
    id,
    mode: 'journey',
    chapter: chapter.id,
    chapterName: chapter.name,
    title: `${chapter.id}–${within + 1}`,
    ...generated,
  }
  journeyCache.set(id, entry)
  return entry
}

export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function previousDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

const DAILY_SHAPES = ['hex', 'rect', 'ring']

/** Same date, same board, everywhere. The seed is the UTC date. */
export function dailyLevel(date = todayKey()) {
  const seed = `hexodus-daily-${date}`
  const shape = DAILY_SHAPES[hashSeed(seed) % DAILY_SHAPES.length]
  return {
    id: `daily-${date}`,
    mode: 'daily',
    date,
    title: 'Daily Challenge',
    ...generatePuzzle({ seed, shape, radius: 3, cols: 6, rows: 6, target: 3 }),
  }
}

export function zenLevel(seed = Date.now()) {
  const n = hashSeed(seed) % 1000
  return {
    id: `zen-${n}`,
    mode: 'zen',
    title: 'Zen',
    ...generatePuzzle({
      seed: `hexodus-zen-${seed}`,
      shape: 'hex',
      radius: n % 3 === 0 ? 3 : 2,
      target: 2,
    }),
  }
}

export function classicLevel(stage = 1) {
  const n = Math.max(1, Math.round(stage))
  const radius = Math.min(4, 2 + Math.floor((n - 1) / 4))
  return {
    id: `classic-${n}`,
    mode: 'classic',
    stage: n,
    title: `Classic ${n}`,
    ...generatePuzzle({
      seed: `hexodus-classic-${n}`,
      shape: 'hex',
      radius,
      mechanics: n >= 6 ? ['frozen'] : n >= 9 ? ['lock'] : [],
      target: Math.min(5, 1 + Math.floor(n / 4)),
    }),
  }
}
