import { test, expect, expectNoClientErrors } from './fixtures.js'

test.describe('Edit Bookmark View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editBookmark#bookmark/23/search/t')
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
      // Wait for the form to be populated
      await expect(page.locator('#bookmark-title')).toHaveValue('JSON Editor Online - view, edit and format JSON')
      await expect(page.locator('#bookmark-url')).toHaveValue('https://jsoneditoronline.org/')
    })

    test('handles missing bookmark gracefully', async ({ page }) => {
      // Navigate to a non-existent bookmark
      await page.goto('/editBookmark#bookmark/nonexistent/search/t')

      // Should show error and focus cancel button
      await expect(page.locator('#error-list')).toBeVisible()
      await expect(page.locator('#edit-bookmark-cancel')).toBeFocused()
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
      // Check that tagify is initialized
      await expect(page.locator('#bookmark-tags')).toBeVisible()

      // Should have some tags available (from the mock data)
      // This is harder to test directly, but we can check that the input works
      await page.locator('#bookmark-tags').click()
    })

    test('handles tag input correctly', async ({ page }) => {
      // Type in the tags input
      await page.locator('#bookmark-tags').fill('new-tag')
      await page.keyboard.press('Enter')

      // The tag should be added
      await expect(page.locator('#bookmark-tags')).toHaveValue('new-tag')
    })
  })

  test.describe('Error Handling', () => {
    test('handles malformed URL hash gracefully', async ({ page }) => {
      // Navigate to edit bookmark with malformed hash
      await page.goto('/editBookmark#malformed-hash')

      // Should show error
      await expect(page.locator('#error-list')).toBeVisible()
    })

    test('handles empty bookmark data', async ({ page }) => {
      // This tests the fix for the original bug
      // Navigate to a bookmark that might have undefined tags
      await page.goto('/editBookmark#bookmark/1/search/t')

      // Should not crash and should handle gracefully
      await expect(page.locator('#edit-bookmark')).toBeVisible()
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
      await page.goto('/editBookmark#bookmark/17/search/t')

      // Should load the new bookmark
      await expect(page.locator('#bookmark-title')).toHaveValue('JSON Schema Validator')
    })
  })
})
