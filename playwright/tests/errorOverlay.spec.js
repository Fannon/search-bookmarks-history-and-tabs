/** @file Test suite for error overlay behavior */
// Note: These tests intentionally trigger errors, so we need to use base test
// to avoid the console error monitoring failing them
import { test as baseTest } from '@playwright/test'
import { expect, test } from './fixtures.js'

/**
 * Dedicated test suite for error overlay functionality.
 * These tests verify that errors are displayed and can be dismissed correctly.
 */
baseTest.describe('Error Overlay', () => {
  baseTest.describe('Search Page Error Overlay', () => {
    baseTest('displays error when triggered and can be dismissed via button', async ({ page }) => {
      await page.goto('/')

      // Wait for initialization to complete
      await expect(page.locator('#results-load')).not.toBeVisible()

      // Trigger an error via the exposed test helper
      await page.evaluate(() => {
        window.ext.printError(new Error('Test error message'), 'Test context')
      })

      // Verify error overlay is visible
      const errorOverlay = page.locator('#error-overlay')
      await expect(errorOverlay).toBeVisible()

      // Verify error content is displayed
      await expect(errorOverlay).toContainText('Error Occurred')
      await expect(errorOverlay).toContainText('Test context')
      await expect(errorOverlay).toContainText('Test error message')

      // Verify dismiss button is present
      const dismissBtn = page.locator('#btn-dismiss-error')
      await expect(dismissBtn).toBeVisible()

      // Click dismiss button
      await dismissBtn.click()

      // Verify overlay is hidden
      await expect(errorOverlay).not.toBeVisible()
    })

    baseTest('displays error and can be dismissed via Escape key', async ({ page }) => {
      await page.goto('/')

      // Wait for initialization
      await expect(page.locator('#results-load')).not.toBeVisible()

      // Trigger an error
      await page.evaluate(() => {
        window.ext.printError(new Error('Keyboard test error'))
      })

      // Verify error overlay is visible
      const errorOverlay = page.locator('#error-overlay')
      await expect(errorOverlay).toBeVisible()

      // Press Escape to dismiss
      await page.keyboard.press('Escape')

      // Verify overlay is hidden
      await expect(errorOverlay).not.toBeVisible()
    })

    baseTest('accumulates multiple errors with correct count', async ({ page }) => {
      await page.goto('/')

      // Wait for initialization
      await expect(page.locator('#results-load')).not.toBeVisible()

      // Trigger multiple errors
      await page.evaluate(() => {
        window.ext.printError(new Error('First error'))
        window.ext.printError(new Error('Second error'))
        window.ext.printError(new Error('Third error'))
      })

      // Verify error overlay shows multiple errors
      const errorOverlay = page.locator('#error-overlay')
      await expect(errorOverlay).toBeVisible()
      await expect(errorOverlay).toContainText('3 Errors Occurred')
      await expect(errorOverlay).toContainText('First error')
      await expect(errorOverlay).toContainText('Second error')
      await expect(errorOverlay).toContainText('Third error')

      // Verify dismissing clears all errors
      await page.locator('#btn-dismiss-error').click()
      await expect(errorOverlay).not.toBeVisible()
    })
  })

  baseTest.describe('Options Page Error Overlay', () => {
    baseTest('displays validation error for invalid config', async ({ page }) => {
      await page.goto('/options.html')

      // Enter invalid config
      const userConfig = page.locator('#config')
      await userConfig.fill('searchMaxResults: "not-a-number"\n')

      // Try to save
      await page.locator('#opt-save').click()

      // Verify error overlay appears
      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()
      await expect(errorOverlay).toContainText('Invalid Options')
      await expect(errorOverlay).toContainText('searchMaxResults')

      // Verify dismiss button works
      await page.locator('#btn-dismiss').click()
      await expect(errorOverlay).not.toBeVisible()
    })

    baseTest('displays unknown option warning with remove button', async ({ page }) => {
      await page.goto('/options.html')

      // Enter config with unknown option
      const userConfig = page.locator('#config')
      await userConfig.fill('unknownTestOption: someValue\n')

      // Try to save
      await page.locator('#opt-save').click()

      // Verify error overlay appears with unknown option message
      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()
      await expect(errorOverlay).toContainText('Unknown option')
      await expect(errorOverlay).toContainText('unknownTestOption')

      // Verify both buttons are present
      await expect(page.locator('#btn-clean')).toBeVisible()
      await expect(page.locator('#btn-dismiss')).toBeVisible()

      // Verify remove button works
      await page.locator('#btn-clean').click()
      await expect(errorOverlay).not.toBeVisible()
    })
  })
})

/**
 * Test that normal operation doesn't trigger false positives with the new console monitoring.
 * Uses the standard test fixture with error monitoring enabled.
 */
test.describe('Error Monitoring Integration', () => {
  test('search page initializes without triggering error monitoring', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#results-load')).not.toBeVisible()
    await expect(page.locator('#results')).toBeVisible()
    // If this test passes, it means no unexpected console errors occurred
  })

  test('options page initializes without triggering error monitoring', async ({ page }) => {
    await page.goto('/options.html')
    await expect(page.locator('#config')).toBeVisible()
    // If this test passes, it means no unexpected console errors occurred
  })

  test('tags page initializes without triggering error monitoring', async ({ page }) => {
    await page.goto('/tags.html')
    await expect(page.locator('#tags-list')).toBeVisible()
    // If this test passes, it means no unexpected console errors occurred
  })

  test('folders page initializes without triggering error monitoring', async ({ page }) => {
    await page.goto('/folders.html')
    await expect(page.locator('#folders-list')).toBeVisible()
    // If this test passes, it means no unexpected console errors occurred
  })
})
