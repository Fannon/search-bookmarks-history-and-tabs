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
 * @param {Object} [metadata={}] Structured change metadata for display.
 * @returns {Object} Undo snapshot.
 */
export function createBookmarkUndoSnapshot(description, bookmarks = [], createdAt = Date.now(), metadata = {}) {
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
    metadata: normalizeUndoMetadata(metadata),
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

/**
 * Create a portable JSON payload for bookmark manager undo snapshots.
 *
 * @param {Array<Object>} snapshots Undo snapshots.
 * @returns {Object} Export payload.
 */
export function createUndoHistoryExport(snapshots) {
  return {
    version: 'bookmark-undo-history/v1',
    exportedAt: new Date().toISOString(),
    note: 'Undo snapshots restore previous bookmark state. They are not change proposals because they need prior title, URL, parent folder, and index data.',
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      createdAt: new Date(snapshot.createdAt).toISOString(),
      description: snapshot.description,
      metadata: snapshot.metadata || {},
      bookmarks: snapshot.bookmarks.map((bookmark) => ({
        id: bookmark.id,
        parentId: bookmark.parentId || '',
        index: Number.isInteger(bookmark.index) ? bookmark.index : undefined,
        title: bookmark.title,
        url: bookmark.url,
      })),
    })),
  }
}

/**
 * Parse exported bookmark manager undo JSON.
 *
 * @param {Object} payload Export payload.
 * @returns {Array<Object>} Normalized undo snapshots.
 */
export function parseUndoHistoryImport(payload) {
  if (!payload || typeof payload !== 'object' || payload.version !== 'bookmark-undo-history/v1') {
    throw new Error('Undo history JSON must use version "bookmark-undo-history/v1".')
  }
  if (!Array.isArray(payload.snapshots)) {
    throw new Error('Undo history JSON must include a snapshots array.')
  }

  const snapshots = []
  for (let i = 0; i < payload.snapshots.length; i++) {
    const snapshot = normalizeImportedUndoSnapshot(payload.snapshots[i], i)
    if (snapshot) {
      snapshots.push(snapshot)
    }
  }
  return snapshots
}

/**
 * Create the default undo-history export filename.
 *
 * @param {Date} [now=new Date()] Current date.
 * @returns {string} Filename.
 */
export function createUndoHistoryExportFilename(now = new Date()) {
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8).replaceAll(':', '-')
  return `bookmark-manager-undo-history-${date}-${time}.json`
}

function normalizeUndoMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {}
  }

  return {
    action: String(metadata.action || '').trim(),
    tagsAdded: normalizeStringList(metadata.tagsAdded),
    tagsRemoved: normalizeStringList(metadata.tagsRemoved),
    tagRenames: normalizeTagRenames(metadata.tagRenames),
    targetFolderId: String(metadata.targetFolderId || '').trim(),
    targetFolderLabel: String(metadata.targetFolderLabel || '').trim(),
  }
}

function normalizeImportedUndoSnapshot(snapshot, index) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.bookmarks) || !snapshot.bookmarks.length) {
    return null
  }

  const createdAt = Number.isFinite(Date.parse(snapshot.createdAt)) ? Date.parse(snapshot.createdAt) : Date.now()
  return createBookmarkUndoSnapshot(
    snapshot.description || `Imported undo snapshot ${index + 1}`,
    snapshot.bookmarks,
    createdAt,
    snapshot.metadata || {},
  )
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return []
  }

  const result = []
  const seen = new Set()
  for (let i = 0; i < values.length; i++) {
    const value = String(values[i] || '').trim()
    const key = value.toLowerCase()
    if (value && !seen.has(key)) {
      seen.add(key)
      result.push(value)
    }
  }
  return result
}

function normalizeTagRenames(renames) {
  if (!Array.isArray(renames)) {
    return []
  }

  const result = []
  for (let i = 0; i < renames.length; i++) {
    const from = String(renames[i]?.from || '').trim()
    const to = String(renames[i]?.to || '').trim()
    if (from && to) {
      result.push({ from, to })
    }
  }
  return result
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
