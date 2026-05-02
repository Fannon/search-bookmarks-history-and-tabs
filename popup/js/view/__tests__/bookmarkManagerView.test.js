import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import {
  bindBookmarkManagerEvents,
  getBookmarkManagerDom,
  getManagedActionTargetIds,
  getSelectedManagedBookmarkIds,
  renderBookmarkWorkspace,
  setManagedBookmarkSelected,
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
  document.body.innerHTML = `
    <div id="manager-status"></div>
    <input id="bookmark-manager-search" />
    <div id="bookmark-folder-tree"></div>
    <div id="bookmark-browser-summary"></div>
    <div id="managed-bookmark-list"></div>
    <button id="select-visible-bookmarks"></button>
    <button id="clear-managed-selection"></button>
    <div id="bookmark-selection-summary"></div>
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
    <button id="delete-selected"><span data-selected-count></span></button>
    <button id="select-suggested"></button>
    <button id="select-none"></button>
    <button id="refresh-bookmarks"></button>
    <div id="manager-load"></div>
    <a data-manager-tab="bookmarks"></a>
    <section data-manager-panel="bookmarks"></section>
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
        move: jest.fn(),
        update: jest.fn(),
      },
    },
  }
  window.ext = global.ext
  ext.dom.manager = getBookmarkManagerDom()
}

function bindEvents() {
  bindBookmarkManagerEvents({
    onRefresh: jest.fn(),
    onDeleteSelected: jest.fn(),
    onDeleteOne: jest.fn(),
    onBookmarkSearch: jest.fn(),
    onSelectBookmark: setManagedBookmarkSelected,
    onSaveBookmark: jest.fn(),
    onMoveSelected: jest.fn(),
    onSuggestTagsSelected: jest.fn(),
    onBulkTagSelected: jest.fn(),
    onRenameTag: jest.fn(),
    onRemoveTag: jest.fn(),
    onOpenBookmark: jest.fn(),
    onBookmarkNavigation: jest.fn(),
  })
}

function renderWorkspace() {
  renderBookmarkWorkspace(BOOKMARKS, true, true)
}

beforeEach(() => {
  setupDom()
  setupExt()
  bindEvents()
  renderWorkspace()
})

describe('bookmarkManagerView selection', () => {
  test('temporarily checks the current bookmark until another row is clicked', () => {
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const inputs = document.querySelectorAll('[data-managed-bookmark-id]')

    rows[0].querySelector('.url').click()

    expect(rows[0].classList.contains('current')).toBe(true)
    expect(rows[0].classList.contains('selected')).toBe(true)
    expect(inputs[0].checked).toBe(true)
    expect(document.getElementById('bookmark-edit-title').disabled).toBe(false)
    expect(getSelectedManagedBookmarkIds()).toEqual([])

    rows[1].querySelector('.url').click()

    expect(rows[0].classList.contains('selected')).toBe(false)
    expect(inputs[0].checked).toBe(false)
    expect(rows[1].classList.contains('current')).toBe(true)
    expect(rows[1].classList.contains('selected')).toBe(true)
    expect(inputs[1].checked).toBe(true)
    expect(getSelectedManagedBookmarkIds()).toEqual([])
    expect(getManagedActionTargetIds()).toEqual(['bookmark-2'])
  })

  test('stops temporary checkbox changes after a checkbox is manually clicked', () => {
    const rows = document.querySelectorAll('[data-managed-bookmark-row-id]')
    const inputs = document.querySelectorAll('[data-managed-bookmark-id]')

    rows[0].querySelector('.url').click()
    inputs[0].click()

    expect(inputs[0].checked).toBe(true)
    expect(getSelectedManagedBookmarkIds()).toEqual(['bookmark-1'])

    rows[1].querySelector('.url').click()

    expect(rows[1].classList.contains('current')).toBe(true)
    expect(rows[1].classList.contains('selected')).toBe(false)
    expect(inputs[0].checked).toBe(true)
    expect(inputs[1].checked).toBe(false)
    expect(document.getElementById('bookmark-edit-title').disabled).toBe(true)
    expect(document.getElementById('bookmark-edit-url').disabled).toBe(true)
    expect(getManagedActionTargetIds()).toEqual(['bookmark-1'])

    inputs[1].click()

    expect(rows[1].classList.contains('selected')).toBe(true)
    expect(inputs[1].checked).toBe(true)
    expect(document.getElementById('bookmark-edit-title').disabled).toBe(true)
    expect(getSelectedManagedBookmarkIds()).toEqual(['bookmark-1', 'bookmark-2'])
  })

  test('shows tag suggestion feedback next to the suggest button', () => {
    showTagSuggestionStatus('No tags suggested', 'error')

    const status = document.getElementById('tag-suggestion-status')
    expect(status.textContent).toBe('No tags suggested')
    expect(status.dataset.tone).toBe('error')
    expect(document.getElementById('manager-status').textContent).toBe('')
  })
})
