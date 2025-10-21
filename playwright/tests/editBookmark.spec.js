import { test, expect, expectNoClientErrors } from './fixtures.js'

const BOOKMARK_ID = '23'
const BOOKMARK_TITLE = 'Try pandoc!'
const BOOKMARK_URL = 'https://pandoc.org/try'
const BOOKMARK_WITHOUT_TAGS_ID = '29'

const gotoEditBookmark = async (page, hash) => {
  await page.goto(`/editBookmark.html${hash}`)
}

const waitForTagify = async (page) => {
  await page.waitForFunction(() => window.ext?.tagify)
}

test.describe('Edit Bookmark View', () => {
  test.beforeEach(async ({ page }) => {
    await gotoEditBookmark(page, `#bookmark/${BOOKMARK_ID}/search/t`)
  })

  test.describe('Initialization', () => {
    test('successfully loads the edit bookmark page', async ({ page }) => {
      await expect(page.locator('#edit-bookmark')).toBeVisible()
      await expect(page.locator('#bookmark-title')).toBeVisible()
      await expect(page.locator('#bookmark-url')).toBeVisible()
      await expect(page.locator('#bookmark-tags')).toBeVisible()
      await expect(page.locator('#edit-bookmark-save')).toBeVisible()
      await expect(page.locator('#edit-bookmark-delete')).toBeVisible()
      await expect(page.locator('#edit-bookmark-cancel')).toBeVisible()
    })

    test('completes initialization without errors', async ({ page }) => {
      await expect(page.locator('#edit-bookmark-loading')).not.toBeVisible()
      await expectNoClientErrors(page)
    })

    test('populates form with bookmark data', async ({ page }) => {
      await waitForTagify(page)
      await expect(page.locator('#bookmark-title')).toHaveValue(BOOKMARK_TITLE)
      await expect(page.locator('#bookmark-url')).toHaveValue(BOOKMARK_URL)
      const tagValues = await page.evaluate(() => window.ext.tagify.value.map((tag) => tag.value))
      expect(tagValues).toEqual(['md'])
    })

    test('handles missing bookmark gracefully', async ({ page }) => {
      const warnings = []
      page.on('console', (message) => {
        if (message.type() === 'warning') {
          warnings.push(message.text())
        }
      })

      await gotoEditBookmark(page, '#bookmark/nonexistent/search/t')

      await expect(page.locator('#edit-bookmark')).not.toBeVisible()
      await expectNoClientErrors(page)
      expect(warnings.some((text) => text.includes('Tried to edit bookmark id="nonexistent"'))).toBe(true)
    })
  })

  test.describe('Form Interactions', () => {
    test('can edit bookmark title and URL', async ({ page }) => {
      // Edit the title
      await page.locator('#bookmark-title').fill('Updated JSON Editor Title')
      await page.locator('#bookmark-url').fill('https://updated-json-editor.com')

      // Save the changes
      await page.locator('#edit-bookmark-save').click()

      // Should redirect back to search page
      await expect(page).toHaveURL(/.*index\.html.*search/)
    })

    test('can add and remove tags', async ({ page }) => {
      await waitForTagify(page)

      // Add a new tag
      await page.locator('#bookmark-tags').fill('test-tag')
      await page.keyboard.press('Enter')

      // Save the changes
      await page.locator('#edit-bookmark-save').click()

      // Should redirect back to search page
      await expect(page).toHaveURL(/.*index\.html.*search/)
    })

    test('can delete bookmark', async ({ page }) => {
      // Delete the bookmark
      await page.locator('#edit-bookmark-delete').click()

      // Should redirect back to search page
      await expect(page).toHaveURL(/.*index\.html.*search/)
    })

    test('can cancel editing', async ({ page }) => {
      // Click cancel
      await page.locator('#edit-bookmark-cancel').click()

      // Should redirect back to search page
      await expect(page).toHaveURL(/.*index\.html.*search/)
    })
  })

  test.describe('Tagify Integration', () => {
    test('initializes tagify with available tags', async ({ page }) => {
      await waitForTagify(page)
      const tagifyMetadata = await page.evaluate(() => ({
        tagCount: window.ext.tagify.value.length,
        whitelistCount: window.ext.tagify.settings.whitelist.length,
      }))
      expect(tagifyMetadata.tagCount).toBe(1)
      expect(tagifyMetadata.whitelistCount).toBeGreaterThan(0)
    })

    test('handles tag input correctly', async ({ page }) => {
      await waitForTagify(page)

      await page.locator('#bookmark-tags').fill('new-tag')
      await page.keyboard.press('Enter')

      const tagValues = await page.evaluate(() => window.ext.tagify.value.map((tag) => tag.value))
      expect(tagValues).toContain('new-tag')
    })
  })

  test.describe('Error Handling', () => {
    test('handles malformed URL hash gracefully', async ({ page }) => {
      // Navigate to edit bookmark with malformed hash
      await gotoEditBookmark(page, '#malformed-hash')

      // Should show error
      await expect(page.locator('#error-list')).toBeVisible()
    })

    test('handles bookmarks without tags gracefully', async ({ page }) => {
      await gotoEditBookmark(page, `#bookmark/${BOOKMARK_WITHOUT_TAGS_ID}/search/t`)

      await expect(page.locator('#edit-bookmark')).toBeVisible()
      await waitForTagify(page)
      const tagValues = await page.evaluate(() => window.ext.tagify.value.map((tag) => tag.value))
      expect(tagValues).toEqual([])
      await expectNoClientErrors(page)
    })
  })

  test.describe('Navigation', () => {
    test('preserves search context when returning', async ({ page }) => {
      // Edit a bookmark
      await page.locator('#bookmark-title').fill('Test Title')
      await page.locator('#edit-bookmark-save').click()

      // Should return to search page with the original search term
      await expect(page).toHaveURL(/.*search\/t/)
    })

    test('handles hash change during editing', async ({ page }) => {
      // Navigate to different bookmark while editing
      await gotoEditBookmark(page, '#bookmark/17/search/t')

      // Should load the new bookmark
      await expect(page.locator('#bookmark-title')).toHaveValue('Convert JSON to YAML')
    })
  })
})
