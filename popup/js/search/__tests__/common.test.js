/**
 * ✅ Covered behaviors: search entry gating, cache hits, mode detection, taxonomy/custom/direct results, scoring, sorting, and default entry sourcing.
 * ⚠️ Known gaps: DOM rendering side effects and performance metrics are not asserted due to limited observable outputs.
 * 🐞 Added BUG tests: none
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals'
import { createTestExt, clearTestExt } from '../../__tests__/testUtils.js'

const mockGetBrowserTabs = jest.fn()
const mockCleanUpUrl = jest.fn((url) => url.replace(/\/+$/, ''))
const mockPrintError = jest.fn()
const mockCloseModals = jest.fn()
const mockRenderSearchResults = jest.fn()
const mockLoadScript = jest.fn(() => Promise.resolve())

let commonModule
let search
let searchWithAlgorithm
let calculateFinalScore
let sortResults
let addDefaultEntries

beforeAll(async () => {
  await jest.unstable_mockModule('../../helper/browserApi.js', () => ({
    __esModule: true,
    getBrowserTabs: mockGetBrowserTabs,
  }))
  await jest.unstable_mockModule('../../helper/utils.js', () => ({
    __esModule: true,
    cleanUpUrl: mockCleanUpUrl,
    printError: mockPrintError,
    loadScript: mockLoadScript,
  }))
  await jest.unstable_mockModule('../../initSearch.js', () => ({
    __esModule: true,
    closeModals: mockCloseModals,
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
  addDefaultEntries = commonModule.addDefaultEntries
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
  test('assigns base scores for each supported result type', () => {
    ext.model.searchTerm = ''
    const results = [
      { type: 'bookmark', searchScore: 0.5, customBonusScore: 5, title: 'Bookmark', url: 'https://bookmark.test' },
      { type: 'tab', searchScore: 1, title: 'Tab', url: 'https://tab.test' },
      { type: 'history', searchScore: 1, title: 'History', url: 'https://history.test' },
      { type: 'search', searchScore: 0.5, title: 'Search', url: 'https://search.test' },
      { type: 'customSearch', searchScore: 1, title: 'Custom', url: 'https://custom.test' },
      { type: 'direct', searchScore: 1, title: 'Direct', url: 'https://direct.test' },
    ]

    const scored = calculateFinalScore(results, '')

    expect(scored).toEqual([
      expect.objectContaining({ score: 55 }),
      expect.objectContaining({ score: 70 }),
      expect.objectContaining({ score: 45 }),
      expect.objectContaining({ score: 15 }),
      expect.objectContaining({ score: 400 }),
      expect.objectContaining({ score: 500 }),
    ])
  })

  test('adds search term bonuses, visit history, and recency adjustments', () => {
    const fixedNow = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow)
    ext.model.searchTerm = 'latest'
    ext.opts.scoreDateAddedBonusScoreMaximum = 12
    ext.opts.scoreDateAddedBonusScorePerDay = 2

    const results = [
      {
        type: 'bookmark',
        title: 'Latest news digest',
        url: 'latestnews.test',
        tags: 'latest,news',
        tagsArray: ['Latest', 'News'],
        folder: 'Latest',
        folderArray: ['Latest'],
        customBonusScore: 7,
        searchScore: 1,
        visitCount: 10,
        lastVisitSecondsAgo: 0,
        dateAdded: fixedNow - 24 * 60 * 60 * 1000,
      },
    ]

    const [scored] = calculateFinalScore(results, 'latest')

    expect(scored.score).toBeCloseTo(172)
    Date.now.mockRestore()
  })

  test('throws on unsupported result type', () => {
    const results = [{ type: 'unsupported', searchScore: 1, title: 'X', url: 'https://x.test' }]

    expect(() => calculateFinalScore(results, 'x')).toThrow('Search result type "unsupported" not supported')
  })
})

describe('sortResults', () => {
  test('sorts by score descending', () => {
    const results = [{ score: 10 }, { score: 40 }, { score: 25 }]

    expect(sortResults(results, 'score')).toEqual([{ score: 40 }, { score: 25 }, { score: 10 }])
  })

  test('sorts by last visited with missing values pushed last', () => {
    const results = [
      { lastVisitSecondsAgo: 5 },
      { lastVisitSecondsAgo: null },
      { lastVisitSecondsAgo: 2 },
    ]

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
  test('returns history entries when history mode active', async () => {
    ext.model.searchMode = 'history'
    ext.model.history = [{ id: 1, title: 'History' }]

    const results = await addDefaultEntries()

    expect(results).toEqual([{ id: 1, title: 'History', searchScore: 1 }])
    expect(ext.model.result).toEqual(results)
  })

  test('returns recent tabs sorted by recency when tabs mode active', async () => {
    ext.model.searchMode = 'tabs'
    ext.model.tabs = [
      { id: 1, lastVisitSecondsAgo: 40 },
      { id: 2, lastVisitSecondsAgo: 10 },
      { id: 3, lastVisitSecondsAgo: 25 },
    ]

    const results = await addDefaultEntries()

    expect(results.map((tab) => tab.id)).toEqual([2, 3, 1])
  })

  test('returns bookmarks when bookmarks mode active', async () => {
    ext.model.searchMode = 'bookmarks'
    ext.model.bookmarks = [{ id: 1, title: 'Bookmark' }]

    const results = await addDefaultEntries()

    expect(results).toEqual([{ id: 1, title: 'Bookmark', searchScore: 1 }])
  })

  test('falls back to current tab matches and recent tabs when no search term', async () => {
    ext.model.bookmarks = [
      { id: 1, originalUrl: 'https://site.test', title: 'Match' },
      { id: 2, originalUrl: 'https://other.test', title: 'Other' },
    ]
    ext.model.tabs = [
      { id: 3, url: 'https://third.test', lastVisitSecondsAgo: 2 },
      { id: 4, url: 'chrome://extensions', lastVisitSecondsAgo: 1 },
    ]
    mockGetBrowserTabs.mockResolvedValue([{ url: 'https://site.test/' }])

    const results = await addDefaultEntries()

    expect(results).toEqual([
      expect.objectContaining({ id: 1, title: 'Match', searchScore: 1 }),
      expect.objectContaining({ id: 3, searchScore: 1 }),
    ])
  })

  test('ignores tab lookup errors but keeps recent tabs', async () => {
    ext.model.tabs = [
      { id: 1, url: 'https://one.test', lastVisitSecondsAgo: 4 },
      { id: 2, url: 'https://two.test', lastVisitSecondsAgo: 2 },
    ]
    mockGetBrowserTabs.mockRejectedValue(new Error('no tabs'))

    const results = await addDefaultEntries()

    expect(results.map((tab) => tab.id)).toEqual([2, 1])
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
    expect(mockCleanUpUrl).toHaveBeenCalledWith('https://example.com')
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
    ext.opts.scoreBookmarkBaseScore = 60

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
})
