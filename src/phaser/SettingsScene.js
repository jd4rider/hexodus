import Phaser from 'phaser'
import { W, H, background, button, text, fade, themeOf, THEMES, THEME_KEYS, iconButton, panel } from './common.js'
import { data, setSetting, commit } from '../save.js'
import { defaultSave } from '../progress.js'
import { sfx } from '../sound.js'

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('settings')
  }

  create() {
    this.theme = themeOf(data.settings.theme)
    this.confirmReset = false
    this.draw()
  }

  draw() {
    this.children.removeAll()
    const theme = this.theme
    background(this, theme, { motes: !data.settings.reducedMotion })

    iconButton(this, 44, 46, '‹', () => fade(this, 'menu'), theme, 46)
    text(this, W / 2, 40, 'Settings', 26, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 70, 'Saved on this device, and mirrored to your account when signed in.', 13, theme.subtext, {
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5)

    panel(this, W / 2, 176, 540, 108, theme)
    text(this, 74, 152, 'Sound effects', 19, theme.text, { fontStyle: 'bold' })
    text(this, 74, 178, 'Synthesised tones — no audio files.', 14, theme.subtext)
    button(this, 520, 176, data.settings.sound ? 'On' : 'Off', () => {
      setSetting('sound', !data.settings.sound)
      this.draw()
      sfx.click()
    }, { width: 96, height: 44, size: 16, fill: data.settings.sound ? theme.accent : 0x64748b, textColor: '#fff', theme })

    panel(this, W / 2, 296, 540, 108, theme)
    text(this, 74, 272, 'Reduced motion', 19, theme.text, { fontStyle: 'bold' })
    text(this, 74, 298, 'Skips drifting motes and long animations.', 14, theme.subtext)
    button(this, 520, 296, data.settings.reducedMotion ? 'On' : 'Off', () => {
      setSetting('reducedMotion', !data.settings.reducedMotion)
      this.draw()
    }, { width: 96, height: 44, size: 16, fill: data.settings.reducedMotion ? theme.accent : 0x64748b, textColor: '#fff', theme })

    text(this, W / 2, 380, 'Theme', 20, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    THEME_KEYS.forEach((key, index) => {
      const option = THEMES[key]
      const y = 430 + index * 74
      const active = data.settings.theme === key
      const g = this.add.graphics()
      g.fillStyle(theme.dark ? 0xffffff : theme.shadow, 0.1)
      g.fillRoundedRect(50, y - 30, 540, 60, 16)
      if (active) {
        g.lineStyle(3, theme.accent, 0.9)
        g.strokeRoundedRect(50, y - 30, 540, 60, 16)
      }
      option.tile.slice(0, 4).forEach((color, i) => {
        const swatch = this.add.graphics()
        swatch.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1)
        swatch.fillCircle(92 + i * 24, y, 9)
      })
      const label = text(this, 196, y, option.name, 18, theme.text, { fontStyle: active ? 'bold' : 'normal' }).setOrigin(0, 0.5)
      const pick = button(this, 522, y, active ? 'Selected' : 'Use', () => {
        setSetting('theme', key)
        this.theme = themeOf(key)
        this.draw()
        sfx.click()
      }, {
        width: 108,
        height: 40,
        size: 14,
        fill: active ? theme.accent : 0x64748b,
        textColor: '#ffffff',
        theme,
      })
      void label
      void pick
    })

    button(this, W / 2, H - 148, this.confirmReset ? 'Tap again to erase progress' : 'Reset progress', () => {
      if (!this.confirmReset) {
        this.confirmReset = true
        this.draw()
        return
      }
      commit(defaultSave())
      this.confirmReset = false
      this.draw()
    }, { width: 380, height: 48, size: 16, fill: this.confirmReset ? 0xb91c1c : theme.dark ? 0x312e81 : 0xffffff, textColor: this.confirmReset ? '#ffffff' : theme.dark ? '#e0e7ff' : theme.text, theme })

    text(this, W / 2, H - 88, 'Hexodus 0.1.1 · Little Joy Arcade', 13, theme.subtext, { alpha: 0.75 }).setOrigin(0.5)
  }
}
