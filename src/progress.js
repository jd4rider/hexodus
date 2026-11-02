// Progress rules, kept free of rendering and storage so they can be tested in
// Node. `save.js` supplies the browser storage around these functions.

export const SAVE_VERSION = 1
export const JOURNEY_LEVELS = 100
export const MAX_STARS_PER_LEVEL = 3

export const ACHIEVEMENTS = [
  { id: 'first_ray', name: 'First Ray', description: 'Clear your first board.', check: (s) => s.totalCleared >= 1 },
  { id: 'ten_boards', name: 'Getting Warm', description: 'Clear ten boards.', check: (s) => s.totalCleared >= 10 },
  { id: 'hundred_tiles', name: 'Hundred Hexes', description: 'Escape one hundred tiles.', check: (s) => s.tilesCleared >= 100 },
  { id: 'flawless', name: 'Flawless', description: 'Earn three stars on a Journey level.', check: (s) => Object.values(s.stars).some((v) => v >= 3) },
  { id: 'chapter_one', name: 'Out of the First Hex', description: 'Finish Chapter 1.', check: (s) => s.unlocked >= 13 },
  { id: 'chapter_four', name: 'Halfway Hexodus', description: 'Reach Chapter 5.', check: (s) => s.unlocked >= 49 },
  { id: 'daily_three', name: 'Daily Habit', description: 'Clear three daily challenges.', check: (s) => Object.keys(s.daily).length >= 3 },
  { id: 'streak_seven', name: 'Seven Days Running', description: 'Keep a seven-day daily streak.', check: (s) => s.streak.count >= 7 },
  { id: 'zen_ten', name: 'Calm Hexes', description: 'Clear ten boards in Zen mode.', check: (s) => s.zenCleared >= 10 },
  { id: 'great_hexodus', name: 'The Great Hexodus', description: 'Finish every Journey level.', check: (s) => s.completedJourney },
]

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    unlocked: 1,
    stars: {},
    daily: {},
    achievements: [],
    totalCleared: 0,
    tilesCleared: 0,
    zenCleared: 0,
    classicBest: 0,
    streak: { last: null, count: 0 },
    settings: { sound: true, theme: 'candy', reducedMotion: false },
    completedJourney: false,
    updatedAt: 0,
  }
}

const asInt = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback)

/** Never trusts stored data: a corrupted save still yields a playable object. */
export function normalizeSave(raw) {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base

  const stars = {}
  if (raw.stars && typeof raw.stars === 'object') {
    for (const [key, value] of Object.entries(raw.stars)) {
      const star = Math.min(MAX_STARS_PER_LEVEL, asInt(value))
      if (star > 0 && /^\d+$/.test(key)) stars[key] = star
    }
  }

  const daily = {}
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [date, entry] of Object.entries(raw.daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      daily[date] = { stars: Math.min(MAX_STARS_PER_LEVEL, Math.max(1, asInt(entry?.stars, 1))) }
    }
  }

  return {
    ...base,
    version: SAVE_VERSION,
    unlocked: Math.min(JOURNEY_LEVELS, Math.max(1, asInt(raw.unlocked, 1))),
    stars,
    daily,
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((id) => typeof id === 'string') : [],
    totalCleared: asInt(raw.totalCleared),
    tilesCleared: asInt(raw.tilesCleared),
    zenCleared: asInt(raw.zenCleared),
    classicBest: asInt(raw.classicBest),
    streak: {
      last: typeof raw.streak?.last === 'string' ? raw.streak.last : null,
      count: asInt(raw.streak?.count),
    },
    settings: {
      sound: raw.settings?.sound !== false,
      theme: typeof raw.settings?.theme === 'string' ? raw.settings.theme : base.settings.theme,
      reducedMotion: raw.settings?.reducedMotion === true,
    },
    completedJourney: raw.completedJourney === true || Object.keys(stars).length >= JOURNEY_LEVELS,
    updatedAt: asInt(raw.updatedAt),
  }
}

/**
 * Stars come from care, not speed: extra taps and hints cost you. Every tile
 * must be removed, so "moves" alone can never distinguish a good clear.
 */
export function starsFor(taps, tiles, hints = 0) {
  const extra = Math.max(0, Math.round(taps) - Math.round(tiles))
  if (hints === 0 && extra <= 2) return 3
  if (hints <= 1 && extra <= Math.max(4, Math.ceil(tiles * 0.4))) return 2
  return 1
}

export function unlockedAchievements(save) {
  return ACHIEVEMENTS.filter((achievement) => {
    try {
      return achievement.check(save)
    } catch {
      return false
    }
  })
}

export function totalStars(save) {
  return Object.values(save.stars).reduce((sum, value) => sum + value, 0)
}

export function isLevelUnlocked(save, level) {
  return level <= Math.max(1, save.unlocked)
}

export function previousDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

function updateStreak(save, date) {
  if (save.streak.last === date) return
  save.streak.count = save.streak.last && previousDate(date) === save.streak.last ? save.streak.count + 1 : 1
  save.streak.last = date
}

/**
 * Record a clear and return the new save. Input is never mutated, so a failed
 * write cannot corrupt the in-memory session.
 */
export function recordClear(save, { mode = 'journey', levelId = 0, stars = 1, tiles = 0 } = {}) {
  const next = normalizeSave(save)
  const earned = Math.min(MAX_STARS_PER_LEVEL, Math.max(1, Math.round(stars)))
  next.totalCleared += 1
  next.tilesCleared += Math.max(0, Math.round(tiles))

  if (mode === 'journey' && levelId > 0) {
    const key = String(levelId)
    next.stars[key] = Math.max(next.stars[key] || 0, earned)
    next.unlocked = Math.min(JOURNEY_LEVELS, Math.max(next.unlocked, levelId + 1))
    if (levelId >= JOURNEY_LEVELS) next.completedJourney = true
  } else if (mode === 'daily' && levelId) {
    const date = String(levelId).replace(/^daily-/, '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.daily[date] = { stars: Math.max(next.daily[date]?.stars || 0, earned) }
      updateStreak(next, date)
    }
  } else if (mode === 'zen') {
    next.zenCleared += 1
  } else if (mode === 'classic' && levelId > 0) {
    next.classicBest = Math.max(next.classicBest, Math.round(levelId))
  }

  next.achievements = unlockedAchievements(next).map((achievement) => achievement.id)
  next.updatedAt = Date.now()
  return next
}

export function newlyUnlocked(before, after) {
  const had = new Set(before?.achievements ?? [])
  return ACHIEVEMENTS.filter((achievement) => after.achievements.includes(achievement.id) && !had.has(achievement.id))
}
