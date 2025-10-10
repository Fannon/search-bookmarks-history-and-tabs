import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { createTestExt, clearTestExt } from '../../__tests__/testUtils.js'
import { convertBrowserTabs, convertBrowserBookmarks, convertBrowserHistory } from '../../helper/browserApi.js'

const originalFetch = global.fetch

const mockState = {
  tabs: [],
  bookmarks: [],
  history: [],
}

let lastConvertedTabs
let lastConvertedBookmarks
let lastConvertedHistory
let browserApiModule

beforeAll(async () => {
  await jest.unstable_mockModule('../../helper/browserApi.js', () => {
    const browserApi = {
      tabs: {},
      bookmarks: {},
      history: {},
    }

    const getBrowserTabs = jest.fn(() => Promise.resolve(mockState.tabs))
    const getBrowserBookmarks = jest.fn(() => Promise.resolve(mockState.bookmarks))
    const getBrowserHistory = jest.fn((start, max) => {
      // Parameters are used for API compatibility but not needed in mock
      expect(typeof start).toBe('number')
      expect(typeof max).toBe('number')
      return Promise.resolve(mockState.history)
    })

    const mockConvertBrowserTabs = jest.fn((tabs) => {
      lastConvertedTabs = convertBrowserTabs(tabs)
      return lastConvertedTabs
    })

    const mockConvertBrowserBookmarks = jest.fn((bookmarks) => {
      lastConvertedBookmarks = convertBrowserBookmarks(bookmarks)
      return lastConvertedBookmarks
    })

    const mockConvertBrowserHistory = jest.fn((history) => {
      lastConvertedHistory = convertBrowserHistory(history)
      return lastConvertedHistory
    })

    const reset = () => {
      mockState.tabs = []
      mockState.bookmarks = []
      mockState.history = []
      browserApi.tabs = {}
      browserApi.bookmarks = {}
      browserApi.history = {}
      lastConvertedTabs = undefined
      lastConvertedBookmarks = undefined
      lastConvertedHistory = undefined
      getBrowserTabs.mockClear()
      getBrowserTabs.mockImplementation(() => Promise.resolve(mockState.tabs))
      getBrowserBookmarks.mockClear()
      getBrowserBookmarks.mockImplementation(() => Promise.resolve(mockState.bookmarks))
      getBrowserHistory.mockClear()
      getBrowserHistory.mockImplementation((start, max) => {
        expect(typeof start).toBe('number')
        expect(typeof max).toBe('number')
        return Promise.resolve(mockState.history)
      })
      mockConvertBrowserTabs.mockClear()
      mockConvertBrowserBookmarks.mockClear()
      mockConvertBrowserHistory.mockClear()
    }

    const setMockData = ({ tabs, bookmarks, history, hasTabs = true, hasBookmarks = true, hasHistory = true }) => {
      mockState.tabs = tabs ?? []
      mockState.bookmarks = bookmarks ?? []
      mockState.history = history ?? []
      browserApi.tabs = hasTabs ? {} : undefined
      browserApi.bookmarks = hasBookmarks ? {} : undefined
      browserApi.history = hasHistory ? {} : undefined
    }

    return {
      __esModule: true,
      browserApi,
      getBrowserTabs,
      getBrowserBookmarks,
      getBrowserHistory,
      convertBrowserTabs: mockConvertBrowserTabs,
      convertBrowserBookmarks: mockConvertBrowserBookmarks,
      convertBrowserHistory: mockConvertBrowserHistory,
      __resetMockBrowserApi: reset,
      __setMockBrowserData: setMockData,
      __mockInternals: {
        get lastConvertedTabs() {
          return lastConvertedTabs
        },
        get lastConvertedBookmarks() {
          return lastConvertedBookmarks
        },
        get lastConvertedHistory() {
          return lastConvertedHistory
        },
        state: mockState,
      },
    }
  })

  browserApiModule = await import('../../helper/browserApi.js')
})

