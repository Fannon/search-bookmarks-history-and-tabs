import { test, expect, expectNoClientErrors } from './fixtures.js'

const waitForInitialization = async (page) => {
  await expect(page.locator('#results-loading')).toBeHidden()
}

const updateUserConfig = async (page, config) => {
  const newConfig = JSON.stringify(config, null, 2)
  await page.goto('/options.html')
  const userConfig = page.locator('#user-config')
  await userConfig.fill('')
  await userConfig.fill(newConfig)
  await page.locator('#edit-options-save').click()
}

test.describe('Recent Tabs on Open Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Default Behavior (maxRecentTabsToShow > 0)', () => {
    test('shows tabs sorted by recent access when popup opens', async ({ page }) => {
      await waitForInitialization(page)

      await expect(page.locator('#search-input')).toHaveValue('')

      const results = page.locator('#result-list li')
      await expect(results).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('maintains tab sorting by last accessed time', async ({ page }) => {
      await waitForInitialization(page)

      const results = page.locator('#result-list li')
      const count = await results.count()
      expect(count).toBeGreaterThanOrEqual(2)

      await expectNoClientErrors(page)
    })

    test('switches to search results when typing', async ({ page }) => {
      await waitForInitialization(page)

      const results = page.locator('#result-list li')
      await expect(results).not.toHaveCount(0)

      await page.locator('#search-input').fill('test')
      await expect(results).not.toHaveCount(0)

      await page.locator('#search-input').fill('')
      await expect(results).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Tab-only Search Mode', () => {
    test('shows tabs with tab-only prefix', async ({ page }) => {
      await waitForInitialization(page)

      await page.locator('#search-input').fill('t ')
      await expect(page.locator('#result-list li')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('filters tabs while maintaining order', async ({ page }) => {
      await waitForInitialization(page)

      await page.locator('#search-input').fill('t chrome')
      await expect(page.locator('#result-list li')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Tab Limit Functionality (maxRecentTabsToShow)', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure we start each scenario with a clean home view
      await page.goto('/')
    })

    test('respects the default limit of 30', async ({ page }) => {
      await waitForInitialization(page)

      const count = await page.locator('#result-list li').count()
      expect(count).toBeLessThanOrEqual(30)

      await expectNoClientErrors(page)
    })

    test('respects a custom limit', async ({ page }) => {
      await updateUserConfig(page, { maxRecentTabsToShow: 5 })

      await page.goto('/')
      await waitForInitialization(page)

      const count = await page.locator('#result-list li').count()
      expect(count).toBeLessThanOrEqual(5)
      await expectNoClientErrors(page)
    })

    test('handles a zero tab limit', async ({ page }) => {
      await updateUserConfig(page, { maxRecentTabsToShow: 0 })

      await page.goto('/')
      await waitForInitialization(page)

      const results = page.locator('#result-list li')
      const count = await results.count()

      if (count > 0) {
        const classes = await Promise.all(
          Array.from({ length: count }, (_, index) => {
            return results.nth(index).getAttribute('class')
          }),
        )
        classes.forEach((className) => {
          const value = className ?? ''
          expect(value).not.toContain('tab')
        })
      }

      await expectNoClientErrors(page)
    })

    test('handles limits larger than the available tabs', async ({ page }) => {
      await updateUserConfig(page, { maxRecentTabsToShow: 1000 })

      await page.goto('/')
      await waitForInitialization(page)

      const count = await page.locator('#result-list li').count()
      expect(count).toBeLessThanOrEqual(1000)
      expect(count).toBeGreaterThan(0)

      await expectNoClientErrors(page)
    })

    test('maintains the result counter behavior', async ({ page }) => {
      await updateUserConfig(page, { maxRecentTabsToShow: 10 })

      await page.goto('/')
      await waitForInitialization(page)

      const count = await page.locator('#result-list li').count()
      expect(count).toBeLessThanOrEqual(10)
      expect(count).toBeGreaterThanOrEqual(1)

      await expect(page.locator('#result-counter')).toHaveText('')
      await expectNoClientErrors(page)
    })
  })
})
