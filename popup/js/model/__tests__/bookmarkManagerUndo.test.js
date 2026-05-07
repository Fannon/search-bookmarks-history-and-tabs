import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import {
  BOOKMARK_MANAGER_UNDO_LIMIT,
  clearBookmarkUndoSnapshots,
  createBookmarkSnapshotEntry,
  createBookmarkUndoSnapshot,
  getBookmarkUndoSnapshots,
  removeBookmarkUndoSnapshot,
  saveBookmarkUndoSnapshot,
} from '../bookmarkManagerUndo.js'

beforeEach(() => {
  clearBookmarkUndoSnapshots()
  jest.spyOn(Math, 'random').mockReturnValue(0.123456)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('bookmark manager undo snapshots', () => {
  test('creates compact restorable bookmark snapshots', () => {
    expect(
      createBookmarkSnapshotEntry({
        id: 12,
        parentId: 4,
        index: 2,
        title: 'Example #tag',
        url: 'https://example.test',
      }),
    ).toEqual({
      id: '12',
      parentId: '4',
      index: 2,
      title: 'Example #tag',
      url: 'https://example.test',
    })

    expect(createBookmarkSnapshotEntry({ id: 1, title: 'Folder' })).toBe(null)
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

    expect(snapshots).toHaveLength(BOOKMARK_MANAGER_UNDO_LIMIT)
    expect(snapshots[0].description).toBe(`Changed ${BOOKMARK_MANAGER_UNDO_LIMIT + 1}`)
    expect(snapshots.at(-1).description).toBe('Changed 2')
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

    expect(snapshot.metadata).toEqual({
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

    expect(removeBookmarkUndoSnapshot(secondSnapshot.id).map((snapshot) => snapshot.description)).toEqual([
      'First change',
    ])

    clearBookmarkUndoSnapshots()
    expect(getBookmarkUndoSnapshots()).toEqual([])
  })
})
