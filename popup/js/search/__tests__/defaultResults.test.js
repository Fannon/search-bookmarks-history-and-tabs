/**
 * Tests for defaultResults.js - default result generation when no search term provided.
 *
 * ✅ Covered behaviors: mode-specific defaults, current tab matching, recent tabs, error handling
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test
} from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

const mockGetBrowserTabs = jest.fn()

let addDefaultEntries

beforeAll(async () => {
  await jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    getBrowserTabs: mockGetBrowserTabs
  }))

  const defaultResultsModule = await import('../defaultResults.js')
  addDefaultEntries = defaultResultsModule.addDefaultEntries
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetBrowserTabs.mockResolvedValue([])
  createTestExt({
    opts: {
      maxRecentTabsToShow: 3
    },
    model: {
      searchMode: 'all',
      bookmarks: [],
      tabs: [],
      history: []
    }
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
        { id: 2, title: 'History 2', url: 'https://two.test' }
      ]

      const results = await addDefaultEntries()

      expect(results).toEqual([
        { id: 1, title: 'History 1', url: 'https://one.test', searchScore: 1 },
        { id: 2, title: 'History 2', url: 'https://two.test', searchScore: 1 }
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
        { id: 3, title: 'Mid Tab', lastVisitSecondsAgo: 50 }
      ]

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2, 3, 1])
      expect(results[0]).toMatchObject({
        id: 2,
        searchScore: 1
      })
    })
  })

  describe('bookmarks mode', () => {
    test('returns all bookmarks with default score', async () => {
      ext.model.searchMode = 'bookmarks'
      ext.model.bookmarks = [
        { id: 1, title: 'Bookmark 1' },
        { id: 2, title: 'Bookmark 2' }
      ]

      const results = await addDefaultEntries()

      expect(results).toEqual([
        { id: 1, title: 'Bookmark 1', searchScore: 1 },
        { id: 2, title: 'Bookmark 2', searchScore: 1 }
      ])
    })
  })

  describe('all mode (default)', () => {
    test('returns bookmarks matching current tab URL', async () => {
      ext.model.bookmarks = [
        { id: 1, originalUrl: 'https://example.com', title: 'Example' },
        { id: 2, originalUrl: 'https://other.com', title: 'Other' }
      ]
      ext.model.tabs = []
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com/' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([
        expect.objectContaining({ id: 1, title: 'Example', searchScore: 1 })
      ])
    })

    test('matches URLs with and without trailing slashes', async () => {
      ext.model.bookmarks = [
        { id: 1, originalUrl: 'https://example.com/', title: 'With Slash' }
      ]
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([
        expect.objectContaining({ id: 1, title: 'With Slash' })
      ])
    })

    test('matches URLs with and without protocol', async () => {
      ext.model.bookmarks = [
        { id: 1, originalUrl: 'https://example.com', title: 'Example' }
      ]
      mockGetBrowserTabs.mockResolvedValue([{ url: 'example.com' }])

      const results = await addDefaultEntries()

      expect(results).toEqual([
        expect.objectContaining({ id: 1, title: 'Example' })
      ])
    })

    test('adds recent tabs when enabled', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.tabs = [
        { id: 1, url: 'https://one.test', lastVisitSecondsAgo: 30 },
        { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 10 },
        { id: 3, url: 'https://three.test', lastVisitSecondsAgo: 20 }
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://nomatch.test' }])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2, 3])
    })

    test('filters out chrome:// and about: URLs from recent tabs', async () => {
      ext.opts.maxRecentTabsToShow = 5
      ext.model.tabs = [
        { id: 1, url: 'chrome://extensions', lastVisitSecondsAgo: 10 },
        { id: 2, url: 'https://valid.test', lastVisitSecondsAgo: 20 },
        { id: 3, url: 'about:blank', lastVisitSecondsAgo: 15 }
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([2])
    })

    test('combines matching bookmarks and recent tabs', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.bookmarks = [
        { id: 1, originalUrl: 'https://example.com', title: 'Example' }
      ]
      ext.model.tabs = [
        { id: 2, url: 'https://tab.test', lastVisitSecondsAgo: 10 },
        { id: 3, url: 'https://tab2.test', lastVisitSecondsAgo: 20 }
      ]
      mockGetBrowserTabs.mockResolvedValue([{ url: 'https://example.com' }])

      const results = await addDefaultEntries()

      expect(results.map((r) => r.id)).toEqual([1, 2, 3])
    })

    test('handles missing tab URL gracefully', async () => {
      ext.model.bookmarks = [
        { id: 1, originalUrl: 'https://example.com', title: 'Example' }
      ]
      mockGetBrowserTabs.mockResolvedValue([{ url: null }])

      const results = await addDefaultEntries()

      // Should not throw and may have no bookmark matches
      expect(results).toBeDefined()
    })

    test('handles browser API errors gracefully', async () => {
      ext.model.tabs = [
        { id: 1, url: 'https://tab.test', lastVisitSecondsAgo: 10 }
      ]
      mockGetBrowserTabs.mockRejectedValue(new Error('API error'))

      const results = await addDefaultEntries()

      // Should still return recent tabs
      expect(results.map((r) => r.id)).toEqual([1])
    })

    test('returns empty when maxRecentTabsToShow is 0', async () => {
      ext.opts.maxRecentTabsToShow = 0
      ext.model.tabs = [
        { id: 1, url: 'https://tab.test', lastVisitSecondsAgo: 10 }
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([])

      const results = await addDefaultEntries()

      expect(results).toEqual([])
    })

    test('handles tabs with undefined lastVisitSecondsAgo', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.tabs = [
        { id: 1, url: 'https://one.test', lastVisitSecondsAgo: undefined },
        { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 10 }
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mockResolvedValue([])

      const results = await addDefaultEntries()

      // Tab with undefined should be sorted last
      expect(results.map((r) => r.id)).toEqual([2, 1])
    })
  })
})
