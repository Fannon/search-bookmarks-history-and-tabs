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

  if (termsOrRegex instanceof RegExp) {
    return highlightRegexMatches(text, termsOrRegex)
  }

  // Escape HTML first to prevent XSS
  const escapedText = escapeHtml(text)

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
 * Highlight matches using a pre-compiled regex.
 *
 * Use this on hot paths that already compiled and sorted terms once.
 *
 * @param {string} text - Text to highlight (will be HTML-escaped).
 * @param {RegExp} regex - Pre-compiled highlight regex with one capture group.
 * @returns {string} HTML-safe string with <mark> tags around matching terms.
 */
export function highlightRegexMatches(text, regex) {
  if (!text || !regex) {
    return escapeHtml(text)
  }

  return escapeHtml(text).replace(regex, '<mark>$1</mark>')
}

// Pre-calculate time units for performance
const TIME_UNITS = [
  [31536000, 'year'],
  [2592000, 'month'],
  [86400, 'd'],
  [3600, 'h'],
  [60, 'm'],
]

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
  for (let i = 0; i < TIME_UNITS.length; i++) {
    const unit = TIME_UNITS[i]
    const unitSeconds = unit[0]
    const count = Math.floor(seconds / unitSeconds)
    if (count >= 1) {
      return `${count} ${unit[1]}`
    }
  }

  return `${seconds} s`
}

/**
 * Normalizes URLs by removing protocol, www, trailing slashes and hashes
 *
 * Strips http://, https://, www. prefix and converts to lowercase
 * to enable consistent URL comparison across different URL formats.
 * Used for matching, deduplication, and search indexing.
 *
 * @param {string|null} url - URL to normalize
 * @returns {string} Normalized URL (lowercase, no protocol/www/trailing slash/hash)
 */
export function cleanUpUrl(url) {
  if (!url) return ''
  const normalizedUrl = String(url).toLowerCase()

  let start = 0
  if (normalizedUrl.startsWith('https://')) {
    start = 8
  } else if (normalizedUrl.startsWith('http://')) {
    start = 7
  }

  if (normalizedUrl.startsWith('www.', start)) {
    start += 4
  }

  let end = normalizedUrl.indexOf('#', start)
  if (end === -1) {
    end = normalizedUrl.length
  }

  if (end > start && normalizedUrl.charCodeAt(end - 1) === 47) {
    end -= 1
  }

  return start === 0 && end === normalizedUrl.length ? normalizedUrl : normalizedUrl.slice(start, end)
}

// Cache script load promises to deduplicate both completed and in-flight requests
const scriptLoads = new Map()

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
export function loadScript(url) {
  const cachedLoad = scriptLoads.get(url)
  if (cachedLoad) {
    return cachedLoad
  }

  const s = document.createElement('script')
  s.type = 'text/javascript'
  s.src = url

  let rejectLoad
  const load = new Promise((resolve, reject) => {
    rejectLoad = reject
    s.onload = () => resolve()
    s.onerror = () => {
      scriptLoads.delete(url)
      reject(new Error(`Failed to load script: ${url}`))
    }
  })

  scriptLoads.set(url, load)

  try {
    document.getElementsByTagName('head')[0].appendChild(s)
  } catch (error) {
    scriptLoads.delete(url)
    rejectLoad(error)
  }

  return load
}
