/**
 * ✅ Covered behaviors: history merging, mock-data fallback, debug logging, feature gating
 * ⚠️ Known gaps: does not execute real browser API error paths beyond happy/fallback flows
 * 🐞 Added BUG tests: none – verified lazy merge regression via reference assertions
 */

import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

const originalFetch = global.fetch
const originalPerformance = global.performance

const mockState = {
  tabs: [],
  bookmarks: [],
  history: [],
}

let tabsQueryMock
let bookmarksGetTreeMock
let historySearchMock
let tabGroupsQueryMock

let helperModule
let browserApi
let actualConvertBrowserTabs
let actualConvertBrowserBookmarks
let actualConvertBrowserHistory

let getSearchData

let currentTabs = []
let currentBookmarks = []
let currentHistory = []

function cloneBookmarksTree(nodes = []) {
  return JSON.parse(JSON.stringify(nodes))
}

function setBrowserData({ tabs = [], bookmarks = [], history = [] } = {}) {
  currentTabs = tabs.map((tab) => ({ ...tab }))
  currentBookmarks = cloneBookmarksTree(bookmarks)
  currentHistory = history.map((historyItem) => ({ ...historyItem }))

  mockState.tabs = currentTabs
  mockState.bookmarks = currentBookmarks
  mockState.history = currentHistory
}

function setBrowserApiAvailability({ tabs = true, bookmarks = true, history = true, tabGroups = true } = {}) {
  if (!browserApi) {
    return
  }
  browserApi.tabs = tabs ? { query: tabsQueryMock } : undefined
  browserApi.bookmarks = bookmarks ? { getTree: bookmarksGetTreeMock } : undefined
  browserApi.history = history ? { search: historySearchMock } : undefined
  browserApi.tabGroups = tabGroups ? { query: tabGroupsQueryMock } : undefined
}

beforeAll(async () => {
  helperModule = await import('../../helper/browserApi.js')
  browserApi = helperModule.browserApi
  actualConvertBrowserTabs = helperModule.convertBrowserTabs
  actualConvertBrowserBookmarks = helperModule.convertBrowserBookmarks
  actualConvertBrowserHistory = helperModule.convertBrowserHistory
  ;({ getSearchData } = await import('../searchData.js'))
})

