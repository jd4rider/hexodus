// Shared look and feel: palettes, text, buttons, panels and the generated
// textures. Every asset is drawn at runtime — the game ships no image files.

import Phaser from 'phaser'

export const W = 640
export const H = 940
export const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

export const THEMES = {
  candy: {
    name: 'Candy Pastel',
    bg: ['#fdf4ff', '#dbeafe'],
    tile: ['#f9a8d4', '#c4b5fd', '#93c5fd', '#6ee7b7', '#fde68a', '#fdba74'],
    tileInk: '#3b0764',
    text: '#312e81',
    subtext: '#7c3aed',
    accent: 0xdb2777,
    accentText: '#ffffff',
    panel: 0xffffff,
    panelAlpha: 0.72,
    shadow: 0x7c3aed,
    dark: false,
  },
  ocean: {
    name: 'Ocean Glass',
    bg: ['#ecfeff', '#bae6fd'],
    tile: ['#a5f3fc', '#7dd3fc', '#5eead4', '#99f6e4', '#bae6fd', '#67e8f9'],
    tileInk: '#083344',
    text: '#083344',
    subtext: '#0e7490',
    accent: 0x0e7490,
    accentText: '#ffffff',
    panel: 0xffffff,
    panelAlpha: 0.7,
    shadow: 0x0369a1,
    dark: false,
  },
  honey: {
    name: 'Golden Honeycomb',
    bg: ['#fffbeb', '#fed7aa'],
    tile: ['#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#fef3c7', '#fca5a5'],
    tileInk: '#451a03',
    text: '#451a03',
    subtext: '#b45309',
    accent: 0xb45309,
    accentText: '#fffbeb',
    panel: 0xfffbeb,
    panelAlpha: 0.75,
    shadow: 0x92400e,
    dark: false,
  },
  midnight: {
    name: 'Midnight Galaxy',
    bg: ['#0b1020', '#1e1b4b'],
    tile: ['#818cf8', '#a78bfa', '#f472b6', '#38bdf8', '#34d399', '#fbbf24'],
    tileInk: '#0b1020',
    text: '#e0e7ff',
    subtext: '#a5b4fc',
    accent: 0x6366f1,
    accentText: '#ffffff',
    panel: 0x1e1b4b,
    panelAlpha: 0.72,
    shadow: 0x000000,
    dark: true,
  },
}

export const THEME_KEYS = Object.keys(THEMES)

export function themeOf(name) {
  return THEMES[name] ?? THEMES.candy
}

const canvasTexture = (scene, key, width, height, draw) => {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, width, height)
  draw(texture.getContext(), width, height)
  texture.refresh()
}

export function makeTextures(scene) {
  canvasTexture(scene, 'spark', 16, 16, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(8, 8, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  canvasTexture(scene, 'glow', 160, 160, (ctx) => {
    const gradient = ctx.createRadialGradient(80, 80, 0, 80, 80, 80)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 160, 160)
  })
}

const backgroundKeys = new Set()

/** A soft vertical gradient plus optional drifting motes. */
export function background(scene, theme, { motes = true } = {}) {
  const key = `bg-${theme.name.replace(/\s/g, '')}`
  if (!backgroundKeys.has(key)) {
    canvasTexture(scene, key, 8, H, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, H)
      gradient.addColorStop(0, theme.bg[0])
      gradient.addColorStop(1, theme.bg[1])
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 8, H)
    })
    backgroundKeys.add(key)
  }
  scene.add.image(W / 2, H / 2, key).setDisplaySize(W, H).setDepth(-100)

  if (!motes) return
  scene.add
    .particles(0, 0, 'spark', {
      x: { min: 0, max: W },
      y: H + 10,
      speedY: { min: -26, max: -8 },
      speedX: { min: -8, max: 8 },
      lifespan: 14000,
      scale: { start: 0.32, end: 0.08 },
      alpha: { start: 0.26, end: 0 },
      frequency: 420,
      tint: theme.dark ? 0xa5b4fc : 0xffffff,
    })
    .setDepth(-90)
}

export function text(scene, x, y, value, size = 22, color = '#fff', extra = {}) {
  return scene.add.text(x, y, value, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    ...extra,
  })
}

export function panel(scene, x, y, width, height, theme, { radius = 22, alpha = theme.panelAlpha } = {}) {
  const g = scene.add.graphics()
  g.fillStyle(theme.shadow, theme.dark ? 0.5 : 0.16)
  g.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 8, width, height, radius)
  g.fillStyle(theme.panel, alpha)
  g.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  g.lineStyle(2, theme.accent, 0.18)
  g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  return g
}

export function button(scene, x, y, caption, onClick, options = {}) {
  const {
    width = 200,
    height = 56,
    size = 21,
    fill = 0xdb2777,
    textColor = '#ffffff',
    radius = 16,
    theme = THEMES.candy,
    icon = '',
  } = options

  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  const draw = (alpha, lift = 0) => {
    bg.clear()
    bg.fillStyle(theme.shadow, 0.22)
    bg.fillRoundedRect(-width / 2, -height / 2 + 5 - lift, width, height, radius)
    bg.fillStyle(fill, alpha)
    bg.fillRoundedRect(-width / 2, -height / 2 - lift, width, height, radius)
    bg.lineStyle(2, 0xffffff, 0.28)
    bg.strokeRoundedRect(-width / 2, -height / 2 - lift, width, height, radius)
  }
  draw(0.95)

  const label = text(scene, 0, 0, `${icon ? `${icon}  ` : ''}${caption}`, size, textColor, {
    fontStyle: 'bold',
    align: 'center',
  }).setOrigin(0.5)

  box.add([bg, label])
  box.setSize(width, height).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => draw(1, 2))
  box.on('pointerout', () => draw(0.95))
  box.on('pointerdown', () => {
    scene.tweens.add({ targets: box, scale: 0.96, duration: 70, yoyo: true })
    onClick()
  })
  box.setCaption = (value) => label.setText(value)
  return box
}

export function iconButton(scene, x, y, glyph, onClick, theme, size = 52) {
  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  bg.fillStyle(theme.dark ? 0xffffff : theme.accent, 0.14)
  bg.fillCircle(0, 0, size / 2)
  bg.lineStyle(2, theme.accent, 0.3)
  bg.strokeCircle(0, 0, size / 2)
  const label = text(scene, 0, 0, glyph, size * 0.46, theme.text).setOrigin(0.5)
  box.add([bg, label])
  box.setSize(size, size).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => box.setScale(1.08))
  box.on('pointerout', () => box.setScale(1))
  box.on('pointerdown', onClick)
  return box
}

export function fade(scene, target, payload) {
  scene.input.enabled = false
  scene.cameras.main.fadeOut(180, 8, 8, 20)
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(target, payload))
}

/** Corner points of a pointy-top hexagon. */
export function hexPoints(size) {
  const points = []
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i + 30)
    points.push({ x: size * Math.cos(angle), y: size * Math.sin(angle) })
  }
  return points
}

export function toColor(hex) {
  return Phaser.Display.Color.HexStringToColor(hex).color
}

export function starString(stars, max = 3) {
  return '★'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, max - stars))
}
