import { describe, expect, test } from '@jest/globals'

import {
  createCleanupApplyEntry,
  createCleanupApplyResult,
  createCleanupUndoMetadata,
  formatCleanupApplyEntries,
} from '../bookmarkCleanupApply.js'

describe('bookmark cleanup apply helpers', () => {
  test('creates apply results and entries for status reporting', () => {
    const result = createCleanupApplyResult(true)
    const error = new Error('Browser API failed')

    result.applied.push(createCleanupApplyEntry('addTags', { id: 'add-1' }, ['bookmark-1']))
    result.failed.push(createCleanupApplyEntry('deleteBookmarks', { id: 'delete-1' }, ['bookmark-2'], error))

    expect(result).toEqual({
      snapshotCreated: true,
      applied: [
        {
          type: 'addTags',
          changeId: 'add-1',
          bookmarkIds: ['bookmark-1'],
          errorMessage: '',
        },
      ],
      failed: [
        {
          type: 'deleteBookmarks',
          changeId: 'delete-1',
          bookmarkIds: ['bookmark-2'],
          errorMessage: 'Browser API failed',
        },
      ],
    })
    expect(formatCleanupApplyEntries(result.failed)).toBe('delete-1 bookmarks bookmark-2: Browser API failed')
  })

  test('creates cleanup undo metadata from proposed changes', () => {
    expect(
      createCleanupUndoMetadata(
        [
          { type: 'addTags', change: { tags: ['Docs', 'docs', 'AI'] } },
          { type: 'removeTags', change: { tags: ['old', 'Old'] } },
          { type: 'renameTags', change: { from: 'llm', to: 'ai' } },
          { type: 'moveBookmarks', change: { targetFolderId: 'folder-1' } },
          { type: 'moveBookmarks', change: { targetFolderId: 'folder-2', targetFolderPath: 'Other' } },
        ],
        (folderId) => (folderId === 'folder-1' ? 'References' : ''),
      ),
    ).toEqual({
      action: 'aiCleanup',
      tagsAdded: ['Docs', 'AI'],
      tagsRemoved: ['old'],
      tagRenames: [{ from: 'llm', to: 'ai' }],
      targetFolderId: 'folder-1',
      targetFolderLabel: 'References',
    })
  })

  test('prefers explicit cleanup target folder paths in undo metadata', () => {
    expect(
      createCleanupUndoMetadata(
        [{ type: 'moveBookmarks', change: { targetFolderId: 'folder-1', targetFolderPath: 'Work / Docs' } }],
        () => 'Fallback',
      ),
    ).toEqual({
      action: 'aiCleanup',
      tagsAdded: [],
      tagsRemoved: [],
      tagRenames: [],
      targetFolderId: 'folder-1',
      targetFolderLabel: 'Work / Docs',
    })
  })
})
