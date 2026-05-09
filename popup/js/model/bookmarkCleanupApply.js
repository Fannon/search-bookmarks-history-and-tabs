/**
 * @file Pure bookkeeping helpers for applying bookmark cleanup changes.
 */

export function createCleanupApplyResult(snapshotCreated) {
  return {
    snapshotCreated,
    applied: [],
    failed: [],
  }
}

export function createCleanupApplyEntry(type, change, bookmarkIds, error) {
  return {
    type,
    changeId: String(change?.id || type),
    bookmarkIds,
    errorMessage: error?.message || '',
  }
}

export function formatCleanupApplyEntries(entries) {
  return entries
    .map((entry) => {
      const bookmarks = entry.bookmarkIds.length ? ` bookmarks ${entry.bookmarkIds.join(', ')}` : ''
      const error = entry.errorMessage ? `: ${entry.errorMessage}` : ''
      return `${entry.changeId}${bookmarks}${error}`
    })
    .join('; ')
}

export function createCleanupUndoMetadata(changes, getFolderLabel = () => '') {
  const metadata = {
    action: 'aiCleanup',
    tagsAdded: [],
    tagsRemoved: [],
    tagRenames: [],
    targetFolderId: '',
    targetFolderLabel: '',
  }

  for (let i = 0; i < changes.length; i++) {
    const { type, change } = changes[i]
    if (type === 'addTags') {
      appendUniqueValues(metadata.tagsAdded, change.tags || [])
    } else if (type === 'removeTags') {
      appendUniqueValues(metadata.tagsRemoved, change.tags || [])
    } else if (type === 'renameTags') {
      metadata.tagRenames.push({ from: change.from, to: change.to })
    } else if (type === 'moveBookmarks' && !metadata.targetFolderId) {
      metadata.targetFolderId = String(change.targetFolderId || '')
      metadata.targetFolderLabel = String(change.targetFolderPath || getFolderLabel(change.targetFolderId) || '')
    }
  }

  return metadata
}

function appendUniqueValues(result, values) {
  const seen = new Set(result.map((value) => value.toLowerCase()))
  for (let i = 0; i < values.length; i++) {
    const value = String(values[i] || '').trim()
    const key = value.toLowerCase()
    if (value && !seen.has(key)) {
      seen.add(key)
      result.push(value)
    }
  }
}
