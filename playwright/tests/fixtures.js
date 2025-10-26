import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page)
  },
})

export { expect }

export const expectNoClientErrors = async (page) => {
  await expect(page.locator('#error-list')).toHaveText('')
}
