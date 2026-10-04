import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createDomainBookmarkHref,
  createFolderBookmarkHref,
  createTagManagerHref,
  renderRecentBookmarks,
  renderStats,
  renderTagSummary,
  renderTopList,
} from '../bookmarkManagerOverviewView.js'

function createBookmarks(count) {
  return Array.from({ length: count }, (_, index) => ({
    originalId: String(index + 1),
    title: `Bookmark ${index + 1}`,
    originalUrl: `https://example.test/${index + 1}`,
    url: `example.test/${index + 1}`,
    dateAdded: index + 1,
    folderArray: ['Folder'],
    tagsArray: ['tag'],
  }))
}
describe('bookmark manager overview rendering', () => {
  test('renders overview stats and tag summary', () => {
    const stats = {
      bookmarkCount: 10,
      duplicateGroupCount: 2,
      removableDuplicateCount: 3,
      taggedBookmarkCount: 8,
      untaggedBookmarkCount: 2,
      uniqueTagCount: 4,
      tagAssignmentCount: 12,
      averageTagsPerBookmark: 1.2,
      averageTagsPerTaggedBookmark: 1.5,
      uniqueDomainCount: 6,
    }
    assert(renderStats(stats).includes('Bookmarks'))
    assert(renderStats(stats).includes('Manage tags'))
    assert(renderTagSummary(stats).includes('4 unique tags'))
  })
  test('renders top lists with optional bookmark filter links', () => {
    assert(renderTopList([], 'No domains found').includes('No domains found'))
    assert(
      renderTopList([{ name: 'example.test', count: 2 }], 'No domains found', createDomainBookmarkHref).includes(
        '?folder=all&amp;search=example.test#bookmarks',
      ),
    )
    assert(
      renderTopList(
        [{ name: 'Work', id: 'work-folder', count: 2 }],
        'No folders found',
        createFolderBookmarkHref,
      ).includes('?folder=work-folder#bookmarks'),
    )
    assert(
      renderTopList([{ name: 'work docs', count: 2 }], 'No tags found', createTagManagerHref).includes(
        '?tag=work+docs#tags',
      ),
    )
  })
  test('renders recent bookmarks sorted by date and clamps requested pages', () => {
    const result = renderRecentBookmarks(createBookmarks(25), 99)
    assert.strictEqual(result.page, 2)
    assert(result.html.includes('Bookmark 1'))
    assert(result.html.includes('25 of 25'))
    assert(!result.html.includes('Bookmark 25'))
  })
  test('renders an empty recent state when dates are missing', () => {
    const result = renderRecentBookmarks([{ originalId: '1', title: 'No Date' }])
    assert.strictEqual(result.page, 1)
    assert(result.html.includes('No bookmark date metadata found'))
  })
})
