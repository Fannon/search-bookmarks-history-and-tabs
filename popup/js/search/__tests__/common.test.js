import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { createTestExt, clearTestExt } from '../../__tests__/testUtils.js'

const mockGetBrowserTabs = jest.fn(() => Promise.resolve([]))
const mockCleanUpUrl = (url) => url.replace(/\/+$/, '')
const mockPrintError = jest.fn()
const mockCloseModals = jest.fn()
const mockRenderSearchResults = jest.fn()
const mockNavigationKeyListener = jest.fn()
const mockToggleSearchApproach = jest.fn()
const mockUpdateSearchApproachToggle = jest.fn()
const mockFuzzySearch = jest.fn(() => Promise.resolve([]))
const mockResetFuzzySearchState = jest.fn()
const mockSimpleSearch = jest.fn(() => [])
const mockResetSimpleSearchState = jest.fn()
const mockSearchTaxonomy = jest.fn(() => [])

let commonModule

beforeAll(async () => {
  await jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    getBrowserTabs: mockGetBrowserTabs,
  }))
  await jest.unstable_mockModule('../../helper/utils.js', () => ({
    __esModule: true,
    cleanUpUrl: mockCleanUpUrl,
    printError: mockPrintError,
  }))
  await jest.unstable_mockModule('../../initSearch.js', () => ({
    __esModule: true,
    closeModals: mockCloseModals,
  }))
  await jest.unstable_mockModule('../../view/searchView.js', () => ({
    __esModule: true,
    renderSearchResults: mockRenderSearchResults,
    navigationKeyListener: mockNavigationKeyListener,
    toggleSearchApproach: mockToggleSearchApproach,
    updateSearchApproachToggle: mockUpdateSearchApproachToggle,
  }))
  await jest.unstable_mockModule('../fuzzySearch.js', () => ({
    __esModule: true,
    fuzzySearch: mockFuzzySearch,
    resetFuzzySearchState: mockResetFuzzySearchState,
  }))
  await jest.unstable_mockModule('../simpleSearch.js', () => ({
    __esModule: true,
    simpleSearch: mockSimpleSearch,
    resetSimpleSearchState: mockResetSimpleSearchState,
  }))
  await jest.unstable_mockModule('../taxonomySearch.js', () => ({
    __esModule: true,
    searchTaxonomy: mockSearchTaxonomy,
  }))

  commonModule = await import('../common.js')
})

