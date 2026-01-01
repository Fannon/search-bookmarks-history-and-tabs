/**
 * @file Gathers shared helper utilities for popup modules.
 *
 * Provides:
 * - Relative time formatting (`timeSince`) for surfacing history/recency metadata.
 * - URL cleanup helpers to normalize and compare bookmark addresses reliably.
 * - Lazy script loading with deduplication for libraries like uFuzzy.
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

let nextGeneratedId = 1

/**
 * Generate a deterministic identifier for synthetic search result entries.
 */
export function generateRandomId() {
  const id = `R${nextGeneratedId}`
  nextGeneratedId += 1
  return id
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

// Regex special characters that need escaping for literal matching
const REGEX_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g

/**
 * Escape special regex characters for literal matching.
 *
 * @param {string} str - String to escape.
 * @returns {string} Escaped string safe for RegExp constructor.
 */
export function escapeRegex(str) {
  return str.replace(REGEX_ESCAPE_REGEX, '\\$&')
}

/**
 * Highlight matching terms in text by wrapping them with <mark> tags.
 *
 * This is a shared utility for pre-computing search result highlights during
 * the search phase (Zero-DOM highlighting approach). The text is HTML-escaped
 * first to prevent XSS, then <mark> tags are applied for matching terms.
 *
 * @param {string} text - Text to highlight (will be HTML-escaped).
 * @param {string[]|RegExp} termsOrRegex - Search terms to highlight or a pre-compiled RegExp.
 * @returns {string} HTML-safe string with <mark> tags around matching terms.
 */
export function highlightMatches(text, termsOrRegex) {
  if (!text || !termsOrRegex) {
    return escapeHtml(text)
  }

  // Escape HTML first to prevent XSS
  const escapedText = escapeHtml(text)

  if (termsOrRegex instanceof RegExp) {
    return escapedText.replace(termsOrRegex, '<mark>$1</mark>')
  }

  // Filter out empty terms and sort by length descending (match longest first)
  const validTerms = termsOrRegex.filter((t) => t && t.length > 0)
  if (validTerms.length === 0) {
    return escapedText
  }

  // Escape terms for regex and sort by length descending to match longest first
  const escapedTerms = validTerms
    .map((t) => escapeHtml(t)) // Escape HTML chars in terms too
    .map((t) => escapeRegex(t))
    .sort((a, b) => b.length - a.length)

  const highlightRegex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
  return escapedText.replace(highlightRegex, '<mark>$1</mark>')
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
  if (!date) {
    return 'Invalid date'
  }
  const timestamp = typeof date === 'number' ? date : new Date(date).getTime()
  if (Number.isNaN(timestamp)) {
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

const URL_CLEANUP_PREFIX_REGEX = /^(?:https?:\/\/)?(?:www\.)?/
const URL_CLEANUP_SUFFIX_REGEX = /\/$/

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
  if (!url) return ''
  return String(url).toLowerCase().replace(URL_CLEANUP_PREFIX_REGEX, '').replace(URL_CLEANUP_SUFFIX_REGEX, '')
}

// Cache for loaded scripts to avoid duplicate loading and network requests
const loadedScripts = new Set()

/**
 * Dynamically loads a script file and caches the result
 *
 * Prevents loading the same script multiple times by tracking loaded URLs.
 * Used for lazy-loading large libraries (uFuzzy) that are only
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

  return new Promise((resolve, reject) => {
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
