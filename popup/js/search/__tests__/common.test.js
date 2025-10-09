import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals'
import { createTestExt } from '../../__tests__/testUtils.js'

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
})
