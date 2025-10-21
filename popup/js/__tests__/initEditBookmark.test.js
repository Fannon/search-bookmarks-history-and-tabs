import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { flushPromises, clearTestExt } from './testUtils.js'

function setupDom() {
  document.body.innerHTML = `
    <div id="edit-bookmark"></div>
    <textarea id="bookmark-title"></textarea>
    <textarea id="bookmark-url"></textarea>
    <textarea id="bookmark-tags"></textarea>
    <a id="edit-bookmark-save" href="#"></a>
    <a id="edit-bookmark-delete" href="#"></a>
    <a id="edit-bookmark-cancel" href="#"></a>
    <div id="edit-bookmark-loading">Loading...</div>
    <ul id="error-list"></ul>
  `
}

describe('initEditBookmark entry point', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    clearTestExt()
    setupDom()
    window.history.replaceState(null, '', 'http://localhost/editBookmark.html')
    window.location.hash = '#bookmark/bookmark-1/search/foo'
  })

  afterEach(() => {
    clearTestExt()
  })

  test('initializes bookmark editor and wires event handlers', async () => {
    const editBookmark = jest.fn((bookmarkId) => {
      window.ext.currentBookmarkId = bookmarkId
      return Promise.resolve()
    })
    const updateBookmark = jest.fn()
    const deleteBookmark = jest.fn(() => Promise.resolve())
    const getEffectiveOptions = jest.fn(() => Promise.resolve({}))
    const getSearchData = jest.fn(() => Promise.resolve({ bookmarks: [{ originalId: 'bookmark-1' }] }))
    const printError = jest.fn()

    await jest.unstable_mockModule('../view/editBookmarkView.js', () => ({
      __esModule: true,
      editBookmark,
      updateBookmark,
      deleteBookmark,
    }))
    await jest.unstable_mockModule('../model/options.js', () => ({
      __esModule: true,
      getEffectiveOptions,
    }))
    await jest.unstable_mockModule('../model/searchData.js', () => ({
      __esModule: true,
      getSearchData,
    }))
    await jest.unstable_mockModule('../view/errorView.js', () => ({
      __esModule: true,
      printError,
    }))
    await jest.unstable_mockModule('../helper/browserApi.js', () => ({
      __esModule: true,
      browserApi: {},
    }))

    const module = await import('../initEditBookmark.js')
    await flushPromises()

    expect(printError).not.toHaveBeenCalled()
    expect(module.ext.initialized).toBe(true)
    expect(module.ext.returnHash).toBe('#search/foo')
    expect(window.ext).toBe(module.ext)
    expect(editBookmark).toHaveBeenCalledWith('bookmark-1')
    expect(getEffectiveOptions).toHaveBeenCalled()
    expect(getSearchData).toHaveBeenCalled()
    expect(document.getElementById('edit-bookmark-loading')).toBeNull()
    expect(document.getElementById('edit-bookmark-cancel').getAttribute('href')).toBe('./index.html#search/foo')

    document.getElementById('edit-bookmark-save').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(updateBookmark).toHaveBeenCalledWith('bookmark-1')

    document.getElementById('edit-bookmark-delete').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(deleteBookmark).toHaveBeenCalledWith('bookmark-1')
  })

  test('supports legacy #id hash format for backwards compatibility', async () => {
    window.location.hash = '#id/legacy-bookmark&searchTerm=foo'
    const editBookmark = jest.fn((bookmarkId) => {
      window.ext.currentBookmarkId = bookmarkId
      return Promise.resolve()
    })
    const updateBookmark = jest.fn()
    const deleteBookmark = jest.fn(() => Promise.resolve())
    const getEffectiveOptions = jest.fn(() => Promise.resolve({}))
    const getSearchData = jest.fn(() => Promise.resolve({ bookmarks: [{ originalId: 'legacy-bookmark' }] }))
    const printError = jest.fn()

    await jest.unstable_mockModule('../view/editBookmarkView.js', () => ({
      __esModule: true,
      editBookmark,
      updateBookmark,
      deleteBookmark,
    }))
    await jest.unstable_mockModule('../model/options.js', () => ({
      __esModule: true,
      getEffectiveOptions,
    }))
    await jest.unstable_mockModule('../model/searchData.js', () => ({
      __esModule: true,
      getSearchData,
    }))
    await jest.unstable_mockModule('../view/errorView.js', () => ({
      __esModule: true,
      printError,
    }))
    await jest.unstable_mockModule('../helper/browserApi.js', () => ({
      __esModule: true,
      browserApi: {},
    }))

    const module = await import('../initEditBookmark.js')
    await flushPromises()

    expect(editBookmark).toHaveBeenCalledWith('legacy-bookmark')
    expect(module.ext.returnHash).toBe('#search/foo')
    expect(printError).not.toHaveBeenCalled()
  })

  test('logs an error when bookmark identifier is missing', async () => {
    window.location.hash = ''
    const printError = jest.fn()

    await jest.unstable_mockModule('../view/editBookmarkView.js', () => ({
      __esModule: true,
      editBookmark: jest.fn(),
      updateBookmark: jest.fn(),
      deleteBookmark: jest.fn(),
    }))
    await jest.unstable_mockModule('../model/options.js', () => ({
      __esModule: true,
      getEffectiveOptions: jest.fn(() => Promise.resolve({})),
    }))
    await jest.unstable_mockModule('../model/searchData.js', () => ({
      __esModule: true,
      getSearchData: jest.fn(() => Promise.resolve({ bookmarks: [] })),
    }))
    await jest.unstable_mockModule('../view/errorView.js', () => ({
      __esModule: true,
      printError,
    }))
    await jest.unstable_mockModule('../helper/browserApi.js', () => ({
      __esModule: true,
      browserApi: {},
    }))

    await import('../initEditBookmark.js')
    await flushPromises()

    expect(printError).toHaveBeenCalled()
    const [error, message] = printError.mock.calls[0]
    expect(error).toBeInstanceOf(Error)
    expect(message).toBe('Could not initialize bookmark editor.')
  })

  test('updates editor when hash changes to a different bookmark id', async () => {
    const editBookmark = jest.fn((bookmarkId) => {
      window.ext.currentBookmarkId = bookmarkId
      return Promise.resolve()
    })

    await jest.unstable_mockModule('../view/editBookmarkView.js', () => ({
      __esModule: true,
      editBookmark,
      updateBookmark: jest.fn(),
      deleteBookmark: jest.fn(),
    }))
    await jest.unstable_mockModule('../model/options.js', () => ({
      __esModule: true,
      getEffectiveOptions: jest.fn(() => Promise.resolve({})),
    }))
    await jest.unstable_mockModule('../model/searchData.js', () => ({
      __esModule: true,
      getSearchData: jest.fn(() => Promise.resolve({ bookmarks: [] })),
    }))
    await jest.unstable_mockModule('../view/errorView.js', () => ({
      __esModule: true,
      printError: jest.fn(),
    }))
    await jest.unstable_mockModule('../helper/browserApi.js', () => ({
      __esModule: true,
      browserApi: {},
    }))

    await import('../initEditBookmark.js')
    await flushPromises()

    editBookmark.mockClear()
    window.location.hash = '#bookmark/bookmark-2/search/bar'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()

    expect(editBookmark).toHaveBeenCalledWith('bookmark-2')
    expect(window.ext.returnHash).toBe('#search/bar')
  })
})
