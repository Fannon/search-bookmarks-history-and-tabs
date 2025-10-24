/**
 * @file Gathers shared helper utilities for popup modules.
 *
 * Provides:
 * - Relative time formatting (`timeSince`) for surfacing history/recency metadata.
 * - URL cleanup helpers to normalize and compare bookmark addresses reliably.
 * - Lazy script loading with deduplication for libraries like mark.js and uFuzzy.
 * - HTML escaping helpers (`escapeHtml`) to keep rendered content safe.
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
 * Generate a unique identifier for synthetic search result entries.
 *
 * @returns {string} Identifier combining random and timestamp components.
 */
export function generateRandomId() {
  return Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36)
}

/**
 * Escape HTML special characters to prevent markup injection.
 *
 * @param {*} value - Value to escape.
 * @returns {string} Sanitized string safe for HTML contexts.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(HTML_ESCAPE_REGEX, (match) => HTML_ESCAPE_MAP[match])
}

/**
 * Converts a date to a compact "time since" string.
 *
 * Converts Unix timestamps or Date objects to relative time strings like
 * "3 m" or "2 month". Values are simple integer counts plus unit labels with
 * no pluralization or "ago" suffix.
 *
 * @param {Date|number} date - Date object or Unix timestamp.
 * @returns {string} Compact relative time (e.g., "5 h").
 *
 * @see https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
 */
export function timeSince(date) {
  const timestamp = new Date(date).getTime()
  if (!date || Number.isNaN(timestamp)) {
    return 'Invalid date'
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  for (const [unitSeconds, label] of [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
  ]) {
    const count = Math.floor(seconds / unitSeconds)
    if (count >= 1) {
      return `${count} ${label}`
    }
  }

  return `${seconds} s`
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
