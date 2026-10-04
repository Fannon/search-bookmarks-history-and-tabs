import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
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
    assert.strictEqual(result.length, 1)
    assert.partialDeepStrictEqual(result[0], {
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
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].originalId, '3')
  })
  test('getUniqueTags aggregates tag usage', () => {
    const { getUniqueTags } = taxonomyModule
    ext.model.bookmarks = [
      { originalId: '1', tags: '#foo #bar' },
      { originalId: '2', tags: '#foo' },
      { originalId: '3', tags: '' },
    ]
    const result = getUniqueTags()
    assert.deepStrictEqual(result.foo, ['1', '2'])
    assert.deepStrictEqual(result.bar, ['1'])
  })
  test('getUniqueFolders caches computed folders', () => {
    const { getUniqueFolders } = taxonomyModule
    ext.model.bookmarks = [
      { originalId: '1', folder: '~Parent ~Child' },
      { originalId: '2', folder: '~Parent' },
    ]
    const first = getUniqueFolders()
    assert.deepStrictEqual(first.Parent.sort(), ['1', '2'])
    assert.deepStrictEqual(first.Child, ['1'])
    ext.model.bookmarks = []
    const second = getUniqueFolders()
    assert.strictEqual(second, first)
  })
  test('resetUniqueFoldersCache invalidates cached folder data', () => {
    const { getUniqueFolders, resetUniqueFoldersCache } = taxonomyModule
    ext.model.bookmarks = [
      {
        originalId: '1',
        folder: '~Work ~Projects',
      },
      {
        originalId: '2',
        folder: '~Work',
      },
    ]
    const first = getUniqueFolders()
    assert.deepStrictEqual(first.Work.sort(), ['1', '2'])

    // Simulate a bookmark removal that affects the folder map
    ext.model.bookmarks = [{ originalId: '2', folder: '~Work' }]
    resetUniqueFoldersCache()
    const second = getUniqueFolders()
    assert.deepStrictEqual(second.Work, ['2'])
    assert.notStrictEqual(second, first)
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
    assert.strictEqual(resultWithTrailingSpace.length, 2)
    assert.strictEqual(resultWithTrailingSpace[0].originalId, '1')
    assert.strictEqual(resultWithTrailingSpace[1].originalId, '2')

    // Test with multiple tags where last has trailing whitespace
    const resultMultipleTags = searchTaxonomy('react #node ', 'tags', data)
    assert.strictEqual(resultMultipleTags.length, 1)
    assert.strictEqual(resultMultipleTags[0].originalId, '1')
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
    assert.strictEqual(resultWithTrailingSpace.length, 2)

    // Test with multiple folders where last has trailing whitespace
    const resultMultipleFolders = searchTaxonomy('work ~projects ', 'folder', data)
    assert.strictEqual(resultMultipleFolders.length, 1)
    assert.strictEqual(resultMultipleFolders[0].originalId, '1')
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
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].originalId, '1')
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
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].originalId, '1')

    // 2. Searching for invalid text match
    const resultNone = searchTaxonomy('KVR  nomatch', 'group', data)
    assert.strictEqual(resultNone.length, 0)

    // 3. Searching for taxonomy only (no text part) - trailing double space
    // This simulates the user just clicking the badge and getting the trailing space
    const resultOnlyTaxonomy = searchTaxonomy('KVR  ', 'group', data)
    assert.strictEqual(resultOnlyTaxonomy.length, 2)
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
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].title, 'Martin Fowler')
  })
  test('getUniqueGroups aggregates group usage', () => {
    const { getUniqueGroups } = taxonomyModule
    ext.model.tabs = [
      { originalId: '1', group: 'Work' },
      { originalId: '2', group: 'Work' },
      { originalId: '3', group: 'Personal' },
      { originalId: '4' }, // No group
    ]
    const result = getUniqueGroups()
    assert.deepStrictEqual(result.Work, ['1', '2'])
    assert.deepStrictEqual(result.Personal, ['3'])
    assert(!Object.keys(result).includes('undefined'))
  })
})
