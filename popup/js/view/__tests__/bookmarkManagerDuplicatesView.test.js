import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
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
    assert(
      renderDuplicateSummary({
        duplicateGroupCount: 1,
        duplicateBookmarkCount: 2,
        removableDuplicateCount: 1,
      }).includes('2 bookmarks share URLs'),
    )
    assert(html.includes('Best candidate'))
    assert(html.includes('data-delete-bookmark-id="copy" checked'))
    assert(!html.includes('data-delete-bookmark-id="keep" checked'))
    assert(!html.includes('Bookmark deletion is unavailable'))
  })
  test('renders disabled controls in preview contexts', () => {
    const html = renderDuplicates(duplicateGroups, false)
    assert(html.includes('Bookmark deletion is unavailable'))
    assert(html.includes('data-delete-bookmark-id="copy" checked disabled'))
    assert(html.includes('duplicate-delete-button'))
    assert(renderDuplicates([], true).includes('No duplicate bookmark URLs'))
    assert(renderDuplicateSummary({ duplicateGroupCount: 0 }).includes('No duplicate bookmark URLs'))
  })
})
