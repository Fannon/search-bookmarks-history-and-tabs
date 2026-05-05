/**
 * @file Local undo snapshot storage for bookmark manager mutations.
 */

export const BOOKMARK_MANAGER_UNDO_KEY = 'bookmarkManagerUndoSnapshots'
export const BOOKMARK_MANAGER_UNDO_LIMIT = 10

/**
 * Load recent bookmark manager undo snapshots.
 *
 * @param {Storage} [storage=globalThis.localStorage] Web storage.
 * @returns {Array<Object>} Undo snapshots, newest first.
 */
export function getBookmarkUndoSnapshots(storage = globalThis.localStorage) {
  if (!storage) {
    return []
  }

  try {
    const rawSnapshots = storage.getItem(BOOKMARK_MANAGER_UNDO_KEY)
    const snapshots = rawSnapshots ? JSON.parse(rawSnapshots) : []
    return Array.isArray(snapshots) ? snapshots.filter(isValidSnapshot) : []
  } catch (error) {
    console.warn('Could not read bookmark manager undo snapshots.', error)
    return []
  }
}

/**
 * Store one undo snapshot, keeping only the newest snapshots.
 *
 * @param {Object} snapshot Undo snapshot.
 * @param {Storage} [storage=globalThis.localStorage] Web storage.
 * @returns {Array<Object>} Stored snapshots.
 */
export function saveBookmarkUndoSnapshot(snapshot, storage = globalThis.localStorage) {
  if (!storage) {
    throw new Error('Bookmark undo storage is unavailable.')
  }
  if (!isValidSnapshot(snapshot)) {
    throw new Error('Bookmark undo snapshot is empty or invalid.')
  }

  const snapshots = getBookmarkUndoSnapshots(storage).filter((entry) => entry.id !== snapshot.id)
  snapshots.unshift(snapshot)
  const limitedSnapshots = snapshots.slice(0, BOOKMARK_MANAGER_UNDO_LIMIT)
  storage.setItem(BOOKMARK_MANAGER_UNDO_KEY, JSON.stringify(limitedSnapshots))
  return limitedSnapshots
}

/**
 * Remove one stored undo snapshot.
 *
 * @param {string} snapshotId Snapshot id.
 * @param {Storage} [storage=globalThis.localStorage] Web storage.
 * @returns {Array<Object>} Remaining snapshots.
 */
export function removeBookmarkUndoSnapshot(snapshotId, storage = globalThis.localStorage) {
  if (!storage) {
    return []
  }

  const snapshots = getBookmarkUndoSnapshots(storage).filter((snapshot) => snapshot.id !== snapshotId)
  storage.setItem(BOOKMARK_MANAGER_UNDO_KEY, JSON.stringify(snapshots))
  return snapshots
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
