/**
 * @file Helper for extension internationalization (i18n).
 */

const browserApi = window.chrome || window.browser || {}

/**
 * Get localized string by key, falling back to default value.
 *
 * @param {string} key - The key of the localized message.
 * @param {string} [defaultValue] - Fallback value if message is not found or API is unavailable.
 * @returns {string} The localized string.
 */
export function t(key, defaultValue) {
  if (browserApi.i18n?.getMessage) {
    const message = browserApi.i18n.getMessage(key)
    if (message) {
      return message
    }
  }
  return defaultValue !== undefined ? defaultValue : key
}

/**
 * Automatically translate all elements with data-i18n* attributes in the document.
 */
export function initI18n() {
  // Translate text content
  const textElements = document.querySelectorAll('[data-i18n]')
  for (let i = 0; i < textElements.length; i++) {
    const el = textElements[i]
    const key = el.getAttribute('data-i18n')
    if (key) {
      el.textContent = t(key, el.textContent)
    }
  }

  // Translate placeholders
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]')
  for (let i = 0; i < placeholderElements.length; i++) {
    const el = placeholderElements[i]
    const key = el.getAttribute('data-i18n-placeholder')
    if (key) {
      el.placeholder = t(key, el.placeholder)
    }
  }

  // Translate titles
  const titleElements = document.querySelectorAll('[data-i18n-title]')
  for (let i = 0; i < titleElements.length; i++) {
    const el = titleElements[i]
    const key = el.getAttribute('data-i18n-title')
    if (key) {
      el.title = t(key, el.title)
    }
  }

  // Translate aria-labels
  const ariaLabelElements = document.querySelectorAll('[data-i18n-aria-label]')
  for (let i = 0; i < ariaLabelElements.length; i++) {
    const el = ariaLabelElements[i]
    const key = el.getAttribute('data-i18n-aria-label')
    if (key) {
      el.setAttribute('aria-label', t(key, el.getAttribute('aria-label') || ''))
    }
  }

  // Translate new badge content attributes
  const badgeElements = document.querySelectorAll('[data-i18n-badge]')
  for (let i = 0; i < badgeElements.length; i++) {
    const el = badgeElements[i]
    const key = el.getAttribute('data-i18n-badge')
    if (key) {
      el.setAttribute('data-new-label', t(key, el.getAttribute('data-new-label') || 'new'))
    }
  }
}
