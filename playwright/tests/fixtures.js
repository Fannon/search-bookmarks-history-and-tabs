import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page)
  },
})

export { expect }

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
