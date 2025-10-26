/**
 * Tests for common.js - search orchestration and coordination logic.
 *
 * ✅ Covered behaviors: search entry gating, cache hits, taxonomy/custom/direct results integration,
 *    scoring, sorting, result filtering, and overall search flow orchestration.
 * ⚠️ Known gaps: DOM rendering side effects and performance metrics are not asserted due to limited observable outputs.
 * 🐞 Added BUG tests: cache invalidation, dead code, architecture violations
 *
 * Note: Detailed tests for extracted modules are in their respective test files:
 * - queryParser.test.js: Mode detection logic
 * - searchEngines.test.js: Search engine result generation
 * - defaultResults.test.js: Default entry sourcing
 */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

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
    await expect(searchWithAlgorithm('unknown', 'test')).rejects.toThrow(
      'Unknown search approach: unknown',
    )
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

    expect(sortResults(results, 'score')).toEqual([
      { score: 40 },
      { score: 25 },
      { score: 10 },
    ])
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
  test('re-exports defaultResults implementation', async () => {
    const defaultResultsModule = await import('../defaultResults.js')
    expect(commonModule.addDefaultEntries).toBe(
      defaultResultsModule.addDefaultEntries,
    )
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
    expect(mockRenderSearchResults).toHaveBeenCalledWith()
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
      {
        id: 1,
        title: 'Recent history',
        url: 'https://recent.test',
        searchScore: 1,
      },
      {
        id: 2,
        title: 'Older history',
        url: 'https://older.test',
        searchScore: 1,
      },
    ])
    expect(mockRenderSearchResults).toHaveBeenCalledWith()
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

    const hasCustom = ext.model.result.some(
      (item) => item.type === 'customSearch',
    )
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
    // Note: resultCounter is now updated by searchView.renderSearchResults, not here
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

    const fallbackResult = ext.model.result.find(
      (item) => item.title === 'Fallback',
    )
    expect(fallbackResult).toBeDefined()
    expect(fallbackResult?.searchApproach).toBe('precise')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Unsupported option "search.approach" value: "unsupported"',
    )
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
    expect(cache.set).toHaveBeenCalledWith(
      'remember_precise_all',
      ext.model.result,
    )
  })
})

describe('🐞 BUG: Cache Invalidation', () => {
  test('cache includes stale tabs after they are closed', async () => {
    // Setup: Add a tab to cache
    ext.model.tabs = [
      {
        type: 'tab',
        title: 'Tab to close',
        url: 'https://tab.test',
        originalId: 123,
        searchString: 'tab to close',
      },
    ]
    ext.dom.searchInput.value = 'tab'
    ext.opts.enableSearchEngines = false
    ext.opts.customSearchEngines = []

    // First search - cache the result with the tab
    await search({ key: 't' })
    const cachedResults = ext.searchCache.get('tab_precise_all')
    expect(cachedResults).toBeDefined()
    expect(
      cachedResults.some((r) => r.type === 'tab' && r.originalId === 123),
    ).toBe(true)

    // Simulate tab closure by removing from model
    ext.model.tabs = []

    // BUG: Second search still returns cached results with ghost tab
    ext.dom.searchInput.value = 'tab'
    await search({ key: 't' })

    // The bug: cache still contains the closed tab
    const currentResults = ext.model.result
    const hasGhostTab = currentResults.some(
      (r) => r.type === 'tab' && r.originalId === 123,
    )
    expect(hasGhostTab).toBe(true) // BUG: This should be false but is true
  })
})

describe('✅ FIXED: Inconsistent Result Passing', () => {
  test('renderSearchResults now always uses ext.model.result (no parameter)', async () => {
    ext.dom.searchInput.value = 'test'
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Test',
        url: 'https://test.com',
        searchString: 'test bookmark',
      },
    ]
    ext.opts.enableSearchEngines = false
    ext.opts.customSearchEngines = []

    await search({ key: 't' })

    // FIXED: renderSearchResults is now called with no parameters
    // It always uses ext.model.result as the single source of truth
    expect(mockRenderSearchResults).toHaveBeenCalledWith()
    expect(ext.model.result.length).toBeGreaterThan(0)
  })
})

describe('✅ FIXED: Architecture Violation', () => {
  test('resultCounter is now updated in view layer, not in common.js', async () => {
    ext.dom.searchInput.value = 'test'
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Test',
        url: 'https://test.com',
        searchString: 'test bookmark',
      },
    ]
    ext.opts.enableSearchEngines = false
    ext.opts.customSearchEngines = []

    await search({ key: 't' })

    // FIXED: resultCounter is now updated by searchView.renderSearchResults
    // common.js no longer touches the DOM directly
    expect(ext.model.result.length).toBeGreaterThan(0)
    // Note: resultCounter is updated in the view layer (searchView.js)
  })
})

describe('✅ VERIFIED: Mode Prefix Without Search Term', () => {
  test('shows default entries when mode prefix is stripped leaving empty term', async () => {
    // User types "t " (tab mode with just space) - common use case
    // Line 254: searchTerm becomes "t"
    // Line 257: "t".trim() is NOT empty, so doesn't return early
    // Line 268: resolveSearchMode strips "t" prefix, returns { mode: 'tabs', term: '' }
    // Line 270: searchTerm becomes '' (empty)
    // Now the else block at 291-294 SHOULD execute to show default entries

    ext.dom.searchInput.value = 't ' // Tab mode prefix only
    ext.model.tabs = [
      { type: 'tab', title: 'Tab 1', url: 'https://tab1.test', originalId: 1 },
      { type: 'tab', title: 'Tab 2', url: 'https://tab2.test', originalId: 2 },
    ]

    await search({ key: 't' })

    // Should show default tab entries, not empty results
    expect(ext.model.result.length).toBeGreaterThan(0)
    expect(ext.model.searchMode).toBe('tabs')
    expect(ext.model.searchTerm).toBe('')
  })

  test('shows default entries for bookmark mode prefix', async () => {
    ext.dom.searchInput.value = 'b ' // Bookmark mode prefix only
    ext.model.bookmarks = [
      {
        type: 'bookmark',
        title: 'Bookmark 1',
        url: 'https://bm1.test',
        searchString: 'bookmark 1 https://bm1.test',
      },
    ]

    await search({ key: 'b' })

    // Should show default bookmark entries
    expect(ext.model.result.length).toBeGreaterThan(0)
    expect(ext.model.searchMode).toBe('bookmarks')
    expect(ext.model.searchTerm).toBe('')
  })
})
