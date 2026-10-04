import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createBookmarksTestData } from '../../__tests__/testUtils.js'
import { executeSearch } from '../common.js'

describe('executeSearch (Pure)', () => {
  const mockData = {
    bookmarks: createBookmarksTestData([
      { title: 'React Docs', url: 'https://react.dev' },
      { title: 'Vue Docs', url: 'https://vuejs.org' },
    ]),
    tabs: [],
    history: [],
  }
  const mockOptions = {
    searchStrategy: 'precise',
    // Note: searchMinMatchCharLength is now hard-coded to 1
  }
  test('returns precise matches', async () => {
    const results = await executeSearch('react', 'bookmarks', mockData, mockOptions)
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].title, 'React Docs')
  })
  test('handles taxonomy search for tags', async () => {
    const taggedData = {
      bookmarks: createBookmarksTestData([{ title: 'Tagged #dev', url: 'https://tagged.com' }]),
    }
    const results = await executeSearch('dev', 'tags', taggedData, mockOptions)
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].title, 'Tagged')
  })
  test('handles taxonomy search for folders', async () => {
    const folderData = {
      bookmarks: createBookmarksTestData([{ title: 'In Folder', url: 'https://folder.com' }]),
    }
    // Folder name is actually determined by the tree structure in real bookmarks.
    // For testing simpleSearch it might be easier to just mock it if we are not testing the conversion logic itself.
    // But createBookmarksTestData expects a tree or array and converts it.
    // Let's make sure it matches what the test expects.
    folderData.bookmarks[0].folder = '~Work'
    folderData.bookmarks[0].folderLower = '~work'
    folderData.bookmarks[0].folderArrayLower = ['work']
    const results = await executeSearch('work', 'folders', folderData, mockOptions)
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].title, 'In Folder')
  })
})
