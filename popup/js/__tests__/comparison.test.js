import uFuzzy from '@leeoniya/ufuzzy'
import { convertBrowserBookmarks, convertBrowserHistory, convertBrowserTabs } from '../helper/browserApi.js'
import {
  createTestExt,
  generateBookmarksTestData,
  generateHistoryTestData,
  generateRawBookmarks,
  generateRawHistory,
  generateRawTabs,
  generateTabsTestData,
} from './testUtils.js'

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
const { calculateFinalScore } = await import('../search/scoring.js')

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

    const _totalItems = ext.model.bookmarks.length + ext.model.history.length + ext.model.tabs.length

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
      console.log(`| ${sizeName} | ${avgP.toFixed(2)}ms | ${avgF.toFixed(2)}ms |`)
    }
  }

  /**
   * Run a realistic incremental typing benchmark
   * Simulates a user typing a phrase character by character
   */
  const runIncrementalBenchmark = async (count, iterations = 5, label = '') => {
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

    const scenarioLabel = label || `Incremental Typing (${count * 2 + Math.floor(count / 10)} items)`
    console.log(`| ${scenarioLabel} | ${avgP.toFixed(2)}ms | ${avgF.toFixed(2)}ms |`)
  }

  /**
   * Run data loading/conversion benchmarks
   * Measures time spent converting raw browser data to internal format
   */
  const runDataLoadingBenchmark = async (count, iterations = 5, label = '') => {
    const rawBookmarks = generateRawBookmarks(count)
    const rawHistory = generateRawHistory(count)
    const rawTabs = generateRawTabs(Math.floor(count / 10))

    let totalTime = 0
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      convertBrowserBookmarks(rawBookmarks)
      convertBrowserHistory(rawHistory)
      convertBrowserTabs(rawTabs)
      totalTime += performance.now() - start
    }

    const avgTime = totalTime / iterations
    const scenarioLabel = label || `${count} items`
    console.log(`| ${scenarioLabel} | ${avgTime.toFixed(2)}ms |`)
  }

  /**
   * Run scoring algorithm benchmarks
   * Measures time spent calculating final scores for search results
   */
  const runScoringBenchmark = async (count, iterations = 10, label = '') => {
    // Generate mock search results
    const results = []
    for (let i = 0; i < count; i++) {
      results.push({
        type: 'bookmark',
        title: `Test Result ${i}: JavaScript Performance Optimization`,
        titleLower: `test result ${i}: javascript performance optimization`,
        url: `example.com/path/to/resource-${i}`,
        originalUrl: `https://example.com/path/to/resource-${i}`,
        originalId: `b${i}`,
        tags: '#javascript #performance',
        tagsLower: '#javascript #performance',
        tagsArray: ['javascript', 'performance'],
        tagsArrayLower: ['javascript', 'performance'],
        folder: '~Dev ~Resources',
        folderLower: '~dev ~resources',
        folderArray: ['Dev', 'Resources'],
        folderArrayLower: ['dev', 'resources'],
        searchScore: 0.8 + Math.random() * 0.2,
        visitCount: Math.floor(Math.random() * 50),
        lastVisitSecondsAgo: Math.floor(Math.random() * 86400 * 7),
        customBonusScore: i % 10 === 0 ? 5 : 0,
      })
    }

    let totalTime = 0
    for (let i = 0; i < iterations; i++) {
      // Clone results to prevent mutation between iterations
      const clonedResults = results.map((r) => ({ ...r }))
      const start = performance.now()
      calculateFinalScore(clonedResults, 'javascript performance')
      totalTime += performance.now() - start
    }

    const avgTime = totalTime / iterations
    const scenarioLabel = label || `${count} results`
    console.log(`| ${scenarioLabel} | ${avgTime.toFixed(2)}ms |`)
  }

  test('Benchmark Matrix', async () => {
    // Data Loading Benchmarks
    console.log('\n### Data Loading/Conversion Performance')
    console.log('\n| Dataset Size | Time (Avg) |')
    console.log('|---|---|')

    await runDataLoadingBenchmark(100, 10, 'Tiny (210 items)')
    await runDataLoadingBenchmark(1000, 10, 'Small (2100 items)')
    await runDataLoadingBenchmark(5000, 5, 'Medium (10500 items)')
    await runDataLoadingBenchmark(25000, 3, 'Large (52500 items)')

    // Scoring Benchmark
    console.log('\n### Scoring Algorithm Performance')
    console.log('\n| Result Count | Time (Avg) |')
    console.log('|---|---|')

    await runScoringBenchmark(500, 20, 'Small (500 results)')
    await runScoringBenchmark(3000, 10, 'Medium (3000 results)')
    await runScoringBenchmark(20000, 5, 'Large (20000 results)')

    // Cold start benchmark
    await runColdStartBenchmark(1000)

    // Warmed benchmarks
    // Pre-warm the JIT with a significant run before recording
    await runBenchmark('Warmup', 1000, 50, true)

    console.log('\n### Single-Query Search Performance')
    console.log('\n| Dataset Size | Precise (Avg) | Fuzzy (Avg) |')
    console.log('|---|---|---|')

    await runBenchmark('Tiny (210 items)', 100)
    await runBenchmark('Small (2100 items)', 1000)
    await runBenchmark('Medium (6300 items)', 3000)
    await runBenchmark('Huge (52500 items)', 25000)

    console.log('\n### Incremental Typing Performance')
    console.log('\n| Dataset Size | Precise (Total) | Fuzzy (Total) |')
    console.log('|---|---|---|')

    await runIncrementalBenchmark(500, 5, 'Small (1050 items)')
    await runIncrementalBenchmark(2500, 5, 'Medium (5250 items)')
    await runIncrementalBenchmark(5000, 5, 'Large (10500 items)')
  })
})
