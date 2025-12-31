import { jest } from '@jest/globals'
import { createTestExt, generateRawBookmarks, generateRawHistory, generateRawTabs } from './testUtils.js'

// Mock chrome before imports
const mockBookmarks = generateRawBookmarks(5000)
const mockHistory = generateRawHistory(2000)
const mockTabs = generateRawTabs(100)

const mockChrome = {
  tabs: {
    query: jest.fn().mockResolvedValue(mockTabs),
  },
  bookmarks: {
    getTree: jest.fn().mockResolvedValue(mockBookmarks),
  },
  history: {
    search: jest.fn().mockResolvedValue(mockHistory),
  },
  storage: {
    sync: {
      get: jest.fn((_keys, cb) => cb({ userOptions: {} })),
    },
  },
  runtime: {
    lastError: null,
  },
}

global.chrome = mockChrome
global.window = global
global.window.chrome = mockChrome

/** setup DOM */
document.body.innerHTML = `
  <div id="container">
    <input id="search-input" value="" />
    <ul id="result-list"></ul>
    <div id="result-counter"></div>
    <ul id="error-list"></ul>
    <div id="search-approach-toggle"></div>
  </div>
`

// Initialize extension context
createTestExt({
  opts: {
    enableTabs: true,
    enableBookmarks: true,
    enableHistory: true,
    historyMaxItems: 2000,
  },
  dom: {
    searchInput: document.getElementById('search-input'),
    resultList: document.getElementById('result-list'),
    resultCounter: document.getElementById('result-counter'),
  },
  browserApi: mockChrome,
  initialized: true,
})

const { getSearchData } = await import('../model/searchData.js')
const { search } = await import('../search/common.js')

describe('Performance Benchmarks', () => {
  beforeAll(async () => {
    // Pre-load data into the model
    const data = await getSearchData()
    ext.model.bookmarks = data.bookmarks
    ext.model.history = data.history
    ext.model.tabs = data.tabs
  })

  test('Search Performance - Precise Strategy (5000 items)', async () => {
    ext.opts.searchStrategy = 'precise'
    ext.dom.searchInput.value = 'resource-123'

    const start = performance.now()
    await search()
    const end = performance.now()

    const duration = end - start
    console.log(`Precise Search ("resource-123") took: ${duration.toFixed(2)}ms`)

    expect(duration).toBeLessThan(100)
    expect(ext.model.result.length).toBeGreaterThan(0)
  })

  test('Search Performance - Fuzzy Strategy (5000 items)', async () => {
    // Mock uFuzzy if not present
    if (!global.uFuzzy) {
      global.uFuzzy = class {
        constructor() {
          this.filter = (h, _t) => h.map((_, i) => i)
          this.info = (idxs, _h, _t) => ({
            idx: idxs,
            intraIns: new Array(idxs.length).fill(0),
            ranges: new Array(idxs.length).fill([]),
          })
        }
      }
      global.uFuzzy.highlight = (h, _r, cb) => {
        if (typeof cb === 'function') {
          return cb(h, true)
        }
        return h
      }
    }

    ext.opts.searchStrategy = 'fuzzy'
    ext.dom.searchInput.value = 'resrc 123'

    const start = performance.now()
    await search()
    const end = performance.now()

    const duration = end - start
    console.log(`Fuzzy Search ("resrc 123") took: ${duration.toFixed(2)}ms`)

    expect(duration).toBeLessThan(200)
    expect(ext.model.result.length).toBeGreaterThan(0)
  })
})
