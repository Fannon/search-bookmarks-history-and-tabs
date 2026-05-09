import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { clearBookmarkUndoSnapshots } from '../model/bookmarkManagerUndo.js'
import { clearTestExt, flushPromises } from './testUtils.js'

const BOOKMARKS = [
  {
    originalId: 'bookmark-1',
    id: 'bookmark-1',
    title: 'First Bookmark',
    url: 'example.com/first',
    originalUrl: 'https://example.com/first',
    folderId: 'folder-1',
    parentId: 'folder-1',
    index: 0,
    folder: 'Folder',
    folderArray: ['Folder'],
    tagsArray: [],
    tagsArrayLower: [],
    tags: '',
    tagsLower: '',
    customBonusScore: 0,
    searchStringLower: 'first bookmark example.com/first folder',
  },
  {
    originalId: 'bookmark-2',
    id: 'bookmark-2',
    title: 'Second Bookmark',
    url: 'example.com/second',
    originalUrl: 'https://example.com/second',
    folderId: 'folder-1',
    parentId: 'folder-1',
    index: 1,
    folder: 'Folder',
    folderArray: ['Folder'],
    tagsArray: [],
    tagsArrayLower: [],
    tags: '',
    tagsLower: '',
    customBonusScore: 0,
    searchStringLower: 'second bookmark example.com/second folder',
  },
]

function setupDom() {
  window.history.replaceState(null, '', '/bookmarkManager.html#cleanup')
  document.body.innerHTML = `
    <div id="manager-status"></div>
    <input id="bookmark-manager-search" />
    <div id="bookmark-folder-tree"></div>
    <div id="bookmark-browser-summary"></div>
    <div id="managed-bookmark-list"></div>
    <button id="select-visible-bookmarks"></button>
    <button id="clear-managed-selection"></button>
    <div id="bookmark-selection-summary"></div>
    <select id="bookmark-move-folder"></select>
    <button id="move-selected-bookmarks"></button>
    <input id="bookmark-bulk-tags" />
    <button id="suggest-tags-selected"></button>
    <div id="tag-suggestion-status"></div>
    <button id="add-tags-selected"></button>
    <button id="replace-tags-selected"></button>
    <button id="remove-tags-selected"></button>
    <input id="bookmark-edit-title" />
    <input id="bookmark-edit-url" />
    <input id="bookmark-edit-tags" />
    <input id="bookmark-edit-score" />
    <a id="open-bookmark-editor" href="./editBookmark.html" aria-disabled="true"></a>
    <button id="save-managed-bookmark"></button>
    <div id="stats-grid"></div>
    <div id="top-tags"></div>
    <div id="top-domains"></div>
    <div id="top-folders"></div>
    <div id="recent-bookmarks"></div>
    <div id="bookmark-count"></div>
    <div id="duplicate-summary"></div>
    <div id="duplicate-count"></div>
    <div id="duplicates-list"></div>
    <div id="tag-summary"></div>
    <div id="tag-count"></div>
    <div id="tag-list"></div>
    <input id="tag-filter" />
    <div id="cleanup-count"></div>
    <select id="cleanup-folder-scope"></select>
    <select id="cleanup-change-limit"><option value="50">50 changes</option></select>
    <select id="cleanup-change-focus"><option value="everything">Everything</option></select>
    <select id="cleanup-bookmark-limit"><option value="1000">1000 bookmarks</option></select>
    <textarea id="cleanup-prompt"></textarea>
    <span id="cleanup-prompt-size"></span>
    <textarea id="cleanup-proposal-json"></textarea>
    <div id="cleanup-proposal-summary"></div>
    <div id="cleanup-proposal-list"></div>
    <div id="cleanup-status"></div>
    <button id="generate-cleanup-prompt"></button>
    <button id="generate-cleanup-prompt-full"></button>
    <button id="run-local-cleanup"></button>
    <button id="copy-cleanup-prompt"></button>
    <button id="apply-all-cleanup-changes"></button>
    <button id="delete-selected"><span data-selected-count></span></button>
    <button id="select-suggested"></button>
    <button id="select-none"></button>
    <div id="bookmark-undo-history"></div>
    <div id="undo-count"></div>
    <button id="undo-bookmark-change"></button>
    <button id="export-undo-history"></button>
    <button id="import-undo-history"></button>
    <input id="import-undo-history-file" type="file" />
    <button id="export-bookmarks"></button>
    <button id="refresh-bookmarks"></button>
    <div id="manager-load"></div>
    <a data-manager-tab="overview"></a>
    <a data-manager-tab="bookmarks"></a>
    <a data-manager-tab="duplicates"></a>
    <a data-manager-tab="tags"></a>
    <a data-manager-tab="cleanup"></a>
    <a data-manager-tab="undo"></a>
    <section data-manager-panel="overview"></section>
    <section data-manager-panel="bookmarks"></section>
    <section data-manager-panel="duplicates"></section>
    <section data-manager-panel="tags"></section>
    <section data-manager-panel="cleanup"></section>
    <section data-manager-panel="undo"></section>
    <div id="error-overlay"></div>
  `
}

