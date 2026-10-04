import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
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
    assert.deepStrictEqual(
      filterBookmarksByFolder(bookmarks, folderTree, 'work').map((bookmark) => bookmark.originalId),
      ['1', '3'],
    )
    assert.deepStrictEqual(
      filterBookmarksByFolder(bookmarks, folderTree, 'docs').map((bookmark) => bookmark.originalId),
      ['1'],
    )
    assert.strictEqual(filterBookmarksByFolder(bookmarks, folderTree, 'missing'), bookmarks)
  })
  test('resolves the most precise folder id from direct id or normalized path', () => {
    assert.strictEqual(getMostPreciseBookmarkFolderId({ folderTree }, bookmarks[0]), 'docs')
    assert.strictEqual(getMostPreciseBookmarkFolderId({ folderTree }, bookmarks[2]), 'work')
    assert.strictEqual(
      getMostPreciseBookmarkFolderId({ folderTree }, { originalId: '4', folderId: 'orphan' }),
      'orphan',
    )
  })
  test('keeps the edit form disabled when a different bookmark is checked', () => {
    assert.strictEqual(canEditCurrentManagedBookmark(bookmarks[1], [], true), true)
    assert.strictEqual(canEditCurrentManagedBookmark(bookmarks[1], ['2'], true), true)
    assert.strictEqual(canEditCurrentManagedBookmark(bookmarks[1], ['1'], true), false)
    assert.strictEqual(canEditCurrentManagedBookmark(bookmarks[1], ['1', '2'], true), false)
    assert.strictEqual(canEditCurrentManagedBookmark(bookmarks[1], [], false), false)
  })
  test('normalizes and merges tag operations case-insensitively', () => {
    assert.strictEqual(normalizeTagName(' #Project   Docs '), 'project-docs')
    assert.strictEqual(normalizeTagName('Dev/Tools'), 'devtools')
    assert.deepStrictEqual(uniqueTags(['Docs', 'docs', '', 'Read']), ['Docs', 'Read'])
    assert.deepStrictEqual(mergeBulkTags(['Docs'], ['docs', 'New'], 'add'), ['Docs', 'New'])
    assert.deepStrictEqual(mergeBulkTags(['Docs', 'Read'], ['docs'], 'remove'), ['Read'])
    assert.deepStrictEqual(mergeBulkTags(['Docs'], ['New'], 'replace'), ['New'])
  })
  test('creates tagged titles and finds common tags without losing original casing', () => {
    assert.strictEqual(createTaggedBookmarkTitle(' Title ', ['Docs', 'Read']), 'Title #Docs #Read')
    assert.deepStrictEqual(getCommonTags(bookmarks), ['Read'])
  })
  test('preserves favorite score metadata before tags when rebuilding titles', () => {
    assert.strictEqual(createTaggedBookmarkTitle(' Title ', ['Docs', 'Read'], 50), 'Title +50 #Docs #Read')
    assert.strictEqual(createTaggedBookmarkTitle(' Title ', [], 75), 'Title +75')
    assert.strictEqual(createTaggedBookmarkTitle(' Title ', ['Docs'], 0), 'Title #Docs')
  })
  test('preserves favorite score metadata across manager tag mutation modes', () => {
    const bookmark = {
      title: 'Reference',
      tagsArray: ['Docs', 'Read'],
      customBonusScore: 25,
    }
    assert.strictEqual(
      createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['New'], 'add'), 25),
      'Reference +25 #Docs #Read #New',
    )
    assert.strictEqual(
      createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['New'], 'replace'), 25),
      'Reference +25 #New',
    )
    assert.strictEqual(
      createTaggedBookmarkTitle(bookmark.title, mergeBulkTags(bookmark.tagsArray, ['docs'], 'remove'), 25),
      'Reference +25 #Read',
    )
    assert.strictEqual(
      createTaggedBookmarkTitle(
        bookmark.title,
        uniqueTags(bookmark.tagsArray.map((tag) => (tag === 'Docs' ? 'Guides' : tag))),
        25,
      ),
      'Reference +25 #Guides #Read',
    )
    assert.strictEqual(
      createTaggedBookmarkTitle(
        bookmark.title,
        bookmark.tagsArray.filter((tag) => tag !== 'Docs'),
        25,
      ),
      'Reference +25 #Read',
    )
  })
  test('strips embedded tags from the title before appending new ones', () => {
    assert.strictEqual(createTaggedBookmarkTitle('My Guide #docs #read', ['utils']), 'My Guide #utils')
    assert.strictEqual(createTaggedBookmarkTitle('#tag1 #tag2', ['Docs']), '#Docs')
  })
  test('strips embedded score and tags before appending new score and tags', () => {
    assert.strictEqual(createTaggedBookmarkTitle('My Guide +25 #docs #read', ['utils'], 50), 'My Guide +50 #utils')
    assert.strictEqual(createTaggedBookmarkTitle('Title +10 #a #b', [], 75), 'Title +75')
    assert.strictEqual(createTaggedBookmarkTitle('Title +10 #a #b', ['c'], 0), 'Title #c')
  })
  test('returns a clean title even when no new tags or score are passed', () => {
    assert.strictEqual(createTaggedBookmarkTitle('My Guide #docs #read'), 'My Guide')
    assert.strictEqual(createTaggedBookmarkTitle('#tag1 #tag2'), '')
  })
  test('does not double tags for a typical undo snapshot title', () => {
    const snapshotTitle = 'Reference +25 #Docs #Read'
    assert.strictEqual(createTaggedBookmarkTitle(snapshotTitle, ['Docs', 'Read'], 25), 'Reference +25 #Docs #Read')
    assert.strictEqual(createTaggedBookmarkTitle(snapshotTitle, ['Docs', 'Read'], 50), 'Reference +50 #Docs #Read')
    assert.strictEqual(createTaggedBookmarkTitle(snapshotTitle, ['New'], 25), 'Reference +25 #New')
  })
  test('does not affect titles that have no embedded tags', () => {
    assert.strictEqual(createTaggedBookmarkTitle('Plain Title', ['Docs', 'Read'], 50), 'Plain Title +50 #Docs #Read')
    assert.strictEqual(createTaggedBookmarkTitle('Plain Title', [], 0), 'Plain Title')
  })
  test('does not strip a legitimate +N in a title that lacks embedded tags', () => {
    assert.strictEqual(createTaggedBookmarkTitle('C++ Tips +5', ['coding']), 'C++ Tips +5 #coding')
    assert.strictEqual(createTaggedBookmarkTitle('C++ Tips +5', ['coding'], 25), 'C++ Tips +5 +25 #coding')
  })
})
