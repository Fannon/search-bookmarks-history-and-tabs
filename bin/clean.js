#!/usr/bin/env node
/**
 * @file Removes build artifacts prior to bundling.
 *
 * `npm run clean` invokes this helper to clear the dist/ directory and delete
 * generated bundle files from popup/js/ and popup/css/ so subsequent builds
 * start from a predictable state.
 */
import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const thisDir = dirname(fileURLToPath(import.meta.url))
const popupJsDir = join(thisDir, '..', 'popup', 'js')
const popupCssDir = join(thisDir, '..', 'popup', 'css')

// Remove stale bundle files from popup/js/
try {
  for (const name of fs.readdirSync(popupJsDir)) {
    if (name.endsWith('.bundle.min.js') || name.endsWith('.bundle.min.js.map')) {
      fs.rmSync(join(popupJsDir, name), { force: true })
    }
  }
} catch {
  /* ignore if the directory doesn't exist */
}

// Remove stale minified CSS from popup/css/
try {
  for (const name of fs.readdirSync(popupCssDir)) {
    if (name.endsWith('.min.css')) {
      fs.rmSync(join(popupCssDir, name), { force: true })
    }
  }
} catch {
  /* ignore if the directory doesn't exist */
}

// Clear dist/
fs.rmSync('./dist', { recursive: true, force: true })
