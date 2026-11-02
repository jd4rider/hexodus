// Renders public/favicon.svg at 1024×1024 for electron-builder.
// Requires puppeteer-core without adding it to the app's dependencies:
//   npm install --no-save puppeteer-core
//   node scripts/make-icons.mjs
// then build/icon.iconset → iconutil -c icns (macOS only, one-time).
import { readFileSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const svg = readFileSync('public/favicon.svg', 'utf8').replace('<svg ', '<svg width="1024" height="1024" ')

mkdirSync('build', { recursive: true })
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 })
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
await page.screenshot({ path: 'build/icon-1024.png', omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } })
await browser.close()
console.log('wrote build/icon-1024.png')
