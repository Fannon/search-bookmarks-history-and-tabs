import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { beforeEach, describe, mock, test } from 'node:test'
import { matches } from '../../../../test/patterns.js'
import {
  addManagerTagInputValues,
  bindBookmarkManagerEvents,
  getBookmarkManagerDom,
  getManagedActionTargetIds,
  getManagedBookmarkEditValues,
  getSelectedManagedBookmarkIds,
  renderActiveManagerScreen,
  renderBookmarkCleanupProposal,
  renderBookmarkUndoHistory,
  renderBookmarkWorkspace,
  setManagedBookmarkSelected,
  showTagSuggestionBusy,
  showTagSuggestionStatus,
} from '../bookmarkManagerView.js'

const BOOKMARKS = [
  {
    originalId: 'bookmark-1',
    title: 'First Bookmark',
    url: 'example.com/first',
    originalUrl: 'https://example.com/first',
    folderArray: ['Folder'],
    tagsArray: ['one'],
    customBonusScore: 25,
  },
  {
    originalId: 'bookmark-2',
    title: 'Second Bookmark',
    url: 'example.com/second',
    originalUrl: 'https://example.com/second',
    folderArray: ['Folder'],
    tagsArray: ['two'],
  },
]
function setupDom() {
  window.history.replaceState(null, '', '/')
  document.body.innerHTML = `
    <div id="manager-status"></div>
    <input id="bookmark-manager-search" />
    <div id="bookmark-folder-tree"></div>
    <div id="bookmark-browser-summary"></div>
    <div id="managed-bookmark-list"></div>
    <button id="select-visible-bookmarks"></button>
    <button id="clear-managed-selection"></button>
    <h2 id="bookmark-inspector-title"></h2>
    <div id="bookmark-selection-summary"></div>
    <div id="bookmark-inspector-empty"></div>
    <div id="bookmark-edit-fields"></div>
    <div id="bookmark-target-actions"></div>
    <p id="bookmark-bulk-selection-note"></p>
    <select id="bookmark-move-folder"><option value="folder-1">Folder</option></select>
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
    <section class="cleanup-result-panel">
      <textarea id="cleanup-proposal-json"></textarea>
    </section>
    <section class="cleanup-review-section">
      <header class="cleanup-review-header">
        <button id="apply-all-cleanup-changes"></button>
      </header>
      <div id="cleanup-proposal-summary"></div>
      <div id="cleanup-proposal-list"></div>
    </section>
    <div id="cleanup-status"></div>
    <button id="generate-cleanup-prompt"></button>
    <button id="generate-cleanup-prompt-full"></button>
    <button id="run-local-cleanup"></button>
    <button id="copy-cleanup-prompt"></button>
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
    <a data-manager-tab="bookmarks"></a>
    <a data-manager-tab="tags"></a>
    <a data-manager-tab="cleanup"></a>
    <a data-manager-tab="undo"></a>
    <section data-manager-panel="bookmarks"></section>
    <section data-manager-panel="tags"></section>
    <section data-manager-panel="cleanup"></section>
    <section data-manager-panel="undo"></section>
  `
}
function setupExt() {
  global.ext = {
    dom: {},
    model: {
      bookmarkManager: {
        bookmarks: BOOKMARKS,
        folderTree: {
          id: 'all',
          title: 'All Bookmarks',
          count: 2,
          totalCount: 2,
          children: [],
          path: [],
        },
        folderOptions: [{ id: 'folder-1', label: 'Folder', depth: 1 }],
        tagGroups: [],
      },
      bookmarkManagerCanUpdateBookmarks: true,
      bookmarkManagerCanMoveBookmarks: true,
      bookmarkManagerCurrentId: '',
      bookmarkManagerSelectedIds: new Set(),
      bookmarkManagerHasManualSelection: false,
    },
    browserApi: {
      bookmarks: {
        move: mock.fn(),
        update: mock.fn(),
      },
    },
  }
  window.ext = global.ext
  ext.dom.manager = getBookmarkManagerDom()
}
function bindEvents() {
  bindBookmarkManagerEvents({
    onRefresh: mock.fn(),
    onDeleteSelected: mock.fn(),
    onDeleteOne: mock.fn(),
    onBookmarkSearch: mock.fn(),
    onSelectBookmark: setManagedBookmarkSelected,
    onSaveBookmark: mock.fn(),
    onMoveSelected: mock.fn(),
    onSuggestTagsSelected: mock.fn(),
    onBulkTagSelected: mock.fn(),
    onRenameTag: mock.fn(),
    onRemoveTag: mock.fn(),
    onOpenBookmark: mock.fn(),
    onBookmarkNavigation: mock.fn(),
    onUndoBookmarkChange: mock.fn(),
    onExportBookmarks: mock.fn(),
    onExportUndoHistory: mock.fn(),
    onImportUndoHistory: mock.fn(),
    onGenerateCleanupPrompt: mock.fn(),
    onGenerateCleanupPromptFull: mock.fn(),
    onCleanupScopeChange: mock.fn(),
    onRunLocalCleanup: mock.fn(),
    onCopyCleanupPrompt: mock.fn(),
    onCleanupProposalInput: mock.fn(),
    onApplyCleanupChange: mock.fn(),
    onApplyCleanupCategory: mock.fn(),
    onApplyAllCleanupChanges: mock.fn(),
  })
}
function renderWorkspace() {
  renderBookmarkWorkspace(BOOKMARKS, true, true)
}
beforeEach(() => {
  setupDom()
  setupExt()
  global.boundHandlers = bindEvents()
  renderWorkspace()
})
describe('bookmarkManagerView selection', () => {
  test('shows an empty inspector, single-bookmark editing, and bulk actions for the current selection', () => {
    const dom = ext.dom.manager
    assert.strictEqual(dom.bookmarkInspectorEmpty.hidden, false)
    assert.strictEqual(dom.bookmarkEditFields.hidden, true)
    assert.strictEqual(dom.bookmarkTargetActions.hidden, true)
    assert.strictEqual(dom.clearManagedSelection.disabled, true)
    document.querySelector('[data-edit-managed-bookmark-id]').click()
    assert.strictEqual(dom.bookmarkInspectorEmpty.hidden, true)
    assert.strictEqual(dom.bookmarkEditFields.hidden, false)
    assert.strictEqual(dom.bookmarkTargetActions.hidden, false)
    assert.strictEqual(dom.bookmarkBulkSelectionNote.hidden, true)
    assert.strictEqual(document.querySelector('[data-edit-managed-bookmark-id]').getAttribute('aria-pressed'), 'true')
    dom.selectVisibleBookmarks.click()
    assert.strictEqual(dom.bookmarkEditFields.hidden, true)
    assert.strictEqual(dom.bookmarkTargetActions.hidden, false)
    assert.strictEqual(dom.bookmarkBulkSelectionNote.hidden, false)
    assert.strictEqual(dom.clearManagedSelection.disabled, false)
    dom.clearManagedSelection.click()
    assert.strictEqual(dom.bookmarkEditFields.hidden, false)
    assert.strictEqual(dom.bookmarkBulkSelectionNote.hidden, true)
    assert.deepStrictEqual(getSelectedManagedBookmarkIds(), [])
  })
  test('preserves unfinished edits while updating tag and move actions', () => {
    const dom = ext.dom.manager
    document.querySelector('[data-edit-managed-bookmark-id]').click()
    dom.bookmarkEditTitle.value = 'Unfinished title'
    dom.bookmarkEditUrl.value = 'https://example.com/new'
    dom.bookmarkEditScore.value = '42'
    dom.bookmarkEditTags.value = 'new-tag'
    dom.bulkTagsInput.value = 'bulk-tag'
    dom.bulkTagsInput.dispatchEvent(new Event('input'))
    dom.bookmarkMoveFolder.dispatchEvent(new Event('change'))
    assert.deepStrictEqual(getManagedBookmarkEditValues(), {
      title: 'Unfinished title',
      url: 'https://example.com/new',
      tags: ['new-tag'],
      customBonusScore: 42,
    })
    assert.strictEqual(dom.addTagsSelected.disabled, false)

    // Refreshing the dataset must still load the saved bookmark values.
    renderWorkspace()
    assert.strictEqual(dom.bookmarkEditTitle.value, 'First Bookmark')
    assert.strictEqual(dom.bookmarkEditScore.value, '25')
  })
  test('selects all matches even when the rendered list is capped', () => {
    const bookmarks = Array.from({ length: 501 }, (_, index) => ({ ...BOOKMARKS[0], originalId: String(index) }))
    renderBookmarkWorkspace(bookmarks, true, true)
    assert.strictEqual(document.querySelectorAll('[data-managed-bookmark-row-id]').length, 500)
    ext.dom.manager.selectVisibleBookmarks.click()
    assert.strictEqual(getSelectedManagedBookmarkIds().length, 501)
    assert(ext.dom.manager.managedBookmarkList.textContent.includes('Select matches selects all 501'))
    assert.strictEqual(ext.dom.manager.bookmarkSelectionSummary.textContent, '501 selected bookmarks')
  })
  test('temporarily checks the current bookmark until another row is clicked', () => {
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const inputs = document.querySelectorAll('[data-managed-bookmark-id]')
    rows[0].querySelector('.url').click()
    assert.strictEqual(rows[0].classList.contains('current'), true)
    assert.strictEqual(rows[0].classList.contains('selected'), true)
    assert.strictEqual(inputs[0].checked, true)
    assert.strictEqual(document.getElementById('bookmark-edit-title').disabled, false)
    assert.strictEqual(document.getElementById('bookmark-edit-score').disabled, false)
    assert.strictEqual(document.getElementById('bookmark-edit-score').value, '25')
    assert.deepStrictEqual(getSelectedManagedBookmarkIds(), [])
    document.getElementById('bookmark-edit-score').value = '42'
    assert.strictEqual(getManagedBookmarkEditValues().customBonusScore, 42)
    document.getElementById('bookmark-edit-score').value = '-5'
    assert.strictEqual(getManagedBookmarkEditValues().customBonusScore, 0)
    rows[1].querySelector('.url').click()
    assert.strictEqual(rows[0].classList.contains('selected'), false)
    assert.strictEqual(inputs[0].checked, false)
    assert.strictEqual(rows[1].classList.contains('current'), true)
    assert.strictEqual(rows[1].classList.contains('selected'), true)
    assert.strictEqual(inputs[1].checked, true)
    assert.deepStrictEqual(getSelectedManagedBookmarkIds(), [])
    assert.deepStrictEqual(getManagedActionTargetIds(), ['bookmark-2'])
  })
  test('stops temporary checkbox changes after a checkbox is manually clicked', () => {
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const inputs = document.querySelectorAll('[data-managed-bookmark-id]')
    rows[0].querySelector('.url').click()
    inputs[0].click()
    assert.strictEqual(inputs[0].checked, true)
    assert.deepStrictEqual(getSelectedManagedBookmarkIds(), ['bookmark-1'])
    rows[1].querySelector('.url').click()
    assert.strictEqual(rows[1].classList.contains('current'), true)
    assert.strictEqual(rows[1].classList.contains('selected'), false)
    assert.strictEqual(inputs[0].checked, true)
    assert.strictEqual(inputs[1].checked, false)
    assert.strictEqual(document.getElementById('bookmark-edit-title').disabled, true)
    assert.strictEqual(document.getElementById('bookmark-edit-url').disabled, true)
    assert.strictEqual(document.getElementById('bookmark-edit-score').disabled, true)
    assert.deepStrictEqual(getManagedActionTargetIds(), ['bookmark-1'])
    inputs[1].click()
    assert.strictEqual(rows[1].classList.contains('selected'), true)
    assert.strictEqual(inputs[1].checked, true)
    assert.strictEqual(document.getElementById('bookmark-edit-title').disabled, true)
    assert.deepStrictEqual(getSelectedManagedBookmarkIds(), ['bookmark-1', 'bookmark-2'])
  })
  test('shows tag suggestion feedback next to the suggest button', () => {
    showTagSuggestionStatus('No tags suggested', 'error')
    const status = document.getElementById('tag-suggestion-status')
    assert.strictEqual(status.textContent, 'No tags suggested')
    assert.strictEqual(status.dataset.tone, 'error')
    assert.strictEqual(document.getElementById('manager-status').textContent, '')
  })
  test('labels suggestion retry only while the target selection is unchanged', () => {
    ext.model.bookmarkManagerLocalAiAvailable = true
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const button = document.getElementById('suggest-tags-selected')
    rows[0].querySelector('.url').click()
    ext.model.bookmarkManagerTagSuggestionRetryKey = 'bookmark-1'
    ext.model.bookmarkManagerTagSuggestionRetryCount = 1
    showTagSuggestionBusy(false)
    assert.strictEqual(button.textContent, 'Suggest tags (try again)')
    rows[1].querySelector('.url').click()
    assert.strictEqual(button.textContent, 'Suggest tags')
  })
  test('clears suggested bulk tags when the action target changes', () => {
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const bulkTags = document.getElementById('bookmark-bulk-tags')
    const status = document.getElementById('tag-suggestion-status')
    rows[0].querySelector('.url').click()
    addManagerTagInputValues('bulk', ['suggested'])
    showTagSuggestionStatus('Suggested 1 tag', 'success', false)
    assert.strictEqual(ext.model.bookmarkManagerSuggestedTagsReady, true)
    assert.strictEqual(bulkTags.disabled, false)
    assert(bulkTags.value.includes('suggested'))
    assert.strictEqual(status.textContent, 'Suggested 1 tag')
    rows[1].querySelector('.url').click()
    assert.strictEqual(ext.model.bookmarkManagerSuggestedTagsReady, false)
    assert.strictEqual(bulkTags.disabled, false)
    assert.strictEqual(bulkTags.value, '')
    assert.strictEqual(status.textContent, '')
  })
  test('enables manual bulk tags without suggested tags', () => {
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const bulkTags = document.getElementById('bookmark-bulk-tags')
    const addButton = document.getElementById('add-tags-selected')
    rows[0].querySelector('.url').click()
    assert(!ext.model.bookmarkManagerSuggestedTagsReady)
    assert.strictEqual(bulkTags.disabled, false)
    assert.strictEqual(addButton.disabled, true)
    bulkTags.value = 'manual'
    bulkTags.dispatchEvent(new Event('input'))
    assert.strictEqual(addButton.disabled, false)
  })
  test('renders move folder options as indented folder names without repeated parent trails', () => {
    ext.model.bookmarkManager.folderOptions = [
      { id: 'parent', title: 'Parent', label: 'Parent', depth: 1 },
      { id: 'child', title: 'Child', label: 'Parent / Child', depth: 2 },
    ]
    renderWorkspace()
    const options = [...document.getElementById('bookmark-move-folder').options]
    assert.strictEqual(options[0].textContent, 'Parent')
    assert.strictEqual(options[1].textContent, '\u00a0\u00a0\u00a0\u00a0Child')
    assert(!options[1].textContent.includes('Parent / Child'))
    assert.strictEqual(options[1].title, 'Parent / Child')
  })
  test('renders move cleanup proposals with folder titles instead of ids', () => {
    ext.model.bookmarkManager.folderOptions = [{ id: '1199', title: 'GitHub PR', label: 'GitHub PR', depth: 1 }]
    renderBookmarkCleanupProposal(
      {
        changes: {
          addTags: [],
          removeTags: [],
          renameTags: [],
          moveBookmarks: [
            {
              id: 'move-1',
              bookmarkId: 'bookmark-1',
              targetFolderId: '1199',
              reason: 'GitHub PR folder is more specific than TMP.',
            },
          ],
          deleteBookmarks: [],
          rewriteTitles: [],
        },
      },
      ext.model.bookmarkManager,
    )
    assert(document.getElementById('cleanup-proposal-list').textContent.includes('Move to ~GitHub PR'))
    assert(!document.getElementById('cleanup-proposal-list').textContent.includes('~1199'))
  })
  test('renders rename cleanup proposals as tag scope changes', () => {
    renderBookmarkCleanupProposal(
      {
        changes: {
          addTags: [],
          removeTags: [],
          renameTags: [
            {
              id: 'rename-1',
              from: 'one',
              to: 'first',
              reason: 'Use a clearer tag.',
            },
          ],
          moveBookmarks: [],
          deleteBookmarks: [],
          rewriteTitles: [],
        },
      },
      ext.model.bookmarkManager,
    )
    const text = document.getElementById('cleanup-proposal-list').textContent
    assert(text.includes('1 bookmark with #one'))
    assert(text.includes('First Bookmark'))
    assert(text.includes('Rename #one to #first'))
    assert(!text.includes('Bookmark undefined'))
    assert(!text.includes('Bookmark not found'))
  })
  test('places apply all with the proposed changes review controls', () => {
    const applyAll = document.getElementById('apply-all-cleanup-changes')
    assert.notStrictEqual(applyAll.closest('.cleanup-review-section'), null)
    assert.strictEqual(applyAll.closest('.cleanup-result-panel'), null)
  })
  test('renders undo history with structured action details', () => {
    renderBookmarkUndoHistory(
      [
        {
          id: 'undo-1',
          createdAt: Date.UTC(2026, 0, 1, 12, 0),
          description: 'Changed tags',
          metadata: {
            action: 'updateTags',
            tagsAdded: ['ai'],
            tagsRemoved: ['old'],
            targetFolderId: 'folder-1',
            targetFolderLabel: 'Folder',
          },
          bookmarks: [{ id: 'bookmark-1', title: 'First Bookmark', url: 'https://example.com/first' }],
        },
      ],
      true,
    )
    const history = document.getElementById('bookmark-undo-history')
    assert(history.textContent.includes('Changed tags'))
    assert(history.textContent.includes('#ai'))
    assert(history.textContent.includes('#old'))
    assert(history.textContent.includes('~Folder'))
    assert(history.textContent.includes('First Bookmark'))
    assert.notStrictEqual(history.querySelector('[href*="tag=ai"]'), null)
  })
  test('selects and scrolls a tag from the tag manager URL', () => {
    const scrollIntoView = mock.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    ext.model.bookmarkManager.tagGroups = [
      { name: 'one', count: 1, bookmarkIds: ['bookmark-1'] },
      { name: 'two', count: 1, bookmarkIds: ['bookmark-2'] },
    ]
    ext.model.bookmarkManagerTagFilter = 'missing'
    document.getElementById('tag-filter').value = 'missing'
    window.history.replaceState(null, '', '/bookmarkManager.html?tag=two#tags')
    renderActiveManagerScreen()
    assert.strictEqual(ext.model.bookmarkManagerSelectedTag, 'two')
    assert.strictEqual(document.getElementById('tag-filter').value, '')
    assert.strictEqual(document.querySelector('.tag-manager-list .active .badge').textContent, '#two')
    assert.strictEqual(document.querySelector('[data-manager-panel="tags"]').hidden, false)
    assert(scrollIntoView.mock.calls.some((call) => matches(call.arguments, [{ block: 'nearest' }])))
  })
})
