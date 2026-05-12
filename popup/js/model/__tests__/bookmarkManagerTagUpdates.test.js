import { describe, expect, test } from '@jest/globals'

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
    expect(createTagUpdatePlans(bookmarks, (tags) => tags.map((tag) => tag.toLowerCase()))).toEqual([])

    const plans = createTagUpdatePlans(bookmarks, (tags) => tags.concat('AI'))

    expect(plans).toEqual([
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
    expect(
      createBulkTagDescription([
        {
          currentTags: ['Docs'],
          nextTags: ['Docs', 'AI'],
        },
      ]),
    ).toBe('Added tags "AI" to 1 bookmark')

    expect(
      createBulkTagDescription([
        {
          currentTags: ['Docs', 'AI'],
          nextTags: ['Docs'],
        },
      ]),
    ).toBe('Removed tags "AI" from 1 bookmark')

    expect(
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
    ).toBe('Changed tags on 2 bookmarks: added "AI"; removed "Read"')
  })

  test('creates deduplicated tag metadata for undo display', () => {
    expect(
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
    ).toEqual({
      action: 'updateTags',
      tagsAdded: ['AI'],
      tagsRemoved: ['Old'],
    })
  })
})
