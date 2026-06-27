import uFuzzy from '@leeoniya/ufuzzy'
import { browserApi, convertBrowserBookmarks, convertBrowserHistory, convertBrowserTabs } from '../helper/browserApi.js'
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

const { addDefaultEntries, search } = await import('../search/common.js')
const { resetSimpleSearchState, simpleSearch } = await import('../search/simpleSearch.js')
const { resetFuzzySearchState } = await import('../search/fuzzySearch.js')
const { calculateFinalScore } = await import('../search/scoring.js')
const { getSearchData } = await import('../model/searchData.js')

describe('REAL Fuzzy vs Precise Search Benchmark', () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  /**
   * Run a synchronous benchmark with warmup and averaged iterations.
   */
  const runSyncTiming = (fn, iterations = 10) => {
    for (let i = 0; i < 3; i++) {
      fn()
    }

    let total = 0
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      fn()
      total += performance.now() - start
    }
    return total / iterations
  }

  /**
   * Run an async benchmark with warmup and averaged iterations.
   */
  const runAsyncTiming = async (fn, iterations = 8, afterWarmup) => {
    for (let i = 0; i < 2; i++) {
      await fn()
    }
    afterWarmup?.()

    let total = 0
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fn()
      total += performance.now() - start
    }
    return total / iterations
  }

  /**
   * Create raw bookmark data with configurable tag density.
   */
  const generateTaggedRawBookmarks = (count, taggedRatio = 0, folderDepth = 1) => {
    const bookmarks = []
    const tagModulo = taggedRatio > 0 ? Math.max(1, Math.round(1 / taggedRatio)) : 0

    for (let i = 0; i < count; i++) {
      const tags = tagModulo && i % tagModulo === 0 ? ` #tag-${i % 10} #project-${i % 20}` : ''
      bookmarks.push({
        id: `tagged-${i}`,
        title: `Bookmark ${i}: Documentation for Resource ${i}${tags}`,
        url: `https://example.com/path/to/resource-${i}`,
        dateAdded: 1700000000000 - i * 60000,
      })
    }

    let children = bookmarks
    for (let depth = folderDepth; depth >= 1; depth--) {
      children = [
        {
          id: `folder-${depth}`,
          title: `Folder ${depth}`,
          children,
        },
      ]
    }

    return [{ title: 'Root', children: [{ title: 'Bookmarks Bar', children }] }]
  }

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

  /**
   * Run benchmarks at realistic user scale without the 50k+ stress emphasis.
   */
  const runRealisticBoundaryBenchmark = async () => {
    console.log('\n### Realistic Boundary Performance')
    console.log('\n| Scenario | Conversion | Precise Broad | Precise Selective | Scoring 1k |')
    console.log('|---|---|---|---|---|')

    const counts = [1000, 6000, 12000]
    for (const count of counts) {
      const rawBookmarks = generateRawBookmarks(count)
      const rawHistory = generateRawHistory(count)
      const rawTabs = generateRawTabs(Math.floor(count / 10))

      const conversionMs = runSyncTiming(() => {
        convertBrowserBookmarks(rawBookmarks)
        convertBrowserHistory(rawHistory)
        convertBrowserTabs(rawTabs)
      }, 8)

      const data = {
        bookmarks: convertBrowserBookmarks(rawBookmarks),
        history: convertBrowserHistory(rawHistory),
        tabs: convertBrowserTabs(rawTabs),
      }
      const broadMs = runSyncTiming(() => {
        resetSimpleSearchState()
        simpleSearchForBenchmark('resource', data)
      }, 8)
      const selectiveMs = runSyncTiming(() => {
        resetSimpleSearchState()
        simpleSearchForBenchmark('resource-123', data)
      }, 8)
      const scoringInput = data.bookmarks.slice(0, 1000).map((entry) => ({ ...entry, searchApproach: 'precise' }))
      const scoringMs = runSyncTiming(() => {
        calculateFinalScore(
          scoringInput.map((entry) => ({ ...entry })),
          'resource',
        )
      }, 8)

      const totalItems = count * 2 + Math.floor(count / 10)
      console.log(
        `| ${count} bookmarks + ${count} history (${totalItems} total) | ${conversionMs.toFixed(2)}ms | ${broadMs.toFixed(2)}ms | ${selectiveMs.toFixed(2)}ms | ${scoringMs.toFixed(2)}ms |`,
      )
    }
  }

  /**
   * Search directly through the precise path for core search timings.
   */
  const simpleSearchForBenchmark = (term, data) => {
    return simpleSearch('all', term, data)
  }

  /**
   * Run conversion benchmarks for tag-heavy and folder-heavy bookmark libraries.
   */
  const runConversionShapeBenchmark = async () => {
    console.log('\n### Conversion Shape Performance')
    console.log('\n| Scenario | Time (Avg) |')
    console.log('|---|---|')

    const scenarios = [
      ['No tags, shallow folders (6000 bookmarks)', generateTaggedRawBookmarks(6000, 0, 1)],
      ['25% tagged, shallow folders (6000 bookmarks)', generateTaggedRawBookmarks(6000, 0.25, 1)],
      ['100% tagged, shallow folders (6000 bookmarks)', generateTaggedRawBookmarks(6000, 1, 1)],
      ['No tags, deep folders (6000 bookmarks)', generateTaggedRawBookmarks(6000, 0, 6)],
      ['100% tagged, deep folders (6000 bookmarks)', generateTaggedRawBookmarks(6000, 1, 6)],
    ]

    for (const [label, rawBookmarks] of scenarios) {
      const avgMs = runSyncTiming(() => {
        convertBrowserBookmarks(rawBookmarks)
      }, 10)
      console.log(`| ${label} | ${avgMs.toFixed(2)}ms |`)
    }
  }

  /**
   * Run popup search benchmarks for result limits and render/highlight settings.
   */
  const runSearchOptionsBenchmark = async () => {
    console.log('\n### Search Option Rendering Performance')
    console.log('\n| Scenario | Time (Avg) |')
    console.log('|---|---|')

    ext.model.bookmarks = convertBrowserBookmarks(generateTaggedRawBookmarks(6000, 1, 3))
    ext.model.history = convertBrowserHistory(generateRawHistory(6000))
    ext.model.tabs = convertBrowserTabs(generateRawTabs(600))
    ext.initialized = true
    ext.dom.searchInput.value = 'resource'
    ext.opts.searchStrategy = 'precise'
    ext.opts.enableSearchEngines = false
    ext.opts.customSearchEngines = []
    ext.opts.enableDirectUrl = false

    const scenarios = [
      ['Max 24, no highlights/badges', { max: 24, highlight: false, tags: false, folders: false, score: false }],
      ['Max 100, no highlights/badges', { max: 100, highlight: false, tags: false, folders: false, score: false }],
      ['Max 250, no highlights/badges', { max: 250, highlight: false, tags: false, folders: false, score: false }],
      ['Max 24, highlights and badges', { max: 24, highlight: true, tags: true, folders: true, score: true }],
      ['Max 100, highlights and badges', { max: 100, highlight: true, tags: true, folders: true, score: true }],
    ]

    for (const [label, config] of scenarios) {
      const avgMs = await runAsyncTiming(async () => {
        ext.opts.searchMaxResults = config.max
        ext.opts.displaySearchMatchHighlight = config.highlight
        ext.opts.displayTags = config.tags
        ext.opts.displayFolderName = config.folders
        ext.opts.displayScore = config.score
        ext.searchCache = new Map()
        resetSimpleSearchState()
        await search()
      }, 8)
      console.log(`| ${label} | ${avgMs.toFixed(2)}ms |`)
    }
  }

  /**
   * Run startup/default-result benchmarks with explicit API latency.
   */
  const runStartupPathBenchmark = async () => {
    console.log('\n### Startup Stage Performance')
    console.log('\n| Scenario | Total | API Wall | Post-API Work |')
    console.log('|---|---|---|---|')

    const originalTabs = browserApi.tabs
    const originalBookmarks = browserApi.bookmarks
    const originalHistory = browserApi.history
    const originalTabGroups = browserApi.tabGroups
    const rawTabs = generateRawTabs(600)
    const rawBookmarks = generateRawBookmarks(6000)
    const rawHistory = generateRawHistory(6000)

    try {
      const apiDelayMs = 2
      let apiWallMs = 0

      const timedApi =
        (fn) =>
        async (...args) => {
          const start = performance.now()
          await sleep(apiDelayMs)
          const result = fn(...args)
          apiWallMs = Math.max(apiWallMs, performance.now() - start)
          return result
        }

      browserApi.tabs = { query: timedApi(() => rawTabs) }
      browserApi.bookmarks = { getTree: timedApi(() => rawBookmarks) }
      browserApi.history = { search: timedApi(() => rawHistory) }
      browserApi.tabGroups = { query: timedApi(() => []) }
      ext.opts.enableTabs = true
      ext.opts.enableBookmarks = true
      ext.opts.enableHistory = true

      for (let i = 0; i < 2; i++) {
        apiWallMs = 0
        await getSearchData()
      }

      let totalMs = 0
      let totalApiWallMs = 0
      const iterations = 5
      for (let i = 0; i < iterations; i++) {
        apiWallMs = 0
        const start = performance.now()
        await getSearchData()
        totalMs += performance.now() - start
        totalApiWallMs += apiWallMs
      }
      const avgTotalMs = totalMs / iterations
      const avgApiWallMs = totalApiWallMs / iterations
      const postApiMs = Math.max(0, avgTotalMs - avgApiWallMs)

      console.log(
        `| getSearchData, 6000 bookmarks + 6000 history, ${apiDelayMs}ms API delay | ${avgTotalMs.toFixed(2)}ms | ${avgApiWallMs.toFixed(2)}ms | ${postApiMs.toFixed(2)}ms |`,
      )
    } finally {
      browserApi.tabs = originalTabs
      browserApi.bookmarks = originalBookmarks
      browserApi.history = originalHistory
      browserApi.tabGroups = originalTabGroups
    }
  }

  /**
   * Run default empty-popup benchmarks for active-tab lookup paths.
   */
  const runDefaultResultsStartupBenchmark = async () => {
    console.log('\n### Default Results Startup Performance')
    console.log('\n| Scenario | Time (Avg) | Tab API Calls/Run |')
    console.log('|---|---|---|')

    const originalTabs = browserApi.tabs
    try {
      let tabApiCalls = 0
      browserApi.tabs = {
        query: async () => {
          tabApiCalls += 1
          await sleep(2)
          return [{ id: 20, title: 'Queried Active Tab', url: 'https://current-window.test' }]
        },
      }
      ext.opts.maxRecentTabsToShow = 0
      ext.model.searchMode = 'all'
      ext.model.bookmarks = [
        { id: 1, url: 'single-active.test', originalUrl: 'https://single-active.test', title: 'Single Active' },
        { id: 2, url: 'current-window.test', originalUrl: 'https://current-window.test', title: 'Current Window' },
      ]

      const measuredIterations = 8

      tabApiCalls = 0
      const unambiguousMs = await runAsyncTiming(
        async () => {
          ext.model.tabs = [
            {
              originalId: 10,
              active: true,
              title: 'Loaded Active Tab',
              url: 'single-active.test',
              originalUrl: 'https://single-active.test',
            },
          ]
          await addDefaultEntries()
        },
        measuredIterations,
        () => {
          tabApiCalls = 0
        },
      )
      console.log(
        `| One loaded active tab | ${unambiguousMs.toFixed(2)}ms | ${(tabApiCalls / measuredIterations).toFixed(2)} |`,
      )

      tabApiCalls = 0
      const ambiguousMs = await runAsyncTiming(
        async () => {
          ext.model.tabs = [
            { originalId: 10, active: true, url: 'other-window.test', originalUrl: 'https://other-window.test' },
            { originalId: 20, active: true, url: 'current-window.test', originalUrl: 'https://current-window.test' },
          ]
          await addDefaultEntries()
        },
        measuredIterations,
        () => {
          tabApiCalls = 0
        },
      )
      console.log(
        `| Multiple loaded active tabs, API fallback | ${ambiguousMs.toFixed(2)}ms | ${(tabApiCalls / measuredIterations).toFixed(2)} |`,
      )
    } finally {
      browserApi.tabs = originalTabs
    }
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

    await runRealisticBoundaryBenchmark()
    await runConversionShapeBenchmark()
    await runSearchOptionsBenchmark()
    await runStartupPathBenchmark()
    await runDefaultResultsStartupBenchmark()
  }, 30000)
})
