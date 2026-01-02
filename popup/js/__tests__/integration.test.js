/**
 * Integration tests for the search bookmarks extension
 * Tests how different components work together and handle real-world scenarios
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  clearTestExt,
  createBookmarksTestData,
  createHistoryTestData,
  createTabsTestData,
  createTestExt,
  generateBookmarksTestData,
} from './testUtils.js'

describe('Extension Integration Tests', () => {
  beforeEach(() => {
    createTestExt({
      opts: {
        searchStrategy: 'precise',
        enableTabs: true,
        enableBookmarks: true,
        enableHistory: true,
        maxRecentTabsToShow: 5,
      },
      model: {
        bookmarks: createBookmarksTestData([
          {
            title: 'JavaScript Guide',
            url: 'https://example.com/js',
          },
          {
            title: 'React Documentation',
            url: 'https://reactjs.org',
          },
        ]),
        tabs: createTabsTestData([
          {
            id: 'tab-1',
            title: 'JavaScript Tutorial',
            url: 'https://example.com/tutorial',
            lastAccessed: Date.now() - 300000,
          },
        ]),
        history: createHistoryTestData([
          {
            id: 'history-1',
            title: 'MDN Web Docs',
            url: 'https://developer.mozilla.org',
            lastVisitTime: Date.now() - 3600000,
            visitCount: 5,
          },
        ]),
      },
    })

    // Setup DOM
    document.body.innerHTML = `
      <input id="q" />
      <ul id="results"></ul>
      <span id="counter"></span>
      <button id="toggle"></button>
      <div id="results-load"></div>
      <div id="edit-bm"></div>
      <div id="tags-view"></div>
      <div id="folders-view"></div>
      <div id="errors"></div>
    `

    ext.dom.searchInput = document.getElementById('q')
    ext.dom.resultList = document.getElementById('results')
    ext.dom.resultCounter = document.getElementById('counter')
    ext.dom.searchApproachToggle = document.getElementById('toggle')
    ext.dom.resultsLoading = document.getElementById('results-load')
  })

  afterEach(() => {
    clearTestExt()
    document.body.innerHTML = ''
    jest.resetModules()
  })

  test('performance with large datasets', async () => {
    ext.model.bookmarks = generateBookmarksTestData(1000)

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

  test('bookmark data structure contains expected fields after conversion', async () => {
    const bookmark = ext.model.bookmarks[0]
    expect(bookmark.title).toBe('JavaScript Guide')
    expect(bookmark.searchStringLower).toContain('javascript guide')
    expect(bookmark.type).toBe('bookmark')
  })

  test('error handling across multiple components', async () => {
    await jest.unstable_mockModule('../search/simpleSearch.js', () => ({
      __esModule: true,
      simpleSearch: () => {
        throw new Error('Simple search failure')
      },
      highlightSimpleSearch: jest.fn((r) => r),
      resetSimpleSearchState: jest.fn(),
    }))

    const { search } = await import('../search/common.js')

    ext.dom.searchInput.value = 'test'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()

    await search({ key: 'a' })

    const errorList = document.getElementById('errors')
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
        searchApproach: 'precise',
      },
    ])

    await jest.unstable_mockModule('../search/simpleSearch.js', () => ({
      __esModule: true,
      simpleSearch: mockSimpleSearch,
      highlightSimpleSearch: jest.fn((r) => r),
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
