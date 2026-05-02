import { expect, expectNoClientErrors, test } from './fixtures.js'

test.describe('Bookmark Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 760 })
    await page.goto('/bookmarkManager.html')
  })

  test('shows bookmark overview statistics from mock data', async ({ page }) => {
    await expect(page.locator('#stats-grid')).toContainText('Bookmarks')
    await expect(page.locator('#bookmark-count')).toHaveText('35')
    await expect(page.locator('#top-tags')).toContainText('json')
    await expect(page.locator('#recent-bookmarks')).toContainText('quicktype')
    await expect(page.locator('#recent-bookmarks .recent-bookmark-edit')).toHaveCount(0)
    await expectNoClientErrors(page)
  })

  test('links top domains to all bookmarks filtered by domain', async ({ page }) => {
    const firstDomain = page.locator('#top-domains .rank-link').first()
    const domain = await firstDomain.locator('.rank-name').textContent()

    await firstDomain.click()

    await expect(page).toHaveURL(/bookmarkManager\.html\?folder=all&search=[^#]+#bookmarks$/)
    await expect(page.locator('[data-manager-panel="bookmarks"]')).toBeVisible()
    await expect(page.locator('.folder-tree-button.active')).toHaveAttribute('data-manager-folder-id', 'all')
    await expect(page.locator('#bookmark-manager-search')).toHaveValue(domain)
    await expect(page.locator('#bookmark-browser-summary')).toContainText(
      `selected in All Bookmarks matching "${domain}"`,
    )
    await expectNoClientErrors(page)
  })

  test('updates bookmark browser query params while navigating', async ({ page }) => {
    await page.locator('[data-manager-tab="bookmarks"]').click()
    await page.locator('#bookmark-manager-search').fill('github.com')

    await expect(page).toHaveURL(/bookmarkManager\.html\?folder=all&search=github\.com#bookmarks$/)

    const firstBookmark = page.locator('[data-managed-bookmark-row-id]').first()
    const bookmarkId = await firstBookmark.getAttribute('data-managed-bookmark-row-id')
    await firstBookmark.locator('.url').click()

    await expect(page).toHaveURL(
      new RegExp(`bookmarkManager\\.html\\?folder=all&search=github\\.com&bookmark=${bookmarkId}#bookmarks$`),
    )
    await expectNoClientErrors(page)
  })

  test('opens passive bookmark rows in the editable bookmark browser', async ({ page }) => {
    await page.locator('#recent-bookmarks [data-open-managed-bookmark-id]').first().click()

    await expect(page).toHaveURL(/\?folder=[^&]+&bookmark=[^#]+#bookmarks$/)
    const linkedFolderId = new URL(page.url()).searchParams.get('folder')
    await expect(page.locator('[data-managed-bookmark-row-id].current')).toHaveCount(1)
    await expect(page.locator('.folder-tree-button.active')).toHaveAttribute('data-manager-folder-id', linkedFolderId)

    const currentBookmarkId = await page
      .locator('[data-managed-bookmark-row-id].current')
      .getAttribute('data-managed-bookmark-row-id')
    await page.reload()
    await expect(page.locator(`[data-managed-bookmark-row-id="${currentBookmarkId}"]`)).toHaveClass(/current/)
    await expect(page.locator('.folder-tree-button.active')).toHaveAttribute('data-manager-folder-id', linkedFolderId)

    await page.locator('[data-manager-tab="tags"]').click()
    const taggedBookmark = page.locator('.tag-bookmark-list [data-open-managed-bookmark-id]').first()
    const taggedBookmarkId = await taggedBookmark.getAttribute('data-open-managed-bookmark-id')

    await taggedBookmark.click()

    await expect(page).toHaveURL(/\?folder=[^&]+&bookmark=[^#]+#bookmarks$/)
    const taggedFolderId = new URL(page.url()).searchParams.get('folder')
    await expect(page.locator(`[data-managed-bookmark-row-id="${taggedBookmarkId}"]`)).toHaveClass(/current/)
    await expect(page.locator('.folder-tree-button.active')).toHaveAttribute('data-manager-folder-id', taggedFolderId)
    await expect(page.locator('#bookmark-manager-search')).toHaveValue('')
    await expectNoClientErrors(page)
  })

  test('separates the current editable bookmark from checked bulk selection', async ({ page }) => {
    await page.locator('[data-manager-tab="bookmarks"]').click()

    const firstBookmark = page.locator('[data-managed-bookmark-row-id]').first()
    const tagInputs = page.locator('.bookmark-tools-panel .tagify')
    const existingTags = tagInputs.first()
    const suggestedTags = tagInputs.nth(1)
    await firstBookmark.locator('.url').click()

    await expect(firstBookmark).toHaveClass(/current/)
    await expect(page.locator('#bookmark-selection-summary')).not.toHaveText('Click a bookmark or check bookmarks.')
    await expect(page.locator('.suggested-tags-section')).toContainText('Add suggested tags')
    await expect(page.locator('.suggested-tags-section')).toContainText("browser's local LLM")
    await expect(page.locator('#add-tags-visible')).toHaveCount(0)
    await expect(page.locator('#suggest-tags-bookmark')).toHaveCount(0)
    await expect(page.locator('#select-all-bookmarks')).toHaveCount(0)
    await expect(existingTags).not.toHaveAttribute('disabled')
    await expect(suggestedTags).toHaveAttribute('disabled')

    await page.locator('#select-visible-bookmarks').click()

    await expect(page.locator('#bookmark-selection-summary')).toHaveText('35 selected bookmarks')
    await expect(firstBookmark).toHaveClass(/current/)
    await expect(firstBookmark).toHaveClass(/selected/)
    await expect(page.locator('#bookmark-edit-title')).toBeDisabled()
    await expect(page.locator('#bookmark-edit-url')).toBeDisabled()
    await expect(existingTags).toHaveAttribute('disabled')
    await expectNoClientErrors(page)
  })

  test('shows duplicate groups and disables removal without the bookmark API', async ({ page }) => {
    await page.locator('[data-manager-tab="duplicates"]').click()

    await expect(page).toHaveURL(/#duplicates$/)
    await expect(page.locator('.duplicate-page-header')).toContainText('Duplicate Bookmarks')
    await expect(page.locator('#duplicates-list')).toContainText('app.quicktype.io')
    await expect(page.locator('#duplicates-list')).toContainText('Best candidate')
    await expect(page.locator('#duplicates-list')).toContainText('Lower-ranked copy')
    await expect(page.locator('#duplicates-list .duplicate-edit-button')).toHaveCount(0)
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
    await expect(page.locator('.tag-manager-list .tag-rename-button')).toHaveCount(0)
    await expect(page.locator('.tag-manager-list .tag-remove-button')).toHaveCount(0)
    await expect(page.locator('.tag-bookmark-panel-header .tag-rename-button')).toBeDisabled()
    await expect(page.locator('.tag-bookmark-panel-header .tag-remove-button')).toBeDisabled()
    await expectNoClientErrors(page)
  })
})
