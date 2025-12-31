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
  const runBenchmark = async (sizeName, count, iterations = 50, silent = false) => {
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
    ext.dom.searchInput.value = 'resource'
    await search()

    ext.searchCache = new Map()
    ext.opts.searchStrategy = 'fuzzy'
    ext.dom.searchInput.value = 'resourc'
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

    if (!silent) {
      console.log(`| ${sizeName} (${totalItems} items) | ${avgP.toFixed(2)}ms | ${avgF.toFixed(2)}ms |`)
    }
  }

  /**
   * Run a realistic incremental typing benchmark
   * Simulates a user typing a phrase character by character
   */
  const runIncrementalBenchmark = async (count, iterations = 5) => {
    // Reset all caches
    resetSimpleSearchState()
    resetFuzzySearchState()

    ext.model.bookmarks = generateBookmarksTestData(count)
    ext.model.history = generateHistoryTestData(count)
    ext.model.tabs = generateTabsTestData(Math.floor(count / 10))
    ext.initialized = true

    const phrase = 'resource google '
    const steps = []
    for (let i = 1; i <= phrase.length; i++) {
      steps.push(phrase.substring(0, i))
    }

    // Precise - reset state between iterations to measure cold incremental
    ext.opts.searchStrategy = 'precise'
    let totalP = 0
    for (let i = 0; i < iterations; i++) {
      resetSimpleSearchState()
      ext.searchCache = new Map()
      const start = performance.now()
      for (const step of steps) {
        ext.dom.searchInput.value = step
        await search()
      }
      totalP += performance.now() - start
    }
    const avgP = totalP / iterations

    // Fuzzy - reset state between iterations to measure cold incremental
    ext.opts.searchStrategy = 'fuzzy'
    let totalF = 0
    for (let i = 0; i < iterations; i++) {
      resetFuzzySearchState()
      ext.searchCache = new Map()
      const start = performance.now()
      for (const step of steps) {
        ext.dom.searchInput.value = step
        await search()
      }
      totalF += performance.now() - start
    }
    const avgF = totalF / iterations

    console.log(`| Incremental Typing ("${phrase}") | ${avgP.toFixed(2)}ms | ${avgF.toFixed(2)}ms |`)
  }

  test('Benchmark Matrix', async () => {
    // Cold start benchmark - runs first before any warming
    await runColdStartBenchmark(1000)

    // Warmed benchmarks
    // Pre-warm the JIT with a significant run before recording
    await runBenchmark('Warmup', 1000, 50, true)

    console.log('\n| Data Set Size | Precise Search (Avg) | Fuzzy Search (Avg) |')
    console.log('|---|---|---|')

    await runBenchmark('Tiny', 100)
    await runBenchmark('Small', 1000)
    await runBenchmark('Medium', 3000)
    await runBenchmark('Huge', 25000)

    console.log('\n### Realistic Interaction Patterns')
    console.log('\n| Scenario | Precise (Total) | Fuzzy (Total) |')
    console.log('|---|---|---|')
    await runIncrementalBenchmark(5000)
  })
})
