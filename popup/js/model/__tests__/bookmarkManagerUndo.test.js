import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import { any, containsText, matches } from '../../../../test/patterns.js'
import {
  BOOKMARK_MANAGER_UNDO_LIMIT,
  clearBookmarkUndoSnapshots,
  createBookmarkSnapshotEntry,
  createBookmarkUndoSnapshot,
  createUndoHistoryExport,
  createUndoHistoryExportFilename,
  getBookmarkUndoSnapshots,
  parseUndoHistoryImport,
  removeBookmarkUndoSnapshot,
  saveBookmarkUndoSnapshot,
} from '../bookmarkManagerUndo.js'

beforeEach(() => {
  clearBookmarkUndoSnapshots()
  mock.method(Math, 'random', () => 0.123456)
})
afterEach(() => {
  mock.restoreAll()
})
describe('bookmark manager undo snapshots', () => {
  test('creates compact restorable bookmark snapshots', () => {
    assert.deepStrictEqual(
      createBookmarkSnapshotEntry({
        id: 12,
        parentId: 4,
        index: 2,
        title: 'Example #tag',
        url: 'https://example.test',
      }),
      {
        id: '12',
        parentId: '4',
        index: 2,
        title: 'Example #tag',
        url: 'https://example.test',
      },
    )
    assert.strictEqual(createBookmarkSnapshotEntry({ id: 1, title: 'Folder' }), null)
  })
  test('keeps newest in-memory snapshots first and limits history length', () => {
    for (let i = 0; i < BOOKMARK_MANAGER_UNDO_LIMIT + 2; i++) {
      const snapshot = createBookmarkUndoSnapshot(
        `Changed ${i}`,
        [
          {
            id: String(i),
            parentId: 'root',
            title: `Bookmark ${i}`,
            url: `https://example.test/${i}`,
          },
        ],
        i,
      )
      saveBookmarkUndoSnapshot(snapshot)
    }
    const snapshots = getBookmarkUndoSnapshots()
    assert.strictEqual(snapshots.length, BOOKMARK_MANAGER_UNDO_LIMIT)
    assert.strictEqual(snapshots[0].description, `Changed ${BOOKMARK_MANAGER_UNDO_LIMIT + 1}`)
    assert.strictEqual(snapshots.at(-1).description, 'Changed 2')
  })
  test('stores normalized display metadata', () => {
    const snapshot = createBookmarkUndoSnapshot(
      'Added tags',
      [
        {
          id: 'bookmark-1',
          title: 'Bookmark',
          url: 'https://example.test',
        },
      ],
      1,
      {
        action: 'addTags',
        tagsAdded: ['Docs', 'docs', '', 'AI'],
        tagsRemoved: ['old'],
        tagRenames: [
          { from: 'llm', to: 'ai' },
          { from: '', to: 'missing' },
        ],
        targetFolderId: 42,
        targetFolderLabel: 'References',
      },
    )
    assert.deepStrictEqual(snapshot.metadata, {
      action: 'addTags',
      tagsAdded: ['Docs', 'AI'],
      tagsRemoved: ['old'],
      tagRenames: [{ from: 'llm', to: 'ai' }],
      targetFolderId: '42',
      targetFolderLabel: 'References',
    })
  })
  test('removes snapshots by id and clears in-memory history', () => {
    const firstSnapshot = createBookmarkUndoSnapshot(
      'First change',
      [
        {
          id: 'first',
          title: 'First',
          url: 'https://first.test',
        },
      ],
      1,
    )
    const secondSnapshot = createBookmarkUndoSnapshot(
      'Second change',
      [
        {
          id: 'second',
          title: 'Second',
          url: 'https://second.test',
        },
      ],
      2,
    )
    saveBookmarkUndoSnapshot(firstSnapshot)
    saveBookmarkUndoSnapshot(secondSnapshot)
    assert.deepStrictEqual(
      removeBookmarkUndoSnapshot(secondSnapshot.id).map((snapshot) => snapshot.description),
      ['First change'],
    )
    clearBookmarkUndoSnapshots()
    assert.deepStrictEqual(getBookmarkUndoSnapshots(), [])
  })
  test('exports undo history as a portable payload', () => {
    const snapshot = createBookmarkUndoSnapshot(
      'Moved bookmark',
      [
        {
          id: 'bookmark-1',
          parentId: 'folder-1',
          index: 3,
          title: 'Bookmark #tag',
          url: 'https://example.test',
        },
      ],
      Date.UTC(2026, 4, 9, 12, 30),
      { action: 'move', targetFolderLabel: 'Folder' },
    )
    const payload = createUndoHistoryExport([snapshot])
    assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert(
      matches(payload, {
        version: 'bookmark-undo-history/v1',
        exportedAt: payload.exportedAt,
        note: containsText('Undo snapshots restore previous bookmark state'),
        snapshots: [
          {
            id: snapshot.id,
            createdAt: '2026-05-09T12:30:00.000Z',
            description: 'Moved bookmark',
            metadata: {
              action: 'move',
              tagsAdded: [],
              tagsRemoved: [],
              tagRenames: [],
              targetFolderId: '',
              targetFolderLabel: 'Folder',
            },
            bookmarks: [
              {
                id: 'bookmark-1',
                parentId: 'folder-1',
                index: 3,
                title: 'Bookmark #tag',
                url: 'https://example.test',
              },
            ],
          },
        ],
      }),
    )
  })
  test('parses imported undo history and skips empty snapshots', () => {
    const snapshots = parseUndoHistoryImport({
      version: 'bookmark-undo-history/v1',
      snapshots: [
        {
          createdAt: '2026-05-09T12:30:00.000Z',
          description: 'Imported change',
          metadata: { tagsAdded: ['Docs'] },
          bookmarks: [
            {
              id: 'bookmark-1',
              title: 'Bookmark',
              url: 'https://example.test',
            },
          ],
        },
        {
          createdAt: '2026-05-09T12:31:00.000Z',
          description: 'Empty change',
          bookmarks: [],
        },
      ],
    })
    assert.strictEqual(snapshots.length, 1)
    assert(
      matches(snapshots[0], {
        id: any(String),
        createdAt: Date.UTC(2026, 4, 9, 12, 30),
        description: 'Imported change',
        metadata: {
          action: '',
          tagsAdded: ['Docs'],
          tagsRemoved: [],
          tagRenames: [],
          targetFolderId: '',
          targetFolderLabel: '',
        },
        bookmarks: [
          {
            id: 'bookmark-1',
            parentId: '',
            index: undefined,
            title: 'Bookmark',
            url: 'https://example.test',
          },
        ],
      }),
    )
  })
  test('rejects invalid undo history imports', () => {
    assert.throws(
      () => parseUndoHistoryImport({ version: 'unknown', snapshots: [] }),
      new RegExp(RegExp.escape('Undo history JSON must use version "bookmark-undo-history/v1".')),
    )
    assert.throws(
      () => parseUndoHistoryImport({ version: 'bookmark-undo-history/v1' }),
      new RegExp(RegExp.escape('Undo history JSON must include a snapshots array.')),
    )
  })
  test('creates undo export filenames from local time', () => {
    assert.strictEqual(
      createUndoHistoryExportFilename(new Date('2026-05-09T12:30:05')),
      'bookmark-manager-undo-history-2026-05-09-12-30-05.json',
    )
  })
})