describe('common search helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createTestExt({
      opts: {
        searchMinMatchCharLength: 1,
        scoreBookmarkBaseScore: 100,
        scoreTabBaseScore: 70,
        scoreHistoryBaseScore: 45,
        scoreSearchEngineBaseScore: 30,
        scoreCustomSearchEngineBaseScore: 400,
        scoreDirectUrlScore: 500,
        scoreTitleWeight: 1,
        scoreTagWeight: 0.7,
        scoreUrlWeight: 0.6,
        scoreFolderWeight: 0.5,
        scoreCustomBonusScore: true,
        scoreExactIncludesBonus: 0,
        scoreExactIncludesBonusMinChars: 3,
        scoreExactStartsWithBonus: 0,
        scoreExactEqualsBonus: 0,
        scoreExactTagMatchBonus: 0,
        scoreExactFolderMatchBonus: 0,
        scoreVisitedBonusScore: 0.5,
        scoreVisitedBonusScoreMaximum: 20,
        scoreRecentBonusScoreMaximum: 20,
        historyDaysAgo: 5,
        maxRecentTabsToShow: 5,
      },
      model: {
        result: [],
        bookmarks: [],
        tabs: [],
        history: [],
      },
    })
  })

  afterEach(() => {
    clearTestExt()
  })

  test('searchWithAlgorithm returns empty array below min length', async () => {
    const { searchWithAlgorithm } = commonModule
    ext.opts.searchMinMatchCharLength = 4

    const result = await searchWithAlgorithm('precise', 'abc')

    expect(result).toEqual([])
    expect(mockSimpleSearch).not.toHaveBeenCalled()
    expect(mockFuzzySearch).not.toHaveBeenCalled()
  })

  test('searchWithAlgorithm delegates to simpleSearch for precise strategy', async () => {
    const { searchWithAlgorithm } = commonModule
    mockSimpleSearch.mockReturnValue([{ type: 'bookmark' }])

    const result = await searchWithAlgorithm('precise', 'term', 'bookmarks')

    expect(mockSimpleSearch).toHaveBeenCalledWith('bookmarks', 'term')
    expect(result).toEqual([{ type: 'bookmark' }])
  })

  test('searchWithAlgorithm delegates to fuzzySearch for fuzzy strategy', async () => {
    const { searchWithAlgorithm } = commonModule
    mockFuzzySearch.mockResolvedValue([{ type: 'tab' }])

    const result = await searchWithAlgorithm('fuzzy', 'term', 'tabs')

    expect(mockFuzzySearch).toHaveBeenCalledWith('tabs', 'term')
    expect(result).toEqual([{ type: 'tab' }])
  })

  test('searchWithAlgorithm throws on unknown strategy', async () => {
    const { searchWithAlgorithm } = commonModule

    await expect(searchWithAlgorithm('unknown', 'term')).rejects.toThrow('Unknown search approach: unknown')
  })

  test('calculateFinalScore adds custom, visit and recency bonuses', () => {
    const { calculateFinalScore } = commonModule
    ext.model.searchTerm = 'foo'
    const results = [
      {
        type: 'bookmark',
        searchScore: 1,
        customBonusScore: 5,
        title: 'Foo resource',
        url: 'https://example.com/foo',
        visitCount: 10,
        lastVisitSecondsAgo: 0,
      },
    ]

    const scored = calculateFinalScore(results, 'foo')

    expect(scored[0].score).toBeGreaterThan(30)
  })

  test('calculateFinalScore throws for unsupported types', () => {
    const { calculateFinalScore } = commonModule
    ext.model.searchTerm = 'foo'
    const results = [
      {
        type: 'unsupported',
        searchScore: 1,
        url: 'https://example.com',
      },
    ]

    expect(() => calculateFinalScore(results, 'foo')).toThrow('Search result type "unsupported" not supported')
  })

  test('sortResults sorts by score descending', () => {
    const { sortResults } = commonModule
    const sorted = sortResults([{ score: 1 }, { score: 5 }, { score: 3 }], 'score')
    expect(sorted.map((item) => item.score)).toEqual([5, 3, 1])
  })

  test('sortResults sorts by lastVisited ascending and throws on invalid mode', () => {
    const { sortResults } = commonModule
    const sorted = sortResults(
      [{ lastVisitSecondsAgo: 10 }, { lastVisitSecondsAgo: undefined }, { lastVisitSecondsAgo: 5 }],
      'lastVisited',
    )
    expect(sorted[0].lastVisitSecondsAgo).toBe(5)
    expect(sorted[2].lastVisitSecondsAgo).toBeUndefined()
    expect(() => sortResults([], 'unknown')).toThrow('Unknown sortMode="unknown"')
  })

  describe('main search function', () => {
    beforeEach(() => {
      // Setup DOM mocks
      Object.defineProperty(ext, 'dom', {
        value: {
          searchInput: { value: '' },
          resultCounter: { innerText: '' },
        },
        writable: true,
      })
      ext.initialized = true
      ext.searchCache = new Map()
    })

    test('search ignores navigation keys', async () => {
      const { search } = commonModule

      const navKeys = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape']
      for (const key of navKeys) {
        await search({ key })
        expect(mockRenderSearchResults).not.toHaveBeenCalled()
      }
    })

    test('search ignores modifier keys', async () => {
      const { search } = commonModule

      const modifierKeys = [{ key: 'Control' }, { ctrlKey: true }, { key: 'Alt' }, { altKey: true }, { key: 'Shift' }]

      for (const event of modifierKeys) {
        await search(event)
        expect(mockRenderSearchResults).not.toHaveBeenCalled()
      }
    })

    test('search returns early when extension not initialized', async () => {
      const { search } = commonModule
      ext.initialized = false

      await search({ key: 'a' })

      expect(mockRenderSearchResults).not.toHaveBeenCalled()
    })

    test('search handles empty search term', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = '' // Empty string should trigger default entries
      ext.opts.searchStrategy = 'precise'
      ext.opts.searchMinMatchCharLength = 1

      await search({ key: 'a' })

      expect(mockRenderSearchResults).toHaveBeenCalled()
      expect(ext.model.result).toBeDefined()
      expect(ext.model.result).toStrictEqual([]) // No default entries set up in this test
    })

    test('search handles history mode', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'h test'

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('history')
      expect(ext.model.searchTerm).toBe('test')
    })

    test('search handles bookmarks mode', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'b test'

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('bookmarks')
      expect(ext.model.searchTerm).toBe('test')
    })

    test('search handles tabs mode', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 't test'

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('tabs')
      expect(ext.model.searchTerm).toBe('test')
    })

    test('search handles search engines mode', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 's test'

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('search')
      expect(ext.model.searchTerm).toBe('test')
    })

    test('search handles tags mode', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = '#test'

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('tags')
      expect(ext.model.searchTerm).toBe('test')
    })

    test('search handles folders mode', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = '~test'

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('folders')
      expect(ext.model.searchTerm).toBe('test')
    })

    test('search uses cache when available', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'test'
      ext.opts.searchStrategy = 'precise'
      const cachedResults = [{ type: 'bookmark', title: 'Cached Result' }]
      ext.searchCache.set('test_precise_all', cachedResults)

      await search({ key: 'a' })

      expect(mockRenderSearchResults).toHaveBeenCalledWith(cachedResults)
      expect(mockSimpleSearch).not.toHaveBeenCalled()
      expect(mockFuzzySearch).not.toHaveBeenCalled()
    })

    test('search handles direct URL matching', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'https://example.com'
      ext.opts.enableDirectUrl = true
      ext.opts.searchMaxResults = 10
      ext.opts.searchStrategy = 'precise'
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out

      await search({ key: 'a' })

      expect(ext.model.result.some((item) => item.type === 'direct')).toBe(true)
    })

    test('search handles custom search engines', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'g test search'
      ext.opts.searchStrategy = 'precise'
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      ext.opts.customSearchEngines = [
        {
          alias: 'g',
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=',
        },
      ]

      await search({ key: 'a' })

      expect(ext.model.result.some((item) => item.type === 'customSearch')).toBe(true)
    })

    test('search falls back to precise search for unknown strategy', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'test'
      ext.opts.searchStrategy = 'unknown'

      await search({ key: 'a' })

      expect(mockSimpleSearch).toHaveBeenCalled()
      expect(mockFuzzySearch).not.toHaveBeenCalled()
    })
  })

  describe('addDefaultEntries', () => {
    beforeEach(() => {
      ext.model.bookmarks = [{ type: 'bookmark', title: 'Test Bookmark', originalUrl: 'https://example.com' }]
      ext.model.tabs = [{ type: 'tab', title: 'Test Tab', url: 'https://example.com', lastVisitSecondsAgo: 100 }]
      ext.model.history = [{ type: 'history', title: 'Test History', url: 'https://example.com' }]
    })

    test('addDefaultEntries returns recent history for history mode', async () => {
      const { addDefaultEntries } = commonModule
      ext.model.searchMode = 'history'

      const results = await addDefaultEntries()

      expect(results).toHaveLength(ext.model.history.length)
      expect(results[0].type).toBe('history')
    })

    test('addDefaultEntries returns sorted tabs for tabs mode', async () => {
      const { addDefaultEntries } = commonModule
      ext.model.searchMode = 'tabs'

      const results = await addDefaultEntries()

      expect(results).toHaveLength(ext.model.tabs.length)
      expect(results[0].type).toBe('tab')
      // Should be sorted by lastVisitSecondsAgo ascending
      expect(results[0].lastVisitSecondsAgo).toBeLessThanOrEqual(results[1]?.lastVisitSecondsAgo || Infinity)
    })

    test('addDefaultEntries returns bookmarks for bookmarks mode', async () => {
      const { addDefaultEntries } = commonModule
      ext.model.searchMode = 'bookmarks'

      const results = await addDefaultEntries()

      expect(results).toHaveLength(ext.model.bookmarks.length)
      expect(results[0].type).toBe('bookmark')
    })

    test('addDefaultEntries finds matching bookmarks for current tab', async () => {
      const { addDefaultEntries } = commonModule
      mockGetBrowserTabs.mockResolvedValue([
        {
          url: 'https://example.com',
          active: true,
        },
      ])

      const results = await addDefaultEntries()

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe('bookmark')
    })

    test('addDefaultEntries adds recent tabs when no search term', async () => {
      const { addDefaultEntries } = commonModule
      ext.opts.maxRecentTabsToShow = 5

      const results = await addDefaultEntries()

      expect(results.length).toBeGreaterThan(0)
      expect(results.some((tab) => tab.type === 'tab')).toBe(true)
    })

    test('addDefaultEntries handles getBrowserTabs error gracefully', async () => {
      const { addDefaultEntries } = commonModule
      mockGetBrowserTabs.mockRejectedValue(new Error('Browser API error'))

      const results = await addDefaultEntries()

      expect(results).toBeDefined()
      // Should still return recent tabs even if getBrowserTabs fails
      expect(results.some((tab) => tab.type === 'tab')).toBe(true)
    })
  })

  describe('search engine functionality', () => {
    beforeEach(() => {
      // Setup DOM for search engine tests
      Object.defineProperty(ext, 'dom', {
        value: {
          searchInput: { value: '' },
          resultCounter: { innerText: '' },
        },
        writable: true,
      })
      ext.initialized = true
      ext.searchCache = new Map()
    })

    test('search handles search engines mode correctly', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 's test'
      ext.opts.enableSearchEngines = true
      ext.opts.searchStrategy = 'precise'
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      ext.opts.searchEngineChoices = [{ name: 'Google', urlPrefix: 'https://www.google.com/search?q=' }]

      await search({ key: 'a' })

      expect(ext.model.searchMode).toBe('search')
      expect(ext.model.result.some((item) => item.type === 'search')).toBe(true)
    })

    test('search handles custom search engines correctly', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'g test search'
      ext.opts.searchStrategy = 'precise'
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      ext.opts.customSearchEngines = [
        {
          alias: 'g',
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=',
        },
      ]

      await search({ key: 'a' })

      expect(ext.model.result.some((item) => item.type === 'customSearch')).toBe(true)
    })
  })

  describe('calculateFinalScore edge cases', () => {
    beforeEach(() => {
      ext.model.searchTerm = 'test'
    })

    test('calculateFinalScore handles exact starts with bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreExactStartsWithBonus = 10

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'test bookmark',
          url: 'https://example.com',
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles exact equals bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreExactEqualsBonus = 10

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'test',
          url: 'https://example.com',
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles tag match bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreExactTagMatchBonus = 10
      ext.opts.scoreTagWeight = 1

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'Test Bookmark',
          url: 'https://example.com',
          tagsArray: ['test'],
          tags: 'test',
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles folder match bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreExactFolderMatchBonus = 10
      ext.opts.scoreFolderWeight = 1

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'Test Bookmark',
          url: 'https://example.com',
          folderArray: ['test'],
          folder: 'test',
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles includes bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreExactIncludesBonus = 5
      ext.opts.scoreExactIncludesBonusMinChars = 2

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'This is a test bookmark',
          url: 'https://example.com',
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles visit count bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreVisitedBonusScore = 2
      ext.opts.scoreVisitedBonusScoreMaximum = 20

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'Test Bookmark',
          url: 'https://example.com',
          visitCount: 10,
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles recent bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreRecentBonusScoreMaximum = 20
      ext.opts.historyDaysAgo = 5 // Ensure maxSeconds is properly calculated

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'Test Bookmark',
          url: 'https://example.com',
          lastVisitSecondsAgo: 0,
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles date added bonus', () => {
      const { calculateFinalScore } = commonModule
      ext.opts.scoreDateAddedBonusScoreMaximum = 20
      ext.opts.scoreDateAddedBonusScorePerDay = 2

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'Test Bookmark',
          url: 'https://example.com',
          dateAdded: Date.now(),
        },
      ]

      const scored = calculateFinalScore(results, 'test')

      expect(scored[0].score).toBeGreaterThan(ext.opts.scoreBookmarkBaseScore)
    })

    test('calculateFinalScore handles no search term', () => {
      const { calculateFinalScore } = commonModule
      ext.model.searchTerm = ''

      const results = [
        {
          type: 'bookmark',
          searchScore: 1,
          title: 'Test Bookmark',
          url: 'https://example.com',
        },
      ]

      const scored = calculateFinalScore(results, '')

      // Should still calculate base score correctly
      expect(scored[0].score).toBe(ext.opts.scoreBookmarkBaseScore)
    })
  })

  describe('integration tests', () => {
    beforeEach(() => {
      // Setup proper DOM for integration tests
      Object.defineProperty(ext, 'dom', {
        value: {
          searchInput: { value: '' },
          resultCounter: { innerText: '' },
        },
        writable: true,
      })
      ext.initialized = true
      ext.searchCache = new Map()
    })

    test('search integration with fuzzy strategy', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'test'
      ext.opts.searchStrategy = 'fuzzy'
      ext.opts.searchMinMatchCharLength = 1
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      mockFuzzySearch.mockResolvedValue([{ type: 'bookmark', title: 'Test Bookmark', searchScore: 0.8, score: 80 }])

      await search({ key: 'a' })

      expect(mockFuzzySearch).toHaveBeenCalledWith('all', 'test')
      expect(ext.model.result.length).toBeGreaterThan(0)
    })

    test('search integration with precise strategy', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'test'
      ext.opts.searchStrategy = 'precise'
      ext.opts.searchMinMatchCharLength = 1
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      mockSimpleSearch.mockReturnValue([{ type: 'bookmark', title: 'Test Bookmark', searchScore: 1, score: 100 }])

      await search({ key: 'a' })

      expect(mockSimpleSearch).toHaveBeenCalledWith('all', 'test')
      expect(ext.model.result.length).toBeGreaterThan(0)
    })

    test('search integration with taxonomy search', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = '#test'
      ext.opts.searchStrategy = 'precise'
      ext.opts.searchMinMatchCharLength = 1
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      mockSearchTaxonomy.mockReturnValue([
        { type: 'bookmark', title: 'Test Bookmark', tags: 'test', searchScore: 1, score: 100 },
      ])

      await search({ key: 'a' })

      expect(mockSearchTaxonomy).toHaveBeenCalledWith('test', 'tags', ext.model.bookmarks)
      expect(ext.model.result.length).toBeGreaterThan(0)
    })

    test('search integration with search engines', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 's test'
      ext.opts.enableSearchEngines = true
      ext.opts.searchStrategy = 'precise'
      ext.opts.searchMinMatchCharLength = 1
      ext.opts.scoreMinScore = 0 // Ensure results aren't filtered out
      ext.opts.searchEngineChoices = [{ name: 'Google', urlPrefix: 'https://www.google.com/search?q=' }]

      await search({ key: 'a' })

      expect(ext.model.result.some((item) => item.type === 'search')).toBe(true)
    })

    test('search integration with result filtering and limiting', async () => {
      const { search } = commonModule
      ext.dom.searchInput.value = 'test'
      ext.opts.searchStrategy = 'precise'
      ext.opts.searchMaxResults = 2
      ext.opts.scoreMinScore = 50

      // Create results that will be filtered and limited
      mockSimpleSearch.mockReturnValue([
        { type: 'bookmark', title: 'Test 1', searchScore: 1, score: 100 },
        { type: 'bookmark', title: 'Test 2', searchScore: 1, score: 80 },
        { type: 'bookmark', title: 'Test 3', searchScore: 1, score: 30 }, // Below min score
        { type: 'bookmark', title: 'Test 4', searchScore: 1, score: 60 },
      ])

      await search({ key: 'a' })

      expect(ext.model.result.length).toBeLessThanOrEqual(2)
      expect(ext.model.result.every((item) => item.score >= 50)).toBe(true)
    })
  })
})