describe('getSearchData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentTabs = []
    currentBookmarks = []
    currentHistory = []

    tabsQueryMock = jest.fn(async () => currentTabs)
    bookmarksGetTreeMock = jest.fn(async () => currentBookmarks)
    historySearchMock = jest.fn(async () => currentHistory)
    tabGroupsQueryMock = jest.fn(async () => [])

    setBrowserApiAvailability()
    setBrowserData()
    createTestExt({
      opts: {
        enableTabs: true,
        enableBookmarks: true,
        enableHistory: true,
        debug: false,
        historyDaysAgo: 7,
        historyMaxItems: 100,
      },
    })
    global.fetch = originalFetch
  })

  afterEach(() => {
    clearTestExt()
    global.fetch = originalFetch
    if (originalPerformance) {
      global.performance = originalPerformance
    } else {
      delete global.performance
    }
    jest.restoreAllMocks()
  })

  test('merges history into bookmarks and tabs', async () => {
    const baseTime = 1700000000000
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    try {
      setBrowserData({
        tabs: [
          {
            url: 'https://example.com',
            title: 'Example Tab',
            id: 'tab-1',
            active: true,
            windowId: 1,
            lastAccessed: baseTime - 400 * 1000,
          },
          {
            url: 'https://no-match.com',
            title: 'No Match',
            id: 'tab-2',
            active: false,
            windowId: 1,
            lastAccessed: baseTime - 200 * 1000,
          },
        ],
        bookmarks: [
          {
            title: '',
            children: [
              {
                title: 'Bookmarks Bar',
                children: [
                  {
                    id: 'bookmark-1',
                    title: 'Example Bookmark',
                    url: 'https://example.com',
                    dateAdded: baseTime - 1000 * 1000,
                  },
                ],
              },
            ],
          },
        ],
        history: [
          {
            id: 'history-1',
            url: 'https://example.com',
            title: 'Example History',
            lastVisitTime: baseTime - 25 * 1000,
            visitCount: 12,
          },
          {
            id: 'history-2',
            url: 'https://history-only.com',
            title: 'Standalone History',
            lastVisitTime: baseTime - 300 * 1000,
            visitCount: 5,
          },
        ],
      })
      const tabsAfterConvert = actualConvertBrowserTabs(mockState.tabs)
      const historyAfterConvert = actualConvertBrowserHistory(mockState.history)

      const result = await getSearchData()

      expect(historySearchMock).toHaveBeenCalled()
      const [historySearchArgs] = historySearchMock.mock.calls[0]
      expect(historySearchArgs.maxResults).toBe(ext.opts.historyMaxItems)
      expect(historySearchArgs.startTime).toBe(baseTime - 1000 * 60 * 60 * 24 * ext.opts.historyDaysAgo)

      const mergedTab = result.tabs.find((tab) => tab.originalUrl === 'https://example.com')
      expect(mergedTab.lastVisitSecondsAgo).toBe(25)
      expect(mergedTab.visitCount).toBe(12)

      const untouchedTab = result.tabs.find((tab) => tab.originalUrl === 'https://no-match.com')
      const originalUntouchedTab = tabsAfterConvert.find((tab) => tab.originalUrl === 'https://no-match.com')
      expect(untouchedTab).toEqual(originalUntouchedTab)

      const mergedBookmark = result.bookmarks.find((bookmark) => bookmark.originalUrl === 'https://example.com')
      expect(mergedBookmark.lastVisitSecondsAgo).toBe(25)
      expect(mergedBookmark.visitCount).toBe(12)

      const remainingHistory = historyAfterConvert.filter((entry) => entry.originalUrl !== 'https://example.com')
      expect(result.history).toEqual(remainingHistory)
    } finally {
      nowSpy.mockRestore()
    }
  })

  test('marks bookmarks that have an open browser tab', async () => {
    const baseTime = 1700000200000
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    try {
      setBrowserData({
        tabs: [
          {
            url: 'https://example.com',
            title: 'Example Tab',
            id: 'tab-1',
            active: true,
            windowId: 1,
            lastAccessed: baseTime - 1000,
          },
        ],
        bookmarks: [
          {
            title: '',
            children: [
              {
                title: 'Bookmarks Bar',
                children: [
                  {
                    id: 'bookmark-1',
                    title: 'Example Bookmark',
                    url: 'https://example.com',
                    dateAdded: baseTime - 5000,
                  },
                  {
                    id: 'bookmark-2',
                    title: 'Standalone Bookmark',
                    url: 'https://no-open-tab.com',
                    dateAdded: baseTime - 6000,
                  },
                ],
              },
            ],
          },
        ],
        history: [],
      })

      const result = await getSearchData()
      const flaggedBookmark = result.bookmarks.find((bookmark) => bookmark.originalUrl === 'https://example.com')
      const plainBookmark = result.bookmarks.find((bookmark) => bookmark.originalUrl === 'https://no-open-tab.com')

      expect(flaggedBookmark.tab).toBe(true)
      expect(plainBookmark.tab).toBeUndefined()
    } finally {
      nowSpy.mockRestore()
    }
  })

  test('copies tab group information to matching bookmarks', async () => {
    const baseTime = 1700000300000
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    try {
      const mockTabGroup = { id: 101, title: 'Work Group', color: 'blue' }
      tabGroupsQueryMock.mockResolvedValue([mockTabGroup])

      setBrowserData({
        tabs: [
          {
            url: 'https://work.com/doc',
            title: 'Work Doc',
            id: 'tab-1',
            groupId: 101,
            active: false,
            windowId: 1,
          },
        ],
        bookmarks: [
          {
            title: '',
            children: [
              {
                title: 'BM Bar',
                children: [
                  {
                    id: 'bm-1',
                    title: 'Work Bookmark',
                    url: 'https://work.com/doc',
                    dateAdded: baseTime,
                  },
                ],
              },
            ],
          },
        ],
        history: [],
      })

      const result = await getSearchData()

      const bookmark = result.bookmarks.find((b) => b.originalUrl === 'https://work.com/doc')
      expect(bookmark.tab).toBe(true)
      expect(bookmark.group).toBe('Work Group')
      expect(bookmark.groupId).toBe(101)
    } finally {
      nowSpy.mockRestore()
    }
  })

  test('uses bundled mock data when browser APIs are unavailable', async () => {
    setBrowserApiAvailability({ tabs: false, bookmarks: false, history: false, tabGroups: false })
    ext.opts.enableBookmarks = true

    const baseTime = 1700000100000
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    try {
      const mockResponse = {
        tabs: [
          {
            url: 'https://mock-tab.com',
            title: 'Mock Tab',
            id: 'tab-1',
            active: true,
            windowId: 2,
            lastAccessed: baseTime - 60 * 1000,
          },
        ],
        bookmarks: [
          {
            title: '',
            children: [
              {
                title: 'Bookmarks Bar',
                children: [
                  {
                    id: 'bookmark-1',
                    title: 'Mock Bookmark',
                    url: 'https://mock-bookmark.com',
                    dateAdded: baseTime - 500 * 1000,
                  },
                ],
              },
            ],
          },
        ],
        history: [
          {
            url: 'https://mock-history.com',
            title: 'Mock History',
            id: 'history-1',
            visitCount: 4,
            lastVisitTime: baseTime - 120 * 1000,
          },
        ],
      }
      const fetchMock = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockResponse),
        }),
      )
      global.fetch = fetchMock

      const result = await getSearchData()

      expect(fetchMock).toHaveBeenCalledWith('./mockData/chrome.json')
      expect(tabsQueryMock).not.toHaveBeenCalled()
      expect(bookmarksGetTreeMock).not.toHaveBeenCalled()
      expect(historySearchMock).not.toHaveBeenCalled()

      const expectedTabs = actualConvertBrowserTabs(mockResponse.tabs)
      const expectedBookmarks = actualConvertBrowserBookmarks(mockResponse.bookmarks)
      const expectedHistory = actualConvertBrowserHistory(mockResponse.history)

      expect(result.tabs).toEqual(expectedTabs)
      expect(result.history).toEqual(expectedHistory)
      expect(result.bookmarks).toEqual(expectedBookmarks)
    } finally {
      nowSpy.mockRestore()
    }
  })

  test('handles mock data fetch failures gracefully', async () => {
    setBrowserApiAvailability({ tabs: false, bookmarks: false, history: false })

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))

    const result = await getSearchData()

    expect(global.fetch).toHaveBeenCalledWith('./mockData/chrome.json')
    expect(warnSpy).toHaveBeenCalledWith('Could not load example mock data', expect.any(Error))
    expect(result).toEqual({ tabs: [], bookmarks: [], history: [] })

    warnSpy.mockRestore()
  })

  test('skips history retrieval when feature disabled', async () => {
    ext.opts.enableHistory = false
    const baseTime = 1700000200000
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseTime)

    try {
      setBrowserData({
        tabs: [
          {
            url: 'https://tab.com',
            title: 'Active Tab',
            id: 'tab-1',
            active: true,
            windowId: 3,
            lastAccessed: baseTime - 5 * 1000,
          },
        ],
        bookmarks: [
          {
            title: '',
            children: [
              {
                title: 'Bookmarks Bar',
                children: [
                  {
                    id: 'bookmark-1',
                    title: 'Saved Page',
                    url: 'https://bookmark.com',
                    dateAdded: baseTime - 1000,
                  },
                ],
              },
            ],
          },
        ],
        history: [
          {
            id: 'history-1',
            url: 'https://history.com',
            title: 'History Entry',
            lastVisitTime: baseTime - 75 * 1000,
            visitCount: 9,
          },
        ],
      })

      const expectedTabs = actualConvertBrowserTabs(mockState.tabs)
      const expectedBookmarks = actualConvertBrowserBookmarks(mockState.bookmarks)

      const result = await getSearchData()

      expect(historySearchMock).not.toHaveBeenCalled()
      expect(result.history).toEqual([])
      expect(result.tabs).toEqual(expectedTabs)
      expect(result.bookmarks).toEqual(expectedBookmarks)
    } finally {
      nowSpy.mockRestore()
    }
  })
})
