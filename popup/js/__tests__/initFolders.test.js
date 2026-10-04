import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../test/modules.js'
import { matches } from '../../../test/patterns.js'

const mockLoadFoldersOverview = mock.fn()
const mockGetEffectiveOptions = mock.fn()
const mockGetSearchData = mock.fn()
const mockPrintError = mock.fn()
beforeEach(async () => {
  resetModules()
  document.body.innerHTML = `
    <div id="folders-view"></div>
    <div id="folders-list"></div>
    <div id="folders-load"></div>
  `
  mock.module(new URL('../view/foldersView.js', import.meta.url), {
    exports: {
      loadFoldersOverview: mockLoadFoldersOverview,
    },
  })
  mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
    exports: {
      getEffectiveOptions: mockGetEffectiveOptions,
    },
  })
  mock.module(new URL('../model/searchData.js', import.meta.url), {
    exports: {
      getSearchData: mockGetSearchData,
    },
  })
  mock.module(new URL('../view/errorView.js', import.meta.url), {
    exports: {
      printError: mockPrintError,
    },
  })
})
afterEach(() => {
  mockLoadFoldersOverview.mock.resetCalls()
  mockGetEffectiveOptions.mock.resetCalls()
  mockGetSearchData.mock.resetCalls()
  mockPrintError.mock.resetCalls()
  delete global.ext
  document.body.innerHTML = ''
})
describe('initFoldersPage', () => {
  test('loads options, disables tabs/history, and renders folders overview', async () => {
    const mockOptions = { searchStrategy: 'precise', enableTabs: true, enableHistory: true }
    const mockBookmarks = [{ id: 'bm-1', title: 'Test Bookmark' }]
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.resolve(mockOptions))
    mockGetSearchData.mock.mockImplementation(() => Promise.resolve({ bookmarks: mockBookmarks }))
    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()
    assert(mockGetEffectiveOptions.mock.callCount() > 0)
    assert(mockGetSearchData.mock.callCount() > 0)
    assert.strictEqual(global.ext.opts.enableTabs, false)
    assert.strictEqual(global.ext.opts.enableHistory, false)
    assert.strictEqual(global.ext.model.bookmarks, mockBookmarks)
    assert(mockLoadFoldersOverview.mock.callCount() > 0)
    assert.strictEqual(global.ext.initialized, true)
  })
  test('handles errors gracefully', async () => {
    const error = new Error('Test error')
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.reject(error))
    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()
    assert(
      mockPrintError.mock.calls.some((call) => matches(call.arguments, [error, 'Could not initialize folders view.'])),
    )
  })
  test('removes loading indicator on success', async () => {
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.resolve({}))
    mockGetSearchData.mock.mockImplementation(() => Promise.resolve({ bookmarks: [] }))
    const loadingIndicator = document.getElementById('folders-load')
    assert(!!loadingIndicator)
    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()
    assert.strictEqual(document.getElementById('folders-load'), null)
  })
  test('removes loading indicator even on error', async () => {
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.reject(new Error('Test error')))
    const loadingIndicator = document.getElementById('folders-load')
    assert(!!loadingIndicator)
    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()
    assert.strictEqual(document.getElementById('folders-load'), null)
  })
})
