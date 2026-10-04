import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../test/modules.js'
/**
 * Integration tests for the search bookmarks extension
 * Tests how different components work together and handle real-world scenarios
 */

import { createTaggedBookmarkTitle, mergeBulkTags } from '../model/bookmarkManagerOperations.js'
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
      <div id="error-overlay" class="error-overlay"></div>
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
    resetModules()
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
    assert(ext.model.result.length > 0)

    // Should complete within reasonable time
    assert(endTime - startTime < 800)
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
    assert(ext.model.result.length > 0)
  })
  test('bookmark data structure contains expected fields after conversion', async () => {
    const bookmark = ext.model.bookmarks[0]
    assert.strictEqual(bookmark.title, 'JavaScript Guide')
    assert(bookmark.searchStringLower.includes('javascript guide'))
    assert.strictEqual(bookmark.type, 'bookmark')
  })
  test('bookmark manager title rewrites preserve parsed favorite scores from browser bookmark titles', () => {
    const [bookmark] = createBookmarksTestData([
      {
        id: 'favorite-bookmark',
        title: 'Favorite Reference +75 #Docs',
        url: 'https://example.com/favorite',
      },
    ])
    assert.partialDeepStrictEqual(bookmark, {
      title: 'Favorite Reference',
      tagsArray: ['Docs'],
      customBonusScore: 75,
    })
    assert.strictEqual(
      createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['Read'], 'add'), 75),
      'Favorite Reference +75 #Docs #Read',
    )
  })
  test('error handling across multiple components', async () => {
    mock.module(new URL('../search/simpleSearch.js', import.meta.url), {
      exports: {
        simpleSearch: () => {
          throw new Error('Simple search failure')
        },
        highlightSimpleSearch: mock.fn((r) => r),
        resetSimpleSearchState: mock.fn(),
      },
    })
    const { search } = await import('../search/common.js')
    ext.dom.searchInput.value = 'test'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()
    await search({ key: 'a' })
    const errorOverlay = document.getElementById('error-overlay')
    assert.strictEqual(errorOverlay.style.display, 'block')
    assert(errorOverlay.innerHTML.includes('Simple search failure'))
  })
  test('caches results to avoid redundant searches', async () => {
    const mockSimpleSearch = mock.fn(() => [
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
    mock.module(new URL('../search/simpleSearch.js', import.meta.url), {
      exports: {
        simpleSearch: mockSimpleSearch,
        highlightSimpleSearch: mock.fn((r) => r),
        resetSimpleSearchState: mock.fn(),
      },
    })
    const { search } = await import('../search/common.js')
    ext.dom.searchInput.value = 'test'
    ext.dom.resultCounter.innerText = ''
    ext.initialized = true
    ext.searchCache = new Map()
    await search({ key: 'a' })
    assert.strictEqual(mockSimpleSearch.mock.callCount(), 1)
    mockSimpleSearch.mock.resetCalls()
    ext.dom.searchInput.value = 'test'
    await search({ key: 'a' })
    assert(mockSimpleSearch.mock.callCount() === 0)
    assert(ext.model.result.length > 0)
  })
})
