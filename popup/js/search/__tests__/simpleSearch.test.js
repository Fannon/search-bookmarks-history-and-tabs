import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'
import { resetSimpleSearchState, simpleSearch } from '../simpleSearch.js'

const resetModes = () => {
  for (const mode of ['bookmarks', 'tabs', 'history', 'all']) {
    resetSimpleSearchState(mode)
  }
}

/**
 * Comprehensive Jest tests for simpleSearch.js
 *
 * Behaviors covered:
 * - All search modes (bookmarks, tabs, history, search, default)
 * - Case-insensitive search with multiple terms (AND logic)
 * - State management and caching optimization
 * - Cache invalidation scenarios
 * - Edge cases (empty data, empty search terms, partial matches)
 * - Performance optimizations (early returns, cached data reduction)
 *
 * Known gaps:
 * - Integration with external dependencies (ext.model structure)
 * - Performance testing with large datasets
 * - Memory leak testing for long-running sessions
 */
describe('simpleSearch', () => {
  beforeEach(() => {
    createTestExt({
      model: {
        bookmarks: [],
        tabs: [],
        history: []
      }
    })
    resetModes()
  })

  afterEach(() => {
    resetModes()
    clearTestExt()
  })

  describe('search modes', () => {
    test('returns entries that match all search terms for bookmarks mode', () => {
      const matchingBookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com/js-handbook',
        searchString: 'learn javascript fundamentals'
      }
      const partialMatchBookmark = {
        id: 'bookmark-2',
        title: 'Learning cooking',
        url: 'https://example.com/cooking',
        searchString: 'learn basic cooking'
      }

      globalThis.ext.model.bookmarks = [matchingBookmark, partialMatchBookmark]

      const results = simpleSearch('bookmarks', 'learn javascript')

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'bookmark-1',
        searchApproach: 'precise',
        searchScore: 1
      })
    })

    test('returns entries that match all search terms for tabs mode', () => {
      const matchingTab = {
        id: 'tab-1',
        title: 'JavaScript tutorial',
        url: 'https://example.com/js-tutorial',
        searchString: 'learn javascript basics'
      }
      const nonMatchingTab = {
        id: 'tab-2',
        title: 'Cooking recipes',
        url: 'https://example.com/recipes',
        searchString: 'delicious food recipes'
      }

      globalThis.ext.model.tabs = [matchingTab, nonMatchingTab]

      const results = simpleSearch('tabs', 'learn javascript')

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'tab-1',
        searchApproach: 'precise',
        searchScore: 1
      })
    })

    test('aggregates tab and history entries when searching in history mode', () => {
      const tabEntry = {
        id: 'tab-1',
        title: 'Example tab',
        url: 'https://example.com',
        searchString: 'example entry open in tab'
      }
      const historyEntry = {
        id: 'history-1',
        title: 'History entry',
        url: 'https://example.com/history',
        searchString: 'example entry visited before'
      }

      globalThis.ext.model.tabs = [tabEntry]
      globalThis.ext.model.history = [historyEntry]

      const results = simpleSearch('history', 'example entry')

      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({
        id: 'tab-1',
        searchApproach: 'precise'
      })
      expect(results[1]).toMatchObject({
        id: 'history-1',
        searchApproach: 'precise'
      })
    })

    test('returns empty array for search mode', () => {
      globalThis.ext.model.bookmarks = [
        {
          id: 'bookmark-1',
          title: 'Test bookmark',
          url: 'https://example.com',
          searchString: 'test content'
        }
      ]

      const results = simpleSearch('search', 'test')

      expect(results).toHaveLength(0)
    })

    test('searches all modes (bookmarks, tabs, history) in default mode', () => {
      const bookmarkEntry = {
        id: 'bookmark-1',
        title: 'JavaScript guide',
        url: 'https://example.com/js',
        searchString: 'javascript programming'
      }
      const tabEntry = {
        id: 'tab-1',
        title: 'JavaScript tutorial',
        url: 'https://example.com/tutorial',
        searchString: 'javascript tutorial'
      }
      const historyEntry = {
        id: 'history-1',
        title: 'JavaScript docs',
        url: 'https://example.com/docs',
        searchString: 'javascript documentation'
      }

      globalThis.ext.model.bookmarks = [bookmarkEntry]
      globalThis.ext.model.tabs = [tabEntry]
      globalThis.ext.model.history = [historyEntry]

      const results = simpleSearch('unknown', 'javascript')

      expect(results).toHaveLength(3)
      expect(results.map((r) => r.id)).toEqual(
        expect.arrayContaining(['bookmark-1', 'tab-1', 'history-1'])
      )
    })
  })

  describe('search behavior', () => {
    test('performs case-insensitive search', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript Handbook',
        url: 'https://example.com',
        searchString: 'Learn JavaScript Fundamentals'
      }

      globalThis.ext.model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', 'learn javascript')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('requires ALL search terms to match (AND logic)', () => {
      const matchingBookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }
      const partialMatchBookmark = {
        id: 'bookmark-2',
        title: 'Learning guide',
        url: 'https://example.com',
        searchString: 'learn programming basics'
      }

      globalThis.ext.model.bookmarks = [matchingBookmark, partialMatchBookmark]

      const results = simpleSearch('bookmarks', 'learn javascript')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('handles partial word matches within search strings', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript programming',
        url: 'https://example.com',
        searchString: 'comprehensive javascript guide'
      }

      globalThis.ext.model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', 'java')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('handles empty search term', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }

      globalThis.ext.model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', '')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('treats whitespace-only search term as empty string', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }

      globalThis.ext.model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', '   ')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })
  })

  describe('state management and caching', () => {
    test('caches search data for performance optimization', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }

      globalThis.ext.model.bookmarks = [bookmark]

      // First search should prepare and cache data
      const results1 = simpleSearch('bookmarks', 'learn')
      expect(results1).toHaveLength(1)

      // Second search should use cached data
      const results2 = simpleSearch('bookmarks', 'javascript')
      expect(results2).toHaveLength(1)
    })

    test('invalidates cache when new search term is not extension of previous', () => {
      const bookmark1 = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }
      const bookmark2 = {
        id: 'bookmark-2',
        title: 'Python tutorial',
        url: 'https://example.com/python',
        searchString: 'learn python basics'
      }

      globalThis.ext.model.bookmarks = [bookmark1, bookmark2]

      // Search for "learn" first
      const results1 = simpleSearch('bookmarks', 'learn')
      expect(results1).toHaveLength(2)

      // Search for "python" - should invalidate cache since "python" doesn't start with "learn"
      const results2 = simpleSearch('bookmarks', 'python')
      expect(results2).toHaveLength(1)
      expect(results2[0].id).toBe('bookmark-2')
    })

    test('maintains cache when new search term extends previous term', () => {
      const bookmark1 = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }
      const bookmark2 = {
        id: 'bookmark-2',
        title: 'JavaScript advanced',
        url: 'https://example.com/advanced',
        searchString: 'learn javascript advanced concepts'
      }

      globalThis.ext.model.bookmarks = [bookmark1, bookmark2]

      // Search for "learn" first
      const results1 = simpleSearch('bookmarks', 'learn')
      expect(results1).toHaveLength(2)

      // Search for "learn javascript" - should use cached data since it extends "learn"
      const results2 = simpleSearch('bookmarks', 'learn javascript')
      expect(results2).toHaveLength(2)
    })

    test('clears cached results for a mode when resetSimpleSearchState is called', () => {
      const readingBookmark = {
        id: 'bookmark-3',
        title: 'Reading list',
        url: 'https://example.com/reading',
        searchString: 'learn reading techniques'
      }
      const cookingBookmark = {
        id: 'bookmark-4',
        title: 'Cooking reference',
        url: 'https://example.com/cooking',
        searchString: 'learn cooking basics'
      }

      globalThis.ext.model.bookmarks = [readingBookmark, cookingBookmark]

      const initialResults = simpleSearch('bookmarks', 'learn')
      expect(initialResults).toHaveLength(2)

      globalThis.ext.model.bookmarks = [readingBookmark]

      const staleResults = simpleSearch('bookmarks', 'learn cooking')
      expect(staleResults).toHaveLength(1)
      expect(staleResults[0].id).toBe('bookmark-4')

      resetSimpleSearchState('bookmarks')

      const refreshedResults = simpleSearch('bookmarks', 'learn cooking')
      expect(refreshedResults).toHaveLength(0)
    })

    test('handles state reset for specific modes independently', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript guide',
        url: 'https://example.com',
        searchString: 'javascript programming'
      }
      const tab = {
        id: 'tab-1',
        title: 'JavaScript tutorial',
        url: 'https://example.com/tutorial',
        searchString: 'javascript tutorial'
      }

      globalThis.ext.model.bookmarks = [bookmark]
      globalThis.ext.model.tabs = [tab]

      // Perform searches in both modes
      simpleSearch('bookmarks', 'javascript')
      simpleSearch('tabs', 'javascript')

      // Reset only bookmarks state
      resetSimpleSearchState('bookmarks')

      // Tabs state should remain intact
      const tabResults = simpleSearch('tabs', 'javascript')
      expect(tabResults).toHaveLength(1)

      // Bookmarks should have fresh state
      globalThis.ext.model.bookmarks = []
      const bookmarkResults = simpleSearch('bookmarks', 'javascript')
      expect(bookmarkResults).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    test('handles empty data arrays gracefully', () => {
      globalThis.ext.model.bookmarks = []

      const results = simpleSearch('bookmarks', 'javascript')

      expect(results).toHaveLength(0)
    })

    test('handles entries without searchStringLower property', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'Learn JavaScript Fundamentals'
        // No searchStringLower property
      }

      globalThis.ext.model.bookmarks = [bookmark]

      const results = simpleSearch('bookmarks', 'learn javascript')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('bookmark-1')
    })

    test('throws when entry is missing searchString', () => {
      const bookmark = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com'
        // No searchString property
      }

      globalThis.ext.model.bookmarks = [bookmark]

      expect(() => simpleSearch('bookmarks', 'javascript')).toThrow(TypeError)
    })

    test('reduces cached data progressively during multi-term search', () => {
      const bookmark1 = {
        id: 'bookmark-1',
        title: 'JavaScript handbook',
        url: 'https://example.com',
        searchString: 'learn javascript fundamentals'
      }
      const bookmark2 = {
        id: 'bookmark-2',
        title: 'Programming guide',
        url: 'https://example.com/programming',
        searchString: 'learn programming basics'
      }
      const bookmark3 = {
        id: 'bookmark-3',
        title: 'Web development',
        url: 'https://example.com/web',
        searchString: 'web development tutorial'
      }

      globalThis.ext.model.bookmarks = [bookmark1, bookmark2, bookmark3]

      // Search with multiple terms where matches reduce progressively
      const results = simpleSearch('bookmarks', 'learn javascript web')

      // Should find entries that contain ALL terms
      expect(results).toHaveLength(0) // None contain all three terms
    })
  })
})
