import { convertBrowserBookmarks, convertBrowserHistory, convertBrowserTabs } from '../helper/browserApi.js'
import { defaultOptions } from '../model/options.js'

export function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export function createTestExt(overrides = {}) {
  // Mock performance for Node environment
  const mockPerf = {
    mark: () => {},
    measure: () => {},
    clearMarks: () => {},
    clearMeasures: () => {},
    now: Date.now.bind(Date),
    getEntriesByName: () => [],
    getEntriesByType: () => [],
  }

  if (typeof performance === 'undefined') {
    global.performance = mockPerf
  } else {
    // Augment existing performance object if possible, otherwise override
    try {
      if (!performance.mark) performance.mark = mockPerf.mark
      if (!performance.measure) performance.measure = mockPerf.measure
    } catch (_) {
      global.performance = mockPerf
    }
  }
  globalThis.performance = global.performance
  if (typeof window !== 'undefined') window.performance = global.performance

  const base = {
    opts: { ...defaultOptions },
    model: {},
    index: { taxonomy: {} },
    dom: {},
    browserApi: {},
    initialized: false,
    searchCache: new Map(),
  }
  const ext = {
    ...base,
    ...overrides,
    opts: { ...base.opts, ...(overrides.opts || {}) },
    model: { ...base.model, ...(overrides.model || {}) },
    index: {
      taxonomy: {
        ...(base.index.taxonomy || {}),
        ...(overrides.index?.taxonomy || {}),
      },
    },
    dom: { ...base.dom, ...(overrides.dom || {}) },
    browserApi: { ...base.browserApi, ...(overrides.browserApi || {}) },
  }
  global.ext = ext
  if (typeof window !== 'undefined') {
    window.ext = ext
    if (typeof document !== 'undefined' && !document.getElementById('error-list')) {
      const errorContainer = document.createElement('div')
      errorContainer.id = 'error-list'
      errorContainer.style = 'display: none;'
      document.body.appendChild(errorContainer)
    }
  }
  return ext
}

export function clearTestExt() {
  // Clear any existing searchCache if it's a Map
  if (globalThis.ext?.searchCache && typeof globalThis.ext.searchCache.clear === 'function') {
    globalThis.ext.searchCache.clear()
  }
  if (typeof window !== 'undefined' && window.ext?.searchCache && typeof window.ext.searchCache.clear === 'function') {
    window.ext.searchCache.clear()
  }

  delete globalThis.ext
  if (typeof window !== 'undefined') {
    delete window.ext
  }

  // Note: fuzzy search state should be reset in individual test cleanup
}

/**
 * Internal: Wraps browser API conversion calls with basic ext setup
 */
function withExt(fn) {
  const originalExt = global.ext
  if (!global.ext || !global.ext.opts) {
    global.ext = { opts: { ...defaultOptions, detectDuplicateBookmarks: false } }
  }
  try {
    return fn()
  } finally {
    if (originalExt) global.ext = originalExt
  }
}

/**
 * Creates raw mock bookmarks (browser format)
 */
export function generateRawBookmarks(count) {
  const bookmarks = []
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000

  for (let i = 0; i < count; i++) {
    const dateAdded = now - Math.floor(Math.random() * 30 * oneDay)
    const title = `Bookmark ${i}: ${['Article about', 'Documentation for', 'GitHub Repo', 'Video Tutorial'][i % 4]} ${['React', 'JavaScript', 'Performance', 'Browsers', 'Testing'][i % 5]}`
    const domain = ['google.com', 'github.com', 'stackoverflow.com', 'developer.mozilla.org'][i % 4]

    bookmarks.push({
      id: `b${i}`,
      title,
      url: `https://${domain}/path/to/resource-${i}`,
      dateAdded,
    })
  }

  return [{ title: 'Root', children: [{ title: 'Folder A', children: bookmarks }] }]
}

/**
 * Creates raw mock history items (browser format)
 */
export function generateRawHistory(count) {
  const history = []
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000

  for (let i = 0; i < count; i++) {
    const lastVisitTime = now - Math.floor(Math.random() * 14 * oneDay)
    const title = `Historic Page ${i}: ${['Search results for', 'User profile on', 'Blog post about'][i % 3]} ${['Testing', 'Debugging', 'Web Development'][i % 3]}`

    history.push({
      id: `h${i}`,
      title,
      url: `https://history.example.org/v${i}`,
      lastVisitTime,
      visitCount: Math.floor(Math.random() * 50),
    })
  }
  return history
}

/**
 * Creates raw mock tabs (browser format)
 */
export function generateRawTabs(count) {
  const tabs = []
  const now = Date.now()

  for (let i = 0; i < count; i++) {
    const lastAccessed = now - Math.floor(Math.random() * 3 * 60 * 60 * 1000)

    tabs.push({
      id: i,
      title: `Open Tab ${i}: ${['Development Server', 'Issue Tracker', 'Email Inbox'][i % 3]}`,
      url: `https://tabs.internal/t/${i}`,
      active: i === 0,
      windowId: 1,
      lastAccessed,
    })
  }
  return tabs
}

/**
 * Standalone mock data generation (converts to internal format)
 * Use these for benchmarks or when you just need 'some data' in ext.model.
 */
export const generateBookmarksTestData = (count) => createBookmarksTestData(generateRawBookmarks(count))
export const generateHistoryTestData = (count) => createHistoryTestData(generateRawHistory(count))
export const generateTabsTestData = (count) => createTabsTestData(generateRawTabs(count))

/**
 * Conversion helpers for manual mock data
 */
export function createBookmarksTestData(rawData) {
  return withExt(() => {
    const tree = rawData.length === 1 && rawData[0].children ? rawData[0] : { title: 'Root', children: rawData }
    return convertBrowserBookmarks([tree])
  })
}

export function createTabsTestData(rawData) {
  return withExt(() => convertBrowserTabs(rawData))
}

export function createHistoryTestData(rawData) {
  return withExt(() => convertBrowserHistory(rawData))
}

/**
 * @deprecated Use create*TestData instead.
 */
export function createTestData(type, rawData) {
  const map = { bookmarks: createBookmarksTestData, tabs: createTabsTestData, history: createHistoryTestData }
  return map[type](rawData)
}