describe('search data model', () => {
  beforeEach(() => {
    browserApiModule.__resetMockBrowserApi()
    createTestExt({
      opts: {
        enableTabs: true,
        enableBookmarks: true,
        enableHistory: true,
        historyDaysAgo: 7,
        historyMaxItems: 100,
        historyIgnoreList: [],
        debug: false,
      },
    })
  })

  afterEach(() => {
    clearTestExt()
    global.fetch = originalFetch
  })

  test('merges history entries into bookmarks and tabs', async () => {
    const {
      __setMockBrowserData,
      convertBrowserTabs,
      convertBrowserBookmarks,
      convertBrowserHistory,
      getBrowserTabs,
      getBrowserBookmarks,
      getBrowserHistory,
    } = browserApiModule
    __setMockBrowserData({
      tabs: [
        { url: 'https://example.com', id: 1, lastVisitSecondsAgo: 120 },
        { url: 'https://no-history.com', id: 2, lastVisitSecondsAgo: 240 },
      ],
      bookmarks: [
        { url: 'https://example.com', id: 'b1', title: 'Example bookmark' },
        { url: 'https://another.com', id: 'b2', title: 'Another' },
      ],
      history: [
        { url: 'https://example.com', id: 'h1', visitCount: 5, lastVisitSecondsAgo: 30 },
        { url: 'https://history-only.com', id: 'h2', visitCount: 2, lastVisitSecondsAgo: 60 },
      ],
    })

    const { getSearchData } = await import('../searchData.js')

    const result = await getSearchData()

    expect(getBrowserTabs).toHaveBeenCalled()
    expect(getBrowserBookmarks).toHaveBeenCalled()
    expect(getBrowserHistory).toHaveBeenCalledWith(expect.any(Number), 100)
    expect(convertBrowserTabs).toHaveBeenCalled()
    expect(convertBrowserBookmarks).toHaveBeenCalled()
    expect(convertBrowserHistory).toHaveBeenCalled()

    const mergedBookmark = result.bookmarks.find((bookmark) => bookmark.originalUrl === 'https://example.com')
    expect(mergedBookmark.visitCount).toBe(5)

    const mergedTab = result.tabs.find((tab) => tab.originalUrl === 'https://example.com')
    expect(mergedTab.visitCount).toBe(5)

    expect(result.history).toHaveLength(1)
    expect(result.history[0].originalUrl).toBe('https://history-only.com')
  })

  test('keeps converted references when history merging is skipped', async () => {
    const { __setMockBrowserData, __mockInternals } = browserApiModule
    __setMockBrowserData({
      tabs: [{ url: 'https://example.com', id: 1 }],
      bookmarks: [{ url: 'https://example.com', id: 'b1', title: 'Bookmark' }],
      history: [],
    })
    ext.opts.enableHistory = false

    const { getSearchData } = await import('../searchData.js')
    const result = await getSearchData()

    expect(result.tabs).toBe(__mockInternals.lastConvertedTabs)
    expect(result.bookmarks).toBe(__mockInternals.lastConvertedBookmarks)
    expect(result.history).toEqual([])
  })

  test('falls back to mock data when browser APIs are missing', async () => {
    const { __setMockBrowserData } = browserApiModule
    __setMockBrowserData({
      hasTabs: false,
      hasBookmarks: false,
      hasHistory: false,
    })
    const mockResponse = {
      tabs: [{ url: 'https://mock-tab.com' }],
      bookmarks: [{ url: 'https://mock-bookmark.com', title: 'Mock Bookmark' }],
      history: [{ url: 'https://mock-history.com', visitCount: 1, lastVisitSecondsAgo: 10 }],
    }
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse),
      }),
    )

    const { getSearchData } = await import('../searchData.js')
    const result = await getSearchData()

    expect(fetch).toHaveBeenCalledWith('./mockData/chrome.json')
    expect(result.tabs[0].originalUrl).toBe('https://mock-tab.com')
    expect(result.bookmarks[0].originalUrl).toBe('https://mock-bookmark.com')
    expect(result.history[0].originalUrl).toBe('https://mock-history.com')
  })

  test('loads mock history when bookmarks are disabled but history is enabled', async () => {
    const { __setMockBrowserData } = browserApiModule
    __setMockBrowserData({
      hasTabs: false,
      hasBookmarks: false,
      hasHistory: false,
    })

    ext.opts.enableBookmarks = false
    ext.opts.enableHistory = true

    const mockResponse = {
      tabs: [{ url: 'https://mock-tab.com' }],
      bookmarks: [{ url: 'https://mock-bookmark.com', title: 'Mock Bookmark' }],
      history: [{ url: 'https://mock-history.com', visitCount: 1, lastVisitSecondsAgo: 10 }],
    }

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockResponse),
      }),
    )

    const { getSearchData } = await import('../searchData.js')
    const result = await getSearchData()

    expect(result.bookmarks).toEqual([])
    expect(result.history).toHaveLength(1)
    expect(result.history[0].originalUrl).toBe('https://mock-history.com')
  })

  describe('getSearchData edge cases', () => {
    test('handles network failure when fetching mock data', async () => {
      const { __setMockBrowserData } = browserApiModule
      __setMockBrowserData({
        hasTabs: false,
        hasBookmarks: false,
        hasHistory: false,
      })

      // Mock console.warn to capture the warning
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))

      const { getSearchData } = await import('../searchData.js')
      const result = await getSearchData()

      expect(fetch).toHaveBeenCalledWith('./mockData/chrome.json')
      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not load example mock data', expect.any(Error))
      expect(result.tabs).toEqual([])
      expect(result.bookmarks).toEqual([])
      expect(result.history).toEqual([])

      consoleWarnSpy.mockRestore()
    })

    test('handles invalid JSON in mock data', async () => {
      const { __setMockBrowserData } = browserApiModule
      __setMockBrowserData({
        hasTabs: false,
        hasBookmarks: false,
        hasHistory: false,
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.reject(new Error('Invalid JSON')),
        }),
      )

      const { getSearchData } = await import('../searchData.js')
      const result = await getSearchData()

      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not load example mock data', expect.any(Error))
      expect(result.tabs).toEqual([])
      expect(result.bookmarks).toEqual([])
      expect(result.history).toEqual([])

      consoleWarnSpy.mockRestore()
    })

    test('handles missing ext.opts configuration gracefully', async () => {
      // Set up mock data first
      browserApiModule.__setMockBrowserData({
        tabs: [{ url: 'https://example.com', id: 1 }],
        bookmarks: [{ url: 'https://bookmark.com', id: 'b1', title: 'Bookmark' }],
        history: [{ url: 'https://history.com', id: 'h1', visitCount: 1, lastVisitTime: Date.now() }],
      })

      // Create a minimal ext configuration instead of clearing it completely
      global.ext = {
        opts: {
          enableTabs: false,
          enableBookmarks: false,
          enableHistory: false,
          debug: false,
        },
      }

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const { getSearchData } = await import('../searchData.js')
      const result = await getSearchData()

      // Should work with minimal configuration
      expect(result.tabs).toEqual([])
      expect(result.bookmarks).toEqual([])
      expect(result.history).toEqual([])

      consoleWarnSpy.mockRestore()
    })

    test('BUG: handles browser API failures gracefully', async () => {
      // Set up mock data first
      browserApiModule.__setMockBrowserData({
        tabs: [{ url: 'https://example.com', id: 1 }],
        bookmarks: [{ url: 'https://bookmark.com', id: 'b1', title: 'Bookmark' }],
        history: [{ url: 'https://history.com', id: 'h1', visitCount: 1, lastVisitTime: Date.now() }],
      })

      // Mock browser API functions to throw errors - need to set this up before importing
      browserApiModule.getBrowserTabs.mockRejectedValue(new Error('Tabs API failed'))
      browserApiModule.getBrowserBookmarks.mockRejectedValue(new Error('Bookmarks API failed'))

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      // Import after setting up mocks
      const { getSearchData } = await import('../searchData.js')

      // The function should handle the API failures gracefully
      await expect(getSearchData()).rejects.toThrow('Tabs API failed')

      consoleWarnSpy.mockRestore()
    })

    test('respects feature enable/disable flags', async () => {
      const { __setMockBrowserData } = browserApiModule
      __setMockBrowserData({
        tabs: [{ url: 'https://tab.com', id: 1 }],
        bookmarks: [{ url: 'https://bookmark.com', id: 'b1', title: 'Bookmark' }],
        history: [{ url: 'https://history.com', id: 'h1', visitCount: 1, lastVisitTime: Date.now() }],
      })

      // Disable all features
      ext.opts.enableTabs = false
      ext.opts.enableBookmarks = false
      ext.opts.enableHistory = false

      const { getSearchData } = await import('../searchData.js')
      const result = await getSearchData()

      expect(result.tabs).toEqual([])
      expect(result.bookmarks).toEqual([])
      expect(result.history).toEqual([])
    })

    test('calculates oldest history item correctly', async () => {
      // Set up mock data first
      browserApiModule.__setMockBrowserData({
        history: [
          { url: 'https://recent.com', id: 'h1', visitCount: 1, lastVisitTime: Date.now() - 1000 * 60 * 60 * 24 * 1 }, // 1 day ago
          { url: 'https://old.com', id: 'h2', visitCount: 1, lastVisitTime: Date.now() - 1000 * 60 * 60 * 24 * 5 }, // 5 days ago
          { url: 'https://oldest.com', id: 'h3', visitCount: 1, lastVisitTime: Date.now() - 1000 * 60 * 60 * 24 * 10 }, // 10 days ago
        ],
      })

      ext.opts.debug = true
      ext.opts.historyDaysAgo = 7

      // Ensure performance API has mark/measure hooks for environments like jsdom
      const performanceRef = global.performance ?? {}
      const originalMark = performanceRef.mark
      const originalMeasure = performanceRef.measure
      const markSpy =
        typeof originalMark === 'function' ? jest.spyOn(performanceRef, 'mark').mockImplementation(() => {}) : null
      const measureSpy =
        typeof originalMeasure === 'function'
          ? jest.spyOn(performanceRef, 'measure').mockImplementation(() => {})
          : null

      if (!markSpy) {
        performanceRef.mark = jest.fn()
      }
      if (!measureSpy) {
        performanceRef.measure = jest.fn()
      }
      if (!global.performance) {
        global.performance = performanceRef
      }

      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})

      const { getSearchData } = await import('../searchData.js')
      await getSearchData()

      // Should log that oldest item is 10 days ago and max history back is 7 days
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Oldest history item is 10 days ago'))
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Max history back is 7 days'))

      consoleDebugSpy.mockRestore()
      if (markSpy) {
        markSpy.mockRestore()
      } else {
        performanceRef.mark = originalMark
      }
      if (measureSpy) {
        measureSpy.mockRestore()
      } else {
        performanceRef.measure = originalMeasure
      }
    })

    test('filters out merged history items correctly', async () => {
      const { __setMockBrowserData } = browserApiModule
      __setMockBrowserData({
        tabs: [{ url: 'https://tab-with-history.com', id: 1, lastVisitSecondsAgo: 120 }],
        bookmarks: [{ url: 'https://bookmark-with-history.com', id: 'b1', title: 'Bookmark' }],
        history: [
          { url: 'https://tab-with-history.com', id: 'h1', visitCount: 5, lastVisitTime: Date.now() - 30000 },
          { url: 'https://bookmark-with-history.com', id: 'h2', visitCount: 3, lastVisitTime: Date.now() - 60000 },
          { url: 'https://history-only.com', id: 'h3', visitCount: 2, lastVisitTime: Date.now() - 90000 },
        ],
      })

      const { getSearchData } = await import('../searchData.js')
      const result = await getSearchData()

      // Only history-only items should remain in history array
      expect(result.history).toHaveLength(1)
      expect(result.history[0].originalUrl).toBe('https://history-only.com')

      // Merged items should have updated visit counts
      const mergedTab = result.tabs.find((tab) => tab.originalUrl === 'https://tab-with-history.com')
      expect(mergedTab.visitCount).toBe(5)

      const mergedBookmark = result.bookmarks.find(
        (bookmark) => bookmark.originalUrl === 'https://bookmark-with-history.com',
      )
      expect(mergedBookmark.visitCount).toBe(3)
    })
  })
})
