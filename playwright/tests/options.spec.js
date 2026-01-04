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
})
