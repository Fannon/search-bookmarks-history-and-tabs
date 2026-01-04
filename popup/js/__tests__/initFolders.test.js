import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockLoadFoldersOverview = jest.fn()
const mockGetEffectiveOptions = jest.fn()
const mockGetSearchData = jest.fn()
const mockPrintError = jest.fn()

beforeEach(async () => {
  jest.resetModules()

  document.body.innerHTML = `
    <div id="folders-view"></div>
    <div id="folders-list"></div>
    <div id="folders-load"></div>
  `

  await jest.unstable_mockModule('../view/foldersView.js', () => ({
    loadFoldersOverview: mockLoadFoldersOverview,
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

describe('initFoldersPage', () => {
  test('loads options, disables tabs/history, and renders folders overview', async () => {
    const mockOptions = { searchStrategy: 'precise', enableTabs: true, enableHistory: true }
    const mockBookmarks = [{ id: 'bm-1', title: 'Test Bookmark' }]

    mockGetEffectiveOptions.mockResolvedValue(mockOptions)
    mockGetSearchData.mockResolvedValue({ bookmarks: mockBookmarks })

    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()

    expect(mockGetEffectiveOptions).toHaveBeenCalled()
    expect(mockGetSearchData).toHaveBeenCalled()
    expect(global.ext.opts.enableTabs).toBe(false)
    expect(global.ext.opts.enableHistory).toBe(false)
    expect(global.ext.model.bookmarks).toBe(mockBookmarks)
    expect(mockLoadFoldersOverview).toHaveBeenCalled()
    expect(global.ext.initialized).toBe(true)
  })

  test('handles errors gracefully', async () => {
    const error = new Error('Test error')
    mockGetEffectiveOptions.mockRejectedValue(error)

    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()

    expect(mockPrintError).toHaveBeenCalledWith(error, 'Could not initialize folders view.')
  })

  test('removes loading indicator on success', async () => {
    mockGetEffectiveOptions.mockResolvedValue({})
    mockGetSearchData.mockResolvedValue({ bookmarks: [] })

    const loadingIndicator = document.getElementById('folders-load')
    expect(loadingIndicator).toBeTruthy()

    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()

    expect(document.getElementById('folders-load')).toBeNull()
  })

  test('removes loading indicator even on error', async () => {
    mockGetEffectiveOptions.mockRejectedValue(new Error('Test error'))

    const loadingIndicator = document.getElementById('folders-load')
    expect(loadingIndicator).toBeTruthy()

    const { initFoldersPage } = await import('../initFolders.js')
    await initFoldersPage()

    expect(document.getElementById('folders-load')).toBeNull()
  })
})
