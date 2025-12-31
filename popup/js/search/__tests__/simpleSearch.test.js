import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { createBookmarksTestData, createHistoryTestData, createTabsTestData } from '../../__tests__/testUtils.js'
import { resetSimpleSearchState, simpleSearch } from '../simpleSearch.js'

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
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Test bookmark',
        url: 'https://example.com/test',
      },
    ])

    const results = simpleSearch('bookmarks', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      originalId: 'bookmark-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  test('returns exact matches for tabs mode', () => {
    model.tabs = createTabsTestData([
      {
        id: 'tab-1',
        title: 'Test tab',
        url: 'https://example.com/tab',
      },
    ])

    const results = simpleSearch('tabs', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      originalId: 'tab-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  test('returns exact matches for history mode', () => {
    model.history = createHistoryTestData([
      {
        id: 'history-1',
        title: 'Test history',
        url: 'https://example.com/history',
      },
    ])

    const results = simpleSearch('history', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      originalId: 'history-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  test('filters out non-matching items', () => {
    model.bookmarks = createBookmarksTestData([
      { id: 'bookmark-1', title: 'Learn JavaScript', url: 'https://javascript.info' },
      { id: 'bookmark-2', title: 'Learn Python', url: 'https://python.org' },
    ])

    const results = simpleSearch('bookmarks', 'learn javascript', model)

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      originalId: 'bookmark-1',
    })
  })

  test('case insensitive matching', () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Test Bookmark',
        url: 'https://example.com/test',
      },
    ])

    const results = simpleSearch('bookmarks', 'test', model)

    expect(results).toHaveLength(1)
    expect(results[0].originalId).toBe('bookmark-1')
  })

  test('requires all search terms to match (AND logic)', () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Learn JavaScript',
        url: 'https://javascript.info',
      },
    ])

    // "learn" matches, "python" does not
    const results = simpleSearch('bookmarks', 'learn python', model)

    expect(results).toHaveLength(0)
  })

  test('aggregates tab and history entries when searching in history mode', () => {
    model.tabs = createTabsTestData([
      {
        id: 'tab-1',
        title: 'Example Entry',
        url: 'https://example.com',
      },
    ])
    model.history = createHistoryTestData([
      {
        id: 'history-1',
        title: 'Example Entry',
        url: 'https://example.com',
      },
    ])

    const results = simpleSearch('history', 'example entry', model)

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      originalId: 'tab-1',
    })
    expect(results[1]).toMatchObject({
      originalId: 'history-1',
    })
  })

  test('returns empty array when no matches found', () => {
    model.bookmarks = createBookmarksTestData([
      {
        id: 'bookmark-1',
        title: 'Test',
        url: 'https://example.com',
      },
    ])

    const results = simpleSearch('bookmarks', 'nonexistent', model)

    expect(results).toHaveLength(0)
  })

  test('returns empty array for unknown search mode', () => {
    const results = simpleSearch('search', 'test', model)

    expect(results).toHaveLength(0)
  })

  test('searches all targets for "unknown" mode (fallback to all)', () => {
    model.bookmarks = createBookmarksTestData([
      { id: 'bookmark-1', title: 'javascript', url: 'https://example.com/bm' },
    ])
    model.tabs = createTabsTestData([{ id: 'tab-1', title: 'javascript', url: 'https://example.com/tab' }])
    model.history = createHistoryTestData([
      { id: 'history-1', title: 'javascript', url: 'https://example.com/history' },
    ])

    const results = simpleSearch('unknown', 'javascript', model)

    expect(results).toHaveLength(3)
    expect(results.map((r) => r.originalId)).toEqual(expect.arrayContaining(['bookmark-1', 'tab-1', 'history-1']))
  })

  describe('Performance optimizations', () => {
    test('pre-calculates lower case search string when data is loaded', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bookmark-1',
          title: 'Test',
          url: 'https://example.com',
        },
      ])

      const results = simpleSearch('bookmarks', 'test', model)

      expect(results).toHaveLength(1)
      // The conversion process precomputes searchStringLower for performance
      expect(model.bookmarks[0].searchStringLower).toBe('test¦example.com')
    })

    test('uses internal cache for efficient repeated searches', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bookmark-1',
          title: 'Test',
          url: 'https://example.com',
        },
      ])

      // First search should set up cache
      const results1 = simpleSearch('bookmarks', 'test', model)
      expect(results1).toHaveLength(1)

      // Second search with extension of term should use cache (progressive filtering)
      // Note: "https://" is stripped, so searching for "test example" instead
      const results2 = simpleSearch('bookmarks', 'test example', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].originalId).toBe('bookmark-1')
    })
  })

  describe('Edge cases', () => {
    test('handles empty search term', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bookmark-1',
          title: 'test',
          url: 'https://example.com',
        },
      ])

      const results = simpleSearch('bookmarks', '', model)

      expect(results).toHaveLength(0)
    })

    test('handles whitespace only search term', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bookmark-1',
          title: 'test',
          url: 'https://example.com',
        },
      ])

      const results = simpleSearch('bookmarks', '   ', model)

      expect(results).toHaveLength(0)
    })

    test('handles null/undefined data gracefully', () => {
      delete model.bookmarks

      const results = simpleSearch('bookmarks', 'test', model)

      expect(results).toHaveLength(0)
    })
  })

  describe('Caching behavior', () => {
    test('caches results for progressive searching', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bookmark-1',
          title: 'learn javascript',
          url: 'https://example.com',
        },
      ])

      // First search should prepare and cache data
      const results1 = simpleSearch('bookmarks', 'learn', model)
      expect(results1).toHaveLength(1)

      // Second search should use cached data
      const results2 = simpleSearch('bookmarks', 'javascript', model)
      expect(results2).toHaveLength(1)
    })

    test('invalidates cache when search term does not start with previous term', () => {
      model.bookmarks = createBookmarksTestData([
        { id: 'bookmark-1', title: 'learn javascript', url: 'https://example.com/1' },
        { id: 'bookmark-2', title: 'python programming', url: 'https://example.com/2' },
      ])

      // Search for "learn" first
      const results1 = simpleSearch('bookmarks', 'learn', model)
      expect(results1).toHaveLength(1)

      // Search for "python" - should invalidate cache since "python" doesn't start with "learn"
      const results2 = simpleSearch('bookmarks', 'python', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].originalId).toBe('bookmark-2')
    })

    test('uses cache when search term extends previous term', () => {
      model.bookmarks = createBookmarksTestData([
        { id: 'bookmark-1', title: 'learn javascript', url: 'https://example.com/1' },
        { id: 'bookmark-2', title: 'learn python', url: 'https://example.com/2' },
      ])

      // Search for "learn" first
      const results1 = simpleSearch('bookmarks', 'learn', model)
      expect(results1).toHaveLength(2)

      // Search for "learn javascript" - should use cached data since it extends "learn"
      const results2 = simpleSearch('bookmarks', 'learn javascript', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].originalId).toBe('bookmark-1')
    })

    test('resets cache when data changes (simulated by resetSimpleSearchState)', () => {
      model.bookmarks = createBookmarksTestData([
        { id: 'bookmark-3', title: 'learn reading', url: 'https://example.com/3' },
        { id: 'bookmark-4', title: 'learn cooking', url: 'https://example.com/4' },
      ])

      const initialResults = simpleSearch('bookmarks', 'learn', model)
      expect(initialResults).toHaveLength(2)

      // Simulate data change by modifying model and resetting state
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bookmark-4',
          title: 'learn cooking',
          url: 'https://example.com/4',
        },
      ])
      resetSimpleSearchState('bookmarks')

      const refreshedResults = simpleSearch('bookmarks', 'learn cooking', model)
      expect(refreshedResults).toHaveLength(1)
      expect(refreshedResults[0].originalId).toBe('bookmark-4')
    })

    test('maintains separate caches for different modes', () => {
      model.bookmarks = createBookmarksTestData([
        { id: 'bookmark-1', title: 'javascript', url: 'https://example.com/bm' },
      ])
      model.tabs = createTabsTestData([{ id: 'tab-1', title: 'javascript', url: 'https://example.com/tab' }])

      // Perform searches in both modes
      simpleSearch('bookmarks', 'javascript', model)
      simpleSearch('tabs', 'javascript', model)

      // Reset only bookmarks state
      resetSimpleSearchState('bookmarks')

      // Tabs state should remain intact
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

    test('reduces cached data progressively during multi-term search', () => {
      model.bookmarks = createBookmarksTestData([
        { id: '1', title: 'learn javascript web', url: 'https://example.com/1' },
        { id: '2', title: 'learn javascript mobile', url: 'https://example.com/2' },
        { id: '3', title: 'learn python web', url: 'https://example.com/3' },
      ])

      // Search with multiple terms where matches reduce progressively
      const results = simpleSearch('bookmarks', 'learn javascript web', model)

      // Should find entries that contain ALL terms
      expect(results).toHaveLength(1)
      expect(results[0].originalId).toBe('1')
    })
  })

  describe('Result immutability', () => {
    test('does not mutate original data entries when adding highlights', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bm-1',
          title: 'React Tutorial',
          url: 'https://reactjs.org',
        },
      ])

      simpleSearch('bookmarks', 'react', model)

      expect(model.bookmarks[0].highlightedTitle).toBeUndefined()
      expect(model.bookmarks[0].highlightedUrl).toBeUndefined()
    })

    test('returns new result objects, not references to originals', () => {
      model.bookmarks = createBookmarksTestData([
        {
          id: 'bm-1',
          title: 'React Tutorial',
          url: 'https://reactjs.org',
        },
      ])

      const results = simpleSearch('bookmarks', 'react', model)

      expect(results[0]).not.toBe(model.bookmarks[0])
      results[0].customField = 'test'
      expect(model.bookmarks[0].customField).toBeUndefined()
    })

    test('returns new objects even on cache hits', () => {
      model.bookmarks = createBookmarksTestData([{ id: '1', title: 'test', url: 'https://test.com' }])

      const results1 = simpleSearch('bookmarks', 'test', model)
      const results2 = simpleSearch('bookmarks', 'test', model)

      expect(results1).not.toBe(results2)
      expect(results1[0]).not.toBe(results2[0])
      expect(results1[0]).not.toBe(model.bookmarks[0])
      expect(results2[0]).not.toBe(model.bookmarks[0])
    })
  })

  describe('Optimization edge cases', () => {
    test('progressive search from "abc" to "abc def" works correctly', () => {
      model.bookmarks = createBookmarksTestData([
        { id: '1', title: 'abc def ghi', url: 'url1' },
        { id: '2', title: 'abc xyz', url: 'url2' },
      ])

      // Step 1: "abc"
      const results1 = simpleSearch('bookmarks', 'abc', model)
      expect(results1).toHaveLength(2)

      // Step 2: "abc def" - should use optimized path and only return 1
      const results2 = simpleSearch('bookmarks', 'abc def', model)
      expect(results2).toHaveLength(1)
      expect(results2[0].originalId).toBe('1')
    })

    test('backtracking search from "abc def" to "abc" works correctly', () => {
      model.bookmarks = createBookmarksTestData([
        { id: '1', title: 'abc def ghi', url: 'url1' },
        { id: '2', title: 'abc xyz', url: 'url2' },
      ])

      simpleSearch('bookmarks', 'abc def', model)
      const results = simpleSearch('bookmarks', 'abc', model)

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.originalId)).toContain('1')
      expect(results.map((r) => r.originalId)).toContain('2')
    })

    test('backtracking from "abcd" to "abc" handles idxs correctly', () => {
      model.bookmarks = createBookmarksTestData([
        { id: '1', title: 'abcd', url: 'u1' },
        { id: '2', title: 'abc', url: 'u2' },
      ])

      simpleSearch('bookmarks', 'abcd', model)
      const results = simpleSearch('bookmarks', 'abc', model)

      expect(results).toHaveLength(2)
    })

    test('handling identical searches with different spaces', () => {
      model.bookmarks = createBookmarksTestData([{ id: '1', title: 'abc def', url: 'u1' }])

      // Note: common.js normalizeSearchTerm handles the spaces before simpleSearch is called
      // But if someone called simpleSearch directly with multiple spaces:
      const results1 = simpleSearch('bookmarks', 'abc  def', model)
      const results2 = simpleSearch('bookmarks', 'abc def', model)

      expect(results1).toHaveLength(1)
      expect(results2).toHaveLength(1)
      expect(results1).not.toBe(results2)
    })
  })
})
