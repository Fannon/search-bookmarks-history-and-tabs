import { jest } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

await jest.unstable_mockModule('../../initSearch.js', () => ({
  closeErrors: jest.fn(),
}))

await jest.unstable_mockModule('../../view/searchView.js', () => ({
  renderSearchResults: jest.fn(),
}))

const { calculateFinalScore } = await import('../common.js')

describe('calculateFinalScore', () => {
  afterEach(() => {
    clearTestExt()
  })

  it('awards includes bonus for tag and folder matches using individual terms', () => {
    const searchTerm = 'foo bar'
    createTestExt({
      model: {
        searchTerm,
      },
      opts: {
        scoreBookmarkBase: 100,
        scoreExactIncludesBonus: 5,
        scoreExactIncludesBonusMinChars: 1,
        scoreExactStartsWithBonus: 0,
        scoreExactEqualsBonus: 0,
        scoreExactTagMatchBonus: 0,
        scoreExactFolderMatchBonus: 0,
        scoreTagWeight: 1,
        scoreFolderWeight: 1,
        scoreTitleWeight: 1,
        scoreUrlWeight: 1,
        scoreVisitedBonusScore: 0,
        scoreVisitedBonusScoreMaximum: 0,
        scoreRecentBonusScoreMaximum: 0,
        scoreCustomBonusScore: false,
      },
    })

    const results = calculateFinalScore(
      [
        {
          type: 'bookmark',
          title: 'Example entry',
          url: 'https://example.com',
          tags: '#foo #qux',
          tagsArray: ['foo', 'qux'],
          folder: '~bar',
          folderArray: ['Bar'],
          searchScore: 1,
        },
      ],
      searchTerm,
    )

    expect(results[0].score).toBeCloseTo(110)
  })
})
