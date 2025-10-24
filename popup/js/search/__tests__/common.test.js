/**
 * Tests for common.js - search orchestration and coordination logic.
 *
 * ✅ Covered behaviors: search entry gating, cache hits, taxonomy/custom/direct results integration,
 *    scoring, sorting, result filtering, and overall search flow orchestration.
 * ⚠️ Known gaps: DOM rendering side effects and performance metrics are not asserted due to limited observable outputs.
 * 🐞 Added BUG tests: none
 *
 * Note: Detailed tests for extracted modules are in their respective test files:
 * - queryParser.test.js: Mode detection logic
 * - searchEngines.test.js: Search engine result generation
 * - defaultResults.test.js: Default entry sourcing
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { createTestExt, clearTestExt } from '../../__tests__/testUtils.js'

const mockGetBrowserTabs = jest.fn()
const mockCloseErrors = jest.fn()
const mockRenderSearchResults = jest.fn()
const mockLoadScript = jest.fn(() => Promise.resolve())

let commonModule
let search
let searchWithAlgorithm
let calculateFinalScore
let sortResults

beforeAll(async () => {
  await jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    getBrowserTabs: mockGetBrowserTabs,
  }))
  const utilsModule = await import('../../helper/utils.js')
  await jest.unstable_mockModule('../../helper/utils.js', () => ({
    __esModule: true,
    ...utilsModule,
    loadScript: mockLoadScript,
  }))
  await jest.unstable_mockModule('../../view/errorView.js', () => ({
    __esModule: true,
    closeErrors: mockCloseErrors,
    printError: jest.fn(),
  }))
  await jest.unstable_mockModule('../../view/searchView.js', () => ({
    __esModule: true,
    renderSearchResults: mockRenderSearchResults,
  }))

  commonModule = await import('../common.js')
  search = commonModule.search
  searchWithAlgorithm = commonModule.searchWithAlgorithm
  calculateFinalScore = commonModule.calculateFinalScore
  sortResults = commonModule.sortResults
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetBrowserTabs.mockResolvedValue([])
  mockLoadScript.mockResolvedValue(undefined)
  setupExt()
})

afterEach(() => {
  jest.restoreAllMocks()
  clearTestExt()
})

function setupExt(overrides = {}) {
  createTestExt({
    initialized: true,
    searchCache: new Map(),
    opts: {
      enableDirectUrl: true,
      enableSearchEngines: true,
      customSearchEngines: [
        {
          alias: ['yt'],
          name: 'YouTube',
          urlPrefix: 'https://youtube.com/results?search_query=$s',
        },
      ],
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
      ],
      searchStrategy: 'precise',
      searchMaxResults: 5,
      searchMinMatchCharLength: 1,
      scoreMinScore: 10,
      scoreExactIncludesBonus: 5,
      scoreExactIncludesBonusMinChars: 3,
      scoreExactStartsWithBonus: 10,
      scoreExactEqualsBonus: 15,
      scoreExactTagMatchBonus: 10,
      scoreExactFolderMatchBonus: 5,
      scoreVisitedBonusScore: 0.5,
      scoreVisitedBonusScoreMaximum: 20,
      scoreRecentBonusScoreMaximum: 20,
      scoreCustomBonusScore: true,
      scoreBookmarkBase: 100,
      scoreTabBase: 70,
      scoreHistoryBase: 45,
      scoreSearchEngineBase: 30,
      scoreCustomSearchEngineBase: 400,
      scoreDirectUrlScore: 500,
      scoreTitleWeight: 1,
      scoreTagWeight: 0.7,
      scoreUrlWeight: 0.6,
      scoreFolderWeight: 0.5,
      historyDaysAgo: 14,
      maxRecentTabsToShow: 3,
      ...overrides.opts,
    },
    model: {
      searchMode: 'all',
      result: [],
      bookmarks: [],
      tabs: [],
      history: [],
      ...overrides.model,
    },
    dom: {
      searchInput: { value: '' },
      resultCounter: { innerText: '' },
      ...overrides.dom,
    },
    ...overrides,
  })
}

describe('searchWithAlgorithm', () => {
  test('returns empty list when below minimum length', async () => {
    ext.opts.searchMinMatchCharLength = 5

    const results = await searchWithAlgorithm('precise', 'abc')

    expect(results).toEqual([])
  })

  test('delegates to precise search', async () => {
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Daily News Digest',
        url: 'https://news.test',
        searchString: 'daily news digest',
      },
    ]

    const results = await searchWithAlgorithm('precise', 'news', 'bookmarks')

    expect(results).toEqual([
      expect.objectContaining({
        title: 'Daily News Digest',
        searchApproach: 'precise',
        type: 'bookmark',
      }),
    ])
  })

  test('delegates to fuzzy search', async () => {
    mockLoadScript.mockClear()
    const results = await searchWithAlgorithm('fuzzy', 'tabs', 'tabs')

    expect(results).toEqual([])
    expect(mockLoadScript).toHaveBeenCalledWith('./lib/uFuzzy.iife.min.js')
  })

  test('throws when search approach unsupported', async () => {
    await expect(searchWithAlgorithm('unknown', 'test')).rejects.toThrow('Unknown search approach: unknown')
  })
})

describe('calculateFinalScore', () => {
  test('re-exports scoring implementation', async () => {
    const scoringModule = await import('../scoring.js')
    expect(calculateFinalScore).toBe(scoringModule.calculateFinalScore)
  })
})

describe('sortResults', () => {
  test('sorts by score descending', () => {
    const results = [{ score: 10 }, { score: 40 }, { score: 25 }]

    expect(sortResults(results, 'score')).toEqual([{ score: 40 }, { score: 25 }, { score: 10 }])
  })

  test('sorts by last visited with missing values pushed last', () => {
    const results = [{ lastVisitSecondsAgo: 5 }, { lastVisitSecondsAgo: null }, { lastVisitSecondsAgo: 2 }]

    expect(sortResults(results, 'lastVisited')).toEqual([
      { lastVisitSecondsAgo: 2 },
      { lastVisitSecondsAgo: 5 },
      { lastVisitSecondsAgo: null },
    ])
  })

  test('throws on unknown sort mode', () => {
    expect(() => sortResults([], 'random')).toThrow('Unknown sortMode="random"')
  })
})

describe('addDefaultEntries', () => {
  test('re-exports defaultResults implementation', async () => {
    const defaultResultsModule = await import('../defaultResults.js')
    expect(commonModule.addDefaultEntries).toBe(defaultResultsModule.addDefaultEntries)
  })
})

describe('mergeResultsByUrl', () => {
  test('merges bookmark, tab, and history entries sharing the same URL', () => {
    const merged = commonModule.mergeResultsByUrl([
      {
        type: 'bookmark',
        originalUrl: 'https://example.test',
        originalId: 1,
        title: 'Example bookmark',
        url: 'https://example.test',
        searchScore: 1,
        tagsArray: ['Work'],
        folderArray: ['Work'],
        dateAdded: 123,
      },
      {
        type: 'tab',
        originalUrl: 'https://example.test',
        originalId: 200,
        title: 'Example tab',
        url: 'https://example.test',
        searchScore: 1,
        windowId: 2,
      },
      {
        type: 'history',
        originalUrl: 'https://example.test',
        originalId: 'hist-1',
        title: 'Example history',
        url: 'https://example.test',
        searchScore: 1,
        lastVisitSecondsAgo: 120,
        visitCount: 5,
      },
      {
        type: 'direct',
        originalUrl: 'https://other.test',
        originalId: 'direct',
      },
    ])

    expect(merged).toHaveLength(2)
    const mergedEntry = merged.find((item) => item.originalUrl === 'https://example.test')
    expect(mergedEntry).toBeDefined()
    expect(mergedEntry?.sourceTypes).toEqual(['bookmark', 'tab', 'history'])
    expect(mergedEntry?.type).toBe('bookmark')
    expect(mergedEntry?.originalId).toBe(1)
    expect(mergedEntry?.tabOriginalId).toBe(200)
    expect(mergedEntry?.bookmarkOriginalId).toBe(1)
    expect(mergedEntry?.historyOriginalId).toBe('hist-1')
    expect(mergedEntry?.tagsArray).toEqual(['Work'])
    expect(mergedEntry?.lastVisitSecondsAgo).toBe(120)
    expect(mergedEntry?.visitCount).toBe(5)
  })

  test('prefers bookmark metadata for titles and tags when available', () => {
    const merged = commonModule.mergeResultsByUrl([
      {
        type: 'tab',
        originalUrl: 'https://bookmark-first.test',
        originalId: 33,
        title: 'Active tab title',
        titleHighlighted: '<mark>Active</mark> tab title',
        url: 'https://bookmark-first.test',
      },
      {
        type: 'bookmark',
        originalUrl: 'https://bookmark-first.test',
        originalId: 77,
        title: 'Bookmark title',
        titleHighlighted: '<mark>Bookmark</mark> title',
        url: 'https://bookmark-first.test',
        tagsArray: ['personal', 'ideas'],
      },
    ])

    expect(merged).toHaveLength(1)
    const mergedEntry = merged[0]
    expect(mergedEntry?.title).toBe('Bookmark title')
    expect(mergedEntry?.titleHighlighted).toBe('<mark>Bookmark</mark> title')
    expect(mergedEntry?.tagsArray).toEqual(['personal', 'ideas'])
    expect(mergedEntry?.tabOriginalId).toBe(33)
    expect(mergedEntry?.bookmarkOriginalId).toBe(77)
    expect(mergedEntry?.type).toBe('bookmark')
    expect(mergedEntry?.originalId).toBe(77)
  })

  test('merges tags from multiple bookmarks with the same URL', () => {
    const merged = commonModule.mergeResultsByUrl([
      {
        type: 'bookmark',
        originalUrl: 'https://multi-bookmark.test',
        originalId: 1,
        title: 'First Bookmark',
        url: 'https://multi-bookmark.test',
        tagsArray: ['work', 'project-a'],
        tags: '#work #project-a',
      },
      {
        type: 'bookmark',
        originalUrl: 'https://multi-bookmark.test',
        originalId: 2,
        title: 'Second Bookmark',
        url: 'https://multi-bookmark.test',
        tagsArray: ['personal', 'project-a'],
        tags: '#personal #project-a',
      },
    ])

    expect(merged).toHaveLength(1)
    const mergedEntry = merged[0]
    // Tags should be merged and deduplicated
    expect(mergedEntry?.tagsArray).toEqual(['work', 'project-a', 'personal'])
    // Tags string should be reconstructed from merged array
    expect(mergedEntry?.tags).toBe('#work #project-a #personal')
    // Title from last bookmark wins
    expect(mergedEntry?.title).toBe('Second Bookmark')
    expect(mergedEntry?.type).toBe('bookmark')
    // Should be marked as duplicate
    expect(mergedEntry?.isDuplicateBookmark).toBe(true)
  })
})

describe('search', () => {
  test('returns early for navigation keys', async () => {
    await search({ key: 'ArrowUp' })

    expect(mockRenderSearchResults).not.toHaveBeenCalled()
  })

  test('skips execution when extension is not initialized', async () => {
    ext.initialized = false

    await search({ key: 'a' })

    expect(mockRenderSearchResults).not.toHaveBeenCalled()
  })

  test('uses cached results when present', async () => {
    const cached = [{ type: 'bookmark', score: 50 }]
    ext.searchCache = new Map([['test_precise_all', cached]])
    ext.dom.searchInput.value = 'Test'
    ext.model.searchTerm = 'previous search'

    await search({ key: 't' })

    expect(ext.model.result).toBe(cached)
    expect(ext.model.searchTerm).toBe('test')
    expect(mockRenderSearchResults).toHaveBeenCalledWith(cached)
  })

  test('loads default entries when search term empty', async () => {
    ext.model.searchMode = 'history'
    ext.model.history = [
      { id: 1, title: 'Recent history', url: 'https://recent.test' },
      { id: 2, title: 'Older history', url: 'https://older.test' },
    ]
    ext.dom.searchInput.value = '   '

    await search({ key: 'a' })

    expect(ext.model.result).toEqual([
      { id: 1, title: 'Recent history', url: 'https://recent.test', searchScore: 1 },
      { id: 2, title: 'Older history', url: 'https://older.test', searchScore: 1 },
    ])
    expect(mockRenderSearchResults).toHaveBeenCalledWith(ext.model.result)
  })

  test('performs taxonomy search when tag prefix detected', async () => {
    ext.dom.searchInput.value = '#TagSearch'
    ext.model.bookmarks = [
      {
        id: 1,
        type: 'bookmark',
        title: 'Tagged result',
        url: 'https://tag.test',
        searchString: 'Tagged result https://tag.test',
        tags: '#tagsearch#other',
        tagsArray: ['TagSearch', 'Other'],
      },
    ]

    await search({ key: 't' })

    expect(ext.model.result).toEqual([
      expect.objectContaining({
        title: 'Tagged result',
        searchApproach: 'taxonomy',
      }),
    ])
    expect(mockRenderSearchResults).toHaveBeenCalled()
  })

  test('adds custom search alias results', async () => {
    ext.dom.searchInput.value = 'yt cats'

    await search({ key: 'c' })

    const hasCustom = ext.model.result.some((item) => item.type === 'customSearch')
    expect(hasCustom).toBe(true)
  })

  test('adds direct url result when term looks like URL', async () => {
    ext.dom.searchInput.value = 'example.com'
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Example',
        url: 'https://example.com',
        searchString: 'example.com example bookmark',
      },
    ]
    ext.opts.scoreMinScore = 0

    await search({ key: 'e' })

    const direct = ext.model.result.find((item) => item.type === 'direct')
    expect(direct).toBeDefined()
    expect(direct).toMatchObject({
      type: 'direct',
      originalUrl: 'https://example.com',
    })
    expect(direct.url).toBe('example.com')
    expect(direct.title).toBe('Direct: "example.com"')
  })

  test('filters low scoring results and limits total size', async () => {
    ext.dom.searchInput.value = 'filter'
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'High',
        url: 'https://high.test',
        searchString: 'filter high result',
        customBonusScore: 50,
      },
      {
        type: 'bookmark',
        title: 'Mid',
        url: 'https://mid.test',
        searchString: 'filter mid result',
        customBonusScore: 20,
      },
      {
        type: 'bookmark',
        title: 'Low',
        url: 'https://low.test',
        searchString: 'filter low result',
        customBonusScore: 0,
      },
      {
        type: 'bookmark',
        title: 'Second Mid',
        url: 'https://mid2.test',
        searchString: 'filter second mid result',
        customBonusScore: 15,
      },
    ]
    ext.opts.scoreMinScore = 70
    ext.opts.searchMaxResults = 2
    ext.opts.enableSearchEngines = false
    ext.opts.customSearchEngines = []
    ext.opts.scoreBookmarkBase = 60

    await search({ key: 'f' })

    expect(ext.model.result.length).toBeLessThanOrEqual(2)
    expect(ext.model.result.every((item) => item.score >= 70)).toBe(true)
    expect(ext.dom.resultCounter.innerText).toBe(`(${ext.model.result.length})`)
  })

  test('falls back to precise search when configured strategy is unsupported', async () => {
    ext.dom.searchInput.value = 'fallback'
    ext.opts.searchStrategy = 'unsupported'
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Fallback',
        url: 'https://fallback.test',
        searchString: 'fallback bookmark entry',
      },
    ]
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await search({ key: 'f' })

    const fallbackResult = ext.model.result.find((item) => item.title === 'Fallback')
    expect(fallbackResult).toBeDefined()
    expect(fallbackResult?.searchApproach).toBe('precise')
    expect(consoleSpy).toHaveBeenCalledWith('Unsupported option "search.approach" value: "unsupported"')
    consoleSpy.mockRestore()
  })

  test('stores new results in cache after search', async () => {
    ext.dom.searchInput.value = 'remember'
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Remember',
        url: 'https://remember.test',
        searchString: 'remember bookmark entry',
      },
    ]
    const cache = {
      has: jest.fn(() => false),
      set: jest.fn(),
    }
    ext.searchCache = cache
    ext.opts.enableSearchEngines = false
    ext.opts.customSearchEngines = []

    await search({ key: 'r' })

    expect(cache.has).toHaveBeenCalledWith('remember_precise_all')
    expect(cache.set).toHaveBeenCalledWith('remember_precise_all', ext.model.result)
  })

  test('merges duplicate URLs across sources during search', async () => {
    ext.dom.searchInput.value = 'duplicate'
    ext.opts.scoreMinScore = 0
    ext.opts.enableDirectUrl = false
    ext.opts.enableSearchEngines = false

    ext.model.bookmarks = [
      {
        type: 'bookmark',
        originalUrl: 'https://merge.test',
        originalId: 11,
        url: 'https://merge.test',
        title: 'Merge Bookmark',
        searchString: 'merge bookmark duplicate https://merge.test',
      },
    ]
    ext.model.tabs = [
      {
        type: 'tab',
        originalUrl: 'https://merge.test',
        originalId: 22,
        url: 'https://merge.test',
        title: 'Merge Tab',
        searchString: 'merge tab duplicate https://merge.test',
      },
    ]

    await search({ key: 'd' })

    const rendered = mockRenderSearchResults.mock.calls.at(-1)?.[0]
    expect(rendered).toHaveLength(1)
    const [merged] = rendered
    expect(merged.sourceTypes).toEqual(['bookmark', 'tab'])
    expect(merged.type).toBe('bookmark')
    expect(merged.tabOriginalId).toBe(22)
    expect(merged.bookmarkOriginalId).toBe(11)
    expect(merged.originalId).toBe(11)
  })
})
