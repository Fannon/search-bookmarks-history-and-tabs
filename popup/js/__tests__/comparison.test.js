import uFuzzy from '@leeoniya/ufuzzy'
import { createTestExt, generateBookmarksTestData, generateHistoryTestData, generateTabsTestData } from './testUtils.js'

// Assign to global so the extension code picks it up
global.uFuzzy = uFuzzy

/** setup DOM */
document.body.innerHTML = `
  <div id="container"><input id="search-input" value="" /><ul id="result-list"></ul></div>
`

// Create ext immediately
createTestExt({
  dom: {
    searchInput: document.getElementById('search-input'),
    resultList: document.getElementById('result-list'),
  },
})

const { search } = await import('../search/common.js')
const { resetSimpleSearchState } = await import('../search/simpleSearch.js')
const { resetFuzzySearchState } = await import('../search/fuzzySearch.js')

describe('REAL Fuzzy vs Precise Search Benchmark', () => {
  /**
   * Run a cold-start benchmark - no pre-warming, measures first-run performance
   */
  const runColdStartBenchmark = async (count) => {
    // Reset all caches to simulate cold start
    resetSimpleSearchState()
    resetFuzzySearchState()

    ext.model.bookmarks = generateBookmarksTestData(count)
    ext.model.history = generateHistoryTestData(count)
    ext.model.tabs = generateTabsTestData(Math.floor(count / 10))
    ext.initialized = true

    const totalItems = ext.model.bookmarks.length + ext.model.history.length + ext.model.tabs.length

    // Cold Precise - first run ever
    ext.searchCache = new Map()
    ext.opts.searchStrategy = 'precise'
    ext.dom.searchInput.value = 'resource'
    const startP = performance.now()
    await search()
    const coldP = performance.now() - startP

    // Reset for fair cold-start of fuzzy
    resetSimpleSearchState()
    resetFuzzySearchState()
    ext.model.bookmarks = generateBookmarksTestData(count)
    ext.model.history = generateHistoryTestData(count)
    ext.model.tabs = generateTabsTestData(Math.floor(count / 10))

    // Cold Fuzzy - first run ever
    ext.searchCache = new Map()
    ext.opts.searchStrategy = 'fuzzy'
    ext.dom.searchInput.value = 'resourc'
    const startF = performance.now()
    await search()
    const coldF = performance.now() - startF

    console.log(`| Cold Start (${totalItems} items) | ${coldP.toFixed(2)}ms | ${coldF.toFixed(2)}ms |`)
  }

  /**
   * Run a warmed-up benchmark with multiple iterations
   */
  const runBenchmark = async (sizeName, count, iterations = 10) => {
    // Reset state before each benchmark size to ensure we use the correct data size
    resetSimpleSearchState()
    resetFuzzySearchState()

    ext.model.bookmarks = generateBookmarksTestData(count)
    ext.model.history = generateHistoryTestData(count)
    ext.model.tabs = generateTabsTestData(Math.floor(count / 10))
    ext.initialized = true

    const totalItems = ext.model.bookmarks.length + ext.model.history.length + ext.model.tabs.length

    // Pre-warmup: run both strategies once to ensure JIT compilation and cache init
    ext.searchCache = new Map()
    ext.opts.searchStrategy = 'precise'
    ext.dom.searchInput.value = 'warmup'
    await search()

    ext.searchCache = new Map()
    ext.opts.searchStrategy = 'fuzzy'
    ext.dom.searchInput.value = 'warmup'
    await search()

    // Precise
    let totalP = 0
    for (let i = 0; i < iterations; i++) {
      ext.searchCache = new Map()
      ext.opts.searchStrategy = 'precise'
      ext.dom.searchInput.value = 'resource'
      const start = performance.now()
      await search()
      totalP += performance.now() - start
    }
    const avgP = totalP / iterations

    // Fuzzy
    let totalF = 0
    for (let i = 0; i < iterations; i++) {
      ext.searchCache = new Map()
      ext.opts.searchStrategy = 'fuzzy'
      ext.dom.searchInput.value = 'resourc'
      const start = performance.now()
      await search()
      totalF += performance.now() - start
    }
    const avgF = totalF / iterations

    console.log(`| ${sizeName} (${totalItems} items) | ${avgP.toFixed(2)}ms | ${avgF.toFixed(2)}ms |`)
  }

  test('Benchmark Matrix', async () => {
    console.log('\n| Data Set Size | Precise Search (Avg) | Fuzzy Search (Avg) |')
    console.log('|---|---|---|')

    // Cold start benchmark - runs first before any warming
    await runColdStartBenchmark(200)

    // Warmed benchmarks
    await runBenchmark('Tiny', 100, 5)
    await runBenchmark('Small', 200)
    await runBenchmark('Medium', 2000)
    await runBenchmark('Big', 10000)
  })
})
