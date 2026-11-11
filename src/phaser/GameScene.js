import Phaser from 'phaser'
import { openTipJar } from './support.js'
import {
  W,
  H,
  background,
  button,
  iconButton,
  text,
  fade,
  themeOf,
  hexPoints,
  toColor,
  panel,
} from './common.js'
import { axialToPixel, dirAngle, SQRT3 } from '../hex.js'
import { KIND, applyMove, escapeCheck, hint as findHint, isSolved, makeState } from '../puzzle.js'
import { journeyLevel, dailyLevel, zenLevel, classicLevel, todayKey, TOTAL_LEVELS } from '../levels.js'
import { starsFor, newlyUnlocked } from '../progress.js'
import { data, record } from '../save.js'
import { sfx } from '../sound.js'

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  init(payload = {}) {
    this.mode = payload.mode ?? 'journey'
    this.levelNumber = payload.level ?? 1
    this.stage = payload.stage ?? 1
    this.seed = payload.seed
    this.dailyDate = payload.date
  }

  create() {
    this.theme = themeOf(data.settings.theme)
    this.level = this.resolveLevel()
    this.state = makeState(this.level)
    this.history = []
    this.pods = new Map()
    this.taps = 0
    this.hintsUsed = 0
    this.combo = 0
    this.busy = false
    this.over = false
    this.pauseLayer = null

    background(this, this.theme, { motes: !data.settings.reducedMotion })
    this.cameras.main.fadeIn(180, 8, 8, 20)
    this.buildChrome()
    this.measureBoard()
    this.buildBoard()
    this.updateHud()
    this.bindKeys()
  }

  resolveLevel() {
    if (this.mode === 'daily') return dailyLevel(this.dailyDate || todayKey())
    if (this.mode === 'zen') return zenLevel(this.seed ?? Date.now())
    if (this.mode === 'classic') return classicLevel(this.stage)
    return journeyLevel(this.levelNumber)
  }

  modeLabel() {
    if (this.mode === 'daily') return 'Daily Challenge'
    if (this.mode === 'zen') return 'Zen'
    if (this.mode === 'classic') return `Classic · stage ${this.stage}`
    return `${this.level.chapterName} · ${this.level.title}`
  }

  buildChrome() {
    const theme = this.theme
    iconButton(this, 44, 46, '‹', () => {
      sfx.click()
      fade(this, this.mode === 'journey' ? 'levels' : 'menu')
    }, theme, 46)

    text(this, W / 2, 34, this.modeLabel(), 20, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 62, `${this.level.tiles.length} tiles · ${this.mechanicHint()}`, 14, theme.subtext).setOrigin(0.5)

    const chip = (x, width) => {
      const g = this.add.graphics()
      g.fillStyle(theme.dark ? 0xffffff : theme.accent, 0.12)
      g.fillRoundedRect(x - width / 2, 104, width, 34, 17)
      return g
    }
    chip(112, 132)
    chip(320, 132)
    chip(528, 132)
    this.hudTiles = text(this, 112, 121, '', 15, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    this.hudTaps = text(this, 320, 121, '', 15, theme.text).setOrigin(0.5)
    this.hudHints = text(this, 528, 121, '', 15, theme.text).setOrigin(0.5)

    const y = 836
    button(this, W / 2 - 158, y, 'Undo', () => this.undo(), {
      width: 148,
      height: 52,
      size: 17,
      fill: theme.dark ? 0x312e81 : 0xffffff,
      textColor: theme.dark ? '#e0e7ff' : theme.text,
      theme,
      icon: '↺',
    })
    button(this, W / 2, y, 'Hint', () => this.useHint(), {
      width: 148,
      height: 52,
      size: 17,
      fill: theme.accent,
      textColor: theme.accentText,
      theme,
      icon: '💡',
    })
    button(this, W / 2 + 158, y, 'Restart', () => this.restartLevel(), {
      width: 148,
      height: 52,
      size: 17,
      fill: theme.dark ? 0x312e81 : 0xffffff,
      textColor: theme.dark ? '#e0e7ff' : theme.text,
      theme,
      icon: '⟳',
    })

    text(this, W / 2, H - 44, 'Tap a tile: its whole ray must be clear for it to escape.', 14, theme.subtext, {
      alpha: 0.8,
    }).setOrigin(0.5)
  }

  mechanicHint() {
    const kinds = new Set(this.level.tiles.map((t) => t.kind ?? 'normal'))
    if (kinds.has(KIND.rotor)) return 'neighbours turn the arrows'
    if (kinds.has(KIND.locked) && kinds.has(KIND.frozen)) return 'keys and frost'
    if (kinds.has(KIND.locked)) return 'find the keys'
    if (kinds.has(KIND.frozen)) return 'thaw the frost'
    return 'clear every ray'
  }

  measureBoard() {
    const area = { x: 24, y: 168, width: W - 48, height: 604 }
    const points = this.level.cells.map(([q, r]) => axialToPixel(q, r))
    const minX = Math.min(...points.map((p) => p.x)) - SQRT3
    const maxX = Math.max(...points.map((p) => p.x)) + SQRT3
    const minY = Math.min(...points.map((p) => p.y)) - 2
    const maxY = Math.max(...points.map((p) => p.y)) + 2
    this.hexSize = Math.min(area.width / (maxX - minX), area.height / (maxY - minY)) * 0.94
    this.originX = area.x + area.width / 2 - ((minX + maxX) / 2) * this.hexSize
    this.originY = area.y + area.height / 2 - ((minY + maxY) / 2) * this.hexSize
  }

  cellPosition(tile) {
    const { x, y } = axialToPixel(tile.q, tile.r)
    return { x: this.originX + x * this.hexSize, y: this.originY + y * this.hexSize }
  }

  buildBoard() {
    this.boardLayer = this.add.container(0, 0)
    this.pods = new Map()
    for (const tile of this.state.tiles) {
      if (tile.alive) this.createPod(tile)
    }
  }

  createPod(tile) {
    const theme = this.theme
    const size = this.hexSize
    const pos = this.cellPosition(tile)
    const pod = this.add.container(pos.x, pos.y)
    // Position animates on `pod`; the flip animates `visual`, so the two never
    // fight over the same transform.
    const visual = this.add.container(0, 0)
    pod.add(visual)
    const points = hexPoints(size * 0.93)
    const color = theme.tile[(Math.abs(tile.q * 7 + tile.r * 13) + tile.id) % theme.tile.length]

    const shadow = this.add.graphics()
    shadow.fillStyle(0x111827, 0.16)
    shadow.fillPoints(points.map((p) => ({ x: p.x, y: p.y + size * 0.1 })), true)

    const face = this.add.graphics()
    face.fillStyle(toColor(color), 1)
    face.fillPoints(points, true)
    face.fillStyle(0xffffff, 0.18)
    face.fillEllipse(0, -size * 0.34, size * 1.02, size * 0.54)
    face.lineStyle(Math.max(2, size * 0.05), 0xffffff, 0.6)
    face.strokePoints(points, true)

    const arrow = this.add.graphics()
    const ink = toColor(theme.tileInk)
    arrow.fillStyle(ink, 0.88)
    arrow.fillTriangle(size * 0.6, 0, size * 0.08, -size * 0.33, size * 0.08, size * 0.33)
    arrow.fillRoundedRect(-size * 0.36, -size * 0.12, size * 0.6, size * 0.24, size * 0.11)
    arrow.setRotation(dirAngle(tile.dir))

    const overlay = this.add.graphics()
    visual.add([shadow, face, arrow, overlay])

    // Input lives on its own scene-space zone whose hit area is the exact hex,
    // in the zone's local coordinates (origin 0.5 puts the centre at size,size).
    // Container hit areas are offset by Phaser's display origin, which is what
    // made players tap above a tile.
    const localHex = hexPoints(size * 0.97).map((p) => [p.x + size, p.y + size])
    const hit = this.add
      .zone(pos.x, pos.y, size * 2, size * 2)
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive(new Phaser.Geom.Polygon(localHex), Phaser.Geom.Polygon.Contains)
    hit.input.cursor = 'pointer'
    hit.on('pointerover', () => {
      if (!this.busy && !this.over) pod.setScale(1.04)
    })
    hit.on('pointerout', () => pod.setScale(1))
    hit.on('pointerdown', () => this.tapTile(tile.id))

    this.boardLayer.add(pod)
    this.pods.set(tile.id, { pod, visual, arrow, overlay, hit })
    this.paintOverlay(tile.id)
    return pod
  }

  paintOverlay(id) {
    const entry = this.pods.get(id)
    const tile = this.state.tiles[id]
    if (!entry || !tile) return
    const size = this.hexSize
    const ink = toColor(this.theme.tileInk)
    const { arrow, overlay } = entry

    arrow.setRotation(dirAngle(tile.dir))
    overlay.clear()

    if (tile.kind === KIND.locked && !tile.unlocked) {
      overlay.fillStyle(ink, 0.9)
      overlay.fillRoundedRect(-size * 0.22, -size * 0.02, size * 0.44, size * 0.34, size * 0.08)
      overlay.lineStyle(Math.max(2, size * 0.07), ink, 0.9)
      overlay.beginPath()
      overlay.arc(0, -size * 0.06, size * 0.15, Math.PI, 0, false)
      overlay.strokePath()
    }

    if (tile.kind === KIND.frozen) {
      overlay.lineStyle(Math.max(2, size * 0.05), 0xffffff, 0.85)
      const cracks = [
        [-0.55, -0.35, -0.18, -0.05],
        [-0.18, -0.05, -0.32, 0.3],
        [0.1, -0.55, 0.22, -0.15],
        [0.22, -0.15, 0.55, 0.05],
        [0.05, 0.25, 0.35, 0.5],
      ]
      for (const [ax, ay, bx, by] of cracks) {
        overlay.beginPath()
        overlay.moveTo(ax * size, ay * size)
        overlay.lineTo(bx * size, by * size)
        overlay.strokePath()
      }
      for (let i = 0; i < tile.needs; i += 1) {
        overlay.fillStyle(0xffffff, i < tile.melt ? 1 : 0.35)
        overlay.fillCircle(-size * 0.12 + i * size * 0.24, size * 0.56, size * 0.06)
      }
    }

    if (tile.kind === KIND.rotor) {
      overlay.lineStyle(Math.max(2, size * 0.055), ink, 0.8)
      overlay.beginPath()
      overlay.arc(0, 0, size * 0.64, Math.PI * 0.12, Math.PI * 0.88, false)
      overlay.strokePath()
      const ax = Math.cos(Math.PI * 0.88) * size * 0.64
      const ay = Math.sin(Math.PI * 0.88) * size * 0.64
      overlay.fillStyle(ink, 0.8)
      overlay.fillTriangle(ax, ay + size * 0.13, ax + size * 0.15, ay - size * 0.06, ax - size * 0.11, ay - size * 0.02)
    }

    if (tile.kind === KIND.key) {
      overlay.lineStyle(Math.max(2, size * 0.07), ink, 0.9)
      overlay.strokeCircle(0, -size * 0.32, size * 0.12)
      overlay.beginPath()
      overlay.moveTo(0, -size * 0.2)
      overlay.lineTo(0, size * 0.1)
      overlay.strokePath()
      overlay.beginPath()
      overlay.moveTo(0, size * 0.02)
      overlay.lineTo(size * 0.17, size * 0.02)
      overlay.strokePath()
    }
  }

  tapTile(id) {
    if (this.busy || this.over || this.pauseLayer) return
    const tile = this.state.tiles[id]
    if (!tile || !tile.alive) return
    this.taps += 1

    const check = escapeCheck(this.state, id)
    if (!check.ok) {
      this.combo = 0
      sfx.blocked()
      this.shake(id)
      if (check.blocker !== undefined) this.pulse(check.blocker, 0xef4444)
      this.updateHud()
      return
    }

    this.busy = true
    this.history.push(this.state)
    const melts = this.state.tiles.map((t) => t.melt)
    const unlocks = this.state.tiles.map((t) => t.unlocked)
    const dirs = this.state.tiles.map((t) => t.dir)
    this.state = applyMove(this.state, id)

    this.state.tiles.forEach((t, i) => {
      if (t.melt > melts[i]) sfx.thaw()
      if (t.unlocked && !unlocks[i]) sfx.unlock()
      if (t.dir !== dirs[i]) sfx.spin()
    })

    sfx.escape(this.combo)
    this.combo = Math.min(9, this.combo + 1)
    this.burst(id)
    this.animateExit(id)
    this.state.tiles.forEach((t, i) => {
      if (t.alive) this.paintOverlay(i)
    })
    this.updateHud()
  }

  animateExit(id) {
    const entry = this.pods.get(id)
    this.pods.delete(id)
    const container = entry?.pod
    const visual = entry?.visual
    entry?.hit?.destroy()

    const tile = this.state.tiles[id]
    const angle = dirAngle(tile.dir)
    const distance = this.hexSize * 5.2
    const spin = (tile.dir % 2 === 0 ? 1 : -1) * 150

    const finish = () => {
      container?.destroy()
      this.busy = false
      if (isSolved(this.state) && !this.over) this.finish()
    }

    if (!container || !visual || data.settings.reducedMotion) {
      finish()
      return
    }

    // 1. The tile lifts and turns edge-on, like a chit being flicked over.
    this.tweens.add({
      targets: visual,
      scaleY: 0.05,
      scaleX: 1.07,
      duration: 95,
      ease: 'Quad.In',
      onComplete: () => {
        // 2. It snaps back to face-up while sailing away and spinning.
        this.tweens.add({ targets: visual, scaleY: 1, scaleX: 1, duration: 130, ease: 'Quad.Out' })
        this.tweens.add({
          targets: container,
          x: container.x + Math.cos(angle) * distance,
          y: container.y + Math.sin(angle) * distance - this.hexSize * 0.25,
          angle: spin,
          alpha: 0,
          scaleX: 0.6,
          scaleY: 0.6,
          duration: 320,
          ease: 'Cubic.In',
          onComplete: finish,
        })
      },
    })
  }

  burst(id) {
    if (data.settings.reducedMotion) return
    const tile = this.state.tiles[id]
    const pos = this.cellPosition(tile)
    const flash = this.add.circle(pos.x, pos.y, this.hexSize * 0.9, 0xffffff, 0.35).setDepth(3)
    this.tweens.add({
      targets: flash,
      scale: 1.7,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy(),
    })
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4
      const mote = this.add.circle(pos.x, pos.y, this.hexSize * 0.11, 0xffffff, 0.9).setDepth(4)
      this.tweens.add({
        targets: mote,
        x: pos.x + Math.cos(angle) * this.hexSize * 2.2,
        y: pos.y + Math.sin(angle) * this.hexSize * 2.2,
        alpha: 0,
        scale: 0.2,
        duration: 380,
        ease: 'Cubic.Out',
        onComplete: () => mote.destroy(),
      })
    }
  }

  pulse(id, tint) {
    const entry = this.pods.get(id)
    if (!entry) return
    const ring = this.add.circle(entry.pod.x, entry.pod.y, this.hexSize * 0.95)
    ring.setStrokeStyle(Math.max(3, this.hexSize * 0.09), tint, 0.95)
    ring.setDepth(5)
    this.tweens.add({
      targets: ring,
      scale: 1.5,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })
  }

  shake(id) {
    const entry = this.pods.get(id)
    if (!entry) return
    const { pod } = entry
    if (pod.__shaking) return
    pod.__shaking = true
    this.tweens.add({
      targets: pod,
      x: pod.x + this.hexSize * 0.12,
      duration: 50,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        pod.__shaking = false
      },
    })
  }

  updateHud() {
    const remaining = this.state.tiles.reduce((n, t) => n + (t.alive ? 1 : 0), 0)
    this.hudTiles.setText(`${remaining} left`)
    this.hudTaps.setText(`${this.taps} taps`)
    this.hudHints.setText(`${this.hintsUsed} hints`)
  }

  undo() {
    if (this.busy || this.over || this.pauseLayer || this.history.length === 0) return
    this.state = this.history.pop()
    this.combo = 0
    sfx.click()
    this.rebuild()
    this.updateHud()
  }

  useHint() {
    if (this.busy || this.over || this.pauseLayer) return
    const id = findHint(this.state)
    if (id === null) return
    this.hintsUsed += 1
    sfx.hint()
    this.pulse(id, this.theme.accent)
    this.updateHud()
  }

  restartLevel() {
    if (this.pauseLayer) return
    this.state = makeState(this.level)
    this.history = []
    this.taps = 0
    this.hintsUsed = 0
    this.combo = 0
    this.busy = false
    this.over = false
    sfx.click()
    this.rebuild()
    this.updateHud()
  }

  rebuild() {
    for (const entry of this.pods.values()) entry.hit?.destroy()
    this.boardLayer?.destroy(true)
    this.pods = new Map()
    this.buildBoard()
  }

  bindKeys() {
    const keyboard = this.input.keyboard
    if (!keyboard) return
    keyboard.on('keydown-Z', () => this.undo())
    keyboard.on('keydown-H', () => this.useHint())
    keyboard.on('keydown-R', () => this.restartLevel())
    keyboard.on('keydown-ESC', () => this.togglePause())
  }

  togglePause() {
    if (this.over) return
    if (this.pauseLayer) {
      this.pauseLayer.destroy(true)
      this.pauseLayer = null
      return
    }
    const theme = this.theme
    const layer = this.add.container(0, 0).setDepth(60)
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b1020, 0.55).setInteractive())
    layer.add(panel(this, W / 2, H / 2, 440, 340, theme, { alpha: 0.98 }))
    layer.add(text(this, W / 2, H / 2 - 110, 'Paused', 30, theme.text, { fontStyle: 'bold' }).setOrigin(0.5))
    layer.add(
      button(this, W / 2, H / 2 - 30, 'Resume', () => this.togglePause(), {
        width: 300,
        height: 56,
        fill: theme.accent,
        textColor: theme.accentText,
        theme,
      }),
    )
    layer.add(
      button(this, W / 2, H / 2 + 40, 'Restart', () => {
        layer.destroy(true)
        this.pauseLayer = null
        this.restartLevel()
      }, { width: 300, height: 56, fill: theme.dark ? 0x312e81 : 0xffffff, textColor: theme.dark ? '#e0e7ff' : theme.text, theme }),
    )
    layer.add(
      button(this, W / 2, H / 2 + 110, 'Leave', () => fade(this, this.mode === 'journey' ? 'levels' : 'menu'), {
        width: 300,
        height: 56,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
    this.pauseLayer = layer
  }

  finish() {
    this.over = true
    const total = this.level.tiles.length
    const stars = starsFor(this.taps, total, this.hintsUsed)
    const before = { achievements: [...data.achievements] }
    record({
      mode: this.mode,
      levelId: this.mode === 'daily' ? this.level.id : this.mode === 'journey' ? this.level.id : this.mode === 'classic' ? this.stage : 0,
      stars,
      tiles: total,
    })
    const gained = newlyUnlocked(before, data)
    sfx.win()
    this.showWin(stars, gained)
  }

  showWin(stars, gained) {
    const theme = this.theme
    const layer = this.add.container(0, 0).setDepth(70)
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b1020, 0.58).setInteractive())
    layer.add(panel(this, W / 2, 520, 520, 470, theme, { alpha: 0.98 }))

    layer.add(text(this, W / 2, 350, 'Cleared!', 38, theme.text, { fontStyle: 'bold' }).setOrigin(0.5))

    const starTexts = []
    for (let i = 0; i < 3; i += 1) {
      const star = text(this, W / 2 - 62 + i * 62, 424, i < stars ? '★' : '☆', 46, i < stars ? '#f59e0b' : theme.subtext, {
        alpha: i < stars ? 1 : 0.5,
      }).setOrigin(0.5)
      starTexts.push(star)
      layer.add(star)
      if (i < stars) {
        star.setScale(0.4)
        this.tweens.add({
          targets: star,
          scale: 1,
          duration: 260,
          delay: 120 + i * 110,
          ease: 'Back.Out',
          onStart: () => sfx.star(i),
        })
      }
    }

    layer.add(
      text(this, W / 2, 486, `${this.level.tiles.length} tiles · ${this.taps} taps · ${this.hintsUsed} hints`, 17, theme.subtext).setOrigin(0.5),
    )

    if (gained.length > 0) {
      layer.add(
        text(this, W / 2, 518, `New achievement: ${gained.map((a) => a.name).join(', ')}`, 15, theme.subtext, {
          fontStyle: 'bold',
          wordWrap: { width: 460 },
          align: 'center',
        }).setOrigin(0.5),
      )
    }

    const nextLabel = this.mode === 'journey' ? 'Next level' : this.mode === 'classic' ? 'Next stage' : 'New board'
    const canAdvance = this.mode === 'journey' ? this.level.id < TOTAL_LEVELS : this.mode !== 'daily'
    layer.add(
      button(this, W / 2, 584, canAdvance ? nextLabel : 'Journey', () => {
        if (!canAdvance) {
          fade(this, 'levels')
          return
        }
        if (this.mode === 'journey') this.scene.restart({ mode: 'journey', level: this.level.id + 1 })
        else if (this.mode === 'classic') this.scene.restart({ mode: 'classic', stage: this.stage + 1 })
        else this.scene.restart({ mode: 'zen', seed: Date.now() })
      }, { width: 380, height: 58, fill: theme.accent, textColor: theme.accentText, theme }),
    )
    layer.add(
      button(this, W / 2 - 100, 660, 'Replay', () => this.scene.restart(this.scene.settings.data), {
        width: 180,
        height: 52,
        size: 17,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
    // Quiet support link: results panel only, under the actions inside the card.
    layer.add(
      button(this, W / 2, 730, '☕ Buy me a coffee', () => openTipJar(), {
        width: 300,
        height: 30,
        size: 13,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
    layer.add(
      button(this, W / 2 + 100, 660, 'Journey', () => fade(this, 'levels'), {
        width: 180,
        height: 52,
        size: 17,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )

    void starTexts
  }
}
