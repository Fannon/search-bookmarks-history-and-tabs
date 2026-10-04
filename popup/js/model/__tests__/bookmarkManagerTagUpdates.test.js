import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createBulkTagDescription, createBulkTagMetadata, createTagUpdatePlans } from '../bookmarkManagerTagUpdates.js'

const bookmarks = [
  {
    originalId: 'bookmark-1',
    tagsArray: ['Docs', 'Read'],
  },
  {
    originalId: 'bookmark-2',
    tagsArray: ['docs'],
  },
]
describe('bookmark manager tag update plans', () => {
  test('creates update plans only when tags change case-insensitively', () => {
    assert.deepStrictEqual(
      createTagUpdatePlans(bookmarks, (tags) => tags.map((tag) => tag.toLowerCase())),
      [],
    )
    const plans = createTagUpdatePlans(bookmarks, (tags) => tags.concat('AI'))
    assert.deepStrictEqual(plans, [
      {
        bookmark: bookmarks[0],
        currentTags: ['Docs', 'Read'],
        nextTags: ['Docs', 'Read', 'AI'],
      },
      {
        bookmark: bookmarks[1],
        currentTags: ['docs'],
        nextTags: ['docs', 'AI'],
      },
    ])
  })
  test('describes added, removed, and changed tag plans', () => {
    assert.strictEqual(
      createBulkTagDescription([
        {
          currentTags: ['Docs'],
          nextTags: ['Docs', 'AI'],
        },
      ]),
      'Added tags "AI" to 1 bookmark',
    )
    assert.strictEqual(
      createBulkTagDescription([
        {
          currentTags: ['Docs', 'AI'],
          nextTags: ['Docs'],
        },
      ]),
      'Removed tags "AI" from 1 bookmark',
    )
    assert.strictEqual(
      createBulkTagDescription([
        {
          currentTags: ['Docs', 'Read'],
          nextTags: ['Docs', 'AI'],
        },
        {
          currentTags: ['docs'],
          nextTags: ['docs', 'AI'],
        },
      ]),
      'Changed tags on 2 bookmarks: added "AI"; removed "Read"',
    )
  })
  test('creates deduplicated tag metadata for undo display', () => {
    assert.deepStrictEqual(
      createBulkTagMetadata([
        {
          currentTags: ['Docs'],
          nextTags: ['Docs', 'AI'],
        },
        {
          currentTags: ['docs', 'Old'],
          nextTags: ['docs', 'ai'],
        },
      ]),
      {
        action: 'updateTags',
        tagsAdded: ['AI'],
        tagsRemoved: ['Old'],
      },
    )
  })
})
