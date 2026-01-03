import { beforeEach, describe, expect, test } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

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
    clearTestExt()
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
    expect(result[0]).toMatchObject({
      originalId: '1',
      searchApproach: 'taxonomy',
    })
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

  test('resetUniqueFoldersCache invalidates cached folder data', () => {
    const { getUniqueFolders, resetUniqueFoldersCache } = taxonomyModule
    ext.model.bookmarks = [
      { originalId: '1', folder: '~Work ~Projects' },
      { originalId: '2', folder: '~Work' },
    ]

    const first = getUniqueFolders()
    expect(first.Work.sort()).toEqual(['1', '2'])

    // Simulate a bookmark removal that affects the folder map
    ext.model.bookmarks = [{ originalId: '2', folder: '~Work' }]
    resetUniqueFoldersCache()

    const second = getUniqueFolders()
    expect(second.Work).toEqual(['2'])
    expect(second).not.toBe(first)
  })

  test('searchTaxonomy handles trailing whitespace in tag terms', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '1',
        tags: '#react #node',
        type: 'bookmark',
      },
      {
        originalId: '2',
        tags: '#react',
        type: 'bookmark',
      },
    ]

    // Test with trailing whitespace after tag
    const resultWithTrailingSpace = searchTaxonomy('react ', 'tags', data)
    expect(resultWithTrailingSpace).toHaveLength(2)
    expect(resultWithTrailingSpace[0].originalId).toBe('1')
    expect(resultWithTrailingSpace[1].originalId).toBe('2')

    // Test with multiple tags where last has trailing whitespace
    const resultMultipleTags = searchTaxonomy('react #node ', 'tags', data)
    expect(resultMultipleTags).toHaveLength(1)
    expect(resultMultipleTags[0].originalId).toBe('1')
  })

  test('searchTaxonomy handles trailing whitespace in folder terms', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '1',
        folder: '~Work ~Projects',
      },
      {
        originalId: '2',
        folder: '~Work',
      },
    ]

    // Test with trailing whitespace after folder
    const resultWithTrailingSpace = searchTaxonomy('work ', 'folder', data)
    expect(resultWithTrailingSpace).toHaveLength(2)

    // Test with multiple folders where last has trailing whitespace
    const resultMultipleFolders = searchTaxonomy('work ~projects ', 'folder', data)
    expect(resultMultipleFolders).toHaveLength(1)
    expect(resultMultipleFolders[0].originalId).toBe('1')
  })

  test('searchTaxonomy ignores empty terms from excessive whitespace', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '1',
        tags: '#test',
        type: 'bookmark',
      },
    ]

    // Test with multiple spaces creating empty terms
    const result = searchTaxonomy('test  ', 'tags', data)
    expect(result).toHaveLength(1)
    expect(result[0].originalId).toBe('1')
  })

  test('searchTaxonomy supports hybrid taxonomy + text search with DOUBLE SPACE separator', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '1',
        group: '@KVR',
        title: 'Project Alpha Temp',
        url: 'http://temp.com',
      },
      {
        originalId: '2',
        group: '@KVR',
        title: 'Project Beta',
        url: 'http://beta.com',
      },
      {
        originalId: '3',
        group: '@Other',
        title: 'Temp Project',
        url: 'http://other.com',
      },
    ]

    // 1. Double space separator used: "KVR  temp"
    // Expect: Group matches "KVR" AND (title OR url matches "temp")
    const result = searchTaxonomy('KVR  temp', 'group', data)

    expect(result).toHaveLength(1)
    expect(result[0].originalId).toBe('1')

    // 2. Searching for invalid text match
    const resultNone = searchTaxonomy('KVR  nomatch', 'group', data)
    expect(resultNone).toHaveLength(0)

    // 3. Searching for taxonomy only (no text part) - trailing double space
    // This simulates the user just clicking the badge and getting the trailing space
    const resultOnlyTaxonomy = searchTaxonomy('KVR  ', 'group', data)
    expect(resultOnlyTaxonomy).toHaveLength(2)
  })

  test('searchTaxonomy supports hybrid search with folder type (~Blogs martin example)', () => {
    const { searchTaxonomy } = taxonomyModule
    const data = [
      {
        originalId: '10',
        folder: '~Blogs',
        title: 'Martin Fowler',
        url: 'https://martinfowler.com',
      },
      {
        originalId: '11',
        folder: '~Blogs',
        title: 'Another Blog',
        url: 'https://example.com',
      },
    ]

    // User example: "~Blogs  martin" (Input normalized/stripped by caller)
    const result = searchTaxonomy('Blogs  martin', 'folder', data)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Martin Fowler')
  })
})
