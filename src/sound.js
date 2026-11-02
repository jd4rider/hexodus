// Synthesised sound: no audio files, no network requests, nothing to license.
// The AudioContext is created lazily on the first tap so browsers that block
// autoplay are never surprised.

let ctx = null
export const audioState = { muted: false }

function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { type = 'sine', dur = 0.16, gain = 0.1, delay = 0 } = {}) {
  if (audioState.muted || !Number.isFinite(freq)) return
  const a = audio()
  if (!a) return
  const start = a.currentTime + delay
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise({ dur = 0.2, gain = 0.06, from = 1800, to = 300, delay = 0 } = {}) {
  if (audioState.muted) return
  const a = audio()
  if (!a) return
  const start = a.currentTime + delay
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length) ** 2
  }
  const source = a.createBufferSource()
  source.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(from, start)
  filter.frequency.exponentialRampToValueAtTime(to, start + dur)
  const amp = a.createGain()
  amp.gain.value = gain
  source.connect(filter).connect(amp).connect(a.destination)
  source.start(start)
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]

export const sfx = {
  escape: (combo = 0) => {
    const semitone = PENTA[Math.min(PENTA.length - 1, combo)]
    tone(523.25 * 2 ** (semitone / 12), { type: 'triangle', dur: 0.22, gain: 0.09 })
    tone(1046.5 * 2 ** (semitone / 12), { type: 'sine', dur: 0.12, gain: 0.03, delay: 0.02 })
  },
  blocked: () => {
    tone(180, { type: 'square', dur: 0.09, gain: 0.045 })
    tone(130, { type: 'square', dur: 0.12, gain: 0.035, delay: 0.05 })
  },
  unlock: () => {
    tone(880, { type: 'sine', dur: 0.08, gain: 0.06 })
    tone(1320, { type: 'sine', dur: 0.14, gain: 0.05, delay: 0.07 })
  },
  thaw: () => {
    noise({ dur: 0.35, gain: 0.05, from: 3200, to: 900 })
    tone(660, { type: 'triangle', dur: 0.18, gain: 0.04, delay: 0.06 })
  },
  spin: () => tone(420, { type: 'sawtooth', dur: 0.12, gain: 0.03 }),
  click: () => tone(620, { type: 'triangle', dur: 0.05, gain: 0.05 }),
  hint: () => {
    tone(784, { type: 'sine', dur: 0.1, gain: 0.05 })
    tone(1175, { type: 'sine', dur: 0.14, gain: 0.04, delay: 0.08 })
  },
  star: (index = 0) => tone(880 * 2 ** ((index * 4) / 12), { type: 'triangle', dur: 0.18, gain: 0.06 }),
  win: () => {
    ;[0, 4, 7, 12, 16].forEach((step, i) => {
      tone(523.25 * 2 ** (step / 12), { type: 'triangle', dur: 0.4, gain: 0.08, delay: i * 0.09 })
    })
    noise({ dur: 0.5, gain: 0.03, from: 4000, to: 800, delay: 0.05 })
  },
  lose: () => [7, 3, 0].forEach((step, i) => tone(392 * 2 ** (step / 12), { type: 'sine', dur: 0.3, gain: 0.05, delay: i * 0.12 })),
}
