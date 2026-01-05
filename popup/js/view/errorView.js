/**
 * @file Shared helpers for managing the popup error overlay.
 *
 * Responsibilities:
 * - Provide the `closeErrors` view helper without importing the primary search entry point.
 * - Render errors consistently via `printError`, including markup sanitization and console logging.
 * - Allow users to dismiss errors and continue using the extension gracefully.
 */

import { escapeHtml } from '../helper/utils.js'

/** Track accumulated errors for display */
let errorQueue = []

/**
 * Hide the global error overlay if present on the current page.
 */
export function closeErrors() {
  const overlay = document.getElementById('error-overlay')

  if (overlay) {
    overlay.style.display = 'none'
    overlay.innerHTML = ''
  }

  // Also check for legacy #errors element (for backwards compatibility)
  const legacyErrorList = document.getElementById('errors')
  if (legacyErrorList) {
    legacyErrorList.style.display = 'none'
  }

  // Clear the error queue
  errorQueue = []
}

/**
 * Display an error in the UI error overlay and log it to the console.
 * Users can dismiss the error and continue using the extension.
 *
 * @param {Error|string} err - Error instance or descriptive string.
 * @param {string} [text] - Optional context message to prepend.
 */
export function printError(err, text) {
  // Always log to console
  if (text) {
    console.error(text)
  }
  console.error(err)

  // Add to error queue
  const errorInfo = {
    context: text,
    message: err && typeof err.message === 'string' ? err.message : String(err),
    stack: err?.stack,
  }
  errorQueue.push(errorInfo)

  // Try the new overlay first
  const overlay = document.getElementById('error-overlay')

  if (overlay) {
    renderErrorOverlay(overlay, errorQueue)
    return
  }

  // Fallback to legacy #errors element for other pages
  const legacyErrorList = document.getElementById('errors')
  if (legacyErrorList) {
    renderLegacyErrors(legacyErrorList, errorQueue)
    return
  }

  console.warn('Error display element not found in DOM. Error:', err?.message || err)
}

/**
 * Render errors using the overlay that covers the results area.
 *
 * @param {HTMLElement} overlay - The overlay element
 * @param {Array} errors - Array of error info objects
 */
function renderErrorOverlay(overlay, errors) {
  const errorCount = errors.length
  const headerText = errorCount > 1 ? `⚠️ ${errorCount} Errors Occurred` : '⚠️ An Error Occurred'

  // Build simple error content
  const errorContentHtml = errors
    .map((e, index) => {
      let html = ''
      if (index > 0) {
        html += '<br>'
      }
      if (e.context) {
        html += `<strong>${escapeHtml(e.context)}</strong><br>`
      }
      html += escapeHtml(e.message)
      if (e.stack) {
        html += `<div class="error-stack">${escapeHtml(e.stack)}</div>`
      }
      return html
    })
    .join('')

  overlay.innerHTML = `
    <div class="error-header">${headerText}</div>
    ${errorContentHtml}
    <div class="error-footer">
      <button id="btn-dismiss-error" class="overlay-button">DISMISS</button>
    </div>
  `

  overlay.style.display = 'block'

  // Attach dismiss handler
  const dismissBtn = document.getElementById('btn-dismiss-error')
  if (dismissBtn) {
    dismissBtn.addEventListener('click', closeErrors)
  }

  // Also close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeErrors()
      document.removeEventListener('keydown', escHandler)
    }
  }
  document.addEventListener('keydown', escHandler)
}

/**
 * Render errors using the legacy list style (for backwards compatibility with other pages).
 *
 * @param {HTMLElement} errorList - The legacy #errors ul element
 * @param {Array} errors - Array of error info objects
 */
function renderLegacyErrors(errorList, errors) {
  let html = ''

  for (const e of errors) {
    if (e.context) {
      html += `<li class="error"><b>Error</b>: ${escapeHtml(e.context)}</li>`
    }
    html += `<li class="error"><b>Error Message</b>: ${escapeHtml(e.message)}</li>`
    if (e.stack) {
      html += `<li class="error"><b>Error Stack</b>: ${escapeHtml(e.stack)}</li>`
    }
  }

  errorList.innerHTML = html
  errorList.style.display = 'block'
}
