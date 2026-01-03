/**
 * Tests for defaultResults.js - default result generation when no search term provided.
 *
 * ✅ Covered behaviors: mode-specific defaults, current tab matching, recent tabs, error handling
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

const mockGetBrowserTabs = jest.fn()

let addDefaultEntries

beforeAll(async () => {
  await jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    getBrowserTabs: mockGetBrowserTabs,
  }))

  const defaultResultsModule = await import('../defaultResults.js')
  addDefaultEntries = defaultResultsModule.addDefaultEntries
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetBrowserTabs.mockResolvedValue([])
  createTestExt({
    opts: {
      maxRecentTabsToShow: 3,
    },
    model: {
      searchMode: 'all',
      bookmarks: [],
      tabs: [],
      history: [],
    },
  })
})

afterEach(() => {
  clearTestExt()
})

describe('addDefaultEntries', () => {
  describe('history mode', () => {
    test('returns all history entries with default score', async () => {
      ext.model.searchMode = 'history'
      ext.model.history = [
        { id: 1, title: 'History 1', url: 'https://one.test' },
        { id: 2, title: 'History 2', url: 'https://two.test' },
      ]

      const results = await addDefaultEntries()

      expect(results).toEqual([
        { id: 1, title: 'History 1', url: 'https://one.test' },
        { id: 2, title: 'History 2', url: 'https://two.test' },
      ])
      expect(ext.model.result).toBe(results)
    })
  })

  describe('tabs mode', () => {
    test('returns tabs sorted by recency', async () => {
      ext.model.searchMode = 'tabs'
      ext.model.tabs = [
        { id: 1, title: 'Old Tab', lastVisitSecondsAgo: 100 },
        { id: 2, title: 'Recent Tab', lastVisitSecondsAgo: 10 },
        { id: 3, title: 'Mid Tab', lastVisitSecondsAgo: 50 },
      ]

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2, 3, 1])
      expect(results[0]).toMatchObject({
        id: 2,
      })
    })
  })

  describe('bookmarks mode', () => {
    test('returns all bookmarks with default score', async () => {
      ext.model.searchMode = 'bookmarks'
      ext.model.bookmarks = [
        { id: 1, title: 'Bookmark 1' },
        { id: 2, title: 'Bookmark 2' },
      ]

      const results = await addDefaultEntries()

      expect(results).toEqual([
        { id: 1, title: 'Bookmark 1' },
        { id: 2, title: 'Bookmark 2' },
      ])
    })
  })

  describe('all mode (default)', () => {
    test('returns bookmarks matching current tab URL', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example' },
        { id: 2, url: 'other.com', originalUrl: 'https://other.com', title: 'Other' },
      ]
      ext.model.tabs = []
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com/' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([expect.objectContaining({ id: 1, title: 'Example' })])
    })

    test('shows all bookmarks if multiple match current tab URL', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example 1' },
        { id: 2, url: 'example.com', originalUrl: 'https://example.com', title: 'Example 2' },
      ]
      ext.model.tabs = []
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com' }])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([1, 2])
    })

    test('matches URLs with and without trailing slashes', async () => {
      ext.model.bookmarks = [{ id: 1, url: 'example.com', originalUrl: 'https://example.com/', title: 'With Slash' }]
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([expect.objectContaining({ id: 1, title: 'With Slash' })])
    })

    test('matches URLs with and without protocol', async () => {
      ext.model.bookmarks = [{ id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example' }]
      mockGetBrowserTabs.mockResolvedValue([{ url: 'example.com' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([expect.objectContaining({ id: 1, title: 'Example' })])
    })

    test('matches URLs ignoring anchor tags', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'example.com', originalUrl: 'https://example.com#section1', title: 'Bookmark with Hash' },
      ]
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com#section2' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([expect.objectContaining({ id: 1, title: 'Bookmark with Hash' })])
    })

    test('adds recent tabs when enabled', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.tabs = [
        { id: 1, url: 'https://one.test', lastVisitSecondsAgo: 30 },
        { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 10 },
        { id: 3, url: 'https://three.test', lastVisitSecondsAgo: 20 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://nomatch.test' }])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2, 3])
    })

    test('excludes active tab from recent tabs', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.tabs = [
        { id: 1, originalId: 1, url: 'https://active.test', active: true, lastVisitSecondsAgo: 0 },
        { id: 2, originalId: 2, url: 'https://recent.test', active: false, lastVisitSecondsAgo: 10 },
        { id: 3, originalId: 3, url: 'https://older.test', active: false, lastVisitSecondsAgo: 20 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([{ id: 1, url: 'https://active.test' }])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2, 3])
    })

    test('filters out chrome:// and about: URLs from recent tabs', async () => {
      ext.opts.maxRecentTabsToShow = 5
      ext.model.tabs = [
        { id: 1, url: 'chrome://extensions', lastVisitSecondsAgo: 10 },
        { id: 2, url: 'https://valid.test', lastVisitSecondsAgo: 20 },
        { id: 3, url: 'about:blank', lastVisitSecondsAgo: 15 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2])
    })

    test('combines matching bookmarks and excludes active tab from recent list', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.bookmarks = [
        { id: 1, originalId: 101, url: 'active.test', originalUrl: 'https://active.test', title: 'Bookmark Match' },
      ]
      ext.model.tabs = [
        { id: 2, originalId: 101, url: 'https://active.test', lastVisitSecondsAgo: 0 },
        { id: 3, originalId: 102, url: 'https://other.test', lastVisitSecondsAgo: 10 },
      ]
      mockGetBrowserTabs.mockResolvedValue([{ id: 101, url: 'https://active.test' }])

      const results = await addDefaultEntries()

      // id: 1 (bookmark) should be there from the bookmark matching logic.
      // id: 2 (tab) should be EXCLUDED from recent tabs because it's the active tab.
      // id: 3 (tab) should be there as it is a recent tab.
      expect(results.map((r) => r.id)).toEqual([1, 3])
    })

    test('handles missing tab URL gracefully', async () => {
      ext.model.bookmarks = [{ id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example' }]
      mockGetBrowserTabs.mockResolvedValue([{ url: null }])

      const results = await addDefaultEntries()

      // Should not throw and may have no bookmark matches
      expect(results).toBeDefined()
    })

    test('handles browser API errors gracefully', async () => {
      ext.model.tabs = [{ id: 1, url: 'https://tab.test', lastVisitSecondsAgo: 10 }]
      mockGetBrowserTabs.mockRejectedValue(new Error('API error'))

      const results = await addDefaultEntries()

      // Should still return recent tabs
      expect(results.map((r) => r.id)).toEqual([1])
    })

    test('returns empty when maxRecentTabsToShow is 0', async () => {
      ext.opts.maxRecentTabsToShow = 0
      ext.model.tabs = [{ id: 1, url: 'https://tab.test', lastVisitSecondsAgo: 10 }]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([])

      const results = await addDefaultEntries()

      expect(results).toEqual([])
    })

    test('handles tabs with undefined lastVisitSecondsAgo', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.tabs = [
        { id: 1, url: 'https://one.test', lastVisitSecondsAgo: undefined },
        { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 10 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([])

      const results = await addDefaultEntries()

      // Tab with undefined should be sorted last
      expect(results.map((r) => r.id)).toEqual([2, 1])
    })
  })
})
