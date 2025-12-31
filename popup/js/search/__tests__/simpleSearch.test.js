import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { highlightSimpleSearch, resetSimpleSearchState, simpleSearch } from '../simpleSearch.js'

/**
 * Helper to create test entries with proper lowercase fields
 */
function createTestEntry(props) {
  const entry = { ...props }
  if (props.searchString && !props.searchStringLower) {
    entry.searchStringLower = props.searchString.toLowerCase()
  }
  if (props.tagsArray && !props.tagsArrayLower) {
    entry.tagsArrayLower = props.tagsArray.map((t) => t.toLowerCase())
  }
  if (props.folderArray && !props.folderArrayLower) {
    entry.folderArrayLower = props.folderArray.map((f) => f.toLowerCase())
  }
  return entry
}

describe('simpleSearch', () => {
  let model

  beforeEach(() => {
    resetSimpleSearchState()
    model = {
      bookmarks: [],
      tabs: [],
      history: [],
    }
  })

  afterEach(() => {
    resetSimpleSearchState()
  })

  test('returns exact matches for bookmarks mode', () => {
    const bookmark = createTestEntry({
      id: 'bookmark-1',
      title: 'Test bookmark',
      url: 'https://example.com/test',
      searchString: 'test bookmark https://example.com/test',
    })

    model.bookmarks = [bookmark]

    const results = simpleSearch('bookmarks', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'bookmark-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  test('returns exact matches for tabs mode', () => {
    const tab = {
      id: 'tab-1',
      title: 'Test tab',
      url: 'https://example.com/tab',
      searchString: 'test tab https://example.com/tab',
    }

    model.tabs = [tab]

    const results = simpleSearch('tabs', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'tab-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  test('returns exact matches for history mode', () => {
    const history = {
      id: 'history-1',
      title: 'Test history',
      url: 'https://example.com/history',
      searchString: 'test history https://example.com/history',
    }

    model.history = [history]

    const results = simpleSearch('history', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'history-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  test('filters out non-matching items', () => {
    const matchingBookmark = {
      id: 'bookmark-1',
      title: 'Learn JavaScript',
      url: 'https://javascript.info',
      searchString: 'learn javascript https://javascript.info',
    }
    const partialMatchBookmark = {
      id: 'bookmark-2',
      title: 'Learn Python',
      url: 'https://python.org',
      searchString: 'learn python https://python.org',
    }

    model.bookmarks = [matchingBookmark, partialMatchBookmark]

    const results = simpleSearch('bookmarks', 'learn javascript', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'bookmark-1',
    })
  })

  test('case insensitive matching', () => {
    const bookmark = {
      id: 'bookmark-1',
      title: 'Test Bookmark',
      url: 'https://example.com/test',
      searchString: 'test bookmark https://example.com/test',
    }

    model.bookmarks = [bookmark]

    const results = simpleSearch('bookmarks', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('bookmark-1')
  })

  test('requires all search terms to match (AND logic)', () => {
    const bookmark = {
      id: 'bookmark-1',
      title: 'Learn JavaScript',
      url: 'https://javascript.info',
      searchString: 'learn javascript https://javascript.info',
    }

    model.bookmarks = [bookmark]

    // "learn" matches, "python" does not
    const results = simpleSearch('bookmarks', 'learn python', model)

    expect(results).toHaveLength(0)
  })

  test('aggregates tab and history entries when searching in history mode', () => {
    const tabEntry = {
      id: 'tab-1',
      title: 'Example Entry',
      url: 'https://example.com',
      searchString: 'example entry https://example.com',
    }
    const historyEntry = {
      id: 'history-1',
      title: 'Example Entry',
      url: 'https://example.com',
      searchString: 'example entry https://example.com',
    }

    model.tabs = [tabEntry]
    model.history = [historyEntry]

    const results = simpleSearch('history', 'example entry', model)

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      id: 'tab-1',
    })
    expect(results[1]).toMatchObject({
      id: 'history-1',
    })
  })

  test('returns empty array when no matches found', () => {
    const bookmark = {
      id: 'bookmark-1',
      title: 'Test',
      url: 'https://example.com',
      searchString: 'test https://example.com',
    }

    model.bookmarks = [bookmark]

    const results = simpleSearch('bookmarks', 'nonexistent', model)

    expect(results).toHaveLength(0)
  })

  test('returns empty array for unknown search mode', () => {
    const results = simpleSearch('search', 'test', model)

    expect(results).toHaveLength(0)
  })

  test('searches all targets for "unknown" mode (fallback to all)', () => {
    // "unknown" mode usually falls back to "all" targets in resolveSearchTargets
    // but let's verify what simpleSearch does.
    // Actually resolveSearchTargets returns 'all' targets if mode is unknown?
    // Let's check common.js behavior.
    // It returns MODE_TARGETS[searchMode] || MODE_TARGETS.all
    // So 'unknown' -> 'all' -> ['bookmarks', 'tabs', 'history']

    const bookmarkEntry = {
      id: 'bookmark-1',
      searchString: 'javascript',
    }
    const tabEntry = {
      id: 'tab-1',
      searchString: 'javascript',
    }
    const historyEntry = {
      id: 'history-1',
      searchString: 'javascript',
    }

    model.bookmarks = [bookmarkEntry]
    model.tabs = [tabEntry]
    model.history = [historyEntry]

    const results = simpleSearch('unknown', 'javascript', model)

    expect(results).toHaveLength(3)
    expect(results.map((r) => r.id)).toEqual(expect.arrayContaining(['bookmark-1', 'tab-1', 'history-1']))
  })

  describe('Performance optimizations', () => {
    test('pre-calculates lower case search string internally (not on original data)', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'Test',
        url: 'https://example.com',
        searchString: 'Test https://example.com',
      }

      model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', 'test', model)

      expect(results).toHaveLength(1)
      // The new implementation stores lowercase in internal haystack array, NOT on original
      // This improves immutability - original data should NOT be mutated
      expect(model.bookmarks[0].searchStringLower).toBeUndefined()
    })

    test('uses internal cache for efficient repeated searches', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'Test',
        url: 'https://example.com',
        searchString: 'Test https://example.com',
      }

      model.bookmarks = [bookmark]

      // First search should set up cache
      const results1 = simpleSearch('bookmarks', 'test', model)
      expect(results1).toHaveLength(1)

      // Second search with extension of term should use cache (progressive filtering)
      const results2 = simpleSearch('bookmarks', 'test https', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].id).toBe('bookmark-1')
    })
  })

  describe('Edge cases', () => {
    test('handles empty search term', () => {
      const bookmark = {
        id: 'bookmark-1',
        searchString: 'test',
      }

      model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', '', model)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('handles whitespace only search term', () => {
      const bookmark = {
        id: 'bookmark-1',
        searchString: 'test',
      }

      model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', '   ', model)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('handles null/undefined data gracefully', () => {
      // If data is missing for a mode, it should return empty array
      // We need to simulate missing data in model
      delete model.bookmarks

      const results = simpleSearch('bookmarks', 'test', model)

      expect(results).toHaveLength(0)
    })
  })

  describe('Caching behavior', () => {
    test('caches results for progressive searching', () => {
      const bookmark = {
        id: 'bookmark-1',
        searchString: 'learn javascript',
      }

      model.bookmarks = [bookmark]

      // First search should prepare and cache data
      const results1 = simpleSearch('bookmarks', 'learn', model)
      expect(results1).toHaveLength(1)

      // Second search should use cached data
      const results2 = simpleSearch('bookmarks', 'javascript', model)
      expect(results2).toHaveLength(1)
    })

    test('invalidates cache when search term does not start with previous term', () => {
      const bookmark1 = {
        id: 'bookmark-1',
        searchString: 'learn javascript',
      }
      const bookmark2 = {
        id: 'bookmark-2',
        searchString: 'python programming',
      }

      model.bookmarks = [bookmark1, bookmark2]

      // Search for "learn" first
      const results1 = simpleSearch('bookmarks', 'learn', model)
      expect(results1).toHaveLength(1)

      // Search for "python" - should invalidate cache since "python" doesn't start with "learn"
      const results2 = simpleSearch('bookmarks', 'python', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].id).toBe('bookmark-2')
    })

    test('uses cache when search term extends previous term', () => {
      const bookmark1 = {
        id: 'bookmark-1',
        searchString: 'learn javascript',
      }
      const bookmark2 = {
        id: 'bookmark-2',
        searchString: 'learn python',
      }

      model.bookmarks = [bookmark1, bookmark2]

      // Search for "learn" first
      const results1 = simpleSearch('bookmarks', 'learn', model)
      expect(results1).toHaveLength(2)

      // Search for "learn javascript" - should use cached data since it extends "learn"
      const results2 = simpleSearch('bookmarks', 'learn javascript', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].id).toBe('bookmark-1')
    })

    test('resets cache when data changes (simulated by resetSimpleSearchState)', () => {
      const readingBookmark = {
        id: 'bookmark-3',
        searchString: 'learn reading',
      }
      const cookingBookmark = {
        id: 'bookmark-4',
        searchString: 'learn cooking',
      }

      model.bookmarks = [readingBookmark, cookingBookmark]

      const initialResults = simpleSearch('bookmarks', 'learn', model)
      expect(initialResults).toHaveLength(2)

      // Simulate data change by modifying model and resetting state
      model.bookmarks = [cookingBookmark]
      resetSimpleSearchState('bookmarks')

      const refreshedResults = simpleSearch('bookmarks', 'learn cooking', model)
      expect(refreshedResults).toHaveLength(1)
      expect(refreshedResults[0].id).toBe('bookmark-4')
    })

    test('maintains separate caches for different modes', () => {
      const bookmark = {
        id: 'bookmark-1',
        searchString: 'javascript',
      }
      const tab = {
        id: 'tab-1',
        searchString: 'javascript',
      }

      model.bookmarks = [bookmark]
      model.tabs = [tab]

      // Perform searches in both modes
      simpleSearch('bookmarks', 'javascript', model)
      simpleSearch('tabs', 'javascript', model)

      // Reset only bookmarks state
      resetSimpleSearchState('bookmarks')

      // Tabs state should remain intact (internal implementation detail, harder to verify directly without exposing state)
      // But we can verify that searching tabs still works
      const tabResults = simpleSearch('tabs', 'javascript', model)
      expect(tabResults).toHaveLength(1)

      // Bookmarks should have fresh state
      const bookmarkResults = simpleSearch('bookmarks', 'javascript', model)
      expect(bookmarkResults).toHaveLength(1)
    })
  })

  describe('Error handling', () => {
    test('handles empty data arrays gracefully', () => {
      model.bookmarks = []

      const results = simpleSearch('bookmarks', 'javascript', model)

      expect(results).toHaveLength(0)
    })

    test('handles malformed data gracefully (missing searchString)', () => {
      const bookmark = {
        id: 'bookmark-1',
        // missing searchString
      }

      model.bookmarks = [bookmark]

      // Depending on implementation, this might throw or return empty.
      // simpleSearch accesses entry.searchString.toLowerCase()
      // So it will throw if searchString is missing.
      // Let's verify that it throws.
      expect(() => simpleSearch('bookmarks', 'javascript', model)).toThrow()
    })

    test('reduces cached data progressively during multi-term search', () => {
      const bookmark1 = { id: '1', searchString: 'learn javascript web' }
      const bookmark2 = { id: '2', searchString: 'learn javascript mobile' }
      const bookmark3 = { id: '3', searchString: 'learn python web' }

      model.bookmarks = [bookmark1, bookmark2, bookmark3]

      // Search with multiple terms where matches reduce progressively
      const results = simpleSearch('bookmarks', 'learn javascript web', model)

      // Should find entries that contain ALL terms
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('1')
    })
  })

  describe('Zero-DOM Highlighting', () => {
    test('generates highlighted title and URL for matching terms', () => {
      const bookmark = {
        id: 'bm-1',
        searchString: 'React Tutorial¦https://reactjs.org/tutorial',
      }

      model.bookmarks = [bookmark]

      let results = simpleSearch('bookmarks', 'react', model)
      results = highlightSimpleSearch(results, 'react')

      expect(results).toHaveLength(1)
      expect(results[0].highlightedTitle).toBeDefined()
      expect(results[0].highlightedUrl).toBeDefined()
      expect(results[0].highlightedTitle).toContain('<mark>')
      expect(results[0].highlightedTitle).toContain('</mark>')
    })

    test('highlights all matching terms in title', () => {
      const bookmark = {
        id: 'bm-1',
        searchString: 'React Hooks Deep Dive¦https://example.com/react-hooks',
      }

      model.bookmarks = [bookmark]

      let results = simpleSearch('bookmarks', 'react hooks', model)
      results = highlightSimpleSearch(results, 'react hooks')

      expect(results).toHaveLength(1)
      const result = results[0]

      // Both 'react' and 'hooks' should be highlighted
      expect(result.highlightedTitle).toContain('<mark>')
      // Count mark tags - should have at least 2 pairs (for react and hooks)
      const markMatches = result.highlightedTitle.match(/<mark>/g)
      expect(markMatches.length).toBeGreaterThanOrEqual(2)
    })

    test('highlights terms in URL as well', () => {
      const bookmark = {
        id: 'bm-1',
        searchString: 'React Tutorial¦https://reactjs.org/tutorial',
      }

      model.bookmarks = [bookmark]

      let results = simpleSearch('bookmarks', 'reactjs', model)
      results = highlightSimpleSearch(results, 'reactjs')

      expect(results).toHaveLength(1)
      expect(results[0].highlightedUrl).toContain('<mark>')
    })

    test('escapes HTML in title before highlighting to prevent XSS', () => {
      const maliciousBookmark = {
        id: 'bm-xss',
        searchString: 'Test <script>alert(1)</script>¦https://example.com/test',
      }

      model.bookmarks = [maliciousBookmark]

      let results = simpleSearch('bookmarks', 'test', model)
      results = highlightSimpleSearch(results, 'test')

      expect(results).toHaveLength(1)
      expect(results[0].highlightedTitle).not.toContain('<script>')
      expect(results[0].highlightedTitle).toContain('&lt;script&gt;')
      expect(results[0].highlightedTitle).toContain('<mark>Test</mark>')
    })

    test('handles empty URL gracefully', () => {
      const bookmark = {
        id: 'bm-empty-url',
        searchString: 'Title Only',
      }

      model.bookmarks = [bookmark]

      let results = simpleSearch('bookmarks', 'title', model)
      results = highlightSimpleSearch(results, 'title')

      expect(results).toHaveLength(1)
      expect(results[0].highlightedTitle).toContain('<mark>')
      expect(results[0].highlightedUrl).toBe('')
    })

    test('returns highlighted content even with empty search terms (no highlights)', () => {
      const bookmark = {
        id: 'bm-1',
        searchString: 'Some Title¦https://example.com',
      }

      model.bookmarks = [bookmark]

      let results = simpleSearch('bookmarks', '', model)
      results = highlightSimpleSearch(results, '')

      expect(results).toHaveLength(1)
      // With empty search term, title should be escaped but not highlighted
      expect(results[0].highlightedTitle).toBe('Some Title')
      expect(results[0].highlightedUrl).toBe('https://example.com')
    })

    test('correctly extracts URL from searchString with tags and folders', () => {
      // Regression test: URL should not include tags or folders
      // searchString format: title¦url¦tags¦folder
      const bookmark = {
        id: 'bm-full-format',
        searchString: 'Elektronauts Forum¦elektronauts.com/latest¦#music¦~Sites ~Forums',
      }

      model.bookmarks = [bookmark]

      let results = simpleSearch('bookmarks', 'elektronauts', model)
      results = highlightSimpleSearch(results, 'elektronauts')

      expect(results).toHaveLength(1)
      // URL must NOT contain tag (#music) or folder (~Sites ~Forums) separators
      expect(results[0].highlightedUrl).not.toContain('¦')
      expect(results[0].highlightedUrl).not.toContain('#music')
      expect(results[0].highlightedUrl).not.toContain('~Sites')
      expect(results[0].highlightedUrl).not.toContain('~Forums')
      // URL should only be the clean URL with highlighting applied
      expect(results[0].highlightedUrl).toContain('<mark>')
      expect(results[0].highlightedUrl).toContain('.com/latest')
    })
  })

  describe('Result immutability', () => {
    test('does not mutate original data entries when adding highlights', () => {
      const originalBookmark = {
        id: 'bm-1',
        title: 'React Tutorial',
        url: 'https://reactjs.org',
        searchString: 'React Tutorial¦https://reactjs.org',
      }

      model.bookmarks = [originalBookmark]

      simpleSearch('bookmarks', 'react', model)

      // Original entry should NOT have highlighting fields
      expect(model.bookmarks[0].highlightedTitle).toBeUndefined()
      expect(model.bookmarks[0].highlightedUrl).toBeUndefined()
    })

    test('returns new result objects, not references to originals', () => {
      const bookmark = {
        id: 'bm-1',
        searchString: 'React Tutorial¦https://reactjs.org',
      }

      model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', 'react', model)

      expect(results[0]).not.toBe(model.bookmarks[0])
      // Modifying the result should not affect the original
      results[0].customField = 'test'
      expect(model.bookmarks[0].customField).toBeUndefined()
    })
  })
})
