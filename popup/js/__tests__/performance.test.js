import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { before, describe, mock, test } from 'node:test'
import { createTestExt, generateRawBookmarks, generateRawHistory, generateRawTabs } from './testUtils.js'

// Mock chrome before imports
const mockBookmarks = generateRawBookmarks(5000)
const mockHistory = generateRawHistory(2000)
const mockTabs = generateRawTabs(100)
const mockChrome = {
  tabs: {
    query: mock.fn(() => Promise.resolve(mockTabs)),
  },
  bookmarks: {
    getTree: mock.fn(() => Promise.resolve(mockBookmarks)),
  },
  history: {
    search: mock.fn(() => Promise.resolve(mockHistory)),
  },
  storage: {
    sync: {
      get: mock.fn((_keys, cb) => cb({ userOptions: {} })),
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
    <input id="q" value="" />
    <ul id="results"></ul>
    <div id="counter"></div>
    <ul id="errors"></ul>
    <div id="toggle"></div>
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
    searchInput: document.getElementById('q'),
    resultList: document.getElementById('results'),
    resultCounter: document.getElementById('counter'),
  },
  browserApi: mockChrome,
  initialized: true,
})
const { getSearchData } = await import('../model/searchData.js')
const { search } = await import('../search/common.js')
// Warm up the runtime, then average uncached searches including DOM rendering.
async function measureSearch() {
  for (let i = 0; i < 2; i++) {
    ext.searchCache.clear()
    await search()
  }
  let total = 0
  for (let i = 0; i < 8; i++) {
    ext.searchCache.clear()
    const start = performance.now()
    await search()
    total += performance.now() - start
  }
  return total / 8
}
describe('Performance Benchmarks', () => {
  before(async () => {
    // Pre-load data into the model
    const data = await getSearchData()
    ext.model.bookmarks = data.bookmarks
    ext.model.history = data.history
    ext.model.tabs = data.tabs
    assert.strictEqual(data.bookmarks.length, 5000)
    assert.strictEqual(data.tabs.length, 100)
  })
  test('Search Performance - Precise Strategy (5000 items)', async () => {
    ext.opts.searchStrategy = 'precise'
    ext.dom.searchInput.value = 'resource-123'
    const duration = await measureSearch()
    console.log(`Precise Search ("resource-123") took: ${duration.toFixed(2)}ms`)
    assert(duration < 100)
    assert(ext.model.result.length > 0)
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
    const duration = await measureSearch()
    console.log(`Fuzzy Search ("resrc 123") took: ${duration.toFixed(2)}ms`)
    assert(duration < 200)
    assert(ext.model.result.length > 0)
  })
})
