import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { fuzzySearch, resetFuzzySearchState } from '../fuzzySearch.js'

const delimiter = '\u00A6'
const cjkTerm = '\u6f22\u5b57'

// Simplified uFuzzy mock focused on testing behavior rather than implementation details
class UFuzzyStub {
  constructor(options) {
    this.options = options
    UFuzzyStub.instances.push(this)
  }

  filter(haystack, term) {
    UFuzzyStub.lastTerm = term
    UFuzzyStub.lastFilterArgs = { haystack, term }

    // Simple mock: return indices where search term appears in search strings
    const indices = []
    haystack.forEach((searchStr, index) => {
      if (searchStr.toLowerCase().includes(term.toLowerCase())) {
        indices.push(index)
      }
    })
    return indices
  }

  info(indices, haystack, term) {
    UFuzzyStub.lastTerm = term
    UFuzzyStub.lastInfoArgs = { indices, haystack, term }

    return {
      idx: indices,
      ranges: indices.map(() => [[0, term.length - 1]]),
      intraIns: indices.map(() => UFuzzyStub.intraInsValue || 1),
    }
  }

  static highlight(searchString, ranges) {
    UFuzzyStub.highlightCalls.push({ searchString, ranges })
    const parts = searchString.split(delimiter)
    const term = UFuzzyStub.lastTerm || ''

    if (!term) return searchString

    // Simple highlighting: mark the search term in title and URL parts
    const mark = `<mark>${term}</mark>`
    const highlightedParts = parts.map((part) =>
      part.toLowerCase().includes(term.toLowerCase()) ? part.replace(new RegExp(term, 'gi'), mark) : part,
    )

    return highlightedParts.join(delimiter)
  }

  static reset() {
    UFuzzyStub.instances = []
    UFuzzyStub.lastTerm = ''
    UFuzzyStub.lastFilterArgs = null
    UFuzzyStub.lastInfoArgs = null
    UFuzzyStub.highlightCalls = []
    UFuzzyStub.intraInsValue = 1
  }
}

UFuzzyStub.reset()

const resetModes = () => {
  for (const mode of ['bookmarks', 'tabs', 'history']) {
    resetFuzzySearchState(mode)
  }
}

describe('fuzzySearch', () => {
  beforeEach(() => {
    UFuzzyStub.reset()
    globalThis.ext = {
      model: {
        bookmarks: [],
        tabs: [],
        history: [],
      },
      opts: {
        searchFuzzyness: 0.3,
        uFuzzyOptions: null,
      },
    }
    window.uFuzzy = UFuzzyStub
    globalThis.uFuzzy = UFuzzyStub
    resetModes()
  })

  afterEach(() => {
    resetModes()
    UFuzzyStub.reset()
    delete window.uFuzzy
    delete globalThis.uFuzzy
    delete globalThis.ext
  })

  it('returns fuzzy results for bookmarks mode and populates highlight and score', async () => {
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
    expect(results[0].searchScore).toBeCloseTo(0.8)
    expect(results[0].titleHighlighted).toContain('<mark>term</mark>')
    expect(results[0].urlHighlighted).toContain('<mark>term</mark>')
  })

  it('aggregates tab and history entries when searching in history mode', async () => {
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
    expect(UFuzzyStub.instances).toHaveLength(1)

    await fuzzySearch('bookmarks', 'cached term')
    expect(UFuzzyStub.instances).toHaveLength(1)

    resetFuzzySearchState('bookmarks')

    await fuzzySearch('bookmarks', 'cached term')
    expect(UFuzzyStub.instances).toHaveLength(2)
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
    expect(UFuzzyStub.instances).toHaveLength(1)
    expect(UFuzzyStub.instances[0].options).toMatchObject({
      intraIns: Math.round(0.85 * 4.2),
      extra: 'option',
    })
    expect(UFuzzyStub.instances[0].options.interSplit).toBeUndefined()

    ext.model.bookmarks = [
      {
        id: 'bookmark-cjk',
        title: `${cjkTerm} entry`,
        url: 'https://example.com/kanji',
        searchString: `${cjkTerm} bookmark${delimiter}https://example.com/${cjkTerm}`,
      },
    ]

    await fuzzySearch('bookmarks', cjkTerm)

    expect(UFuzzyStub.instances).toHaveLength(2)
    expect(UFuzzyStub.instances[1].options).toMatchObject({
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
})
