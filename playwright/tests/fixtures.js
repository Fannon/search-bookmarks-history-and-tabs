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
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleErrors = []

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

    await use(page)

    // After test completes, fail if there were unexpected errors
    // Note: This runs after the test body but before afterEach hooks
    if (consoleErrors.length > 0) {
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
 */
export const expectNoClientErrors = async (page) => {
  // The error overlay is hidden by default and only shown when errors occur
  // Check that either the overlay is not visible OR has no content
  const errorOverlay = page.locator('#error-overlay')
  const isVisible = await errorOverlay.isVisible()
  if (isVisible) {
    // If visible, it should be empty (no errors displayed)
    await expect(errorOverlay).toHaveText('')
  }
  // If not visible, no errors are being shown
}
