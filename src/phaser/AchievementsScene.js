import Phaser from 'phaser'
import { W, background, text, fade, themeOf, iconButton, panel } from './common.js'
import { data } from '../save.js'
import { ACHIEVEMENTS } from '../progress.js'

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('achievements')
  }

  create() {
    const theme = themeOf(data.settings.theme)
    background(this, theme, { motes: !data.settings.reducedMotion })

    iconButton(this, 44, 46, '‹', () => fade(this, 'menu'), theme, 46)
    text(this, W / 2, 40, 'Achievements', 26, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    const unlocked = ACHIEVEMENTS.filter((a) => data.achievements.includes(a.id)).length
    text(this, W / 2, 74, `${unlocked} of ${ACHIEVEMENTS.length} earned`, 15, theme.subtext).setOrigin(0.5)

    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = 132 + index * 76
      const earned = data.achievements.includes(achievement.id)
      panel(this, W / 2, y, 552, 64, theme, { alpha: earned ? 0.92 : 0.5, radius: 16 })
      const badge = this.add.graphics()
      badge.fillStyle(earned ? theme.accent : 0x94a3b8, earned ? 0.95 : 0.35)
      badge.fillCircle(84, y, 19)
      text(this, 84, y, earned ? '★' : '·', 18, '#ffffff').setOrigin(0.5)
      text(this, 116, y - 11, achievement.name, 17, theme.text, { fontStyle: 'bold' }).setOrigin(0, 0.5)
      text(this, 116, y + 12, achievement.description, 13, theme.subtext).setOrigin(0, 0.5)
      if (earned) {
        text(this, W - 52, y, '✓', 20, theme.accent, { fontStyle: 'bold' }).setOrigin(0.5)
      }
      void badge
    })

    text(this, W / 2, 132 + ACHIEVEMENTS.length * 76 + 14, 'Progress is saved locally and synced when you sign in.', 13, theme.subtext, {
      alpha: 0.8,
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5)
  }
}
