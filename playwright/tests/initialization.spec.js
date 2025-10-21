/**
 * @file E2E tests for page initialization and error handling
 *
 * Tests that all pages initialize without JavaScript errors
 * and that critical DOM elements are present.
 */

import { test, expect } from './fixtures.js'

test.describe('Page Initialization', () => {
  test('index.html initializes without errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/')

    // Wait for initialization to complete
    await expect(page.locator('#result-list')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#search-input')).toBeVisible()
    await expect(page.locator('#results-loading')).not.toBeVisible()

    // Check for JavaScript errors
    expect(errors, `Page had console errors: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('editBookmark.html initializes without errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    // Navigate to edit bookmark page with a valid bookmark ID
    // Using bookmark ID from mock data (assuming ID "7" exists)
    await page.goto('/editBookmark.html#bookmark/7')

    // Wait for page to load
    await expect(page.locator('#edit-bookmark')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#bookmark-title')).toBeVisible()
    await expect(page.locator('#bookmark-url')).toBeVisible()

    // Check for JavaScript errors
    expect(errors, `Page had console errors: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('tags.html initializes without errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/tags.html')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check for JavaScript errors
    expect(errors, `Page had console errors: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('folders.html initializes without errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/folders.html')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check for JavaScript errors
    expect(errors, `Page had console errors: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('options.html initializes without errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/options.html')

    // Wait for page to load
    await expect(page.locator('#options-form')).toBeVisible({ timeout: 5000 })

    // Check for JavaScript errors
    expect(errors, `Page had console errors: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('tag input works correctly in edit bookmark page', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/editBookmark.html#bookmark/7')

    // Wait for page to load
    await expect(page.locator('#edit-bookmark')).toBeVisible({ timeout: 5000 })

    // Verify tag input is initialized
    const tagInput = page.locator('.tag-input')
    await expect(tagInput).toBeVisible()

    // Verify existing tags are displayed
    const existingTags = page.locator('.tag-input__tag')
    await expect(existingTags).toHaveCount(1) // Should have at least one tag from mock data

    // Try adding a new tag
    const tagField = page.locator('.tag-input__field')
    await tagField.fill('testtag')
    await tagField.press('Enter')

    // Verify tag was added
    await expect(page.locator('.tag-input__tag')).toHaveCount(2)

    // Check for JavaScript errors
    expect(errors, `Page had console errors: ${errors.join(', ')}`).toHaveLength(0)
  })
})
