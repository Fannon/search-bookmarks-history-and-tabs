import { expect, test } from './fixtures.js'

test.describe('Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('Initial load performance', async ({ page }) => {
    // Wait for the initialization log in console
    const consoleLogs = []
    page.on('console', (msg) => {
      if (msg.text().includes('Extension initialized')) {
        consoleLogs.push(msg.text())
      }
    })

    await page.reload()
    await expect(page.locator('#results')).toBeVisible()

    const initLog = consoleLogs.find((l) => l.includes('Extension initialized'))
    console.log('Browser reported:', initLog)

    // Also check performance API
    const measures = await page.evaluate(() => {
      return performance.getEntriesByType('measure').map((m) => ({ name: m.name, duration: m.duration }))
    })
    console.log('Performance measures:', measures)
  })

  test('Search and Rendering Performance with Large Dataset', async ({ page }) => {
    // 1. Inject large dataset (5000 items)
    await page.evaluate(() => {
      const count = 5000
      const bookmarks = []
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const domains = ['google.com', 'github.com', 'stackoverflow.com', 'developer.mozilla.org']
      const topics = ['React', 'JavaScript', 'Performance', 'Browsers', 'Testing']

      for (let i = 0; i < count; i++) {
        const dateAdded = now - Math.floor(Math.random() * 30 * oneDay)
        const domain = domains[i % domains.length]
        const topic = topics[i % topics.length]
        const title = `Performance Bookmark ${i}: How to optimize ${topic} in 2024`
        const url = `https://${domain}/article/perf-guide-${i}`

        bookmarks.push({
          type: 'bookmark',
          title,
          url,
          originalUrl: url,
          dateAdded,
          _dateAddedISO: new Date(dateAdded).toISOString(),
          searchStringLower: `${title}¦${url}`.toLowerCase(),
          score: 100,
        })
      }
      // Inject directly into the model
      window.ext.model.bookmarks = bookmarks
      window.ext.model.tabs = []
      window.ext.model.history = []
      window.ext.searchCache = new Map()
    })

    // 2. Perform Search
    const searchInput = page.locator('#q')

    await page.evaluate(() => performance.clearMeasures())
    await searchInput.fill('perf 1234')

    // 3. Wait for results to be rendered
    await expect(page.locator('#results li')).not.toHaveCount(0)

    // 4. Extract performance data
    const perfResults = await page.evaluate(() => {
      const measures = performance.getEntriesByName('search-total')
      return measures.length > 0 ? measures[measures.length - 1].duration : null
    })

    console.log(`Playwright: Search & Render for 5000 items took: ${perfResults ? perfResults.toFixed(2) : 'N/A'}ms`)

    if (perfResults) {
      expect(perfResults).toBeLessThan(150)
    }
  })

  test('Worst-case rendering (Tags, Folders, Metrics enabled)', async ({ page }) => {
    // 1. Enable all UI badges
    await page.evaluate(() => {
      window.ext.opts.displayTags = true
      window.ext.opts.displayFolderName = true
      window.ext.opts.displayLastVisit = true
      window.ext.opts.displayVisitCounter = true
      window.ext.opts.displaySearchMatchHighlight = true
    })

    // 2. Inject items with tags and folders
    await page.evaluate(() => {
      const count = 1000
      const bookmarks = []
      for (let i = 0; i < count; i++) {
        bookmarks.push({
          type: 'bookmark',
          title: `Book ${i} #tag1 #tag2`,
          url: `https://example.com/${i}`,
          originalUrl: `https://example.com/${i}`,
          tagsArray: ['tag1', 'tag2', 'tag3'],
          folderArray: ['Folder', 'Subfolder', 'Project'],
          lastVisitSecondsAgo: 3600,
          visitCount: 42,
          searchStringLower:
            `book ${i} #tag1 #tag2¦example.com/${i}¦tag1 tag2 tag3¦folder subfolder project`.toLowerCase(),
          score: 100,
        })
      }
      window.ext.model.bookmarks = bookmarks
      window.ext.searchCache = new Map()
    })

    const searchInput = page.locator('#q')
    await page.evaluate(() => performance.clearMeasures())

    await searchInput.fill('Book 500')
    await expect(page.locator('#results li')).not.toHaveCount(0)

    const perfResults = await page.evaluate(() => {
      const measures = performance.getEntriesByName('search-total')
      return measures.length > 0 ? measures[measures.length - 1].duration : null
    })

    console.log(
      `Playwright: Worst-case Rendering (1000 items with all badges) took: ${perfResults ? perfResults.toFixed(2) : 'N/A'}ms`,
    )
    expect(perfResults).toBeLessThan(150)
  })

  test('Search and Rendering Performance - Fuzzy Strategy', async ({ page }) => {
    // 1. Switch to Fuzzy
    await page.locator('#toggle').click()
    await expect(page.locator('#toggle')).toHaveClass(/fuzzy/)

    // 2. Inject 2000 items (fuzzy is heavier)
    await page.evaluate(() => {
      const count = 2000
      const bookmarks = []
      const now = Date.now()
      const domains = ['awesome.io', 'cool-blog.net', 'tech-news.com']
      const adjectives = ['Fuzzy', 'Approximate', 'Nearby', 'Similar']

      for (let i = 0; i < count; i++) {
        const dateAdded = now - Math.floor(Math.random() * 10000000)
        const adj = adjectives[i % adjectives.length]
        const domain = domains[i % domains.length]
        const title = `${adj} Result ${i} - exploring new horizons in search`
        const url = `https://${domain}/search/v${i}`

        bookmarks.push({
          type: 'bookmark',
          title,
          url,
          originalUrl: url,
          dateAdded,
          _dateAddedISO: new Date(dateAdded).toISOString(),
          searchStringLower: `${title}¦${url}`.toLowerCase(),
          score: 100,
        })
      }
      window.ext.model.bookmarks = bookmarks
      window.ext.searchCache = new Map()
    })

    const searchInput = page.locator('#q')
    await page.evaluate(() => performance.clearMeasures())

    await searchInput.fill('fz test 999')

    await expect(page.locator('#results li')).not.toHaveCount(0)

    const perfResults = await page.evaluate(() => {
      const measures = performance.getEntriesByName('search-total')
      return measures.length > 0 ? measures[measures.length - 1].duration : null
    })

    console.log(
      `Playwright: Fuzzy Search & Render for 2000 items took: ${perfResults ? perfResults.toFixed(2) : 'N/A'}ms`,
    )

    if (perfResults) {
      expect(perfResults).toBeLessThan(300)
    }
  })
})
