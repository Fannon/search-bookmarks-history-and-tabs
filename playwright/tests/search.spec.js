import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Search View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Initializing Phase', () => {
    test('successfully loads', async ({ page }) => {
      await expect(page.locator('#results')).toBeVisible()
      await expect(page.locator('#q')).toBeVisible()
    })

    test('completes the initializing phase without errors', async ({ page }) => {
      await expect(page.locator('#results-load')).not.toBeVisible()
      await expectNoClientErrors(page)
    })
  })

  test.describe('Result Navigation', () => {
    test('first result is highlighted and navigation works', async ({ page }) => {
      await page.locator('#q').fill('JSON Edit')

      const assertSelection = async (index) => {
        const items = page.locator('#results li')
        const count = await items.count()
        for (let i = 0; i < count; i += 1) {
          const item = items.nth(i)
          if (i === index) {
            await expect(item).toHaveAttribute('id', 'sel')
          } else {
            await expect(item).not.toHaveAttribute('id', 'sel')
          }
        }
      }

      await assertSelection(0)

      await page.keyboard.press('ArrowDown')
      await assertSelection(1)

      await page.keyboard.press('ArrowUp')
      await assertSelection(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Search result item', () => {
    test('includes title, url, tags, folder and score', async ({ page }) => {
      await page.locator('#q').fill('JSON')

      await expect(page.locator('#results [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('#results [x-original-id="17"]')).toBeVisible()
      await expect(page.locator('#results [x-original-id="6"]')).toBeVisible()
      await expect(page.locator('#results [x-original-id="9"]')).toBeVisible()

      await expect(page.locator('[x-original-id="7"] .title')).toContainText('JSON')
      await expect(page.locator('[x-original-id="7"] .url')).toContainText('json')
      await expect(page.locator('[x-original-id="7"] span.tags')).toContainText('#json')
      await expect(page.locator('[x-original-id="7"] span.folder')).toContainText('~Tools')
      await expect(page.locator('[x-original-id="7"] span.score')).toBeVisible()

      await expectNoClientErrors(page)
    })
  })

  test.describe('Precise search', () => {
    test('can execute search successfully', async ({ page }) => {
      await expect(page.locator('#toggle')).toHaveText('PRECISE')

      await page.locator('#q').fill('JSON')

      const results = page.locator('#results li')
      await expect(results).not.toHaveCount(0)

      await expect(page.locator('#results [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('#results li.bookmark')).not.toHaveCount(0)
      await expect(page.locator('#results li.history')).not.toHaveCount(0)
      await expect(page.locator('#results li.tab')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('handles non-ASCII search queries', async ({ page }) => {
      await expect(page.locator('#toggle')).toHaveText('PRECISE')

      await page.locator('#q').fill('äe指事字₽')
      await expect(page.locator('#results li')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Fuzzy search', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('#toggle').click()
      await expect(page.locator('#toggle')).toHaveText('FUZZY')
    })

    test('can switch to fuzzy search', async ({ page }) => {
      await page.locator('#q').fill('JSON')
      await expect(page.locator('#results li.bookmark')).not.toHaveCount(0)
      await expectNoClientErrors(page)
    })

    test('returns all result types in fuzzy mode', async ({ page }) => {
      await page.locator('#q').fill('JSON')

      await expect(page.locator('#results li')).not.toHaveCount(0)
      await expect(page.locator('#results li.bookmark')).not.toHaveCount(0)
      await expect(page.locator('#results li.history')).not.toHaveCount(0)
      await expect(page.locator('#results li.tab')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('handles non-ASCII search queries in fuzzy mode', async ({ page }) => {
      await page.locator('#q').fill('äe指事字₽')
      await expect(page.locator('#results li')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Direct URL Search', () => {
    test('returns a direct navigation item', async ({ page }) => {
      await page.locator('#q').fill('example.com')

      const directResult = page.locator('li.direct')
      await expect(directResult).toHaveCount(1)
      await expect(directResult).toHaveAttribute('x-open-url', 'https://example.com')

      await expectNoClientErrors(page)
    })
  })

  test.describe('Bookmark search', () => {
    test('empty bookmark search returns recent bookmarks', async ({ page }) => {
      await page.locator('#q').fill('b ')

      await expect(page.locator('#results li.bookmark')).not.toHaveCount(0)
      await expect(page.locator('#results [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('.tab')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('search returns only bookmark results', async ({ page }) => {
      await page.locator('#q').fill('b JSON')

      await expect(page.locator('#results [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('.tab')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)
      await expect(page.locator('#counter')).toHaveText('(6)')

      await expectNoClientErrors(page)
    })
  })

  test.describe('History search', () => {
    test('empty history search returns recent history', async ({ page }) => {
      await page.locator('#q').fill('h ')

      await expect(page.locator('#results li.history')).not.toHaveCount(0)
      await expect(page.locator('#results [x-original-id="h6"]')).toBeVisible()
      await expect(page.locator('.tab')).toHaveCount(0)
      await expect(page.locator('.bookmark')).toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('history search includes history and tab results', async ({ page }) => {
      await page.locator('#q').fill('h JSON')

      await expect(page.locator('#results [x-original-id="h8"]')).toBeVisible()
      await expect(page.locator('#results [x-original-id="185"]')).toBeVisible()
      await expect(page.locator('.bookmark')).toHaveCount(0)
      await expect(page.locator('#counter')).toContainText('(9)')

      await expectNoClientErrors(page)
    })
  })

  test.describe('Tab search', () => {
    test('empty tab search returns all open tabs', async ({ page }) => {
      await page.locator('#q').fill('t ')

      await expect(page.locator('#results li.tab')).not.toHaveCount(0)
      await expect(page.locator('#results [x-original-id="179"]')).toBeVisible()
      await expect(page.locator('.bookmark')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('tab search returns only tab results', async ({ page }) => {
      await page.locator('#q').fill('t JSON')

      await expect(page.locator('#results [x-original-id="185"]')).toBeVisible()
      await expect(page.locator('#results li')).toHaveCount(2)
      await expect(page.locator('.bookmark')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)
      await expect(page.locator('#counter')).toContainText('(2)')

      await expectNoClientErrors(page)
    })
  })
})
