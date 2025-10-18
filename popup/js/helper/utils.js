/**
 * @file Gathers shared helper utilities for popup modules.
 * Provides HTML escaping, time formatting, URL cleanup, dynamic script loading, and error reporting.
 */

const HTML_ESCAPE_REGEX = /[&<>"']/g
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escape HTML special characters to prevent markup injection.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(HTML_ESCAPE_REGEX, (match) => HTML_ESCAPE_MAP[match])
}

/**
 * Convert a date to a human-readable "time ago" string.
 * @param {Date|number} date
 * @returns {string}
 *
 * @see https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
 */
export function timeSince(date) {
  if (!date || isNaN(new Date(date).getTime())) {
    return 'Invalid date'
  }

  const seconds = Math.floor((new Date() - new Date(date)) / 1000)

  if (seconds < 0) {
    return '0 seconds'
  }

  // Use fixed intervals (30 days/month, 365 days/year) - not accounting for actual length variations
  const intervals = [
    { unitSeconds: 31536000, label: 'year' },
    { unitSeconds: 2592000, label: 'month' },
    { unitSeconds: 86400, label: 'day' },
    { unitSeconds: 3600, label: 'hour' },
    { unitSeconds: 60, label: 'minute' },
  ]

  for (const { unitSeconds, label } of intervals) {
    const count = Math.floor(seconds / unitSeconds)
    if (count >= 1) {
      return `${count} ${label}${count === 1 ? '' : 's'}`
    }
  }

  const secondsCount = Math.floor(seconds)
  const secondsLabel = secondsCount === 1 ? 'second' : 'seconds'
  return `${secondsCount} ${secondsLabel}`
}

/**
 * Normalize URLs by stripping protocol, www, and trailing slashes.
 * @param {string|null} url
 * @returns {string}
 *
 * @see https://stackoverflow.com/a/57698415
 */
export function cleanUpUrl(url) {
  if (!url) {
    return ''
  }

  return String(url)
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

// Cache for loaded scripts to avoid duplicate loading and network requests
const loadedScripts = new Set()

/**
 * Dynamically load a script file and cache the result.
 * @param {string} url
 * @returns {Promise<void>}
 * @throws {Error}
 */
export async function loadScript(url) {
  if (loadedScripts.has(url)) {
    return Promise.resolve()
  }

  return new Promise(function (resolve, reject) {
    const s = document.createElement('script')
    s.type = 'text/javascript'
    s.onload = () => {
      loadedScripts.add(url)
      resolve()
    }
    s.onerror = () => {
      reject(new Error(`Failed to load script: ${url}`))
    }
    s.src = url
    document.getElementsByTagName('head')[0].appendChild(s)
  })
}

/**
 * Display an error in the UI list and log details to the console.
 * @param {Error} err
 * @param {string} [text]
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

  if (err && err.stack) {
    html += `<li class="error"><b>Error Stack</b>: <pre>${escapeHtml(err.stack)}</pre></li>`
  }

  errorList.innerHTML = html + errorList.innerHTML
  errorList.style.display = 'block'
}
