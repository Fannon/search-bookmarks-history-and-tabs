import { test as base, expect } from '@playwright/test'

/**
 * Patterns for console errors that are expected and should be ignored.
 * These are errors that are intentionally triggered by the application's
 * normal error handling flow.
 */
const EXPECTED_ERROR_PATTERNS = [
  // Options validation errors are expected when user enters invalid config
  'User options do not match the required schema',
]

/**
 * Check if an error message matches any of the expected patterns.
 * @param {string} text - The error message to check
 * @returns {boolean} - True if the error is expected
 */
function isExpectedError(text) {
  return EXPECTED_ERROR_PATTERNS.some((pattern) => text.includes(pattern))
}

/**
 * Extended test fixture that monitors for unexpected console errors.
 * This catches JavaScript errors that may not be surfaced to the UI.
 *
 * Expected errors (like validation errors) are filtered out based on
 * the EXPECTED_ERROR_PATTERNS list above.
 *
 * Use test.use({ skipConsoleErrors: true }) to disable this for specific tests.
 */
export const test = base.extend({
  // Default to false (monitoring enabled)
  skipConsoleErrors: [false, { option: true }],

  page: async ({ page, skipConsoleErrors }, use) => {
    const consoleErrors = []

    if (!skipConsoleErrors) {
      // Capture console.error messages
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          // Ignore expected errors or Playwright-specific messages
          if (!text.includes('[Playwright]') && !isExpectedError(text)) {
            consoleErrors.push(text)
          }
        }
      })

      // Capture uncaught JavaScript exceptions
      page.on('pageerror', (err) => {
        const message = err.message
        if (!isExpectedError(message)) {
          consoleErrors.push(`Page Error: ${message}`)
        }
      })
    }

    await use(page)

    // After test completes, fail if there were unexpected errors
    // Note: This runs after the test body but before afterEach hooks
    if (!skipConsoleErrors && consoleErrors.length > 0) {
      throw new Error(`Unexpected console errors during test:\n${consoleErrors.join('\n')}`)
    }
  },
})

export { expect }

/**
 * Assert that no client-side errors are currently displayed in the UI.
 * Checks the error overlay element which is hidden by default.
 *
 * @param {import('@playwright/test').Page} page - Playwright page instance
 * @returns {Promise<void>}
 */
export const expectNoClientErrors = async (page) => {
  const errorOverlay = page.locator('#error-overlay, #error-message')
  // Ensure the element matches in the DOM (can be hidden) to catch selector issues
  await expect(errorOverlay).not.toHaveCount(0)

  // Use a visibility-aware check: if any overlay is visible, it must be empty
  const visibleOverlay = errorOverlay.filter({ visible: true })
  if ((await visibleOverlay.count()) > 0) {
    // If one is visible, it should be the only one and it should have no text
    await expect(visibleOverlay).toHaveCount(1)
    await expect(visibleOverlay).toHaveText('')
  }
}
