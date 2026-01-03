import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Folder View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/folders.html')
  })

  test.describe('Initializing Phase', () => {
    test('successfully loads', async ({ page }) => {
      await expect(page.locator('#folders-view #folders-list')).toBeVisible()
    })

    test('contains a list of folders', async ({ page }) => {
      await expect(page.locator('#folders-view #folders-list [x-folder="Tools"]')).toBeVisible()
      await expectNoClientErrors(page)
    })

    test('allows navigation via folders', async ({ page }) => {
      await page.locator('#folders-view #folders-list [x-folder="Tools"]').click()
      await expect(page).toHaveURL(/#search\/~Tools%20%20$/)

      await expect(page.locator('#q')).toHaveValue('~Tools  ')
      await expect(page.locator('#results')).not.toHaveCount(0)
      await expect(page.locator('#results [x-original-id="6"]')).toBeVisible()
      await expect(page.locator('#results li.bookmark')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })
})
