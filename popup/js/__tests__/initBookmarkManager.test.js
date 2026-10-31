import '../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { resetModules } from '../../../test/modules.js'
import { containsText, matches, subset } from '../../../test/patterns.js'
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
  let undo
  let printError
  beforeEach(async () => {
    resetModules()
    clearTestExt()
    undo = await import('../model/bookmarkManagerUndo.js')
    undo.clearBookmarkUndoSnapshots()
    setupDom()
    window.HTMLElement.prototype.scrollIntoView = mock.fn()
    global.CSS = { escape: (value) => String(value) }
    window.confirm = mock.fn(() => true)
    mock.method(console, 'warn', () => {})
    updateBookmark = mock.fn((bookmarkId) => {
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
          get: mock.fn((bookmarkId) =>
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
          move: mock.fn(),
          create: mock.fn(async () => ({ id: 'restored-1' })),
          remove: mock.fn(),
        },
        windows: {},
      },
      searchCache: new Map(),
      initialized: false,
    }
    mock.module(new URL('../helper/extensionContext.js', import.meta.url), {
      exports: {
        createExtensionContext: () => ext,
      },
    })
    mock.module(new URL('../model/optionsStorage.js', import.meta.url), {
      exports: {
        defaultOptions: {},
        getEffectiveOptions: mock.fn(() => Promise.resolve({})),
        getUserOptions: mock.fn(() => Promise.resolve({})),
        setUserOptions: mock.fn(() => Promise.resolve()),
      },
    })
    mock.module(new URL('../model/searchData.js', import.meta.url), {
      exports: {
        getSearchData: mock.fn(() =>
          Promise.resolve({
            bookmarks: BOOKMARKS.map((bookmark) => ({ ...bookmark })),
            bookmarkTree: [],
          }),
        ),
      },
    })
    printError = mock.fn()
    mock.module(new URL('../view/errorView.js', import.meta.url), {
      exports: {
        closeErrors: mock.fn(),
        printError,
      },
    })
    await import('../initBookmarkManager.js')
    await flushPromises()
    await flushPromises()
  })
  afterEach(() => {
    delete globalThis.LanguageModel
    undo.clearBookmarkUndoSnapshots()
    clearTestExt()
  })
  async function applyOneCleanupChange(type = 'addTags') {
    const change = { id: 'change-1', bookmarkId: 'bookmark-1' }
    if (type === 'addTags') change.tags = ['docs']
    if (type === 'deleteBookmarks') change.duplicateOfBookmarkId = 'bookmark-2'
    const proposalInput = document.getElementById('cleanup-proposal-json')
    proposalInput.value = JSON.stringify({ changes: { [type]: [change] } })
    proposalInput.dispatchEvent(new Event('input'))
    await new Promise((resolve) => setTimeout(resolve, 220))
    document.getElementById('apply-all-cleanup-changes').click()
    await flushPromises()
    await flushPromises()
  }
  test('cleanup changes on the same bookmark compose without overwriting earlier tags', async () => {
    const input = document.getElementById('cleanup-proposal-json')
    input.value = JSON.stringify({
      changes: {
        addTags: [
          { id: 'add-first', bookmarkId: 'bookmark-1', tags: ['docs'] },
          { id: 'add-second', bookmarkId: 'bookmark-1', tags: ['new'] },
        ],
        removeTags: [{ id: 'remove', bookmarkId: 'bookmark-1', tags: ['docs'] }],
        rewriteTitles: [{ id: 'rewrite', bookmarkId: 'bookmark-1', title: 'Rewritten' }],
      },
    })
    input.dispatchEvent(new Event('input'))
    await new Promise((resolve) => setTimeout(resolve, 220))
    document.getElementById('apply-all-cleanup-changes').click()
    await flushPromises()
    await flushPromises()
    assert.deepStrictEqual(
      updateBookmark.mock.calls.map((call) => call.arguments[1].title),
      ['First Bookmark #docs', 'First Bookmark #docs #new', 'First Bookmark #new', 'Rewritten #new'],
    )
    assert.strictEqual(ext.model.bookmarkCleanupAppliedChangeIds.size, 4)
  })
  test('older undo steps follow a bookmark recreated by undoing its deletion', async () => {
    const node = { id: 'bookmark-1', title: 'Original', url: 'https://example.com/first' }
    undo.saveBookmarkUndoSnapshot(undo.createBookmarkUndoSnapshot('Edit', [node], 1))
    undo.saveBookmarkUndoSnapshot(undo.createBookmarkUndoSnapshot('Delete', [{ ...node, title: 'Edited' }], 2))
    let restored = false
    ext.browserApi.bookmarks.get.mock.mockImplementation((id) =>
      Promise.resolve(restored && id === 'restored-1' ? [{ ...node, id: 'restored-1' }] : []),
    )
    ext.browserApi.bookmarks.create.mock.mockImplementation(async () => {
      restored = true
      return { id: 'restored-1' }
    })
    const button = document.getElementById('undo-bookmark-change')
    button.disabled = false
    button.click()
    await flushPromises()
    await flushPromises()
    assert.strictEqual(undo.getBookmarkUndoSnapshots()[0].bookmarks[0].id, 'restored-1')
    button.click()
    await flushPromises()
    await flushPromises()
    assert.strictEqual(ext.browserApi.bookmarks.create.mock.callCount(), 1)
    assert.deepStrictEqual(updateBookmark.mock.calls[0].arguments, ['restored-1', { title: 'Original', url: node.url }])
    assert.deepStrictEqual(undo.getBookmarkUndoSnapshots(), [])
  })
  test('cancelling cleanup leaves bookmarks and undo history untouched', async () => {
    window.confirm = mock.fn(() => false)
    await applyOneCleanupChange()
    assert.strictEqual(window.confirm.mock.callCount(), 1)
    assert.strictEqual(ext.browserApi.bookmarks.get.mock.callCount(), 0)
    assert.strictEqual(updateBookmark.mock.callCount(), 0)
    assert.deepStrictEqual(undo.getBookmarkUndoSnapshots(), [])
    assert.strictEqual(ext.model.bookmarkCleanupAppliedChangeIds?.size || 0, 0)
  })
  test('undo restores the previous title, URL, folder and position before removing its snapshot', async () => {
    await applyOneCleanupChange()
    assert.strictEqual(undo.getBookmarkUndoSnapshots().length, 1)
    assert.deepStrictEqual(updateBookmark.mock.calls[0].arguments, ['bookmark-1', { title: 'First Bookmark #docs' }])
    document.getElementById('undo-bookmark-change').click()
    await flushPromises()
    await flushPromises()
    assert.deepStrictEqual(updateBookmark.mock.calls[1].arguments, [
      'bookmark-1',
      { title: 'First Bookmark', url: 'https://example.com/first' },
    ])
    assert.deepStrictEqual(ext.browserApi.bookmarks.move.mock.calls[0].arguments, [
      'bookmark-1',
      { parentId: 'folder-1', index: 0 },
    ])
    assert.deepStrictEqual(undo.getBookmarkUndoSnapshots(), [])
    assert.strictEqual(document.getElementById('undo-bookmark-change').disabled, true)
    assert.strictEqual(printError.mock.callCount(), 0)
  })
  test('undo recreates a deleted bookmark with its original folder and position', async () => {
    ext.model.bookmarkManager.bookmarks[1].originalUrl = BOOKMARKS[0].originalUrl
    ext.model.bookmarkManager.bookmarks[1].url = BOOKMARKS[0].url
    await applyOneCleanupChange('deleteBookmarks')
    assert.deepStrictEqual(ext.browserApi.bookmarks.remove.mock.calls[0].arguments, ['bookmark-1'])
    assert.strictEqual(undo.getBookmarkUndoSnapshots().length, 1)
    ext.browserApi.bookmarks.get.mock.mockImplementation(() => Promise.resolve([]))
    document.getElementById('undo-bookmark-change').click()
    await flushPromises()
    await flushPromises()
    assert.deepStrictEqual(ext.browserApi.bookmarks.create.mock.calls[0].arguments, [
      { title: 'First Bookmark', url: 'https://example.com/first', parentId: 'folder-1', index: 0 },
    ])
    assert.strictEqual(updateBookmark.mock.callCount(), 0)
    assert.deepStrictEqual(undo.getBookmarkUndoSnapshots(), [])
    assert.strictEqual(printError.mock.callCount(), 0)
  })
  test('failed undo keeps its snapshot available for a successful retry', async () => {
    await applyOneCleanupChange()
    const [snapshot] = undo.getBookmarkUndoSnapshots()
    const error = new Error('simulated move failure')
    ext.browserApi.bookmarks.move.mock.mockImplementation(() => Promise.reject(error))
    document.getElementById('undo-bookmark-change').click()
    await flushPromises()
    await flushPromises()
    assert.deepStrictEqual(undo.getBookmarkUndoSnapshots(), [snapshot])
    assert.strictEqual(document.getElementById('manager-status').textContent, 'Undo failed')
    assert.strictEqual(document.getElementById('undo-bookmark-change').disabled, false)
    assert.deepStrictEqual(printError.mock.calls[0].arguments, [error, 'Could not restore bookmark undo snapshot.'])
    ext.browserApi.bookmarks.move.mock.mockImplementation(() => Promise.resolve())
    document.getElementById('undo-bookmark-change').click()
    await flushPromises()
    await flushPromises()
    assert.strictEqual(ext.browserApi.bookmarks.move.mock.callCount(), 2)
    assert.deepStrictEqual(undo.getBookmarkUndoSnapshots(), [])
    assert.strictEqual(document.getElementById('manager-status').textContent, `Undid: ${snapshot.description}`)
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
    assert(
      window.confirm.mock.calls.some((call) =>
        matches(call.arguments, [containsText('Apply 2 bookmark cleanup changes?')]),
      ),
    )
    assert(
      updateBookmark.mock.calls.some((call) =>
        matches(call.arguments, ['bookmark-1', { title: 'First Bookmark #docs' }]),
      ),
    )
    assert(
      updateBookmark.mock.calls.some((call) =>
        matches(call.arguments, ['bookmark-2', { title: 'Second Bookmark #docs' }]),
      ),
    )
    assert.strictEqual(ext.model.bookmarkCleanupAppliedChangeIds.has('add-ok'), true)
    assert.strictEqual(ext.model.bookmarkCleanupAppliedChangeIds.has('add-fails'), false)
    assert.strictEqual(document.getElementById('manager-status').textContent, 'cleanup changes partially applied')
    assert(document.getElementById('cleanup-status').textContent.includes('Applied 1; failed 1'))
    assert(document.getElementById('cleanup-status').textContent.includes('add-fails bookmarks bookmark-2'))
    assert(document.getElementById('cleanup-status').textContent.includes('Undo is available'))
    assert(
      console.warn.mock.calls.some((call) =>
        matches(call.arguments, [
          'Could not apply cleanup change "add-fails".',
          subset({ message: 'simulated update failure' }),
        ]),
      ),
    )
  })
  async function runBatchedLocalCleanup(measuredTokens) {
    ext.model.bookmarkManager.bookmarks = Array.from({ length: 400 }, (_, index) => ({
      ...BOOKMARKS[0],
      originalId: `batch-${index + 1}`,
      id: `batch-${index + 1}`,
      title: `Batch Bookmark ${index + 1} ${'x'.repeat(90)}`,
      originalUrl: `https://example.com/batch/${index + 1}`,
    }))
    const sessions = []
    const statuses = []
    globalThis.LanguageModel = {
      create: mock.fn(async () => {
        const session = {
          contextWindow: 9216,
          measureContextUsage: mock.fn(async () => measuredTokens),
          prompt: mock.fn(async (prompt) => {
            statuses.push(document.getElementById('cleanup-status').textContent)
            const bookmarkId = prompt.match(/www\.\):\n(\S+) \|/)[1]
            return JSON.stringify({
              summary: 'Batch.',
              changes: { addTags: [{ id: 'add-1', bookmarkId, tags: ['docs'] }] },
            })
          }),
          destroy: mock.fn(),
        }
        sessions.push(session)
        return session
      }),
    }
    const runButton = document.getElementById('run-local-cleanup')
    runButton.disabled = false
    runButton.click()
    for (let i = 0; i < 50 && !ext.model.bookmarkCleanupProposal; i++) {
      await flushPromises()
    }
    return { sessions, statuses }
  }
  test('runs lite local cleanup in context-sized batches and merges the proposals', async () => {
    const { sessions, statuses } = await runBatchedLocalCleanup(1000)

    assert(sessions.length > 1)
    for (const session of sessions) {
      assert.strictEqual(session.prompt.mock.callCount(), 1)
      assert.strictEqual(session.destroy.mock.callCount(), 1)
      assert(session.prompt.mock.calls[0].arguments[0].length <= 19800)
    }
    assert(statuses[0].startsWith(`Batch 1 of ${sessions.length}: reviewing`))
    assert(statuses[1].includes('(1 change(s) so far)'))
    assert.deepStrictEqual(
      ext.model.bookmarkCleanupProposal.changes.addTags.map((change) => change.id),
      sessions.map((_, index) => `b${index + 1}-add-1`),
    )
    assert(
      document.getElementById('cleanup-status').textContent.includes(`Loaded ${sessions.length} proposed change(s)`),
    )
  })
  test('shrinks local cleanup batches when measured tokens exceed the input limit', async () => {
    const { sessions } = await runBatchedLocalCleanup(12000)

    const prompts = sessions.map((session) => session.prompt.mock.calls[0].arguments[0])
    assert(sessions.length > 4)
    assert(prompts.every((prompt) => prompt.length <= 19800 * (6000 / 12000)))
  })
  test('allows aborting local AI tag suggestions for large selections before prompting the model', async () => {
    window.confirm = mock.fn(() => false)
    globalThis.LanguageModel = {
      availability: mock.fn(() => Promise.resolve('available')),
      create: mock.fn(),
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
    assert(
      window.confirm.mock.calls.some((call) =>
        matches(call.arguments, [containsText('Suggest tags for 21 selected bookmarks?')]),
      ),
    )
    assert(globalThis.LanguageModel.availability.mock.callCount() === 0)
    assert(globalThis.LanguageModel.create.mock.callCount() === 0)
    assert(document.getElementById('tag-suggestion-status').textContent.includes('Tag suggestion cancelled'))
  })
})
