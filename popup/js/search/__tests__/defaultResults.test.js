import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, describe, mock, test } from 'node:test'
import { format } from 'node:util'
import { matches, subset } from '../../../../test/patterns.js'
/**
 * Tests for defaultResults.js - default result generation when no search term provided.
 *
 * ✅ Covered behaviors: mode-specific defaults, current tab matching, recent tabs, error handling
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */

import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

const mockGetBrowserTabs = mock.fn()
let addDefaultEntries
before(async () => {
  mock.module(new URL('../../helper/browserApi.js', import.meta.url), {
    exports: {
      getBrowserTabs: mockGetBrowserTabs,
    },
  })
  const defaultResultsModule = await import('../defaultResults.js')
  addDefaultEntries = defaultResultsModule.addDefaultEntries
})
beforeEach(() => {
  mockGetBrowserTabs.mock.resetCalls()
  mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([]))
  createTestExt({
    opts: {
      maxRecentTabsToShow: 3,
    },
    model: {
      searchMode: 'all',
      bookmarks: [],
      tabs: [],
      history: [],
    },
  })
})
afterEach(() => {
  clearTestExt()
})
describe('addDefaultEntries', () => {
  describe('history mode', () => {
    test('returns all history entries with default score', async () => {
      ext.model.searchMode = 'history'
      ext.model.history = [
        { id: 1, title: 'History 1', url: 'https://one.test' },
        { id: 2, title: 'History 2', url: 'https://two.test' },
      ]
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results, [
        { id: 1, title: 'History 1', url: 'https://one.test' },
        { id: 2, title: 'History 2', url: 'https://two.test' },
      ])
      assert.strictEqual(ext.model.result, results)
    })
    test('clones history entries so downstream scoring cannot mutate source data', async () => {
      ext.model.searchMode = 'history'
      ext.model.history = [{ id: 1, title: 'History 1', url: 'https://one.test' }]
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results[0], ext.model.history[0])
      assert.notStrictEqual(results[0], ext.model.history[0])
    })
  })
  describe('tabs mode', () => {
    test('returns tabs sorted by recency', async () => {
      ext.model.searchMode = 'tabs'
      ext.model.tabs = [
        { id: 1, title: 'Old Tab', lastVisitSecondsAgo: 100 },
        { id: 2, title: 'Recent Tab', lastVisitSecondsAgo: 10 },
        { id: 3, title: 'Mid Tab', lastVisitSecondsAgo: 50 },
      ]
      const results = await addDefaultEntries()
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [2, 3, 1],
      )
      assert.partialDeepStrictEqual(results[0], { id: 2 })
    })
  })
  describe('bookmarks mode', () => {
    test('returns all bookmarks with default score', async () => {
      ext.model.searchMode = 'bookmarks'
      ext.model.bookmarks = [
        { id: 1, title: 'Bookmark 1' },
        { id: 2, title: 'Bookmark 2' },
      ]
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results, [
        { id: 1, title: 'Bookmark 1' },
        { id: 2, title: 'Bookmark 2' },
      ])
    })
    test('clones bookmark entries so downstream scoring cannot mutate source data', async () => {
      ext.model.searchMode = 'bookmarks'
      ext.model.bookmarks = [{ id: 1, title: 'Bookmark 1' }]
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results[0], ext.model.bookmarks[0])
      assert.notStrictEqual(results[0], ext.model.bookmarks[0])
    })
  })
  describe('all mode (default)', () => {
    test('returns bookmarks matching current tab URL', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example' },
        { id: 2, url: 'other.com', originalUrl: 'https://other.com', title: 'Other' },
      ]
      ext.model.tabs = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: 'https://example.com/' }]))
      const results = await addDefaultEntries()
      assert(matches(results, [subset({ id: 1, title: 'Example' })]))
      assert.notStrictEqual(results[0], ext.model.bookmarks[0])
    })
    test('reuses the loaded active tab when it is unambiguous', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'active.test/path', originalUrl: 'https://active.test/path', title: 'Active Bookmark' },
      ]
      ext.model.tabs = [
        {
          originalId: 11,
          active: true,
          title: 'Loaded Active Tab',
          url: 'active.test/path',
          originalUrl: 'https://active.test/path',
          lastVisitSecondsAgo: 0,
        },
      ]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ id: 99, url: 'https://wrong.test' }]))
      const results = await addDefaultEntries()
      assert(mockGetBrowserTabs.mock.callCount() === 0)
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [1],
      )
    })
    test('queries the browser when loaded tab data has multiple active tabs', async () => {
      ext.opts.maxRecentTabsToShow = 0
      ext.model.bookmarks = [
        { id: 1, url: 'other-window.test', originalUrl: 'https://other-window.test', title: 'Other Window' },
        { id: 2, url: 'current-window.test', originalUrl: 'https://current-window.test', title: 'Current Window' },
      ]
      ext.model.tabs = [
        { originalId: 10, active: true, url: 'other-window.test', originalUrl: 'https://other-window.test' },
        { originalId: 20, active: true, url: 'current-window.test', originalUrl: 'https://current-window.test' },
      ]
      mockGetBrowserTabs.mock.mockImplementation(() =>
        Promise.resolve([{ id: 20, url: 'https://current-window.test' }]),
      )
      const results = await addDefaultEntries()
      assert(
        mockGetBrowserTabs.mock.calls.some((call) => matches(call.arguments, [{ active: true, currentWindow: true }])),
      )
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [2],
      )
    })
    test('adds quick bookmark action first for an unbookmarked active tab', async () => {
      ext.model.bookmarks = []
      ext.model.tabs = [{ id: 2, originalId: 2, url: 'https://recent.test', lastVisitSecondsAgo: 10 }]
      mockGetBrowserTabs.mock.mockImplementation(() =>
        Promise.resolve([
          {
            id: 1,
            title: 'Active Page',
            url: 'https://active.test/path',
            favIconUrl: 'https://active.test/favicon.ico',
          },
        ]),
      )
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results[0], {
        type: 'bookmarkCreate',
        title: 'Bookmark current page',
        pageTitle: 'Active Page',
        originalUrl: 'https://active.test/path',
        url: 'active.test/path',
        favIconUrl: 'https://active.test/favicon.ico',
      })
      assert(matches(results[1], subset({ id: 2 })))
    })
    test('does not add quick bookmark action when option is disabled', async () => {
      ext.opts.quickBookmarkCurrentTab = ''
      ext.model.bookmarks = []
      ext.model.tabs = []
      mockGetBrowserTabs.mock.mockImplementation(() =>
        Promise.resolve([{ id: 1, title: 'Active Page', url: 'https://active.test/path' }]),
      )
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results, [])
    })
    test('does not add quick bookmark action when active tab is already bookmarked', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'active.test/path', originalUrl: 'https://active.test/path', title: 'Existing Bookmark' },
      ]
      ext.model.tabs = []
      mockGetBrowserTabs.mock.mockImplementation(() =>
        Promise.resolve([{ id: 1, title: 'Active Page', url: 'https://active.test/path' }]),
      )
      const results = await addDefaultEntries()
      assert(matches(results, [subset({ id: 1, title: 'Existing Bookmark' })]))
      assert.strictEqual(
        results.find((entry) => entry.type === 'bookmarkCreate'),
        undefined,
      )
    })
    ;[
      ['about:blank'],
      ['brave://settings'],
      ['chrome://extensions'],
      ['chrome-extension://abc/page.html'],
      ['data:text/plain,hello'],
      ['edge://extensions'],
      ['file:///tmp/page.html'],
      ['javascript:alert(1)'],
      ['moz-extension://abc/page.html'],
      ['opera://settings'],
      ['vivaldi://settings'],
    ].forEach((testCase) => {
      const args = Array.isArray(testCase) ? testCase : [testCase]
      test(
        format(
          'does not add quick bookmark action for unbookmarkable URL %s'.replace(
            /\$([a-zA-Z]+)/g,
            (_, key) => testCase[key],
          ),
          ...args,
        ),
        () =>
          (async (url) => {
            ext.model.bookmarks = []
            ext.model.tabs = []
            mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ id: 1, title: 'Internal Page', url }]))
            const results = await addDefaultEntries()
            assert.deepStrictEqual(results, [])
          })(...args),
      )
    })
    test('shows all bookmarks if multiple match current tab URL', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example 1' },
        { id: 2, url: 'example.com', originalUrl: 'https://example.com', title: 'Example 2' },
      ]
      ext.model.tabs = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: 'https://example.com' }]))
      const results = await addDefaultEntries()
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [1, 2],
      )
    })
    test('matches URLs with and without trailing slashes', async () => {
      ext.model.bookmarks = [{ id: 1, url: 'example.com', originalUrl: 'https://example.com/', title: 'With Slash' }]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: 'https://example.com' }]))
      const results = await addDefaultEntries()
      assert(matches(results, [subset({ id: 1, title: 'With Slash' })]))
    })
    test('matches URLs with and without protocol', async () => {
      ext.model.bookmarks = [{ id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example' }]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: 'example.com' }]))
      const results = await addDefaultEntries()
      assert(matches(results, [subset({ id: 1, title: 'Example' })]))
    })
    test('matches URLs ignoring anchor tags', async () => {
      ext.model.bookmarks = [
        { id: 1, url: 'example.com', originalUrl: 'https://example.com#section1', title: 'Bookmark with Hash' },
      ]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: 'https://example.com#section2' }]))
      const results = await addDefaultEntries()
      assert(matches(results, [subset({ id: 1, title: 'Bookmark with Hash' })]))
    })
    test('adds recent tabs when enabled', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.opts.quickBookmarkCurrentTab = ''
      ext.model.tabs = [
        { id: 1, url: 'https://one.test', lastVisitSecondsAgo: 30 },
        { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 10 },
        { id: 3, url: 'https://three.test', lastVisitSecondsAgo: 20 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: 'https://nomatch.test' }]))
      const results = await addDefaultEntries()
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [2, 3],
      )
    })
    test('excludes active tab from recent tabs', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.opts.quickBookmarkCurrentTab = ''
      ext.model.tabs = [
        { id: 1, originalId: 1, url: 'https://active.test', active: true, lastVisitSecondsAgo: 0 },
        { id: 2, originalId: 2, url: 'https://recent.test', active: false, lastVisitSecondsAgo: 10 },
        { id: 3, originalId: 3, url: 'https://older.test', active: false, lastVisitSecondsAgo: 20 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ id: 1, url: 'https://active.test' }]))
      const results = await addDefaultEntries()
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [2, 3],
      )
    })
    test('filters out chrome:// and about: URLs from recent tabs', async () => {
      ext.opts.maxRecentTabsToShow = 5
      ext.model.tabs = [
        { id: 1, url: 'chrome://extensions', lastVisitSecondsAgo: 10 },
        { id: 2, url: 'https://valid.test', lastVisitSecondsAgo: 20 },
        { id: 3, url: 'about:blank', lastVisitSecondsAgo: 15 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([]))
      const results = await addDefaultEntries()
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [2],
      )
    })
    test('combines matching bookmarks and excludes active tab from recent list', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.bookmarks = [
        { id: 1, originalId: 101, url: 'active.test', originalUrl: 'https://active.test', title: 'Bookmark Match' },
      ]
      ext.model.tabs = [
        { id: 2, originalId: 101, url: 'https://active.test', lastVisitSecondsAgo: 0 },
        { id: 3, originalId: 102, url: 'https://other.test', lastVisitSecondsAgo: 10 },
      ]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ id: 101, url: 'https://active.test' }]))
      const results = await addDefaultEntries()

      // id: 1 (bookmark) should be there from the bookmark matching logic.
      // id: 2 (tab) should be EXCLUDED from recent tabs because it's the active tab.
      // id: 3 (tab) should be there as it is a recent tab.
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [1, 3],
      )
    })
    test('handles missing tab URL gracefully', async () => {
      ext.model.bookmarks = [{ id: 1, url: 'example.com', originalUrl: 'https://example.com', title: 'Example' }]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([{ url: null }]))
      const results = await addDefaultEntries()

      // Should not throw and may have no bookmark matches
      assert.notStrictEqual(results, undefined)
    })
    test('handles browser API errors gracefully', async () => {
      ext.model.tabs = [{ id: 1, url: 'https://tab.test', lastVisitSecondsAgo: 10 }]
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.reject(new Error('API error')))
      const results = await addDefaultEntries()

      // Should still return recent tabs
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [1],
      )
    })
    test('returns empty when maxRecentTabsToShow is 0', async () => {
      ext.opts.maxRecentTabsToShow = 0
      ext.model.tabs = [{ id: 1, url: 'https://tab.test', lastVisitSecondsAgo: 10 }]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([]))
      const results = await addDefaultEntries()
      assert.deepStrictEqual(results, [])
    })
    test('handles tabs with undefined lastVisitSecondsAgo', async () => {
      ext.opts.maxRecentTabsToShow = 2
      ext.model.tabs = [
        { id: 1, url: 'https://one.test', lastVisitSecondsAgo: undefined },
        { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 10 },
      ]
      ext.model.bookmarks = []
      mockGetBrowserTabs.mock.mockImplementation(() => Promise.resolve([]))
      const results = await addDefaultEntries()

      // Tab with undefined should be sorted last
      assert.deepStrictEqual(
        results.map((r) => r.id),
        [2, 1],
      )
    })
  })
})
