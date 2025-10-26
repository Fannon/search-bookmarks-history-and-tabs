import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Folder View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/folders.html')
  })

  test.describe('Initializing Phase', () => {
    test('successfully loads', async ({ page }) => {
      await expect(
        page.locator('#folders-overview #folders-list'),
      ).toBeVisible()
    })

    test('contains a list of folders', async ({ page }) => {
      await expect(
        page.locator('#folders-overview #folders-list [x-folder="Tools"]'),
      ).toBeVisible()
      await expectNoClientErrors(page)
    })

    test('allows navigation via folders', async ({ page }) => {
      await page
        .locator('#folders-overview #folders-list [x-folder="Tools"]')
        .click()
      await expect(page).toHaveURL(/#search\/~Tools$/)

      await expect(page.locator('#search-input')).toHaveValue('~Tools')
      await expect(page.locator('#result-list')).not.toHaveCount(0)
      await expect(
        page.locator('#result-list [x-original-id="6"]'),
      ).toBeVisible()
      await expect(page.locator('#result-list li.bookmark')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })
})
