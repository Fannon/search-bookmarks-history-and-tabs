import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockLoadGroupsOverview = jest.fn()
const mockGetEffectiveOptions = jest.fn()
const mockGetSearchData = jest.fn()
const mockPrintError = jest.fn()

beforeEach(async () => {
  jest.resetModules()

  document.body.innerHTML = `
    <div id="groups-view"></div>
    <div id="groups-list"></div>
    <div id="groups-load"></div>
  `

  await jest.unstable_mockModule('../view/groupsView.js', () => ({
    loadGroupsOverview: mockLoadGroupsOverview,
  }))
  await jest.unstable_mockModule('../model/options.js', () => ({
    getEffectiveOptions: mockGetEffectiveOptions,
  }))
  await jest.unstable_mockModule('../model/searchData.js', () => ({
    getSearchData: mockGetSearchData,
  }))
  await jest.unstable_mockModule('../view/errorView.js', () => ({
    printError: mockPrintError,
  }))
})

afterEach(() => {
  jest.clearAllMocks()
  delete global.ext
  document.body.innerHTML = ''
})

describe('initGroupsPage', () => {
  test('loads options, disables bookmarks/history, and renders groups overview', async () => {
    const mockOptions = { searchStrategy: 'precise', enableBookmarks: true, enableHistory: true }
    const mockTabs = [{ id: 'tab-1', title: 'Test Tab' }]

    mockGetEffectiveOptions.mockResolvedValue(mockOptions)
    mockGetSearchData.mockResolvedValue({ tabs: mockTabs })

    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()

    expect(mockGetEffectiveOptions).toHaveBeenCalled()
    expect(mockGetSearchData).toHaveBeenCalled()
    expect(global.ext.opts.enableBookmarks).toBe(false)
    expect(global.ext.opts.enableHistory).toBe(false)
    expect(global.ext.model.tabs).toBe(mockTabs)
    expect(mockLoadGroupsOverview).toHaveBeenCalled()
    expect(global.ext.initialized).toBe(true)
  })

  test('handles errors gracefully', async () => {
    const error = new Error('Test error')
    mockGetEffectiveOptions.mockRejectedValue(error)

    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()

    expect(mockPrintError).toHaveBeenCalledWith(error, 'Could not initialize groups view.')
  })

  test('removes loading indicator on success', async () => {
    mockGetEffectiveOptions.mockResolvedValue({})
    mockGetSearchData.mockResolvedValue({ tabs: [] })

    const loadingIndicator = document.getElementById('groups-load')
    expect(loadingIndicator).toBeTruthy()

    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()

    expect(document.getElementById('groups-load')).toBeNull()
  })

  test('removes loading indicator even on error', async () => {
    mockGetEffectiveOptions.mockRejectedValue(new Error('Test error'))

    const loadingIndicator = document.getElementById('groups-load')
    expect(loadingIndicator).toBeTruthy()

    const { initGroupsPage } = await import('../initGroups.js')
    await initGroupsPage()

    expect(document.getElementById('groups-load')).toBeNull()
  })
})
