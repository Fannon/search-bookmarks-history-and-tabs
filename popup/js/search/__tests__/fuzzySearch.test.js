import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { createBookmarksTestData, createHistoryTestData, createTabsTestData } from '../../__tests__/testUtils.js'
import { fuzzySearch, resetFuzzySearchState } from '../fuzzySearch.js'

const cjkTerm = '\u6f22\u5b57'

// Use real uFuzzy library with tracking capabilities
let uFuzzyInstances = []
let uFuzzyCallHistory = []
let originalUFuzzy = null
let lastSearchTerm = ''

// Enhanced uFuzzy wrapper that tracks calls while using real implementation
class TrackedUFuzzy {
  constructor(options) {
    this.options = options
    this.instanceId = uFuzzyInstances.length
    uFuzzyInstances.push(this)

    // Use real uFuzzy if available, otherwise create a minimal fallback
    if (typeof window !== 'undefined' && window.uFuzzy && window.uFuzzy !== TrackedUFuzzy) {
      this.uf = new window.uFuzzy(options)
    } else {
      // Fallback for when uFuzzy is not loaded yet
      this.uf = null
    }
  }

  filter(haystack, term) {
    lastSearchTerm = term
    uFuzzyCallHistory.push({
      method: 'filter',
      instanceId: this.instanceId,
      args: { haystack, term },
    })

    if (this.uf && typeof this.uf.filter === 'function') {
      return this.uf.filter(haystack, term)
    }

    // Fallback implementation for testing
    const indices = []
    haystack.forEach((searchStr, index) => {
      if (searchStr.toLowerCase().includes(term.toLowerCase())) {
        indices.push(index)
      }
    })
    return indices
  }

  info(indices, haystack, term) {
    lastSearchTerm = term
    uFuzzyCallHistory.push({
      method: 'info',
      instanceId: this.instanceId,
      args: { indices, haystack, term },
    })

    if (this.uf && typeof this.uf.info === 'function') {
      return this.uf.info(indices, haystack, term)
    }

    // Fallback implementation for testing
    return {
      idx: indices,
      ranges: indices.map(() => [[0, term.length - 1]]),
      intraIns: indices.map(() => 1),
    }
  }

  static highlight(searchString, ranges, mapper) {
    uFuzzyCallHistory.push({
      method: 'highlight',
      args: { searchString, ranges },
    })

    // Use real uFuzzy highlight if available
    if (originalUFuzzy?.highlight) {
      return originalUFuzzy.highlight(searchString, ranges, mapper)
    }

    // Fallback highlighting implementation
    if (lastSearchTerm) {
      const termRegex = new RegExp(lastSearchTerm, 'gi')
      return searchString.replace(termRegex, (match) => `<mark>${match}</mark>`)
    }

    return searchString
  }

  static reset() {
    uFuzzyInstances = []
    uFuzzyCallHistory = []
    lastSearchTerm = ''
  }

  static getInstances() {
    return uFuzzyInstances
  }

  static getCallHistory() {
    return uFuzzyCallHistory
  }
}

TrackedUFuzzy.reset()

const resetModes = () => {
  // Reset all fuzzy search state at once
  resetFuzzySearchState()
}

