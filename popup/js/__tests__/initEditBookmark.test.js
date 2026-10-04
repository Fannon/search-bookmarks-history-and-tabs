import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../test/modules.js'
import { matches } from '../../../test/patterns.js'
import { clearTestExt, flushPromises } from './testUtils.js'

function setupDom() {
  document.body.innerHTML = `
    <div id="edit-bm"></div>
    <textarea id="bm-title"></textarea>
    <textarea id="bm-url"></textarea>
    <textarea id="bm-tags"></textarea>
    <a id="bm-save" href="#"></a>
    <a id="bm-del" href="#"></a>
    <a id="bm-cancel" href="#"></a>
    <button id="bm-favorite" type="button" data-favorite="" aria-pressed="false" title="Favorite bookmark"></button>
    <div id="bm-load">Loading...</div>
    <ul id="errors"></ul>
  `
}
describe('initEditBookmark entry point', () => {
  beforeEach(() => {
    resetModules()
    clearTestExt()
    setupDom()
    window.history.replaceState(null, '', 'http://localhost/editBookmark.html')
    window.location.hash = '#bookmark/bookmark-1/search/foo'
  })
  afterEach(() => {
    clearTestExt()
  })
  test('initializes bookmark editor and wires event handlers', async () => {
    const editBookmark = mock.fn((bookmarkId) => {
      window.ext.currentBookmarkId = bookmarkId
      return Promise.resolve()
    })
    const updateBookmark = mock.fn()
    const deleteBookmark = mock.fn(() => Promise.resolve())
    const cycleFavoriteButton = mock.fn()
    const getEffectiveOptions = mock.fn(() => Promise.resolve({}))
    const bookmarkTree = [{ id: '0', title: '', children: [] }]
    const getSearchData = mock.fn(() => Promise.resolve({ bookmarks: [{ originalId: 'bookmark-1' }], bookmarkTree }))
    const printError = mock.fn()
    mock.module(new URL('../view/editBookmarkView.js', import.meta.url), {
      exports: {
        createBookmark: mock.fn(),
        editBookmark,
        editNewBookmark: mock.fn(),
        updateBookmark,
        deleteBookmark,
        cycleFavoriteButton,
      },
    })
    mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
      exports: {
        getEffectiveOptions,
      },
    })
    mock.module(new URL('../model/searchData.js', import.meta.url), {
      exports: {
        getSearchData,
      },
    })
    mock.module(new URL('../view/errorView.js', import.meta.url), {
      exports: {
        printError,
      },
    })
    mock.module(new URL('../helper/browserApi.js', import.meta.url), {
      exports: {
        browserApi: {},
      },
    })
    const module = await import('../initEditBookmark.js')
    await flushPromises()
    assert(printError.mock.callCount() === 0)
    assert.strictEqual(module.ext.initialized, true)
    assert.strictEqual(module.ext.returnHash, '#search/foo')
    assert.strictEqual(window.ext, module.ext)
    assert.strictEqual(module.ext.model.bookmarkTree, bookmarkTree)
    assert(editBookmark.mock.calls.some((call) => matches(call.arguments, ['bookmark-1'])))
    assert(getEffectiveOptions.mock.callCount() > 0)
    assert(getSearchData.mock.callCount() > 0)
    assert.strictEqual(document.getElementById('bm-load'), null)
    assert.strictEqual(document.getElementById('bm-cancel').getAttribute('href'), './index.html#search/foo')
    document.getElementById('bm-save').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    assert(updateBookmark.mock.calls.some((call) => matches(call.arguments, ['bookmark-1'])))
    document.getElementById('bm-del').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    assert(deleteBookmark.mock.calls.some((call) => matches(call.arguments, ['bookmark-1'])))
    const favoriteButton = document.getElementById('bm-favorite')
    favoriteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    assert(cycleFavoriteButton.mock.calls.some((call) => matches(call.arguments, [favoriteButton])))
  })
  test('supports legacy #id hash format for backwards compatibility', async () => {
    window.location.hash = '#id/legacy-bookmark&searchTerm=foo'
    const editBookmark = mock.fn((bookmarkId) => {
      window.ext.currentBookmarkId = bookmarkId
      return Promise.resolve()
    })
    const updateBookmark = mock.fn()
    const deleteBookmark = mock.fn(() => Promise.resolve())
    const getEffectiveOptions = mock.fn(() => Promise.resolve({}))
    const getSearchData = mock.fn(() => Promise.resolve({ bookmarks: [{ originalId: 'legacy-bookmark' }] }))
    const printError = mock.fn()
    mock.module(new URL('../view/editBookmarkView.js', import.meta.url), {
      exports: {
        createBookmark: mock.fn(),
        editBookmark,
        editNewBookmark: mock.fn(),
        updateBookmark,
        deleteBookmark,
        cycleFavoriteButton: mock.fn(),
      },
    })
    mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
      exports: {
        getEffectiveOptions,
      },
    })
    mock.module(new URL('../model/searchData.js', import.meta.url), {
      exports: {
        getSearchData,
      },
    })
    mock.module(new URL('../view/errorView.js', import.meta.url), {
      exports: {
        printError,
      },
    })
    mock.module(new URL('../helper/browserApi.js', import.meta.url), {
      exports: {
        browserApi: {},
      },
    })
    const module = await import('../initEditBookmark.js')
    await flushPromises()
    assert(editBookmark.mock.calls.some((call) => matches(call.arguments, ['legacy-bookmark'])))
    assert.strictEqual(module.ext.returnHash, '#search/foo')
    assert(printError.mock.callCount() === 0)
  })
  test('initializes new bookmark draft and creates only on save', async () => {
    window.location.hash = '#new?url=https%3A%2F%2Fnew.test%2Fpage&title=New%20Page&return=%23search%2F'
    const editBookmark = mock.fn()
    const editNewBookmark = mock.fn((bookmarkDraft) => {
      window.ext.currentBookmarkDraft = bookmarkDraft
    })
    let resolveCreateBookmark
    const createBookmark = mock.fn(
      () =>
        new Promise((resolve) => {
          resolveCreateBookmark = resolve
        }),
    )
    const getEffectiveOptions = mock.fn(() => Promise.resolve({}))
    const getSearchData = mock.fn(() => Promise.resolve({ bookmarks: [] }))
    const printError = mock.fn()
    mock.module(new URL('../view/editBookmarkView.js', import.meta.url), {
      exports: {
        createBookmark,
        editBookmark,
        editNewBookmark,
        updateBookmark: mock.fn(),
        deleteBookmark: mock.fn(),
        cycleFavoriteButton: mock.fn(),
      },
    })
    mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
      exports: {
        getEffectiveOptions,
      },
    })
    mock.module(new URL('../model/searchData.js', import.meta.url), {
      exports: {
        getSearchData,
      },
    })
    mock.module(new URL('../view/errorView.js', import.meta.url), {
      exports: {
        printError,
      },
    })
    mock.module(new URL('../helper/browserApi.js', import.meta.url), {
      exports: {
        browserApi: {},
      },
    })
    const module = await import('../initEditBookmark.js')
    await flushPromises()
    assert(editBookmark.mock.callCount() === 0)
    assert(
      editNewBookmark.mock.calls.some((call) =>
        matches(call.arguments, [
          {
            title: 'New Page',
            url: 'https://new.test/page',
          },
        ]),
      ),
    )
    assert.strictEqual(module.ext.returnHash, '#search/')
    assert(printError.mock.callCount() === 0)
    assert(createBookmark.mock.callCount() === 0)
    document.getElementById('bm-save').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.getElementById('bm-save').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    assert.strictEqual(createBookmark.mock.callCount(), 1)
    resolveCreateBookmark()
    await flushPromises()
    assert.strictEqual(createBookmark.mock.callCount(), 1)
    assert.strictEqual(module.ext.currentBookmarkDraft, null)
  })
  test('logs an error when bookmark identifier is missing', async () => {
    window.location.hash = ''
    const printError = mock.fn()
    mock.module(new URL('../view/editBookmarkView.js', import.meta.url), {
      exports: {
        createBookmark: mock.fn(),
        editBookmark: mock.fn(),
        editNewBookmark: mock.fn(),
        updateBookmark: mock.fn(),
        deleteBookmark: mock.fn(),
        cycleFavoriteButton: mock.fn(),
      },
    })
    mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
      exports: {
        getEffectiveOptions: mock.fn(() => Promise.resolve({})),
      },
    })
    mock.module(new URL('../model/searchData.js', import.meta.url), {
      exports: {
        getSearchData: mock.fn(() => Promise.resolve({ bookmarks: [] })),
      },
    })
    mock.module(new URL('../view/errorView.js', import.meta.url), {
      exports: {
        printError,
      },
    })
    mock.module(new URL('../helper/browserApi.js', import.meta.url), {
      exports: {
        browserApi: {},
      },
    })
    await import('../initEditBookmark.js')
    await flushPromises()
    assert(printError.mock.callCount() > 0)
    const [error, message] = printError.mock.calls[0].arguments
    assert(error instanceof Error)
    assert.strictEqual(message, 'Could not initialize bookmark editor.')
  })
  test('updates editor when hash changes to a different bookmark id', async () => {
    const editBookmark = mock.fn((bookmarkId) => {
      window.ext.currentBookmarkId = bookmarkId
      return Promise.resolve()
    })
    mock.module(new URL('../view/editBookmarkView.js', import.meta.url), {
      exports: {
        createBookmark: mock.fn(),
        editBookmark,
        editNewBookmark: mock.fn(),
        updateBookmark: mock.fn(),
        deleteBookmark: mock.fn(),
        cycleFavoriteButton: mock.fn(),
      },
    })
    mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
      exports: {
        getEffectiveOptions: mock.fn(() => Promise.resolve({})),
      },
    })
    mock.module(new URL('../model/searchData.js', import.meta.url), {
      exports: {
        getSearchData: mock.fn(() => Promise.resolve({ bookmarks: [] })),
      },
    })
    mock.module(new URL('../view/errorView.js', import.meta.url), {
      exports: {
        printError: mock.fn(),
      },
    })
    mock.module(new URL('../helper/browserApi.js', import.meta.url), {
      exports: {
        browserApi: {},
      },
    })
    await import('../initEditBookmark.js')
    await flushPromises()
    editBookmark.mock.resetCalls()
    window.location.hash = '#bookmark/bookmark-2/search/bar'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()
    assert(editBookmark.mock.calls.some((call) => matches(call.arguments, ['bookmark-2'])))
    assert.strictEqual(window.ext.returnHash, '#search/bar')
  })
})
