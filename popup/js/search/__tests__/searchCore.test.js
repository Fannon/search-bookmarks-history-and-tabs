import { describe, expect, test } from '@jest/globals'
import { executeSearch } from '../common.js'

describe('executeSearch (Pure)', () => {
  const mockData = {
    bookmarks: [
      { title: 'React Docs', url: 'https://react.dev', searchString: 'react docs', type: 'bookmark' },
      { title: 'Vue Docs', url: 'https://vuejs.org', searchString: 'vue docs', type: 'bookmark' },
    ],
    tabs: [],
    history: [],
  }

  const mockOptions = {
    searchStrategy: 'precise',
    searchMinMatchCharLength: 2,
  }

  test('returns precise matches', async () => {
    const results = await executeSearch('react', 'bookmarks', mockData, mockOptions)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('React Docs')
  })

  test('returns empty when below min char length', async () => {
    const results = await executeSearch('r', 'bookmarks', mockData, mockOptions)
    expect(results).toHaveLength(0)
  })

  test('handles taxonomy search for tags', async () => {
    const taggedData = {
      bookmarks: [{ title: 'Tagged', tags: '#dev', searchString: 'tagged', type: 'bookmark' }],
    }
    const results = await executeSearch('dev', 'tags', taggedData, mockOptions)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Tagged')
  })

  test('handles taxonomy search for folders', async () => {
    const folderData = {
      bookmarks: [{ title: 'In Folder', folder: '~Work', searchString: 'in folder', type: 'bookmark' }],
    }
    const results = await executeSearch('work', 'folders', folderData, mockOptions)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('In Folder')
  })
})
