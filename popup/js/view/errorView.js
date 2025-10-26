/**
 * @file Shared helpers for managing the popup error overlay.
 *
 * Responsibilities:
 * - Provide the `closeErrors` view helper without importing the primary search entry point.
 * - Render errors consistently via `printError`, including markup sanitization and console logging.
 * - Allow secondary pages (e.g., edit bookmark) to hide the error overlay without triggering search bootstrapping.
 */

import { escapeHtml } from '../helper/utils.js'

/**
 * Hide the global error overlay if present on the current page.
 */
export function closeErrors() {
  const element = document.getElementById('error-list')
  if (element) {
    element.style = 'display: none;'
  }
}

/**
 * Display an error in the UI error list and log it to the console.
 *
 * @param {Error|string} err - Error instance or descriptive string.
 * @param {string} [text] - Optional context message to prepend.
 */
export function printError(err, text) {
  const errorList = document.getElementById('error-list')

  if (text) {
    console.error(text)
  }
  console.error(err)

  if (!errorList) {
    console.warn('Error list element not found in DOM. Error:', err?.message || err)
    return
  }

  let html = ''

  if (text) {
    html += `<li class="error"><b>Error</b>: ${escapeHtml(text)}</li>`
  }

  const message = err && typeof err.message === 'string' ? err.message : String(err)
  html += `<li class="error"><b>Error Message</b>: ${escapeHtml(message)}</li>`

  if (err?.stack) {
    html += `<li class="error"><b>Error Stack</b>: ${escapeHtml(err.stack)}</li>`
  }

  errorList.innerHTML = html + errorList.innerHTML
  errorList.style.display = 'block'
}
