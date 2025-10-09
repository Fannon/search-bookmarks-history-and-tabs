import { describe, test, expect, beforeEach } from '@jest/globals'
import { createTestExt } from '../../__tests__/testUtils.js'

describe('taxonomy search', () => {
  let taxonomyModule

  beforeEach(async () => {
    createTestExt({
      model: {
        bookmarks: [],
      },
      index: {
        taxonomy: {},
      },
    })
    taxonomyModule = await import('../taxonomySearch.js')
  })

  afterEach(() => {
    delete global.ext
    if (typeof window !== 'undefined') {
      delete window.ext
    }
  })

  test('searchTaxonomy finds entries containing all tag terms', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '1',
        tags: '#foo #bar',
        type: 'bookmark',
      },
      {
        originalId: '2',
        tags: '#foo',
        type: 'bookmark',
      },
    ]

    const result = searchTaxonomy('foo #bar', 'tags', data)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ originalId: '1', searchScore: 1, searchApproach: 'taxonomy' })
  })

  test('searchTaxonomy finds entries based on folder names', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '3',
        folder: '~Work ~Projects',
      },
      {
        originalId: '4',
        folder: '~Personal',
      },
    ]

    const result = searchTaxonomy('work ~projects', 'folder', data)

    expect(result).toHaveLength(1)
    expect(result[0].originalId).toBe('3')
  })

  test('getUniqueTags aggregates tag usage', () => {
    const { getUniqueTags } = taxonomyModule
    ext.model.bookmarks = [
      { originalId: '1', tags: '#foo #bar' },
      { originalId: '2', tags: '#foo' },
      { originalId: '3', tags: '' },
    ]

    const result = getUniqueTags()

    expect(result.foo).toEqual(['1', '2'])
    expect(result.bar).toEqual(['1'])
  })

  test('getUniqueFolders caches computed folders', () => {
    const { getUniqueFolders } = taxonomyModule
    ext.model.bookmarks = [
      { originalId: '1', folder: '~Parent ~Child' },
      { originalId: '2', folder: '~Parent' },
    ]

    const first = getUniqueFolders()
    expect(first.Parent.sort()).toEqual(['1', '2'])
    expect(first.Child).toEqual(['1'])

    ext.model.bookmarks = []
    const second = getUniqueFolders()
    expect(second).toBe(first)
  })
})
