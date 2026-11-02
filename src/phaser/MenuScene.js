import Phaser from 'phaser'
import { W, H, background, button, text, fade, themeOf, THEME_KEYS, starString } from './common.js'
import { data, setSetting } from '../save.js'
import { TOTAL_LEVELS, journeyLevel } from '../levels.js'
import { totalStars } from '../progress.js'
import { sfx } from '../sound.js'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create() {
    this.input.enabled = true
    const theme = themeOf(data.settings.theme)
    background(this, theme, { motes: !data.settings.reducedMotion })
    this.cameras.main.fadeIn(240, 8, 8, 20)

    // A little ring of hexagons behind the wordmark.
    const ring = [0, 1, 2, 3, 4, 5]
    ring.forEach((i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 2
      const x = W / 2 + Math.cos(angle) * 128
      const y = 146 + Math.sin(angle) * 74
      const size = 26
      const points = []
      for (let k = 0; k < 6; k += 1) {
        const a = (Math.PI / 180) * (60 * k + 30)
        points.push({ x: size * Math.cos(a), y: size * Math.sin(a) })
      }
      const hex = this.add.graphics()
      hex.setPosition(x, y)
      hex.fillStyle(Phaser.Display.Color.HexStringToColor(theme.tile[i % theme.tile.length]).color, 0.55)
      hex.fillPoints(points, true)
      hex.setDepth(-1)
      this.tweens.add({
        targets: hex,
        y: y - 5,
        duration: 1800 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    })

    text(this, W / 2, 146, 'HEXODUS', 62, theme.text, {
      fontStyle: 'bold',
      stroke: theme.dark ? '#0b1020' : '#ffffff',
      strokeThickness: 8,
    }).setOrigin(0.5)
    text(this, W / 2, 208, 'Tap a tile. Clear its ray. Escape.', 20, theme.subtext).setOrigin(0.5)
    text(this, W / 2, 246, 'A Little Joy Arcade puzzle', 15, theme.subtext, { alpha: 0.8 }).setOrigin(0.5)

    const next = Math.min(data.unlocked, TOTAL_LEVELS)
    const resume = journeyLevel(next)
    button(
      this,
      W / 2,
      330,
      `${next > 1 ? 'Continue' : 'Start'}  ·  ${resume.chapterName} ${resume.title}`,
      () => fade(this, 'game', { mode: 'journey', level: next }),
      { width: 460, height: 64, size: 21, fill: theme.accent, textColor: theme.accentText, theme, icon: '▶' },
    )

    const row = (y, left, right) => {
      button(this, W / 2 - 108, y, left.label, left.action, {
        width: 204,
        height: 56,
        size: 19,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
        icon: left.icon,
      })
      button(this, W / 2 + 108, y, right.label, right.action, {
        width: 204,
        height: 56,
        size: 19,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
        icon: right.icon,
      })
    }

    row(414, { label: 'Journey', icon: '🗺', action: () => fade(this, 'levels') }, { label: 'Daily', icon: '📅', action: () => fade(this, 'game', { mode: 'daily' }) })
    row(486, { label: 'Zen', icon: '🌿', action: () => fade(this, 'game', { mode: 'zen' }) }, { label: 'Classic', icon: '♾', action: () => fade(this, 'game', { mode: 'classic', stage: Math.max(1, data.classicBest + 1) }) })
    row(558, {
      label: 'Achievements',
      icon: '🏅',
      action: () => fade(this, 'achievements'),
    }, {
      label: 'Settings',
      icon: '⚙',
      action: () => fade(this, 'settings'),
    })

    const stars = totalStars(data)
    text(this, W / 2, 628, `${Object.keys(data.stars).length} of ${TOTAL_LEVELS} levels cleared · ${stars}★`, 17, theme.subtext).setOrigin(0.5)

    // Daily status line.
    const today = new Date().toISOString().slice(0, 10)
    const todayStars = data.daily[today]?.stars ?? 0
    text(this, W / 2, 658, todayStars ? `Today's challenge: ${starString(todayStars)}` : "Today's challenge is waiting.", 16, theme.subtext, {
      alpha: 0.85,
    }).setOrigin(0.5)

    // Sound quick toggle, bottom-left; arcade link bottom-centre.
    button(this, 84, 736, data.settings.sound ? 'Sound on' : 'Muted', () => {
      setSetting('sound', !data.settings.sound)
      this.scene.restart()
    }, { width: 136, height: 44, size: 15, fill: theme.dark ? 0x312e81 : 0xffffff, textColor: theme.dark ? '#e0e7ff' : theme.text, theme })

    const arcade = text(this, W / 2, 736, 'littlejoyarcade.site →', 16, theme.subtext, { fontStyle: 'bold' }).setOrigin(0.5)
    arcade.setInteractive({ useHandCursor: true })
    arcade.on('pointerdown', () => {
      sfx.click()
      window.open('https://littlejoyarcade.site', '_blank', 'noopener')
    })

    button(this, W - 84, 736, `${THEME_KEYS.length} themes`, () => {
      const index = THEME_KEYS.indexOf(data.settings.theme)
      setSetting('theme', THEME_KEYS[(index + 1) % THEME_KEYS.length])
      this.scene.restart()
    }, { width: 136, height: 44, size: 15, fill: theme.dark ? 0x312e81 : 0xffffff, textColor: theme.dark ? '#e0e7ff' : theme.text, theme })

    text(this, W / 2, H - 42, 'Undo Z · Hint H · Restart R · Pause Esc', 14, theme.subtext, { alpha: 0.7 }).setOrigin(0.5)

    this.input.keyboard?.on('keydown-ENTER', () => fade(this, 'game', { mode: 'journey', level: next }))
  }
}
