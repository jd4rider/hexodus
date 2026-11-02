// localStorage wrapper around the pure progress rules. The arcade client
// mirrors this key into the player's account, so it stays plain JSON.

import { defaultSave, normalizeSave, recordClear } from './progress.js'

export const SAVE_KEY = 'hexodus-save-v1'

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? normalizeSave(JSON.parse(raw)) : defaultSave()
  } catch {
    return defaultSave()
  }
}

export const data = loadSave()

export function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // Private mode / file:// without storage: the session still plays, just unsaved.
  }
  return data
}

/** Merge a freshly computed save into the live object and write it. */
export function commit(next) {
  Object.assign(data, next)
  return persist()
}

export function record(opts) {
  return commit(recordClear(data, opts))
}

export function setSetting(key, value) {
  data.settings = { ...data.settings, [key]: value }
  return persist()
}
