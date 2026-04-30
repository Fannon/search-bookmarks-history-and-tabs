import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Bookmark Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 760 })
    await page.goto('/bookmarkManager.html')
  })

  test('shows bookmark overview statistics from mock data', async ({ page }) => {
    await expect(page.locator('#stats-grid')).toContainText('Bookmarks')
    await expect(page.locator('#top-tags')).toContainText('json')
    await expect(page.locator('#recent-bookmarks')).toContainText('quicktype')
    await expect(page.locator('#recent-bookmarks .recent-bookmark-edit').first()).toHaveAttribute(
      'href',
      /editBookmark\.html#bookmark\//,
    )
    await expectNoClientErrors(page)
  })

  test('shows duplicate groups and disables removal without the bookmark API', async ({ page }) => {
    await page.locator('[data-manager-tab="duplicates"]').click()

    await expect(page).toHaveURL(/#duplicates$/)
    await expect(page.locator('.duplicate-page-header')).toContainText('Duplicate Bookmarks')
    await expect(page.locator('#duplicates-list')).toContainText('app.quicktype.io')
    await expect(page.locator('#duplicates-list')).toContainText('Best candidate')
    await expect(page.locator('#duplicates-list')).toContainText('Lower-ranked copy')
    await expect(page.locator('#duplicates-list .duplicate-edit-button').first()).toHaveAttribute(
      'href',
      /editBookmark\.html#bookmark\//,
    )
    await expect(page.locator('#duplicates-list .duplicate-delete-button').first()).toBeDisabled()
    await expect(page.locator('#duplicates-list')).toContainText('Bookmark deletion is unavailable')
    await expect(page.locator('#delete-selected')).toBeDisabled()
    await expectNoClientErrors(page)
  })

  test('shows tag manager overview and disables tag updates without bookmark API', async ({ page }) => {
    await page.locator('[data-manager-tab="tags"]').click()

    await expect(page).toHaveURL(/#tags$/)
    await expect(page.locator('.tag-page-header')).toContainText('Tag Manager')
    await expect(page.locator('#tag-list')).toContainText('#json')
    await expect(page.locator('#tag-list')).toContainText('Tag updates are unavailable')
    await expect(page.locator('#tag-list .tag-rename-button').first()).toBeDisabled()
    await expect(page.locator('#tag-list .tag-remove-button').first()).toBeDisabled()
    await expectNoClientErrors(page)
  })
})
