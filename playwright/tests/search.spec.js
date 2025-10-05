import { test, expect, expectNoClientErrors } from './fixtures.js'

test.describe('Search View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Initializing Phase', () => {
    test('successfully loads', async ({ page }) => {
      await expect(page.locator('#result-list')).toBeVisible()
      await expect(page.locator('#search-input')).toBeVisible()
    })

    test('completes the initializing phase without errors', async ({ page }) => {
      await expect(page.locator('#results-loading')).not.toBeVisible()
      await expectNoClientErrors(page)
    })
  })

  test.describe('Result Navigation', () => {
    test('first result is highlighted and navigation works', async ({ page }) => {
      await page.locator('#search-input').type('JSON Edit')

      const assertSelection = async (index) => {
        const items = page.locator('#result-list li')
        const count = await items.count()
        for (let i = 0; i < count; i += 1) {
          const item = items.nth(i)
          if (i === index) {
            await expect(item).toHaveAttribute('id', 'selected-result')
          } else {
            await expect(item).not.toHaveAttribute('id', 'selected-result')
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
      await page.locator('#search-input').type('JSON')

      await expect(page.locator('#result-list [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('#result-list [x-original-id="5"]')).toBeVisible()
      await expect(page.locator('#result-list [x-original-id="6"]')).toBeVisible()
      await expect(page.locator('#result-list [x-original-id="9"]')).toBeVisible()

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
      await expect(page.locator('#search-approach-toggle')).toHaveText('PRECISE')

      await page.locator('#search-input').type('JSON')

      const results = page.locator('#result-list li')
      await expect(results).not.toHaveCount(0)

      await expect(page.locator('#result-list [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('#result-list li.bookmark')).not.toHaveCount(0)
      await expect(page.locator('#result-list li.history')).not.toHaveCount(0)
      await expect(page.locator('#result-list li.tab')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('handles non-ASCII search queries', async ({ page }) => {
      await expect(page.locator('#search-approach-toggle')).toHaveText('PRECISE')

      await page.locator('#search-input').type('äe指事字₽')
      await expect(page.locator('#result-list li')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Fuzzy search', () => {
    test.skip(({ browserName }) => browserName === 'firefox', 'Fuzzy search not reliable on Firefox headless')

    const enableFuzzy = async (page) => {
      await expect(page.locator('#search-approach-toggle')).toHaveText('PRECISE')
      await page.locator('#search-approach-toggle').click()
      await page.waitForTimeout(100)
      await expect(page.locator('#search-approach-toggle')).toHaveText('FUZZY')
    }

    test('can switch to fuzzy search', async ({ page }) => {
      await enableFuzzy(page)
      await page.locator('#search-input').type('JSON')
      await expect(page.locator('li.bookmark')).toBeVisible()
      await expectNoClientErrors(page)
    })

    test('returns all result types in fuzzy mode', async ({ page }) => {
      await enableFuzzy(page)
      await page.locator('#search-input').type('JSON')

      await expect(page.locator('#result-list li')).not.toHaveCount(0)
      await expect(page.locator('#result-list [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('#result-list li.bookmark')).not.toHaveCount(0)
      await expect(page.locator('#result-list li.history')).not.toHaveCount(0)
      await expect(page.locator('#result-list li.tab')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('handles non-ASCII search queries in fuzzy mode', async ({ page }) => {
      await enableFuzzy(page)
      await page.locator('#search-input').type('äe指事字₽')
      await expect(page.locator('#result-list li')).not.toHaveCount(0)

      await expectNoClientErrors(page)
    })
  })

  test.describe('Direct URL Search', () => {
    test('returns a direct navigation item', async ({ page }) => {
      await page.locator('#search-input').type('example.com')

      const directResult = page.locator('li.direct')
      await expect(directResult).toHaveCount(1)
      await expect(directResult).toHaveAttribute('x-open-url', 'https://example.com')

      await expectNoClientErrors(page)
    })
  })

  test.describe('Bookmark search', () => {
    test('empty bookmark search returns recent bookmarks', async ({ page }) => {
      await page.locator('#search-input').type('b ')

      await expect(page.locator('#result-list li.bookmark')).not.toHaveCount(0)
      await expect(page.locator('#result-list [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('.tab')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('search returns only bookmark results', async ({ page }) => {
      await page.locator('#search-input').type('b JSON')

      await expect(page.locator('#result-list [x-original-id="7"]')).toBeVisible()
      await expect(page.locator('.tab')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)
      await expect(page.locator('#result-counter')).toHaveText('(5)')

      await expectNoClientErrors(page)
    })
  })

  test.describe('History search', () => {
    test('empty history search returns recent history', async ({ page }) => {
      await page.locator('#search-input').type('h ')

      await expect(page.locator('#result-list li.history')).not.toHaveCount(0)
      await expect(page.locator('#result-list [x-original-id="6"]')).toBeVisible()
      await expect(page.locator('.tab')).toHaveCount(0)
      await expect(page.locator('.bookmark')).toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('history search includes history and tab results', async ({ page }) => {
      await page.locator('#search-input').type('h JSON')

      await expect(page.locator('#result-list [x-original-id="8"]')).toBeVisible()
      await expect(page.locator('#result-list [x-original-id="185"]')).toBeVisible()
      await expect(page.locator('.bookmark')).toHaveCount(0)
      await expect(page.locator('#result-counter')).toContainText('(6)')

      await expectNoClientErrors(page)
    })
  })

  test.describe('Tab search', () => {
    test('empty tab search returns all open tabs', async ({ page }) => {
      await page.locator('#search-input').type('t ')

      await expect(page.locator('#result-list li.tab')).not.toHaveCount(0)
      await expect(page.locator('#result-list [x-original-id="179"]')).toBeVisible()
      await expect(page.locator('.bookmark')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)

      await expectNoClientErrors(page)
    })

    test('tab search returns only tab results', async ({ page }) => {
      await page.locator('#search-input').type('t JSON')

      await expect(page.locator('#result-list [x-original-id="185"]')).toBeVisible()
      await expect(page.locator('#result-list li')).toHaveCount(1)
      await expect(page.locator('.bookmark')).toHaveCount(0)
      await expect(page.locator('.history')).toHaveCount(0)
      await expect(page.locator('#result-counter')).toContainText('(1)')

      await expectNoClientErrors(page)
    })
  })
})
