import { describe, expect, test } from '@jest/globals'

import { renderDuplicateSummary, renderDuplicates } from '../bookmarkManagerDuplicatesView.js'

const duplicateGroups = [
  {
    displayUrl: 'https://example.test',
    keepId: 'keep',
    count: 2,
    bookmarks: [
      {
        originalId: 'keep',
        title: 'Keep',
        originalUrl: 'https://example.test',
        url: 'example.test',
        folderArray: ['Work'],
        tagsArray: ['docs'],
        dateAdded: 2,
        duplicateSuggestion: {
          recommended: true,
          label: 'Best candidate',
          detail: 'More complete metadata.',
        },
      },
      {
        originalId: 'copy',
        title: 'Copy',
        originalUrl: 'https://example.test',
        url: 'example.test',
        folderArray: ['Inbox'],
        tagsArray: [],
        dateAdded: 1,
        duplicateSuggestion: {
          recommended: false,
          label: 'Lower-ranked copy',
          detail: 'Fewer tags.',
        },
      },
    ],
  },
]

describe('bookmark manager duplicates rendering', () => {
  test('renders summary and deletion controls when bookmark API is available', () => {
    const html = renderDuplicates(duplicateGroups, true)

    expect(
      renderDuplicateSummary({ duplicateGroupCount: 1, duplicateBookmarkCount: 2, removableDuplicateCount: 1 }),
    ).toContain('2 bookmarks share URLs')
    expect(html).toContain('Best candidate')
    expect(html).toContain('data-delete-bookmark-id="copy" checked')
    expect(html).not.toContain('data-delete-bookmark-id="keep" checked')
    expect(html).not.toContain('Bookmark deletion is unavailable')
  })

  test('renders disabled controls in preview contexts', () => {
    const html = renderDuplicates(duplicateGroups, false)

    expect(html).toContain('Bookmark deletion is unavailable')
    expect(html).toContain('data-delete-bookmark-id="copy" checked disabled')
    expect(html).toContain('duplicate-delete-button')
    expect(renderDuplicates([], true)).toContain('No duplicate bookmark URLs')
    expect(renderDuplicateSummary({ duplicateGroupCount: 0 })).toContain('No duplicate bookmark URLs')
  })
})
