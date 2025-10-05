import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { simpleSearch, resetSimpleSearchState } from '../simpleSearch.js'

const resetModes = () => {
  for (const mode of ['bookmarks', 'tabs', 'history', 'all']) {
    resetSimpleSearchState(mode)
  }
}

describe('simpleSearch', () => {
  beforeEach(() => {
    globalThis.ext = {
      model: {
        bookmarks: [],
        tabs: [],
        history: [],
      },
    }
    resetModes()
  })

  afterEach(() => {
    resetModes()
    delete globalThis.ext
  })

  it('returns entries that match all search terms for the requested mode', () => {
    const matchingBookmark = {
      id: 'bookmark-1',
      title: 'JavaScript handbook',
      url: 'https://example.com/js-handbook',
      searchString: 'learn javascript fundamentals',
    }
    const partialMatchBookmark = {
      id: 'bookmark-2',
      title: 'Learning cooking',
      url: 'https://example.com/cooking',
      searchString: 'learn basic cooking',
    }

    globalThis.ext.model.bookmarks = [matchingBookmark, partialMatchBookmark]

    const results = simpleSearch('bookmarks', 'learn javascript')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'bookmark-1',
      searchApproach: 'precise',
      searchScore: 1,
    })
  })

  it('aggregates tab and history entries when searching in history mode', () => {
    const tabEntry = {
      id: 'tab-1',
      title: 'Example tab',
      url: 'https://example.com',
      searchString: 'example entry open in tab',
    }
    const historyEntry = {
      id: 'history-1',
      title: 'History entry',
      url: 'https://example.com/history',
      searchString: 'example entry visited before',
    }

    globalThis.ext.model.tabs = [tabEntry]
    globalThis.ext.model.history = [historyEntry]

    const results = simpleSearch('history', 'example entry')

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ id: 'tab-1', searchApproach: 'precise' })
    expect(results[1]).toMatchObject({ id: 'history-1', searchApproach: 'precise' })
  })

  it('clears cached results for a mode when resetSimpleSearchState is called', () => {
    const readingBookmark = {
      id: 'bookmark-3',
      title: 'Reading list',
      url: 'https://example.com/reading',
      searchString: 'learn reading techniques',
    }
    const cookingBookmark = {
      id: 'bookmark-4',
      title: 'Cooking reference',
      url: 'https://example.com/cooking',
      searchString: 'learn cooking basics',
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
})
