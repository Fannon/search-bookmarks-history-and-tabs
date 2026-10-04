import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../test/modules.js'
import { matches } from '../../../test/patterns.js'

const mockLoadGroupsOverview = mock.fn()
const mockGetEffectiveOptions = mock.fn()
const mockGetSearchData = mock.fn()
const mockPrintError = mock.fn()
beforeEach(async () => {
  resetModules()
  document.body.innerHTML = `
    <div id="groups-view"></div>
    <div id="groups-list"></div>
    <div id="groups-load"></div>
  `
  mock.module(new URL('../view/groupsView.js', import.meta.url), {
    exports: {
      loadGroupsOverview: mockLoadGroupsOverview,
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
  mockLoadGroupsOverview.mock.resetCalls()
  mockGetEffectiveOptions.mock.resetCalls()
  mockGetSearchData.mock.resetCalls()
  mockPrintError.mock.resetCalls()
  delete global.ext
  document.body.innerHTML = ''
})
describe('initGroupsPage', () => {
  test('loads options, disables bookmarks/history, and renders groups overview', async () => {
    const mockOptions = { searchStrategy: 'precise', enableBookmarks: true, enableHistory: true }
    const mockTabs = [{ id: 'tab-1', title: 'Test Tab' }]
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.resolve(mockOptions))
    mockGetSearchData.mock.mockImplementation(() => Promise.resolve({ tabs: mockTabs }))
    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()
    assert(mockGetEffectiveOptions.mock.callCount() > 0)
    assert(mockGetSearchData.mock.callCount() > 0)
    assert.strictEqual(global.ext.opts.enableBookmarks, false)
    assert.strictEqual(global.ext.opts.enableHistory, false)
    assert.strictEqual(global.ext.model.tabs, mockTabs)
    assert(mockLoadGroupsOverview.mock.callCount() > 0)
    assert.strictEqual(global.ext.initialized, true)
  })
  test('handles errors gracefully', async () => {
    const error = new Error('Test error')
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.reject(error))
    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()
    assert(
      mockPrintError.mock.calls.some((call) => matches(call.arguments, [error, 'Could not initialize groups view.'])),
    )
  })
  test('removes loading indicator on success', async () => {
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.resolve({}))
    mockGetSearchData.mock.mockImplementation(() => Promise.resolve({ tabs: [] }))
    const loadingIndicator = document.getElementById('groups-load')
    assert(!!loadingIndicator)
    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()
    assert.strictEqual(document.getElementById('groups-load'), null)
  })
  test('removes loading indicator even on error', async () => {
    mockGetEffectiveOptions.mock.mockImplementation(() => Promise.reject(new Error('Test error')))
    const loadingIndicator = document.getElementById('groups-load')
    assert(!!loadingIndicator)
    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()
    assert.strictEqual(document.getElementById('groups-load'), null)
  })
})