describe('initBookmarkManager cleanup apply', () => {
  let ext
  let updateBookmark

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
    clearTestExt()
    clearBookmarkUndoSnapshots()
    setupDom()
    window.HTMLElement.prototype.scrollIntoView = jest.fn()
    global.CSS = { escape: (value) => String(value) }
    window.confirm = jest.fn(() => true)
    jest.spyOn(console, 'warn').mockImplementation(() => {})

    updateBookmark = jest.fn((bookmarkId) => {
      if (bookmarkId === 'bookmark-2') {
        return Promise.reject(new Error('simulated update failure'))
      }
      return Promise.resolve()
    })

    ext = {
      dom: {},
      model: {},
      index: { taxonomy: {} },
      opts: {},
      browserApi: {
        bookmarks: {
          get: jest.fn((bookmarkId) =>
            Promise.resolve([
              {
                id: String(bookmarkId),
                parentId: 'folder-1',
                index: bookmarkId === 'bookmark-1' ? 0 : 1,
                title: bookmarkId === 'bookmark-1' ? 'First Bookmark' : 'Second Bookmark',
                url: bookmarkId === 'bookmark-1' ? 'https://example.com/first' : 'https://example.com/second',
              },
            ]),
          ),
          update: updateBookmark,
          move: jest.fn(),
          create: jest.fn(),
          remove: jest.fn(),
        },
        windows: {},
      },
      searchCache: new Map(),
      initialized: false,
    }

    await jest.unstable_mockModule('../helper/extensionContext.js', () => ({
      __esModule: true,
      createExtensionContext: () => ext,
    }))
    await jest.unstable_mockModule('../model/options.js', () => ({
      __esModule: true,
      defaultOptions: {},
      getEffectiveOptions: jest.fn(() => Promise.resolve({})),
      getUserOptions: jest.fn(() => Promise.resolve({})),
      setUserOptions: jest.fn(() => Promise.resolve()),
    }))
    await jest.unstable_mockModule('../model/searchData.js', () => ({
      __esModule: true,
      getSearchData: jest.fn(() =>
        Promise.resolve({
          bookmarks: BOOKMARKS.map((bookmark) => ({ ...bookmark })),
          bookmarkTree: [],
        }),
      ),
    }))
    await jest.unstable_mockModule('../view/errorView.js', () => ({
      __esModule: true,
      closeErrors: jest.fn(),
      printError: jest.fn(),
    }))

    await import('../initBookmarkManager.js')
    await flushPromises()
    await flushPromises()
  })

  afterEach(() => {
    delete globalThis.LanguageModel
    clearBookmarkUndoSnapshots()
    clearTestExt()
  })

  test('keeps failed cleanup changes pending and reports partial success', async () => {
    const proposal = {
      changes: {
        addTags: [
          { id: 'add-ok', bookmarkId: 'bookmark-1', tags: ['docs'] },
          { id: 'add-fails', bookmarkId: 'bookmark-2', tags: ['docs'] },
        ],
      },
    }
    const proposalInput = document.getElementById('cleanup-proposal-json')

    proposalInput.value = JSON.stringify(proposal)
    proposalInput.dispatchEvent(new Event('input'))
    await new Promise((resolve) => setTimeout(resolve, 220))

    document.getElementById('apply-all-cleanup-changes').click()
    await flushPromises()
    await flushPromises()

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Apply 2 bookmark cleanup changes?'))
    expect(updateBookmark).toHaveBeenCalledWith('bookmark-1', { title: 'First Bookmark #docs' })
    expect(updateBookmark).toHaveBeenCalledWith('bookmark-2', { title: 'Second Bookmark #docs' })
    expect(ext.model.bookmarkCleanupAppliedChangeIds.has('add-ok')).toBe(true)
    expect(ext.model.bookmarkCleanupAppliedChangeIds.has('add-fails')).toBe(false)
    expect(document.getElementById('manager-status').textContent).toBe('cleanup changes partially applied')
    expect(document.getElementById('cleanup-status').textContent).toContain('Applied 1; failed 1')
    expect(document.getElementById('cleanup-status').textContent).toContain('add-fails bookmarks bookmark-2')
    expect(document.getElementById('cleanup-status').textContent).toContain('Undo is available')
    expect(console.warn).toHaveBeenCalledWith(
      'Could not apply cleanup change "add-fails".',
      expect.objectContaining({ message: 'simulated update failure' }),
    )
  })

  test('allows aborting local AI tag suggestions for large selections before prompting the model', async () => {
    window.confirm = jest.fn(() => false)
    globalThis.LanguageModel = {
      availability: jest.fn(() => Promise.resolve('available')),
      create: jest.fn(),
    }
    const largeSelection = Array.from({ length: 21 }, (_, index) => {
      const bookmarkId = `large-${index + 1}`
      return {
        ...BOOKMARKS[0],
        originalId: bookmarkId,
        id: bookmarkId,
        title: `Large Bookmark ${index + 1}`,
      }
    })
    ext.model.bookmarkManager.bookmarks = largeSelection
    ext.model.bookmarkManagerSelectedIds = new Set(largeSelection.map((bookmark) => bookmark.originalId))

    document.getElementById('suggest-tags-selected').disabled = false
    document.getElementById('suggest-tags-selected').click()
    await flushPromises()

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Suggest tags for 21 selected bookmarks?'))
    expect(globalThis.LanguageModel.availability).not.toHaveBeenCalled()
    expect(globalThis.LanguageModel.create).not.toHaveBeenCalled()
    expect(document.getElementById('tag-suggestion-status').textContent).toContain('Tag suggestion cancelled')
  })
})
