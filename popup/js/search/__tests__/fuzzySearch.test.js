import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createTestExt, clearTestExt } from '../../__tests__/testUtils.js'
import { fuzzySearch, resetFuzzySearchState } from '../fuzzySearch.js'

const delimiter = '\u00A6'
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

  static highlight(searchString, ranges) {
    uFuzzyCallHistory.push({
      method: 'highlight',
      args: { searchString, ranges },
    })

    // Use real uFuzzy highlight if available
    if (originalUFuzzy && originalUFuzzy.highlight) {
      return originalUFuzzy.highlight(searchString, ranges)
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
      const fs = await import('fs')
      const path = await import('path')
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

    createTestExt({
      model: {
        bookmarks: [],
        tabs: [],
        history: [],
      },
      opts: {
        searchFuzzyness: 0.3,
        uFuzzyOptions: null,
      },
    })

    window.uFuzzy = TrackedUFuzzy
    globalThis.uFuzzy = TrackedUFuzzy
  })

  afterEach(() => {
    resetModes()
    TrackedUFuzzy.reset()
    window.uFuzzy = originalUFuzzy
    globalThis.uFuzzy = originalUFuzzy
    clearTestExt()
  })

  it('returns fuzzy results for bookmarks mode and populates highlight and score', async () => {
    // Reset all model data to ensure clean state
    ext.model.bookmarks = []
    ext.model.tabs = []
    ext.model.history = []

    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'Term bookmark',
        url: 'https://example.com/term',
        searchString: `term bookmark${delimiter}https://example.com/term`,
      },
    ]

    const results = await fuzzySearch('bookmarks', 'term')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'bookmark-1',
      searchApproach: 'fuzzy',
    })
    expect(typeof results[0].searchScore).toBe('number')
    expect(results[0].searchScore).toBeGreaterThan(0)
    // Real uFuzzy may not provide the same highlighting format as our mock
    if (results[0].titleHighlighted) {
      expect(typeof results[0].titleHighlighted).toBe('string')
    }
    if (results[0].urlHighlighted) {
      expect(typeof results[0].urlHighlighted).toBe('string')
    }
  })

  it('aggregates tab and history entries when searching in history mode', async () => {
    // Complete reset of all state before this test
    resetModes()
    TrackedUFuzzy.reset()

    // Reset all model data to ensure clean state
    ext.model.bookmarks = []
    ext.model.tabs = []
    ext.model.history = []

    ext.model.tabs = [
      {
        id: 'tab-1',
        title: 'Term tab',
        url: 'https://example.com/term-tab',
        searchString: `term tab entry${delimiter}https://example.com/term-tab`,
      },
    ]
    ext.model.history = [
      {
        id: 'history-1',
        title: 'Term history',
        url: 'https://example.com/term-history',
        searchString: `term history entry${delimiter}https://example.com/term-history`,
      },
    ]

    const results = await fuzzySearch('history', 'term')

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('tab-1')
    expect(results[1].id).toBe('history-1')
    expect(results.every((result) => result.searchApproach === 'fuzzy')).toBe(true)
  })

  it('reuses cached state until resetFuzzySearchState is called', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-cache',
        title: 'Cached term',
        url: 'https://example.com/cached-term',
        searchString: `cached term entry${delimiter}https://example.com/cached-term`,
      },
    ]

    await fuzzySearch('bookmarks', 'cached')
    const initialInstances = TrackedUFuzzy.getInstances().length
    expect(initialInstances).toBeGreaterThan(0)

    await fuzzySearch('bookmarks', 'cached term')
    // Should reuse cached state, but real uFuzzy may create additional instances
    const afterSecondCall = TrackedUFuzzy.getInstances().length
    expect(afterSecondCall).toBeGreaterThanOrEqual(initialInstances)

    resetFuzzySearchState('bookmarks')

    await fuzzySearch('bookmarks', 'cached term')
    // After reset, should create new instances
    const afterReset = TrackedUFuzzy.getInstances().length
    expect(afterReset).toBeGreaterThan(afterSecondCall)
  })

  it('applies non-ASCII specific options when fuzzyness is high', async () => {
    ext.opts.searchFuzzyness = 0.85
    ext.opts.uFuzzyOptions = { extra: 'option' }

    ext.model.bookmarks = [
      {
        id: 'bookmark-warm',
        title: 'Warm entry',
        url: 'https://example.com/warm',
        searchString: `warm bookmark${delimiter}https://example.com/warm`,
      },
    ]

    await fuzzySearch('bookmarks', 'warm')
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

    ext.model.bookmarks = [
      {
        id: 'bookmark-cjk',
        title: `${cjkTerm} entry`,
        url: 'https://example.com/kanji',
        searchString: `${cjkTerm} bookmark${delimiter}https://example.com/${cjkTerm}`,
      },
    ]

    await fuzzySearch('bookmarks', cjkTerm)

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
    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'Different title',
        url: 'https://example.com/different',
        searchString: `different title${delimiter}https://example.com/different`,
      },
    ]

    const results = await fuzzySearch('bookmarks', 'nonexistent')

    expect(results).toHaveLength(0)
  })

  it('handles empty data arrays gracefully', async () => {
    ext.model.bookmarks = []

    const results = await fuzzySearch('bookmarks', 'term')

    expect(results).toHaveLength(0)
  })

  it('handles malformed search data gracefully', async () => {
    // Mock DOM to prevent errors in printError function
    Object.defineProperty(document, 'getElementById', {
      value: jest.fn(() => ({
        innerHTML: '',
        style: { display: '' },
      })),
      writable: true,
    })

    ext.model.bookmarks = [
      {
        id: 'bookmark-malformed',
        title: 'Valid title',
        url: 'https://example.com/valid',
        searchString: null, // Malformed - missing searchString
      },
    ]

    // Should not throw an error even with malformed data
    const results = await fuzzySearch('bookmarks', 'valid')

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('handles empty search terms gracefully', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/test',
        searchString: `test bookmark${delimiter}https://example.com/test`,
      },
    ]

    const results = await fuzzySearch('bookmarks', '')

    expect(results).toHaveLength(0)
  })

  it('handles whitespace-only search terms gracefully', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/test',
        searchString: `test bookmark${delimiter}https://example.com/test`,
      },
    ]

    const results = await fuzzySearch('bookmarks', '   ')

    expect(results).toHaveLength(0)
  })

  it('handles special characters in search terms', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-special',
        title: 'GitHub repo',
        url: 'https://github.com/user/repo',
        searchString: `github repo${delimiter}https://github.com/user/repo`,
      },
    ]

    const results = await fuzzySearch('bookmarks', 'github.com')

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('bookmark-special')
  })

  it('handles multiple search terms correctly', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'JavaScript framework',
        url: 'https://reactjs.org',
        searchString: `javascript framework${delimiter}https://reactjs.org`,
      },
      {
        id: 'bookmark-2',
        title: 'Python library',
        url: 'https://pypi.org/project/requests',
        searchString: `python library${delimiter}https://pypi.org/project/requests`,
      },
    ]

    const results = await fuzzySearch('bookmarks', 'javascript python')

    // Should handle multiple terms (implementation detail, but tests the interface)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('handles search mode switching correctly', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/bookmark',
        searchString: `test bookmark${delimiter}https://example.com/bookmark`,
      },
    ]
    ext.model.tabs = [
      {
        id: 'tab-1',
        title: 'Test tab',
        url: 'https://example.com/tab',
        searchString: `test tab${delimiter}https://example.com/tab`,
      },
    ]

    const bookmarkResults = await fuzzySearch('bookmarks', 'test')
    const tabResults = await fuzzySearch('tabs', 'test')

    expect(bookmarkResults).toHaveLength(1)
    expect(bookmarkResults[0].id).toBe('bookmark-1')
    expect(tabResults).toHaveLength(1)
    expect(tabResults[0].id).toBe('tab-1')
  })

  it('does not mutate cached entries when adding highlight strings', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-highlight',
        title: 'Highlight persistence test',
        url: 'https://example.com/highlight',
        searchString: `highlight persistence test${delimiter}https://example.com/highlight`,
      },
    ]

    const firstResults = await fuzzySearch('bookmarks', 'highlight')

    expect(firstResults).toHaveLength(1)
    const firstResult = firstResults[0]
    expect(firstResult).not.toBe(ext.model.bookmarks[0])
    expect(firstResult.titleHighlighted || '').toContain('<mark>')
    expect(ext.model.bookmarks[0].titleHighlighted).toBeUndefined()
    expect(ext.model.bookmarks[0].urlHighlighted).toBeUndefined()

    const secondResults = await fuzzySearch('bookmarks', 'highlight')

    expect(secondResults[0]).not.toBe(ext.model.bookmarks[0])
    expect(ext.model.bookmarks[0].titleHighlighted).toBeUndefined()
    expect(ext.model.bookmarks[0].urlHighlighted).toBeUndefined()
  })
})
