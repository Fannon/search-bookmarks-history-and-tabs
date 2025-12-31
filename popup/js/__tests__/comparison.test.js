import uFuzzy from '@leeoniya/ufuzzy'
import { createTestExt, generateMockBookmarks, generateMockHistory, generateMockTabs } from './testUtils.js'

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

const { convertBrowserBookmarks, convertBrowserHistory, convertBrowserTabs } = await import('../helper/browserApi.js')
const { search } = await import('../search/common.js')

describe('REAL Fuzzy vs Precise Search Benchmark', () => {
  const runBenchmark = async (sizeName, count, iterations = 10) => {
    const rawBookmarks = generateMockBookmarks(count)
    const rawHistory = generateMockHistory(count)
    const rawTabs = generateMockTabs(Math.floor(count / 10))

    ext.model.bookmarks = convertBrowserBookmarks(rawBookmarks)
    ext.model.history = convertBrowserHistory(rawHistory)
    ext.model.tabs = convertBrowserTabs(rawTabs)
    ext.initialized = true

    const totalItems = ext.model.bookmarks.length + ext.model.history.length + ext.model.tabs.length

    // Precise
    let totalP = 0
    for (let i = 0; i < iterations; i++) {
      ext.searchCache = new Map()
      ext.opts.searchStrategy = 'precise'
      // Use different search terms to avoid any hidden engine-level path optimizations
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
      ext.dom.searchInput.value = 'resourc' // fuzzy should handle this
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

    // Warmup
    await runBenchmark('Warmup', 100, 5)

    await runBenchmark('Small', 200)
    await runBenchmark('Medium', 2000)
    await runBenchmark('Big', 10000)
  })
})
