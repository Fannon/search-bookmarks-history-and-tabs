import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { matches } from '../../../../test/patterns.js'
import { createBookmarkManagerModel, getDuplicateGroups, getFolderTree, getTagGroups } from '../bookmarkManagerData.js'

const bookmarks = [
  {
    originalId: '1',
    title: 'Example',
    originalUrl: 'https://example.com/page',
    url: 'example.com/page',
    dateAdded: 1000,
    tagsArray: ['work', 'docs'],
    folderArray: ['Work'],
    folderId: 'work',
  },
  {
    originalId: '2',
    title: 'Example Copy',
    originalUrl: 'http://www.example.com/page#section',
    url: 'example.com/page',
    dateAdded: 2000,
    tagsArray: ['work'],
    folderArray: ['Inbox'],
    folderId: 'inbox',
  },
  {
    originalId: '3',
    title: 'No Tags',
    originalUrl: 'https://docs.example.net',
    url: 'docs.example.net',
    dateAdded: 3000,
    tagsArray: [],
    folderArray: ['Work'],
    folderId: 'work',
  },
  {
    originalId: '4',
    title: 'Root Bookmark',
    originalUrl: 'https://root.test',
    url: 'root.test',
    tagsArray: ['personal'],
    folderArray: [],
  },
]
describe('bookmark manager data', () => {
  test('groups duplicates by normalized URL and suggests the richer bookmark to keep', () => {
    const duplicateGroups = getDuplicateGroups(bookmarks)
    assert.strictEqual(duplicateGroups.length, 1)
    assert.strictEqual(duplicateGroups[0].url, 'example.com/page')
    assert.strictEqual(duplicateGroups[0].keepId, '1')
    assert.deepStrictEqual(
      duplicateGroups[0].bookmarks.map((bookmark) => bookmark.originalId),
      ['1', '2'],
    )
    assert.strictEqual(duplicateGroups[0].bookmarks[0].duplicateSuggestion.label, 'Best candidate')
    assert.strictEqual(duplicateGroups[0].bookmarks[1].duplicateSuggestion.label, 'Lower-ranked copy')
  })
  test('prefers tags, title quality, recency, then folder depth for duplicate suggestions', () => {
    const tagGroups = getDuplicateGroups([
      {
        originalId: 'tagged-old',
        title: 'Tagged',
        originalUrl: 'https://same.test',
        url: 'same.test',
        dateAdded: 1000,
        tagsArray: ['one', 'two'],
        folderArray: [],
      },
      {
        originalId: 'untagged-new',
        title: 'Newer',
        originalUrl: 'https://same.test',
        url: 'same.test',
        dateAdded: 3000,
        tagsArray: ['one'],
        folderArray: ['Folder'],
      },
    ])
    assert.strictEqual(tagGroups[0].keepId, 'tagged-old')
    const titleGroups = getDuplicateGroups([
      {
        originalId: 'url-title-new',
        title: 'https://title.test/page',
        originalUrl: 'https://title.test/page',
        url: 'title.test/page',
        dateAdded: 3000,
        tagsArray: ['one'],
        folderArray: ['Folder'],
      },
      {
        originalId: 'clean-title-old',
        title: 'Project Reference',
        originalUrl: 'https://title.test/page',
        url: 'title.test/page',
        dateAdded: 1000,
        tagsArray: ['one'],
        folderArray: [],
      },
    ])
    assert.strictEqual(titleGroups[0].keepId, 'clean-title-old')
    const dateGroups = getDuplicateGroups([
      {
        originalId: 'older',
        title: 'Project Reference',
        originalUrl: 'https://date.test/page',
        url: 'date.test/page',
        dateAdded: 1000,
        tagsArray: ['one'],
        folderArray: [],
      },
      {
        originalId: 'newer',
        title: 'Project Reference',
        originalUrl: 'https://date.test/page',
        url: 'date.test/page',
        dateAdded: 3000,
        tagsArray: ['one'],
        folderArray: [],
      },
    ])
    assert.strictEqual(dateGroups[0].keepId, 'newer')
  })
  test('prefers favorited duplicate bookmarks before other ranking signals', () => {
    const duplicateGroups = getDuplicateGroups([
      {
        originalId: 'favorite',
        title: 'Project Reference',
        originalUrl: 'https://favorite.test/page',
        url: 'favorite.test/page',
        dateAdded: 1000,
        customBonusScore: 50,
        tagsArray: [],
        folderArray: [],
      },
      {
        originalId: 'tagged-newer',
        title: 'Project Reference',
        originalUrl: 'https://favorite.test/page',
        url: 'favorite.test/page',
        dateAdded: 3000,
        customBonusScore: 0,
        tagsArray: ['one', 'two'],
        folderArray: ['Folder'],
      },
    ])
    assert.strictEqual(duplicateGroups[0].keepId, 'favorite')
    assert(duplicateGroups[0].bookmarks[0].duplicateSuggestion.detail.includes('+50 favorite score'))
    assert(duplicateGroups[0].bookmarks[1].duplicateSuggestion.detail.includes('lower favorite score'))
  })
  test('calculates overview statistics', () => {
    const model = createBookmarkManagerModel(bookmarks)
    assert.strictEqual(model.stats.bookmarkCount, 4)
    assert.strictEqual(model.stats.taggedBookmarkCount, 3)
    assert.strictEqual(model.stats.untaggedBookmarkCount, 1)
    assert.strictEqual(model.stats.uniqueTagCount, 3)
    assert.strictEqual(model.stats.tagAssignmentCount, 4)
    assert.strictEqual(model.stats.averageTagsPerBookmark, 1)
    assert.strictEqual(model.stats.duplicateGroupCount, 1)
    assert.strictEqual(model.stats.duplicateBookmarkCount, 2)
    assert.strictEqual(model.stats.removableDuplicateCount, 1)
    assert.strictEqual(model.stats.folderCount, 3)
    assert.deepStrictEqual(model.stats.topTags[0], { name: 'work', count: 2 })
    assert.deepStrictEqual(model.stats.topDomains[0], { name: 'example.com', count: 2 })
    assert.deepStrictEqual(model.stats.topFolders[0], { name: 'Work', id: 'work', count: 2 })
    assert.deepStrictEqual(model.tagGroups[0], { name: 'work', count: 2, bookmarkIds: ['1', '2'] })
  })
  test('groups tags with affected bookmark ids', () => {
    const tagGroups = getTagGroups(bookmarks)
    assert(tagGroups.some((item) => matches(item, { name: 'docs', count: 1, bookmarkIds: ['1'] })))
    assert(tagGroups.some((item) => matches(item, { name: 'personal', count: 1, bookmarkIds: ['4'] })))
  })
  test('builds a traditional folder tree from raw browser folders', () => {
    const folderTree = getFolderTree([
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            parentId: '0',
            children: [
              {
                id: '5',
                title: 'Work',
                parentId: '1',
                children: [
                  {
                    id: '10',
                    parentId: '5',
                    title: 'Docs',
                    url: 'https://docs.example.test',
                  },
                ],
              },
            ],
          },
          {
            id: '2',
            title: 'Other Bookmarks',
            parentId: '0',
            children: [],
          },
        ],
      },
    ])
    assert.strictEqual(folderTree.title, 'All Bookmarks')
    assert.strictEqual(folderTree.totalCount, 1)
    assert.deepStrictEqual(
      folderTree.children.map((folder) => folder.title),
      ['Bookmarks Bar', 'Other Bookmarks'],
    )
    assert.partialDeepStrictEqual(folderTree.children[0].children[0], {
      id: '5',
      title: 'Work',
      path: ['Bookmarks Bar', 'Work'],
      totalCount: 1,
    })
  })
})