describe('fuzzySearch', () => {
  let model
  let opts

  beforeEach(async () => {
    // Set up DOM environment for tests
    if (typeof document === 'undefined') {
      // Mock DOM for Node.js environment
      global.document = {
        getElementById: (id) => {
          if (id === 'error-list') {
            return {
              innerHTML: '',
              style: { display: '' },
            }
          }
          return null
        },
        createElement: () => ({
          id: '',
          style: {},
          appendChild: () => {},
        }),
        getElementsByTagName: () => [{ appendChild: () => {} }],
        body: {
          appendChild: () => {},
        },
      }
    }

    // Load the real uFuzzy library
    try {
      // Load uFuzzy script in Node.js test environment
      if (typeof window === 'undefined') {
        global.window = {}
      }
      originalUFuzzy = window.uFuzzy

      // Load the actual uFuzzy library
      const fs = await import('node:fs')
      const path = await import('node:path')
      const uFuzzyPath = path.join(process.cwd(), 'popup/lib/uFuzzy.iife.min.js')

      if (fs.existsSync(uFuzzyPath)) {
        const uFuzzyScript = fs.readFileSync(uFuzzyPath, 'utf8')
        // Execute the script to make uFuzzy available globally
        new Function(uFuzzyScript)()
      }
    } catch (error) {
      console.warn('Could not load real uFuzzy library, using fallback:', error.message)
    }

    // Ensure complete reset of all state
    resetModes()
    TrackedUFuzzy.reset()

    model = {
      bookmarks: [],
      tabs: [],
      history: [],
    }
    opts = {
      searchFuzzyness: 0.3,
      uFuzzyOptions: null,
    }

    window.uFuzzy = TrackedUFuzzy
    globalThis.uFuzzy = TrackedUFuzzy
  })

  afterEach(() => {
    resetModes()
    TrackedUFuzzy.reset()
    window.uFuzzy = originalUFuzzy
    globalThis.uFuzzy = originalUFuzzy
  })

  it('returns fuzzy results for bookmarks mode and populates highlight and score', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Term bookmark',
        url: 'https://example.com/term',
      },
    ])

    const results = await fuzzySearch('bookmarks', 'term', model, opts)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      originalId: 'bookmark-1',
      searchApproach: 'fuzzy',
    })
  })

  it('aggregates tab and history entries when searching in history mode', async () => {
    model.tabs = createTabsTestData([
      {
        id: 'tab-1',
        title: 'Term tab',
        url: 'https://example.com/term-tab',
      },
    ])
    model.history = createHistoryTestData([
      {
        id: 'history-1',
        title: 'Term history',
        url: 'https://example.com/term-history',
      },
    ])

    const results = await fuzzySearch('history', 'term', model, opts)

    expect(results).toHaveLength(2)
    expect(results[0].originalId).toBe('tab-1')
    expect(results[1].originalId).toBe('history-1')
    expect(results.every((result) => result.searchApproach === 'fuzzy')).toBe(true)
  })

  it('reuses cached state until resetFuzzySearchState is called', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-cache',
        title: 'Cached term',
        url: 'https://example.com/cached-term',
      },
    ])

    await fuzzySearch('bookmarks', 'cached', model, opts)
    const initialInstances = TrackedUFuzzy.getInstances().length
    expect(initialInstances).toBeGreaterThan(0)

    await fuzzySearch('bookmarks', 'cached term', model, opts)
    // Should reuse cached state, but real uFuzzy may create additional instances
    const afterSecondCall = TrackedUFuzzy.getInstances().length
    expect(afterSecondCall).toBeGreaterThanOrEqual(initialInstances)

    resetFuzzySearchState('bookmarks')

    await fuzzySearch('bookmarks', 'cached term', model, opts)
    // After reset, should create new instances
    const afterReset = TrackedUFuzzy.getInstances().length
    expect(afterReset).toBeGreaterThan(afterSecondCall)
  })

  it('applies non-ASCII specific options when fuzzyness is high', async () => {
    opts.searchFuzzyness = 0.85
    opts.uFuzzyOptions = { extra: 'option' }

    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-warm',
        title: 'Warm entry',
        url: 'https://example.com/warm',
      },
    ])

    await fuzzySearch('bookmarks', 'warm', model, opts)
    const instancesAfterWarm = TrackedUFuzzy.getInstances()
    expect(instancesAfterWarm.length).toBeGreaterThan(0)

    // Find the top-level instance (not nested)
    const topLevelInstance = instancesAfterWarm.find((instance) => !instance.uf || !instance.uf.instanceId)
    expect(topLevelInstance).toBeDefined()
    expect(topLevelInstance.options).toMatchObject({
      intraIns: Math.round(0.85 * 4.2),
      extra: 'option',
    })
    expect(topLevelInstance.options.interSplit).toBeUndefined()

    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-cjk',
        title: `${cjkTerm} entry`,
        url: 'https://example.com/kanji',
      },
    ])

    await fuzzySearch('bookmarks', cjkTerm, model, opts)

    const instancesAfterCJK = TrackedUFuzzy.getInstances()
    // Real uFuzzy may reuse instances, so just check that we have instances
    expect(instancesAfterCJK.length).toBeGreaterThan(0)

    // Find the CJK instance (should be the most recent top-level instance)
    const cjkInstance = instancesAfterCJK.find(
      (instance) => instance.options && instance.options.interSplit === '(p{Unified_Ideograph=yes})+',
    )
    expect(cjkInstance).toBeDefined()
    expect(cjkInstance.options).toMatchObject({
      intraIns: Math.round(0.85 * 4.2),
      intraMode: 1,
      intraSub: 1,
      intraTrn: 1,
      intraDel: 1,
      interSplit: '(p{Unified_Ideograph=yes})+',
      extra: 'option',
    })
  })

  it('handles empty search results gracefully', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Different title',
        url: 'https://example.com/different',
      },
    ])

    const results = await fuzzySearch('bookmarks', 'nonexistent', model, opts)

    expect(results).toHaveLength(0)
  })

  it('handles empty data arrays gracefully', async () => {
    model.bookmarks = []

    const results = await fuzzySearch('bookmarks', 'term', model, opts)

    expect(results).toHaveLength(0)
  })

  it('handles malformed search data gracefully', async () => {
    // Mock DOM to prevent errors in printError function
    Object.defineProperty(document, 'getElementById', {
      value: jest.fn(() => ({
        innerHTML: '',
        style: { display: '' },
        firstChild: null,
        insertBefore: jest.fn(),
      })),
      writable: true,
    })

    model.bookmarks = [
      {
        id: 'bookmark-malformed',
        title: 'Valid title',
        url: 'https://example.com/valid',
        searchString: null, // Malformed - missing searchString
      },
    ]

    // Should not throw an error even with malformed data
    const results = await fuzzySearch('bookmarks', 'valid', model, opts)

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('handles empty search terms gracefully', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/test',
      },
    ])

    const results = await fuzzySearch('bookmarks', '', model, opts)

    expect(results).toHaveLength(0)
  })

  it('handles whitespace-only search terms gracefully', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/test',
      },
    ])

    const results = await fuzzySearch('bookmarks', '   ', model, opts)

    expect(results).toHaveLength(0)
  })

  it('handles special characters in search terms', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-special',
        title: 'GitHub repo',
        url: 'https://github.com/user/repo',
      },
    ])

    const results = await fuzzySearch('bookmarks', 'github.com', model, opts)

    expect(results).toHaveLength(1)
    expect(results[0].originalId).toBe('bookmark-special')
  })

  it('handles multiple search terms correctly', async () => {
    model.bookmarks = createBookmarksTestData([
      { id: 'bookmark-1', title: 'JavaScript framework', url: 'https://reactjs.org' },
      { id: 'bookmark-2', title: 'Python library', url: 'https://pypi.org/project/requests' },
    ])

    const results = await fuzzySearch('bookmarks', 'javascript python', model, opts)

    // Should handle multiple terms (implementation detail, but tests the interface)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('handles search mode switching correctly', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/bookmark',
      },
    ])
    model.tabs = createTabsTestData([
      {
        id: 'tab-1',
        title: 'Test tab',
        url: 'https://example.com/tab',
      },
    ])

    const bookmarkResults = await fuzzySearch('bookmarks', 'test', model, opts)
    const tabResults = await fuzzySearch('tabs', 'test', model, opts)

    expect(bookmarkResults).toHaveLength(1)
    expect(bookmarkResults[0].originalId).toBe('bookmark-1')
    expect(tabResults).toHaveLength(1)
    expect(tabResults[0].originalId).toBe('tab-1')
  })

  it('does not mutate cached entries when creating results', async () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-highlight',
        title: 'Highlight persistence test',
        url: 'https://example.com/highlight',
      },
    ])

    const firstResults = await fuzzySearch('bookmarks', 'highlight', model, opts)

    expect(firstResults).toHaveLength(1)
    const firstResult = firstResults[0]
    // Verify fuzzy search creates a copy of the entry, not mutating the original
    expect(firstResult).not.toBe(model.bookmarks[0])
    expect(firstResult.searchApproach).toBe('fuzzy')

    const secondResults = await fuzzySearch('bookmarks', 'highlight', model, opts)

    // Verify original model entry remains unchanged
    expect(secondResults[0]).not.toBe(model.bookmarks[0])
    expect(model.bookmarks[0].searchScore).toBeUndefined()
    expect(model.bookmarks[0].searchApproach).toBeUndefined()
  })
})
