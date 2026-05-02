import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import {
  BOOKMARK_MANAGER_UNDO_KEY,
  BOOKMARK_MANAGER_UNDO_LIMIT,
  createBookmarkSnapshotEntry,
  createBookmarkUndoSnapshot,
  getBookmarkUndoSnapshots,
  removeBookmarkUndoSnapshot,
  saveBookmarkUndoSnapshot,
} from '../bookmarkManagerUndo.js'

beforeEach(() => {
  localStorage.clear()
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

  test('stores newest snapshots first and limits history length', () => {
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

  test('removes snapshots by id and ignores malformed storage', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
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

    localStorage.setItem(BOOKMARK_MANAGER_UNDO_KEY, '{broken')
    expect(getBookmarkUndoSnapshots()).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith('Could not read bookmark manager undo snapshots.', expect.any(SyntaxError))
  })
})
