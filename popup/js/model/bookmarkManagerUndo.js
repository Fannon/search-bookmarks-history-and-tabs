/**
 * @file In-memory undo snapshot storage for bookmark manager mutations.
 */

export const BOOKMARK_MANAGER_UNDO_LIMIT = 50

let bookmarkUndoSnapshots = []

/**
 * Load recent bookmark manager undo steps.
 *
 * @returns {Array<Object>} Undo snapshots, newest first.
 */
export function getBookmarkUndoSnapshots() {
  return bookmarkUndoSnapshots.filter(isValidSnapshot)
}

/**
 * Store one undo snapshot, keeping only the newest in-memory steps.
 *
 * @param {Object} snapshot Undo snapshot.
 * @returns {Array<Object>} Stored snapshots.
 */
export function saveBookmarkUndoSnapshot(snapshot) {
  if (!isValidSnapshot(snapshot)) {
    throw new Error('Bookmark undo snapshot is empty or invalid.')
  }

  const snapshots = getBookmarkUndoSnapshots().filter((entry) => entry.id !== snapshot.id)
  snapshots.unshift(snapshot)
  bookmarkUndoSnapshots = snapshots.slice(0, BOOKMARK_MANAGER_UNDO_LIMIT)
  return getBookmarkUndoSnapshots()
}

/**
 * Remove one undo snapshot.
 *
 * @param {string} snapshotId Snapshot id.
 * @returns {Array<Object>} Remaining snapshots.
 */
export function removeBookmarkUndoSnapshot(snapshotId) {
  bookmarkUndoSnapshots = getBookmarkUndoSnapshots().filter((snapshot) => snapshot.id !== snapshotId)
  return getBookmarkUndoSnapshots()
}

/**
 * Clear all in-memory undo snapshots.
 *
 * @returns {Array<Object>} Empty undo history.
 */
export function clearBookmarkUndoSnapshots() {
  bookmarkUndoSnapshots = []
  return bookmarkUndoSnapshots
}

/**
 * Create an undo snapshot from current browser bookmark nodes.
 *
 * @param {string} description Human-readable change description.
 * @param {Array<Object>} bookmarks Browser bookmark nodes.
 * @param {number} [createdAt=Date.now()] Snapshot timestamp.
 * @returns {Object} Undo snapshot.
 */
export function createBookmarkUndoSnapshot(description, bookmarks = [], createdAt = Date.now()) {
  const snapshotBookmarks = []

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = createBookmarkSnapshotEntry(bookmarks[i])
    if (bookmark) {
      snapshotBookmarks.push(bookmark)
    }
  }

  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt,
    description: String(description || '').trim() || 'Changed bookmarks',
    bookmarks: snapshotBookmarks,
  }
}

/**
 * Create a compact restorable bookmark entry.
 *
 * @param {Object} bookmark Browser bookmark node.
 * @returns {Object|null} Snapshot entry.
 */
export function createBookmarkSnapshotEntry(bookmark) {
  const id = bookmark?.id ?? bookmark?.originalId
  const url = bookmark?.url ?? bookmark?.originalUrl

  if (id === undefined || !url) {
    return null
  }

  return {
    id: String(id),
    parentId: bookmark.parentId ? String(bookmark.parentId) : '',
    index: Number.isInteger(bookmark.index) ? bookmark.index : undefined,
    title: String(bookmark.title || ''),
    url: String(url),
  }
}

function isValidSnapshot(snapshot) {
  return Boolean(
    snapshot &&
      typeof snapshot.id === 'string' &&
      typeof snapshot.description === 'string' &&
      Array.isArray(snapshot.bookmarks) &&
      snapshot.bookmarks.length,
  )
}
