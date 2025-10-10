import { test, expect, expectNoClientErrors } from './fixtures.js'

const locate = (page, selector) => page.locator(selector)

const saveOptions = async (page) => {
  await page.locator('#edit-options-save').click()
  await expect(page.locator('#error-message')).toHaveText(/Options saved successfully/)
}

test.describe('Options View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/options.html')
  })

  test('successfully loads the options form', async ({ page }) => {
    await expect(locate(page, '#options-form')).toBeVisible()
    await expect(locate(page, '#opt-searchStrategy')).toHaveValue('precise')
    await expect(locate(page, '#opt-displayVisitCounter')).not.toBeChecked()
    await expectNoClientErrors(page)
  })

  test('saves a modified boolean option', async ({ page }) => {
    const visitCounter = locate(page, '#opt-displayVisitCounter')
    await visitCounter.check()
    await saveOptions(page)

    await page.reload()
    await expect(locate(page, '#opt-displayVisitCounter')).toBeChecked()
    await expectNoClientErrors(page)

    // Reset to defaults for subsequent tests
    await locate(page, '#edit-options-reset').click()
    await expect(page.locator('#error-message')).toHaveText(/reset to defaults/i)
    await saveOptions(page)
  })

  test('allows managing custom search engines via the form', async ({ page }) => {
    const customSection = page.locator('#section-search-engines')
    const addCustom = customSection.getByRole('button', { name: 'Add custom search engine' })

    await addCustom.click()
    const lastCustom = customSection.locator('.object-array-item').last()
    await lastCustom.getByLabel('Aliases').fill('s, stack')
    await lastCustom.getByLabel('Name').fill('Stack Overflow')
    await lastCustom.getByLabel('Search URL prefix').fill('https://stackoverflow.com/search?q=$s')
    await lastCustom.getByLabel('Optional default URL').fill('https://stackoverflow.com')

    await saveOptions(page)
    await page.reload()

    const persisted = customSection.locator('.object-array-item').last()
    await expect(persisted.getByLabel('Aliases')).toHaveValue('s, stack')
    await expect(persisted.getByLabel('Name')).toHaveValue('Stack Overflow')

    // Clean up to avoid impacting other tests
    await persisted.getByRole('button', { name: 'Remove' }).click()
    await saveOptions(page)
    await expect(customSection.locator('.object-array-item').last().getByLabel('Name')).not.toHaveValue('Stack Overflow')
    await expectNoClientErrors(page)
  })
})
