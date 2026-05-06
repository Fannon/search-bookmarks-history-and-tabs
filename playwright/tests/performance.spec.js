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

  test('Bookmark Manager renders and filters a 10k bookmark dataset', async ({ page }) => {
    test.setTimeout(20000)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/bookmarkManager.html#bookmarks')
    await expect(page.locator('#manager-status')).toContainText('Loaded')

    const initialRenderMs = await page.evaluate(async () => {
      const { createBookmarkManagerModel } = await import('./js/model/bookmarkManagerData.js')
      const { renderBookmarkManager, renderBookmarkWorkspace } = await import('./js/view/bookmarkManagerView.js')
      const count = 10000
      const now = Date.now()
      const bookmarks = []
      const topics = ['Docs', 'API', 'Release', 'Design', 'Testing', 'Performance']
      const folders = ['Engineering', 'Research', 'Archive', 'Product', 'Support']
      const domains = ['example.com', 'developer.mozilla.org', 'github.com', 'docs.example.test']

      for (let i = 0; i < count; i++) {
        const topic = topics[i % topics.length]
        const folder = folders[i % folders.length]
        const subfolder = `${topic} ${i % 20}`
        const url = `https://${domains[i % domains.length]}/manager/perf/${i % 250 === 0 ? 'duplicate' : i}`
        const tagsArray = [topic, `batch-${i % 50}`, i % 7 === 0 ? 'review' : 'keep']
        const title = `Manager Performance Bookmark ${i} ${topic}`
        const folderArray = [folder, subfolder]
        const tags = `#${tagsArray.join(' #')}`
        const normalizedUrl = url.replace(/^https?:\/\//, '')
        const folderText = `~${folderArray.join(' ~')}`

        bookmarks.push({
          type: 'bookmark',
          originalId: `manager-perf-${i}`,
          title,
          titleLower: title.toLowerCase(),
          url: normalizedUrl,
          originalUrl: url,
          dateAdded: now - i * 60000,
          _dateAddedISO: new Date(now - i * 60000).toISOString(),
          folder,
          folderArray,
          folderArrayLower: folderArray.map((entry) => entry.toLowerCase()),
          folderId: `folder-${i % 100}`,
          tags,
          tagsLower: tags.toLowerCase(),
          tagsArray,
          tagsArrayLower: tagsArray.map((entry) => entry.toLowerCase()),
          customBonusScore: i % 25 === 0 ? 50 : 0,
          score: 100,
          searchStringLower: `${title}¦${normalizedUrl}¦${tags}¦${folderText}`.toLowerCase(),
        })
      }

      const model = createBookmarkManagerModel(bookmarks, [])
      window.ext.model.bookmarks = bookmarks
      window.ext.model.bookmarkManager = model
      window.ext.model.bookmarkManagerFolderId = 'all'
      window.ext.model.bookmarkManagerSelectedIds = new Set()
      window.ext.model.bookmarkManagerCurrentId = ''
      window.ext.model.bookmarkManagerHasManualSelection = false
      window.ext.model.bookmarkManagerSuggestedTagsReady = false
      window.ext.model.bookmarkManagerLocalAiAvailable = false
      window.ext.model.searchMode = 'bookmarks'
      window.ext.searchCache = new Map()
      document.getElementById('bookmark-manager-search').value = ''

      const start = performance.now()
      renderBookmarkManager(model, true, true)
      renderBookmarkWorkspace(model.bookmarks, true, true)
      return performance.now() - start
    })

    const renderedBookmarkCount = await page.evaluate(
      () => document.querySelectorAll('[data-managed-bookmark-row-id]').length,
    )
    expect(renderedBookmarkCount).toBe(500)
    await expect(page.locator('#managed-bookmark-list')).toContainText('Showing first 500 of 10,000')

    const selectVisibleMs = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const summary = document.getElementById('bookmark-selection-summary')
          const observer = new MutationObserver(() => {
            observer.disconnect()
            requestAnimationFrame(() => resolve(performance.now() - start))
          })
          observer.observe(summary, { childList: true, subtree: true, characterData: true })
          const start = performance.now()
          document.getElementById('select-visible-bookmarks').click()
        }),
    )
    await expect(page.locator('#bookmark-selection-summary')).toHaveText('10,000 selected bookmarks')

    await page.evaluate(() => document.getElementById('clear-managed-selection').click())

    const folderSwitchMs = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const list = document.getElementById('managed-bookmark-list')
          const folderButton = document.querySelector('[data-manager-folder-id]:not([data-manager-folder-id="all"])')
          const observer = new MutationObserver(() => {
            observer.disconnect()
            requestAnimationFrame(() => resolve(performance.now() - start))
          })
          observer.observe(list, { childList: true, subtree: true })
          const start = performance.now()
          folderButton.click()
        }),
    )

    await page.locator('[data-manager-folder-id="all"]').click()

    const searchRenderMs = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const list = document.getElementById('managed-bookmark-list')
          const input = document.getElementById('bookmark-manager-search')
          const observer = new MutationObserver(() => {
            observer.disconnect()
            requestAnimationFrame(() => resolve(performance.now() - start))
          })
          observer.observe(list, { childList: true, subtree: true })
          const start = performance.now()
          input.value = 'manager 9876'
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }),
    )
    await expect(page.locator('[data-managed-bookmark-row-id]')).not.toHaveCount(0)

    const tagPanelMs = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const tagList = document.getElementById('tag-list')
          const observer = new MutationObserver(() => {
            observer.disconnect()
            requestAnimationFrame(() => resolve(performance.now() - start))
          })
          observer.observe(tagList, { childList: true, subtree: true })
          const start = performance.now()
          window.location.hash = '#tags'
        }),
    )
    await expect(page.locator('[data-manager-panel="tags"]')).toBeVisible()
    await expect(page.locator('.tag-bookmark-panel')).toContainText('Showing first 500')
    await expect(page.locator('.tag-bookmark-list .bookmark')).toHaveCount(500)

    console.log(
      `Playwright: Bookmark Manager 10k render=${initialRenderMs.toFixed(2)}ms search=${searchRenderMs.toFixed(
        2,
      )}ms select=${selectVisibleMs.toFixed(2)}ms folder=${folderSwitchMs.toFixed(2)}ms tagPanel=${tagPanelMs.toFixed(
        2,
      )}ms`,
    )

    expect(initialRenderMs).toBeLessThan(5000)
    expect(searchRenderMs).toBeLessThan(1000)
    expect(selectVisibleMs).toBeLessThan(1500)
    expect(folderSwitchMs).toBeLessThan(5000)
    expect(tagPanelMs).toBeLessThan(500)
  })
})
