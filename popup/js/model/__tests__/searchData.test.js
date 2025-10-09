import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { createTestExt } from '../../__tests__/testUtils.js'

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

const convertTab = (tab) => ({
  type: 'tab',
  title: tab.title || 'Tab',
  url: tab.url,
  originalUrl: tab.url,
  originalId: tab.id ?? tab.url,
  lastVisitSecondsAgo: tab.lastVisitSecondsAgo ?? 0,
  visitCount: tab.visitCount ?? 0,
})

const convertBookmark = (bookmark) => ({
  type: 'bookmark',
  title: bookmark.title || 'Bookmark',
  url: bookmark.url,
  originalUrl: bookmark.url,
  originalId: bookmark.id ?? bookmark.url,
  lastVisitSecondsAgo: bookmark.lastVisitSecondsAgo ?? 0,
  visitCount: bookmark.visitCount ?? 0,
})

const convertHistory = (history) => ({
  type: 'history',
  title: history.title || 'History',
  url: history.url,
  originalUrl: history.url,
  originalId: history.id ?? history.url,
  lastVisitSecondsAgo: history.lastVisitSecondsAgo ?? 0,
  visitCount: history.visitCount ?? 0,
})

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

    const convertBrowserTabs = jest.fn((tabs) => {
      lastConvertedTabs = tabs.map((tab) => convertTab(tab))
      return lastConvertedTabs
    })

    const convertBrowserBookmarks = jest.fn((bookmarks) => {
      lastConvertedBookmarks = bookmarks.map((bookmark) => convertBookmark(bookmark))
      return lastConvertedBookmarks
    })

    const convertBrowserHistory = jest.fn((history) => {
      lastConvertedHistory = history.map((entry) => convertHistory(entry))
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
      getBrowserBookmarks.mockClear()
      getBrowserHistory.mockClear()
      convertBrowserTabs.mockClear()
      convertBrowserBookmarks.mockClear()
      convertBrowserHistory.mockClear()
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
      convertBrowserTabs,
      convertBrowserBookmarks,
      convertBrowserHistory,
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

const clearExt = () => {
  delete global.ext
  if (typeof window !== 'undefined') {
    delete window.ext
  }
}

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
    clearExt()
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
})
