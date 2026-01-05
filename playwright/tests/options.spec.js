import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Options View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
  })

  test.describe('Initializing Phase', () => {
    test('successfully loads', async ({ page }) => {
      await expect(page.locator('#options #config')).toBeVisible()
    })

    test('loads the default user config', async ({ page }) => {
      await expect(page.locator('#config')).toHaveValue(/searchStrategy/)
      await expectNoClientErrors(page)
    })

    test('saves a new user config in JSON format', async ({ page }) => {
      const newConfig = JSON.stringify(
        {
          displayVisitCounter: true,
        },
        null,
        2,
      )

      const userConfig = page.locator('#config')
      await userConfig.fill('')
      await expect(userConfig).toHaveValue('')
      await userConfig.fill(newConfig)

      await page.locator('#opt-save').click()
      await page.waitForURL(/.*#search.*/)

      await page.goto('/options.html')
      await expect(page.locator('#config')).toHaveValue(/displayVisitCounter/)
      await expectNoClientErrors(page)
    })

    test('saves a new user config in YAML format', async ({ page }) => {
      const newConfig = 'displayVisitCounter: true\n'

      const userConfig = page.locator('#config')
      await userConfig.fill('')
      await expect(userConfig).toHaveValue('')
      await userConfig.fill(newConfig)

      await page.locator('#opt-save').click()
      await page.waitForURL(/.*#search.*/)

      await page.goto('/options.html')
      await expect(page.locator('#config')).toHaveValue(/displayVisitCounter/)
      await expectNoClientErrors(page)
    })
  })

  // Validation tests intentionally produce console errors, so we skip the monitoring
  test.describe('Validation', () => {
    test.use({ skipConsoleErrors: true })

    test('saves valid config without errors', async ({ page }) => {
      const validConfig = 'searchStrategy: precise\nsearchMaxResults: 50\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(validConfig)
      await page.locator('#opt-save').click()

      await expect(page.locator('#error-message')).not.toBeVisible()
      await page.waitForURL(/.*#search.*/)
    })

    test('shows validation error for invalid option type and blocks save', async ({ page }) => {
      const invalidConfig = 'searchMaxResults: "not-a-number"\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(invalidConfig)
      await page.locator('#opt-save').click()

      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()
      await expect(errorOverlay).toContainText('Invalid Options')

      // Verify it contains the specific validation error
      await expect(errorOverlay).toContainText('searchMaxResults')

      // Verify URL did NOT change (save was blocked)
      await expect(page).not.toHaveURL(/.*#search.*/)
    })

    test('shows validation error for enum violation and allows user to fix', async ({ page }) => {
      const invalidConfig = 'searchStrategy: invalid-value\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(invalidConfig)
      await page.locator('#opt-save').click()

      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()
      await expect(errorOverlay).toContainText('searchStrategy')

      // Fix the error
      await userConfig.fill('searchStrategy: precise\n')
      await page.locator('#opt-save').click()

      // Should now succeed
      await expect(errorOverlay).not.toBeVisible()
      await page.waitForURL(/.*#search.*/)
    })
  })

  test.describe('Unknown Options', () => {
    test.use({ skipConsoleErrors: true })
    test('detects unknown option and shows remove button', async ({ page }) => {
      const configWithUnknown = 'searchStrategy: precise\nunknownOption: someValue\nanotherUnknown: 123\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(configWithUnknown)
      await page.locator('#opt-save').click()

      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()
      await expect(errorOverlay).toContainText('Unknown option')
      await expect(errorOverlay).toContainText('unknownOption')
      await expect(errorOverlay).toContainText('anotherUnknown')

      // Verify the REMOVE UNKNOWN OPTIONS button is present
      await expect(page.locator('#btn-clean')).toBeVisible()
      await expect(page.locator('#btn-dismiss')).toBeVisible()
    })

    test('removes unknown options via button and allows save', async ({ page }) => {
      const configWithUnknown = 'searchStrategy: precise\nunknownOption: shouldBeRemoved\nenableTabs: true\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(configWithUnknown)
      await page.locator('#opt-save').click()

      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()

      // Click the remove button
      await page.locator('#btn-clean').click()

      // Error should be dismissed
      await expect(errorOverlay).not.toBeVisible()

      // Verify the unknown option was removed but valid options remain
      const currentValue = await userConfig.inputValue()
      expect(currentValue).toContain('searchStrategy')
      expect(currentValue).toContain('enableTabs')
      expect(currentValue).not.toContain('unknownOption')

      // Now save should work
      await page.locator('#opt-save').click()
      await page.waitForURL(/.*#search.*/)
    })

    test('dismisses error without removing options', async ({ page }) => {
      const configWithUnknown = 'searchStrategy: precise\nunknownOption: keepMe\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(configWithUnknown)
      await page.locator('#opt-save').click()

      const errorOverlay = page.locator('#error-message')
      await expect(errorOverlay).toBeVisible()

      // Click dismiss
      await page.locator('#btn-dismiss').click()

      // Error should be hidden
      await expect(errorOverlay).not.toBeVisible()

      // But the unknown option should still be there
      const currentValue = await userConfig.inputValue()
      expect(currentValue).toContain('unknownOption')

      // Try saving again - error should reappear
      await page.locator('#opt-save').click()
      await expect(errorOverlay).toBeVisible()
    })
  })

  test.describe('Edge Cases', () => {
    test.use({ skipConsoleErrors: true })
    test('handles only unknown options (no valid options)', async ({ page }) => {
      const onlyUnknownOptions = 'completelyUnknown: value\nanotherBad: 123\n'
      const userConfig = page.locator('#config')

      await userConfig.fill(onlyUnknownOptions)
      await page.locator('#opt-save').click()

      // Error should appear
      await expect(page.locator('#error-message')).toBeVisible()

      // Click the remove button
      await page.locator('#btn-clean').click()

      // After removal, textarea should contain empty object (YAML representation of {})
      const currentValue = await userConfig.inputValue()
      expect(currentValue.trim()).toBe('{}')
    })

    test('preserves valid complex config when removing unknown options', async ({ page }) => {
      const complexConfig = `searchStrategy: fuzzy
searchMaxResults: 50
customSearchEngines:
  - alias: test
    name: Test Engine
    urlPrefix: https://test.com/search?q=$s
unknownOption: removeMe
badNested:
  deep: value
`
      const userConfig = page.locator('#config')

      await userConfig.fill(complexConfig)
      await page.locator('#opt-save').click()

      await expect(page.locator('#error-message')).toBeVisible()
      await page.locator('#btn-clean').click()

      const currentValue = await userConfig.inputValue()
      expect(currentValue).toContain('searchStrategy: fuzzy')
      expect(currentValue).toContain('customSearchEngines:')
      expect(currentValue).toContain('alias: test')
      expect(currentValue).not.toContain('unknownOption')
      expect(currentValue).not.toContain('badNested')
    })
  })
})
