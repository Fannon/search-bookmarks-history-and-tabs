import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Tag View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tags.html')
  })

  test.describe('Initializing Phase', () => {
    test('successfully loads', async ({ page }) => {
      await expect(page.locator('#tags-overview #tags-list')).toBeVisible()
    })

    test('contains a list of tags', async ({ page }) => {
      await expect(page.locator('#tags-overview #tags-list [x-tag="json"]')).toBeVisible()
      await expectNoClientErrors(page)
    })

    test('allows navigation via tags', async ({ page }) => {
      await page.locator('#tags-overview #tags-list [x-tag="json"]').click()
      await expect(page).toHaveURL(/#search\/#json$/)

      await expect(page.locator('#search-input')).toHaveValue('#json')
      await expect(page.locator('#result-list')).not.toHaveCount(0)
      await expect(page.locator('#result-list [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('#result-list li.bookmark')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })
})
