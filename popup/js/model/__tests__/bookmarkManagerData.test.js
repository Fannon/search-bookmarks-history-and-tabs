import { describe, expect, test } from '@jest/globals'
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
  },
  {
    originalId: '2',
    title: 'Example Copy',
    originalUrl: 'http://www.example.com/page#section',
    url: 'example.com/page',
    dateAdded: 2000,
    tagsArray: ['work'],
    folderArray: ['Inbox'],
  },
  {
    originalId: '3',
    title: 'No Tags',
    originalUrl: 'https://docs.example.net',
    url: 'docs.example.net',
    dateAdded: 3000,
    tagsArray: [],
    folderArray: ['Work'],
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

    expect(duplicateGroups).toHaveLength(1)
    expect(duplicateGroups[0].url).toBe('example.com/page')
    expect(duplicateGroups[0].keepId).toBe('1')
    expect(duplicateGroups[0].bookmarks.map((bookmark) => bookmark.originalId)).toEqual(['1', '2'])
    expect(duplicateGroups[0].bookmarks[0].duplicateSuggestion.label).toBe('Best candidate')
    expect(duplicateGroups[0].bookmarks[1].duplicateSuggestion.label).toBe('Lower-ranked copy')
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
    expect(tagGroups[0].keepId).toBe('tagged-old')

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
    expect(titleGroups[0].keepId).toBe('clean-title-old')

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
    expect(dateGroups[0].keepId).toBe('newer')
  })

  test('calculates overview statistics', () => {
    const model = createBookmarkManagerModel(bookmarks)

    expect(model.stats.bookmarkCount).toBe(4)
    expect(model.stats.taggedBookmarkCount).toBe(3)
    expect(model.stats.untaggedBookmarkCount).toBe(1)
    expect(model.stats.uniqueTagCount).toBe(3)
    expect(model.stats.tagAssignmentCount).toBe(4)
    expect(model.stats.averageTagsPerBookmark).toBe(1)
    expect(model.stats.duplicateGroupCount).toBe(1)
    expect(model.stats.duplicateBookmarkCount).toBe(2)
    expect(model.stats.removableDuplicateCount).toBe(1)
    expect(model.stats.folderCount).toBe(3)
    expect(model.stats.topTags[0]).toEqual({ name: 'work', count: 2 })
    expect(model.stats.topDomains[0]).toEqual({ name: 'example.com', count: 2 })
    expect(model.tagGroups[0]).toEqual({ name: 'work', count: 2, bookmarkIds: ['1', '2'] })
  })

  test('groups tags with affected bookmark ids', () => {
    const tagGroups = getTagGroups(bookmarks)

    expect(tagGroups).toContainEqual({ name: 'docs', count: 1, bookmarkIds: ['1'] })
    expect(tagGroups).toContainEqual({ name: 'personal', count: 1, bookmarkIds: ['4'] })
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

    expect(folderTree.title).toBe('All Bookmarks')
    expect(folderTree.totalCount).toBe(1)
    expect(folderTree.children.map((folder) => folder.title)).toEqual(['Bookmarks Bar', 'Other Bookmarks'])
    expect(folderTree.children[0].children[0]).toMatchObject({
      id: '5',
      title: 'Work',
      path: ['Bookmarks Bar', 'Work'],
      totalCount: 1,
    })
  })
})
