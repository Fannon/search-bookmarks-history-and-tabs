import { describe, expect, test } from '@jest/globals'

import {
  canEditCurrentManagedBookmark,
  createTaggedBookmarkTitle,
  filterBookmarksByFolder,
  getCommonTags,
  getMostPreciseBookmarkFolderId,
  mergeBulkTags,
  normalizeTagName,
  uniqueTags,
} from '../bookmarkManagerOperations.js'

const folderTree = {
  id: 'all',
  title: 'All Bookmarks',
  path: [],
  children: [
    {
      id: 'work',
      title: 'Work',
      path: ['Work'],
      children: [
        {
          id: 'docs',
          title: 'Docs',
          path: ['Work', 'Docs'],
          children: [],
        },
      ],
    },
    {
      id: 'read',
      title: 'Reading',
      path: ['Reading'],
      children: [],
    },
  ],
}

const bookmarks = [
  {
    originalId: '1',
    folderId: 'docs',
    folderArray: ['Work', 'Docs'],
    tagsArray: ['Docs', 'Read'],
  },
  {
    originalId: '2',
    folderId: 'read',
    folderArray: ['Reading'],
    tagsArray: ['read', 'Later'],
  },
  {
    originalId: '3',
    folderId: 'external-id',
    folderArray: ['Work', 'Drafts'],
    tagsArray: ['Read', 'Draft'],
  },
]

describe('bookmark manager operations', () => {
  test('filters bookmarks by folder id descendants and normalized path fallback', () => {
    expect(filterBookmarksByFolder(bookmarks, folderTree, 'work').map((bookmark) => bookmark.originalId)).toEqual([
      '1',
      '3',
    ])
    expect(filterBookmarksByFolder(bookmarks, folderTree, 'docs').map((bookmark) => bookmark.originalId)).toEqual(['1'])
    expect(filterBookmarksByFolder(bookmarks, folderTree, 'missing')).toBe(bookmarks)
  })

  test('resolves the most precise folder id from direct id or normalized path', () => {
    expect(getMostPreciseBookmarkFolderId({ folderTree }, bookmarks[0])).toBe('docs')
    expect(getMostPreciseBookmarkFolderId({ folderTree }, bookmarks[2])).toBe('work')
    expect(getMostPreciseBookmarkFolderId({ folderTree }, { originalId: '4', folderId: 'orphan' })).toBe('orphan')
  })

  test('keeps the edit form disabled when a different bookmark is checked', () => {
    expect(canEditCurrentManagedBookmark(bookmarks[1], [], true)).toBe(true)
    expect(canEditCurrentManagedBookmark(bookmarks[1], ['2'], true)).toBe(true)
    expect(canEditCurrentManagedBookmark(bookmarks[1], ['1'], true)).toBe(false)
    expect(canEditCurrentManagedBookmark(bookmarks[1], ['1', '2'], true)).toBe(false)
    expect(canEditCurrentManagedBookmark(bookmarks[1], [], false)).toBe(false)
  })

  test('normalizes and merges tag operations case-insensitively', () => {
    expect(normalizeTagName(' #Project   Docs ')).toBe('Project Docs')
    expect(uniqueTags(['Docs', 'docs', '', 'Read'])).toEqual(['Docs', 'Read'])
    expect(mergeBulkTags(['Docs'], ['docs', 'New'], 'add')).toEqual(['Docs', 'New'])
    expect(mergeBulkTags(['Docs', 'Read'], ['docs'], 'remove')).toEqual(['Read'])
    expect(mergeBulkTags(['Docs'], ['New'], 'replace')).toEqual(['New'])
  })

  test('creates tagged titles and finds common tags without losing original casing', () => {
    expect(createTaggedBookmarkTitle(' Title ', ['Docs', 'Read'])).toBe('Title #Docs #Read')
    expect(getCommonTags(bookmarks)).toEqual(['Read'])
  })

  test('preserves favorite score metadata before tags when rebuilding titles', () => {
    expect(createTaggedBookmarkTitle(' Title ', ['Docs', 'Read'], 50)).toBe('Title +50 #Docs #Read')
    expect(createTaggedBookmarkTitle(' Title ', [], 75)).toBe('Title +75')
    expect(createTaggedBookmarkTitle(' Title ', ['Docs'], 0)).toBe('Title #Docs')
  })

  test('preserves favorite score metadata across manager tag mutation modes', () => {
    const bookmark = {
      title: 'Reference',
      tagsArray: ['Docs', 'Read'],
      customBonusScore: 25,
    }

    expect(createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['New'], 'add'), 25)).toBe(
      'Reference +25 #Docs #Read #New',
    )
    expect(createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['New'], 'replace'), 25)).toBe(
      'Reference +25 #New',
    )
    expect(createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['docs'], 'remove'), 25)).toBe(
      'Reference +25 #Read',
    )
    expect(
      createTaggedBookmarkTitle(
        bookmark.title,
        uniqueTags(bookmark.tagsArray.map((tag) => (tag === 'Docs' ? 'Guides' : tag))),
        25,
      ),
    ).toBe('Reference +25 #Guides #Read')
    expect(
      createTaggedBookmarkTitle(
        bookmark.title,
        bookmark.tagsArray.filter((tag) => tag !== 'Docs'),
        25,
      ),
    ).toBe('Reference +25 #Read')
  })
})
