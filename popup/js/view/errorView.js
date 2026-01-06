/**
 * @file Shared helpers for managing popup overlays (errors and info).
 *
 * Responsibilities:
 * - Provide the `closeErrors` and `closeInfo` view helpers.
 * - Render errors consistently via `printError`, including markup sanitization and console logging.
 * - Render informational messages via `printInfo` for demos and user guidance.
 * - Allow users to dismiss overlays and continue using the extension gracefully.
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

  // Clear the error queue
  errorQueue = []
}

/**
 * Hide the global info overlay if present on the current page.
 */
export function closeInfo() {
  const overlay = document.getElementById('info-overlay')

  if (overlay) {
    overlay.style.display = 'none'
    overlay.innerHTML = ''
  }
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

  // Render to the error overlay
  const overlay = document.getElementById('error-overlay')

  if (overlay) {
    renderErrorOverlay(overlay, errorQueue)
    return
  }

  console.warn('Error display element not found in DOM. Error:', err?.message || err)
}

/**
 * Display an informational message in the UI info overlay.
 * Useful for demos and user guidance. Does not log to console.error.
 *
 * @param {string} title - The title/header for the info message.
 * @param {string} [message] - Optional detailed message content.
 */
export function printInfo(title, message) {
  // Close any existing info overlay first
  closeInfo()

  // Log to console for debugging
  console.info(`ℹ️ ${title}${message ? `: ${message}` : ''}`)

  // Render to the info overlay
  const overlay = document.getElementById('info-overlay')

  if (overlay) {
    renderInfoOverlay(overlay, title, message)
    return
  }

  console.warn('Info display element not found in DOM.')
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
 * Render an informational message using the info overlay.
 *
 * @param {HTMLElement} overlay - The overlay element
 * @param {string} title - The title/header text
 * @param {string} [message] - Optional message content
 */
function renderInfoOverlay(overlay, title, message) {
  const messageHtml = message ? `<div class="info-message">${escapeHtml(message)}</div>` : ''

  overlay.innerHTML = `
    <div class="info-header">ℹ️ ${escapeHtml(title)}</div>
    ${messageHtml}
    <div class="info-footer">
      <button id="btn-dismiss-info" class="overlay-button">OK</button>
    </div>
  `

  overlay.style.display = 'block'

  // Attach dismiss handler
  const dismissBtn = document.getElementById('btn-dismiss-info')
  if (dismissBtn) {
    dismissBtn.addEventListener('click', closeInfo)
  }

  // Also close on Escape key or any other key
  const keyHandler = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      closeInfo()
      document.removeEventListener('keydown', keyHandler)
    }
  }
  document.addEventListener('keydown', keyHandler)
}
