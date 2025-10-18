/**
 * @file Gathers shared helper utilities for popup modules.
 *
 * Provides:
 * - Relative time formatting (`timeSince`) for surfacing history/recency metadata.
 * - URL cleanup helpers to normalise and compare bookmark addresses reliably.
 * - Lazy script loading with deduplication for libraries like mark.js and uFuzzy.
 * - Error logging/rendering helpers to keep user feedback consistent across entry points.
 */

/**
 * Converts a date to a human-readable "time ago" format
 *
 * Converts Unix timestamps or Date objects to relative time strings like
 * "2 hours ago", "3 days ago", etc. Falls back to smaller units if date
 * is within the current day.
 *
 * @param {Date|number} date - Date object or Unix timestamp
 * @returns {string} Formatted relative time (e.g., "5 minutes ago")
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
 * Normalizes URLs by removing protocol, www, and trailing slashes
 *
 * Strips http://, https://, www. prefix and converts to lowercase
 * to enable consistent URL comparison across different URL formats.
 * Used for matching bookmarks/history to current page and for display.
 *
 * Examples:
 * - "https://www.example.com/" → "example.com"
 * - "http://example.com/path" → "example.com/path"
 * - "www.example.com/" → "example.com"
 *
 * @param {string|null} url - URL to normalize
 * @returns {string} Normalized URL (lowercase, no protocol/www/trailing slash)
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
 * Dynamically loads a script file and caches the result
 *
 * Prevents loading the same script multiple times by tracking loaded URLs.
 * Used for lazy-loading large libraries (uFuzzy, mark.js) that are only
 * needed when specific features are used.
 *
 * @param {string} url - Script URL to load
 * @returns {Promise<void>} Resolves when script is loaded or cached
 * @throws {Error} If script fails to load
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
 * Displays an error in the UI error list and logs to console
 *
 * Prepends error messages to the error-list element with full stack trace.
 * Logs to console.error for developer debugging. Used throughout the extension
 * to provide user-facing error feedback while maintaining console visibility.
 *
 * @param {Error} err - The error object with message and stack
 * @param {string} [text] - Optional context message to display before error message
 */
export function printError(err, text) {
  let html = ''
  if (text) {
    html += `<li class="error"><b>Error</b>: ${text}</span>`
    console.error(text)
  }
  console.error(err)
  html += `<li class="error"><b>Error Message</b>: ${err.message}</span>`
  if (err.stack) {
    html += `<li class="error"><b>Error Stack</b>: ${err.stack}</li>`
  }
  // Prepend errors to top of list (most recent errors appear first)
  const errorList = document.getElementById('error-list')
  if (errorList) {
    errorList.innerHTML = html + errorList.innerHTML
    errorList.style.display = 'block'
  } else {
    // Fallback for test environments where DOM might not be available
    console.warn('Error list element not found in DOM. Error:', err.message)
  }
}
