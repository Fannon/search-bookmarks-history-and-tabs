import { describe, expect, test } from '@jest/globals'

import {
  createDomainBookmarkHref,
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

    expect(renderStats(stats)).toContain('Bookmarks')
    expect(renderStats(stats)).toContain('Manage tags')
    expect(renderTagSummary(stats)).toContain('4 unique tags')
  })

  test('renders top lists with optional bookmark filter links', () => {
    expect(renderTopList([], 'No domains found')).toContain('No domains found')
    expect(renderTopList([{ name: 'example.test', count: 2 }], 'No domains found', createDomainBookmarkHref)).toContain(
      '?folder=all&amp;search=example.test#bookmarks',
    )
  })

  test('renders recent bookmarks sorted by date and clamps requested pages', () => {
    const result = renderRecentBookmarks(createBookmarks(25), 99)

    expect(result.page).toBe(2)
    expect(result.html).toContain('Bookmark 1')
    expect(result.html).toContain('25 of 25')
    expect(result.html).not.toContain('Bookmark 25')
  })

  test('renders an empty recent state when dates are missing', () => {
    const result = renderRecentBookmarks([{ originalId: '1', title: 'No Date' }])

    expect(result.page).toBe(1)
    expect(result.html).toContain('No bookmark date metadata found')
  })
})
