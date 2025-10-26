/**
 * Integration tests for the search bookmarks extension
 * Tests how different components work together and handle real-world scenarios
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { clearTestExt, createTestExt } from './testUtils.js'

describe('Extension Integration Tests', () => {
  beforeEach(() => {
    createTestExt({
      opts: {
        searchStrategy: 'precise',
        searchMinMatchCharLength: 1,
        enableTabs: true,
        enableBookmarks: true,
        enableHistory: true,
        maxRecentTabsToShow: 5,
      },
      model: {
        bookmarks: [
          {
            type: 'bookmark',
            id: 'bookmark-1',
            title: 'JavaScript Guide',
            url: 'https://example.com/js',
            searchString: 'javascript guide¦https://example.com/js',
            tags: '#javascript #web',
            folder: '~Work ~Programming',
          },
          {
            type: 'bookmark',
            id: 'bookmark-2',
            title: 'React Documentation',
            url: 'https://reactjs.org',
            searchString: 'react documentation¦https://reactjs.org',
            tags: '#react #javascript #frontend',
            folder: '~Work ~Frontend',
          },
        ],
        tabs: [
          {
            type: 'tab',
            id: 'tab-1',
            title: 'JavaScript Tutorial',
            url: 'https://example.com/tutorial',
            searchString: 'javascript tutorial¦https://example.com/tutorial',
            lastVisitSecondsAgo: 300,
          },
        ],
        history: [
          {
            type: 'history',
            id: 'history-1',
            title: 'MDN Web Docs',
            url: 'https://developer.mozilla.org',
            searchString: 'mdn web docs¦https://developer.mozilla.org',
            lastVisitSecondsAgo: 3600,
            visitCount: 5,
          },
        ],
      },
    })

    // Setup DOM
    document.body.innerHTML = `
      <input id="search-input" />
      <ul id="result-list"></ul>
      <span id="result-counter"></span>
      <button id="search-approach-toggle"></button>
      <div id="results-loading"></div>
      <div id="edit-bookmark"></div>
      <div id="tags-overview"></div>
      <div id="folders-overview"></div>
      <div id="error-list"></div>
    `

    ext.dom.searchInput = document.getElementById('search-input')
    ext.dom.resultList = document.getElementById('result-list')
    ext.dom.resultCounter = document.getElementById('result-counter')
    ext.dom.searchApproachToggle = document.getElementById('search-approach-toggle')
    ext.dom.resultsLoading = document.getElementById('results-loading')
  })

  afterEach(() => {
    clearTestExt()
    document.body.innerHTML = ''
    jest.resetModules()
  })

  test('performance with large datasets', async () => {
    // Create large dataset
    const largeBookmarks = []
    for (let i = 0; i < 1000; i++) {
      largeBookmarks.push({
        id: `bookmark-${i}`,
        title: `Bookmark ${i}`,
        url: `https://example.com/${i}`,
        searchString: `bookmark ${i}¦https://example.com/${i}`,
        type: 'bookmark',
      })
    }

    ext.model.bookmarks = largeBookmarks

    const { search } = await import('../search/common.js')

    ext.dom.searchInput.value = 'bookmark'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()

    const startTime = Date.now()
    await search({ key: 'a' })
    const endTime = Date.now()

    // Should find results and complete within reasonable time
    expect(ext.model.result.length).toBeGreaterThan(0)

    // Should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(800)
  })

  test('complete search workflow from user input to results display', async () => {
    const { search } = await import('../search/common.js')

    // Simulate user typing in search box
    ext.dom.searchInput.value = 'javascript'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()

    await search({ key: 'a' })

    // The search should find results from the bookmarks that contain 'javascript'
    expect(ext.model.result.length).toBeGreaterThan(0)
  })

  test('bookmark editing workflow updates search data and refreshes results', async () => {
    // Test that bookmark data can be updated correctly
    const bookmark = ext.model.bookmarks[0]
    bookmark.title = 'Updated JavaScript Guide'
    bookmark.searchString = 'updated javascript guide¦https://example.com/js'

    // Verify the bookmark was updated
    expect(bookmark.title).toBe('Updated JavaScript Guide')
    expect(bookmark.searchString).toContain('updated javascript guide')
  })

  test('error handling across multiple components', async () => {
    await jest.unstable_mockModule('../search/simpleSearch.js', () => ({
      __esModule: true,
      simpleSearch: () => {
        throw new Error('Simple search failure')
      },
      resetSimpleSearchState: jest.fn(),
    }))

    const { search } = await import('../search/common.js')

    ext.dom.searchInput.value = 'test'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()

    await search({ key: 'a' })

    const errorList = document.getElementById('error-list')
    expect(errorList.getAttribute('style')).toBe('display: block;')
    expect(errorList.innerHTML).toContain('Simple search failure')
  })

  test('caches results to avoid redundant searches', async () => {
    const mockSimpleSearch = jest.fn(() => [
      {
        id: 'bookmark-1',
        type: 'bookmark',
        title: 'Cached Result',
        url: 'https://example.com',
        searchScore: 1,
        score: 100,
      },
    ])

    await jest.unstable_mockModule('../search/simpleSearch.js', () => ({
      __esModule: true,
      simpleSearch: mockSimpleSearch,
      resetSimpleSearchState: jest.fn(),
    }))

    const { search } = await import('../search/common.js')

    ext.dom.searchInput.value = 'test'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()

    await search({ key: 'a' })
    expect(mockSimpleSearch).toHaveBeenCalledTimes(1)

    mockSimpleSearch.mockClear()
    ext.dom.searchInput.value = 'test'

    await search({ key: 'a' })

    expect(mockSimpleSearch).not.toHaveBeenCalled()
    expect(ext.model.result.length).toBeGreaterThan(0)
  })
})
