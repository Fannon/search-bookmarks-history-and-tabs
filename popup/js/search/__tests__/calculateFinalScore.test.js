import { jest } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

await jest.unstable_mockModule('../../initSearch.js', () => ({
  closeErrors: jest.fn(),
}))

await jest.unstable_mockModule('../../view/searchView.js', () => ({
  renderSearchResults: jest.fn(),
}))

const { calculateFinalScore } = await import('../common.js')

const baseOpts = {
  scoreBookmarkBase: 100,
  scoreTabBase: 70,
  scoreHistoryBase: 45,
  scoreSearchEngineBase: 30,
  scoreCustomSearchEngineBase: 400,
  scoreDirectUrlScore: 500,
  scoreTitleWeight: 1,
  scoreTagWeight: 1,
  scoreUrlWeight: 1,
  scoreFolderWeight: 1,
  scoreExactIncludesBonus: 0,
  scoreExactIncludesBonusMinChars: 1,
  scoreExactStartsWithBonus: 0,
  scoreExactEqualsBonus: 0,
  scoreExactTagMatchBonus: 0,
  scoreExactFolderMatchBonus: 0,
  scoreVisitedBonusScore: 0,
  scoreVisitedBonusScoreMaximum: 0,
  scoreRecentBonusScoreMaximum: 0,
  historyDaysAgo: 7,
  scoreDateAddedBonusScoreMaximum: 0,
  scoreDateAddedBonusScorePerDay: 0,
  scoreCustomBonusScore: false,
}

const baseResult = {
  type: 'bookmark',
  title: 'base title',
  url: 'example.com/item',
  tags: '',
  tagsArray: [],
  folder: '',
  folderArray: [],
  searchScore: 1,
  customBonusScore: 0,
}

function scoreFor({ searchTerm = 'query', opts = {}, result = {} }) {
  createTestExt({
    model: { searchTerm },
    opts: { ...baseOpts, ...opts },
  })

  const [scored] = calculateFinalScore([{ ...baseResult, ...result }], searchTerm)
  const score = scored.score

  clearTestExt()
  return score
}

describe('calculateFinalScore', () => {
  afterEach(() => {
    clearTestExt()
    jest.restoreAllMocks()
  })

  it('scales the base score by the searchScore multiplier', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      result: { searchScore: 0.5 },
    })

    expect(score).toBeCloseTo(50)
  })

  it('applies includes bonus for title matches', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: { scoreExactIncludesBonus: 5 },
      result: { title: 'alpha value' },
    })

    expect(score).toBeCloseTo(105)
  })

  it('applies includes bonus for tag matches', () => {
    const score = scoreFor({
      searchTerm: 'taggy',
      opts: { scoreExactIncludesBonus: 5 },
      result: {
        title: 'neutral title',
        tags: '#taggy',
        tagsArray: ['taggy'],
      },
    })

    expect(score).toBeCloseTo(105)
  })

  it('applies includes bonus for folder matches', () => {
    const score = scoreFor({
      searchTerm: 'projects',
      opts: { scoreExactIncludesBonus: 5 },
      result: {
        title: 'neutral title',
        folder: '~Projects',
        folderArray: ['Projects'],
      },
    })

    expect(score).toBeCloseTo(105)
  })

  it('normalizes url fragments before applying includes bonus', () => {
    const score = scoreFor({
      searchTerm: 'project plan',
      opts: { scoreExactIncludesBonus: 5 },
      result: {
        title: 'neutral title',
        url: 'example.com/project-plan',
      },
    })

    expect(score).toBeCloseTo(110)
  })

  it('adds exact tag match bonus when the tag matches a search term', () => {
    const score = scoreFor({
      searchTerm: 'taggy other',
      opts: { scoreExactTagMatchBonus: 7 },
      result: {
        tags: '#taggy',
        tagsArray: ['taggy'],
      },
    })

    expect(score).toBeCloseTo(107)
  })

  it('adds exact folder match bonus when the folder name matches a search term', () => {
    const score = scoreFor({
      searchTerm: 'projects other',
      opts: { scoreExactFolderMatchBonus: 6 },
      result: {
        folder: '~Projects',
        folderArray: ['Projects'],
      },
    })

    expect(score).toBeCloseTo(106)
  })

  it('adds starts-with bonus when the title starts with the search term', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: { scoreExactStartsWithBonus: 8 },
      result: {
        title: 'alpha project plan',
      },
    })

    expect(score).toBeCloseTo(108)
  })

  it('adds starts-with bonus when the url starts with the hyphenated search term', () => {
    const score = scoreFor({
      searchTerm: 'alpha beta',
      opts: { scoreExactStartsWithBonus: 8 },
      result: {
        url: 'alpha-beta.com/path',
      },
    })

    expect(score).toBeCloseTo(108)
  })

  it('adds exact equals bonus when the title equals the search term', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: { scoreExactEqualsBonus: 9 },
      result: {
        title: 'alpha',
      },
    })

    expect(score).toBeCloseTo(109)
  })

  it('adds custom bonus score when enabled', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: { scoreCustomBonusScore: true },
      result: {
        customBonusScore: 7,
      },
    })

    expect(score).toBeCloseTo(107)
  })

  it('adds visited bonus and respects the maximum cap', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: {
        scoreVisitedBonusScore: 2,
        scoreVisitedBonusScoreMaximum: 5,
      },
      result: {
        visitCount: 10,
      },
    })

    expect(score).toBeCloseTo(105)
  })

  it('adds recent bonus scaled by lastVisitSecondsAgo', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: {
        scoreRecentBonusScoreMaximum: 20,
        historyDaysAgo: 1,
      },
      result: {
        lastVisitSecondsAgo: 3600,
      },
    })

    expect(score).toBeCloseTo(119.1666667)
  })

  it('adds full recent bonus when lastVisitSecondsAgo is zero', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: {
        scoreRecentBonusScoreMaximum: 20,
        historyDaysAgo: 1,
      },
      result: {
        lastVisitSecondsAgo: 0,
      },
    })

    expect(score).toBeCloseTo(120)
  })

  it('adds date-added bonus with per-day decay', () => {
    const fixedNow = 1_700_000_000_000
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow)

    const score = scoreFor({
      searchTerm: 'alpha',
      opts: {
        scoreDateAddedBonusScoreMaximum: 10,
        scoreDateAddedBonusScorePerDay: 2,
      },
      result: {
        dateAdded: fixedNow - 12 * 60 * 60 * 1000,
      },
    })

    expect(score).toBeCloseTo(109)
  })
})
