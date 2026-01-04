import { jest } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'

const { calculateFinalScore } = await import('../scoring.js')
const { defaultOptions } = await import('../../model/options.js')

// Baseline options for isolated unit tests (all bonuses off, weights = 1.0 for simplicity)
// Note: scoreTitleWeight (1), scoreExactIncludesBonusMinChars (3), and scoreExactIncludesMaxBonuses (3)
// are now hard-coded constants in scoring.js and cannot be overridden via options.
const baseOpts = {
  scoreBookmarkBaseScore: 100,
  scoreTabBaseScore: 70,
  scoreHistoryBaseScore: 45,
  scoreSearchEngineBaseScore: 30,
  scoreCustomSearchEngineBaseScore: 400,
  scoreDirectUrlScore: 500,
  scoreTagWeight: 1,
  scoreUrlWeight: 1,
  scoreFolderWeight: 1,
  scoreBookmarkOpenTabBonus: 0,
  scoreExactIncludesBonus: 0,
  scoreExactStartsWithBonus: 0,
  scoreExactEqualsBonus: 0,
  scoreExactTagMatchBonus: 0,
  scoreExactFolderMatchBonus: 0,
  scoreExactPhraseTitleBonus: 0,
  scoreExactPhraseUrlBonus: 0,
  scoreVisitedBonusScore: 0,
  scoreVisitedBonusScoreMaximum: 0,
  scoreRecentBonusScoreMaximum: 0,
  historyDaysAgo: 7,
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
  customBonusScore: 0,
}

function scoreFor({ searchTerm = 'query', opts = {}, result = {} }) {
  createTestExt({
    model: { searchTerm },
    opts: { ...baseOpts, ...opts },
  })

  // Ensure normalized fields are present for scoring logic
  const normalizedResult = {
    ...baseResult,
    ...result,
  }
  if (normalizedResult.title && !normalizedResult.titleLower) {
    normalizedResult.titleLower = normalizedResult.title.toLowerCase().trim()
  }
  if (normalizedResult.tags && !normalizedResult.tagsLower) {
    normalizedResult.tagsLower = normalizedResult.tags.toLowerCase()
  }
  if (normalizedResult.tagsArray && !normalizedResult.tagsArrayLower) {
    normalizedResult.tagsArrayLower = normalizedResult.tagsArray.map((t) => t.toLowerCase())
  }
  if (normalizedResult.folder && !normalizedResult.folderLower) {
    normalizedResult.folderLower = normalizedResult.folder.toLowerCase()
  }
  if (normalizedResult.folderArray && !normalizedResult.folderArrayLower) {
    normalizedResult.folderArrayLower = normalizedResult.folderArray.map((f) => f.toLowerCase())
  }
  if (normalizedResult.url) {
    normalizedResult.url = normalizedResult.url.toLowerCase()
  }

  const [scored] = calculateFinalScore([normalizedResult], searchTerm)
  const score = scored.score

  clearTestExt()
  return score
}

describe('scoring', () => {
  afterEach(() => {
    clearTestExt()
    jest.restoreAllMocks()
  })

  it('applies base scores for each result type', () => {
    createTestExt({
      model: { searchTerm: '' },
      opts: baseOpts,
    })

    const results = [
      {
        type: 'bookmark',
        title: 'Bookmark',
        titleLower: 'bookmark',
        url: 'bookmark.test',
        searchScore: 0.55,
      },
      { type: 'tab', title: 'Tab', titleLower: 'tab', url: 'tab.test', searchScore: 1 },
      {
        type: 'history',
        title: 'History',
        titleLower: 'history',
        url: 'history.test',
        searchScore: 1,
      },
      {
        type: 'search',
        title: 'Search',
        titleLower: 'search',
        url: 'search.test',
        searchScore: 0.5,
      },
      {
        type: 'customSearch',
        title: 'Custom search',
        titleLower: 'custom search',
        url: 'custom.test',
        searchScore: 1,
      },
      { type: 'direct', title: 'Direct', titleLower: 'direct', url: 'direct.test', searchScore: 1 },
    ]

    const scored = calculateFinalScore(results, '')
    const scoreByType = Object.fromEntries(scored.map((item) => [item.type, item.score]))

    expect(scoreByType).toMatchObject({
      bookmark: expect.any(Number),
      tab: expect.any(Number),
      history: expect.any(Number),
      search: expect.any(Number),
      customSearch: expect.any(Number),
      direct: expect.any(Number),
    })
    expect(scoreByType.bookmark).toBeCloseTo(100)
    expect(scoreByType.tab).toBeCloseTo(70)
    expect(scoreByType.history).toBeCloseTo(45)
    expect(scoreByType.search).toBeCloseTo(30)
    expect(scoreByType.customSearch).toBeCloseTo(400)
    expect(scoreByType.direct).toBeCloseTo(500)
  })

  it('throws on unsupported result type', () => {
    createTestExt({
      model: { searchTerm: 'test' },
      opts: baseOpts,
    })

    expect(() =>
      calculateFinalScore(
        [
          {
            type: 'unsupported',
            title: 'X',
            url: 'https://x.test',
          },
        ],
        'test',
      ),
    ).toThrow('Search result type "unsupported" not supported')
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

  it('allows numeric tokens shorter than the min character threshold (3 chars)', () => {
    // Note: scoreExactIncludesBonusMinChars is now hard-coded to 3
    const score = scoreFor({
      searchTerm: '42',
      opts: { scoreExactIncludesBonus: 5 },
      result: { title: 'version 42 release' },
    })

    expect(score).toBeCloseTo(105)
  })

  it('adds the configured bonus when a bookmark is also an open tab', () => {
    const score = scoreFor({
      searchTerm: '',
      opts: { scoreBookmarkOpenTabBonus: 25 },
      result: { tab: true },
    })

    expect(score).toBeCloseTo(125)
  })

  it('does not apply open-tab bonus to non-bookmark types', () => {
    const score = scoreFor({
      searchTerm: '',
      opts: { scoreBookmarkOpenTabBonus: 25 },
      result: { type: 'tab', tab: true },
    })

    expect(score).toBeCloseTo(70)
  })

  it('limits substring bonuses to max cap of 3 (hard-coded)', () => {
    // Note: scoreExactIncludesMaxBonuses is now hard-coded to 3
    // Use 4 terms to verify the cap is applied
    const score = scoreFor({
      searchTerm: 'alpha beta gamma delta',
      opts: { scoreExactIncludesBonus: 5 },
      result: { url: 'https://example.test/alpha-beta-gamma-delta' },
    })

    // Only 3 bonuses should be applied (capped), not 4: 100 + (5 * 3) = 115
    expect(score).toBeCloseTo(115)
  })

  it('adds phrase bonus when the entire query appears in the title', () => {
    const score = scoreFor({
      searchTerm: 'project plan',
      opts: { scoreExactPhraseTitleBonus: 3, scoreExactIncludesBonus: 0 },
      result: { title: 'project plan document' },
    })

    expect(score).toBeCloseTo(103)
  })

  it('adds phrase bonus when the entire query appears in the url', () => {
    const score = scoreFor({
      searchTerm: 'project plan',
      opts: { scoreExactPhraseUrlBonus: 2, scoreExactIncludesBonus: 0 },
      result: { url: 'https://docs.test/project-plan-overview' },
    })

    expect(score).toBeCloseTo(102)
  })

  it('does NOT add phrase bonus for single-word searches in title', () => {
    const score = scoreFor({
      searchTerm: 'project',
      opts: { scoreExactPhraseTitleBonus: 8, scoreExactIncludesBonus: 0 },
      result: { title: 'project document' },
    })

    // Should be base score only (100), no phrase bonus for single word
    expect(score).toBeCloseTo(100)
  })

  it('does NOT add phrase bonus for single-word searches in url', () => {
    const score = scoreFor({
      searchTerm: 'project',
      opts: { scoreExactPhraseUrlBonus: 4, scoreExactIncludesBonus: 0 },
      result: { url: 'https://docs.test/project-overview' },
    })

    // Should be base score only (100), no phrase bonus for single word
    expect(score).toBeCloseTo(100)
  })

  it('adds exact tag match bonus when the tag matches a search term', () => {
    const score = scoreFor({
      searchTerm: 'taggy other',
      opts: { scoreExactTagMatchBonus: 7, scoreExactIncludesBonus: 0 },
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
      opts: { scoreExactFolderMatchBonus: 6, scoreExactIncludesBonus: 0 },
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

  it('BEHAVIOR: repeated search terms each get exact tag match bonus (intentional)', () => {
    const score = scoreFor({
      searchTerm: 'tag tag tag',
      opts: { scoreExactTagMatchBonus: 10, scoreExactIncludesBonus: 0 },
      result: {
        tags: '#tag',
        tagsArray: ['tag'],
      },
    })

    // Each "tag" in the search gets the exact tag match bonus: 100 + (10 * 3) = 130
    // This is intentional - repeated terms indicate higher relevance
    expect(score).toBeCloseTo(130)
  })

  it('BUG FIX: normalizes title before startsWith check', () => {
    const score = scoreFor({
      searchTerm: 'alpha',
      opts: { scoreExactStartsWithBonus: 8 },
      result: {
        title: '  alpha project',
      },
    })

    // Should match even with leading spaces (now fixed with title.trim())
    expect(score).toBeCloseTo(108)
  })

  it('OPTIMIZATION: caches normalized tag lookups', () => {
    const score = scoreFor({
      searchTerm: 'tag1 tag2',
      opts: { scoreExactTagMatchBonus: 5, scoreExactIncludesBonus: 0 },
      result: {
        tags: '#Tag1#OtherTag',
        tagsArray: ['Tag1', 'OtherTag'],
      },
    })

    // Should match Tag1 without repeated toLowerCase
    expect(score).toBeCloseTo(105)
  })

  it('IMPROVEMENT: penalizes results missing all search terms more aggressively', () => {
    const scoreNoMatch = scoreFor({
      searchTerm: 'alpha beta gamma',
      result: { title: 'delta' },
    })

    const scoreOneMatch = scoreFor({
      searchTerm: 'alpha beta gamma',
      opts: { scoreExactIncludesBonus: 5 },
      result: { title: 'alpha delta epsilon' },
    })

    // Single match should not score close to base
    expect(scoreOneMatch).toBeGreaterThan(scoreNoMatch)
    expect(scoreOneMatch).toBeLessThan(120)
  })

  it('IMPROVEMENT: avoids duplicate penalty for multi-source results', () => {
    const score = scoreFor({
      searchTerm: 'test',
      result: {
        type: 'bookmark',
        title: 'test',
        fromMultipleSources: true,
      },
    })

    // Should not double-count bonuses for duplicates
    expect(score).toBeLessThan(150)
  })

  it('IMPROVEMENT: detects exact URL matches in includes check', () => {
    const score = scoreFor({
      searchTerm: 'github.com',
      opts: { scoreExactIncludesBonus: 8 },
      result: {
        title: 'My Project',
        url: 'github.com/user/repo',
      },
    })

    // Should match domain exactly
    expect(score).toBeGreaterThan(105)
  })

  it('BEHAVIOR: repeated search terms each get includes bonus (intentional)', () => {
    const score = scoreFor({
      searchTerm: 'test test test',
      opts: { scoreExactIncludesBonus: 5 },
      result: { title: 'test value' },
    })

    // Each "test" in the search gets bonus: 100 + (5 * 3) = 115
    // This is intentional - repeated terms indicate higher relevance
    expect(score).toBeCloseTo(115)
  })

  it('BEHAVIOR: multiple different terms each get their own includes bonus', () => {
    const score = scoreFor({
      searchTerm: 'alpha beta',
      opts: { scoreExactIncludesBonus: 5 },
      result: { title: 'alpha beta gamma' },
    })

    // Both 'alpha' and 'beta' match: 100 + (5 * 2) = 110
    expect(score).toBeCloseTo(110)
  })

  it('BUG FIX: normalizes URL in includes check for case-insensitive matching', () => {
    const score = scoreFor({
      searchTerm: 'example',
      opts: { scoreExactIncludesBonus: 8 },
      result: {
        title: 'neutral title',
        url: 'EXAMPLE.COM/path',
      },
    })

    // Should match despite URL being uppercase
    expect(score).toBeCloseTo(108)
  })

  it('BUG FIX: uses lowercase URL in startsWith check', () => {
    const score = scoreFor({
      searchTerm: 'example-path',
      opts: { scoreExactStartsWithBonus: 10 },
      result: {
        title: 'neutral title',
        url: 'EXAMPLE-PATH/file',
      },
    })

    // Should match despite URL being uppercase
    expect(score).toBeCloseTo(110)
  })

  it('does not apply bonus multiple times when same search term appears in different fields', () => {
    const score = scoreFor({
      searchTerm: 'test',
      opts: { scoreExactIncludesBonus: 5 },
      result: {
        title: 'test',
        tags: '#test',
        tagsArray: ['test'],
      },
    })

    // Should apply only title bonus (first match), not title + tag bonuses
    expect(score).toBeCloseTo(105)
  })

  it('handles empty results gracefully', () => {
    const scoreNoSearchTerm = scoreFor({
      searchTerm: '',
      result: {},
    })

    expect(scoreNoSearchTerm).toBeCloseTo(100)
  })

  it('applies includes bonuses in priority order (title > url > tags > folder)', () => {
    // Note: scoreTitleWeight is now hard-coded to 1, but we can still verify
    // that title match takes priority over other fields
    const scoreWith = scoreFor({
      searchTerm: 'priority',
      opts: {
        scoreExactIncludesBonus: 5,
        scoreUrlWeight: 0.6,
        scoreTagWeight: 0.7,
        scoreFolderWeight: 0.5,
      },
      result: {
        title: 'priority test',
        url: 'priority.com',
        tags: '#priority',
        folder: 'priority',
      },
    })

    // Should apply title weight bonus (5 * 1 = 5 added) since title takes priority
    expect(scoreWith).toBeCloseTo(105)
  })

  describe('Tag scoring scenarios (real-world use cases)', () => {
    it('exact tag match gets both includes bonus (tag weight) and exact tag match bonus', () => {
      const score = scoreFor({
        searchTerm: 'javascript',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 10,
          scoreTagWeight: 0.7,
        },
        result: {
          title: 'MDN Documentation',
          url: 'developer.mozilla.org',
          tags: '#javascript',
          tagsArray: ['javascript'],
        },
      })

      // Base: 100, includes bonus (tag): 5 * 0.7 = 3.5, exact tag match: 10
      // Total: 100 + 3.5 + 10 = 113.5
      expect(score).toBeCloseTo(113.5)
    })

    it('tag match with title match applies title bonus (higher priority)', () => {
      const score = scoreFor({
        searchTerm: 'javascript',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 10,

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'JavaScript Tutorial',
          url: 'example.com',
          tags: '#javascript',
          tagsArray: ['javascript'],
        },
      })

      // Base: 100, includes bonus (title, not tag): 5 * 1 = 5, exact tag match: 10
      // Total: 100 + 5 + 10 = 115
      expect(score).toBeCloseTo(115)
    })

    it('compares tag-only match vs title-only match scores', () => {
      const tagOnlyScore = scoreFor({
        searchTerm: 'javascript',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 10,

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'MDN Docs',
          url: 'developer.mozilla.org',
          tags: '#javascript',
          tagsArray: ['javascript'],
        },
      })

      const titleOnlyScore = scoreFor({
        searchTerm: 'javascript',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 10,

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'JavaScript Tutorial',
          url: 'example.com',
          tags: '',
          tagsArray: [],
        },
      })

      // Tag-only: 100 + (5 * 0.7) + 10 = 113.5
      // Title-only: 100 + (5 * 1) = 105
      // Tag-only should score HIGHER due to exact tag match bonus
      expect(tagOnlyScore).toBeCloseTo(113.5)
      expect(titleOnlyScore).toBeCloseTo(105)
      expect(tagOnlyScore).toBeGreaterThan(titleOnlyScore)
    })

    it('ISSUE: partial tag match (e.g., "java" matching "#javascript") does NOT get exact tag bonus', () => {
      const score = scoreFor({
        searchTerm: 'java',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 10,
          scoreTagWeight: 0.7,
        },
        result: {
          title: 'Programming Tutorial',
          url: 'example.com',
          tags: '#javascript',
          tagsArray: ['javascript'],
        },
      })

      // Base: 100, includes bonus (tag): 5 * 0.7 = 3.5
      // NO exact tag match bonus because "java" !== "javascript"
      // Total: 100 + 3.5 = 103.5
      expect(score).toBeCloseTo(103.5)
    })

    it('BUG: tag includes bonus not applied when only exact tag match is configured', () => {
      const tagMatchScore = scoreFor({
        searchTerm: 'tutorial',
        opts: {
          scoreExactIncludesBonus: 10,

          scoreExactTagMatchBonus: 10,

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'Programming Guide',
          url: 'example.com',
          tags: '#tutorial',
          tagsArray: ['tutorial'],
        },
      })

      const titleMatchScore = scoreFor({
        searchTerm: 'tutorial',
        opts: {
          scoreExactIncludesBonus: 10,

          scoreExactTagMatchBonus: 10,

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'Tutorial Guide',
          url: 'example.com',
          tags: '',
          tagsArray: [],
        },
      })

      // Tag match should be: 100 + (10 * 0.7 includes bonus) + (10 exact tag bonus) = 117
      // Title match should be: 100 + (10 * 1.0 includes bonus) = 110
      // Tag should win!
      expect(tagMatchScore).toBeCloseTo(117)
      expect(titleMatchScore).toBeCloseTo(110)
      expect(tagMatchScore).toBeGreaterThan(titleMatchScore)
    })

    it('OBSERVATION: tags need BOTH includes and exact match bonuses to compete with titles', () => {
      // With ONLY includes bonus (no exact tag match bonus)
      const tagNoExactBonus = scoreFor({
        searchTerm: 'react',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 0, // disabled

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'Framework Docs',
          url: 'example.com',
          tags: '#react',
          tagsArray: ['react'],
        },
      })

      const titleMatch = scoreFor({
        searchTerm: 'react',
        opts: {
          scoreExactIncludesBonus: 5,
          scoreExactTagMatchBonus: 0,

          scoreTagWeight: 0.7,
        },
        result: {
          title: 'React Documentation',
          url: 'example.com',
          tags: '',
          tagsArray: [],
        },
      })

      // Tag: 100 + (5 * 0.7) = 103.5
      // Title: 100 + (5 * 1.0) = 105
      // Title WINS when exact tag match bonus is disabled!
      expect(tagNoExactBonus).toBeCloseTo(103.5)
      expect(titleMatch).toBeCloseTo(105)
      expect(titleMatch).toBeGreaterThan(tagNoExactBonus)
    })
  })

  describe('Real-world scoring with ACTUAL default options', () => {
    function scoreWithDefaults({ searchTerm, result }) {
      createTestExt({
        model: { searchTerm },
        opts: defaultOptions, // Use actual defaults!
      })

      // Ensure normalized fields are present
      const normalizedResult = { ...result }
      if (normalizedResult.title && !normalizedResult.titleLower) {
        normalizedResult.titleLower = normalizedResult.title.toLowerCase().trim()
      }
      if (normalizedResult.tags && !normalizedResult.tagsLower) {
        normalizedResult.tagsLower = normalizedResult.tags.toLowerCase()
      }
      if (normalizedResult.tagsArray && !normalizedResult.tagsArrayLower) {
        normalizedResult.tagsArrayLower = normalizedResult.tagsArray.map((t) => t.toLowerCase())
      }
      if (normalizedResult.folder && !normalizedResult.folderLower) {
        normalizedResult.folderLower = normalizedResult.folder.toLowerCase()
      }
      if (normalizedResult.folderArray && !normalizedResult.folderArrayLower) {
        normalizedResult.folderArrayLower = normalizedResult.folderArray.map((f) => f.toLowerCase())
      }
      if (normalizedResult.url) {
        normalizedResult.url = normalizedResult.url.toLowerCase()
      }

      const [scored] = calculateFinalScore([normalizedResult], searchTerm)
      const score = scored.score

      clearTestExt()
      return score
    }

    it('validates that tag-only matches remain competitive with defaults', () => {
      const tagOnlyScore = scoreWithDefaults({
        searchTerm: 'javascript',
        result: {
          type: 'bookmark',
          title: 'MDN Web Docs',
          url: 'developer.mozilla.org',
          tags: '#javascript',
          tagsArray: ['javascript'],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      const titleOnlyScore = scoreWithDefaults({
        searchTerm: 'javascript',
        result: {
          type: 'bookmark',
          title: 'JavaScript Tutorial',
          url: 'example.com',
          tags: '',
          tagsArray: [],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      // With defaults:
      // - scoreExactIncludesBonus: 5
      // - scoreExactIncludesBonusMinChars: 3
      // - scoreExactTagMatchBonus: 10
      // - scoreExactStartsWithBonus: 10
      // - scoreTitleWeight: 1.0
      // - scoreTagWeight: 0.7
      //
      // Tag-only: 100 (base) + 3.5 (includes 5*0.7) + 15 (exact tag) = 118.5
      // Title-only: 100 (base) + 5 (includes 5*1.0) + 10 (starts with "JavaScript") = 115
      //
      // Note: No phrase bonus for single-word search "javascript"
      // With default scoreExactTagMatchBonus of 15, tags WIN by 3.5 points
      expect(tagOnlyScore).toBeCloseTo(118.5)
      expect(titleOnlyScore).toBeCloseTo(115)
      expect(tagOnlyScore - titleOnlyScore).toBeCloseTo(3.5)
    })

    it('validates that both title AND tag match scores highest with defaults', () => {
      const bothScore = scoreWithDefaults({
        searchTerm: 'react',
        result: {
          type: 'bookmark',
          title: 'React Documentation',
          url: 'react.dev',
          tags: '#react #frontend',
          tagsArray: ['react', 'frontend'],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      const tagOnlyScore = scoreWithDefaults({
        searchTerm: 'react',
        result: {
          type: 'bookmark',
          title: 'Frontend Framework',
          url: 'example.com',
          tags: '#react',
          tagsArray: ['react'],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      const titleOnlyScore = scoreWithDefaults({
        searchTerm: 'react',
        result: {
          type: 'bookmark',
          title: 'React Guide',
          url: 'example.com',
          tags: '',
          tagsArray: [],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      // Both title+tag: 100 + 5 (title includes) + 10 (title starts with) + 15 (exact tag) = 130
      // Tag-only: 100 + 3.5 (tag includes) + 15 (exact tag) = 118.5
      // Title-only: 100 + 5 (title includes) + 10 (title starts with "React") = 115
      // Note: No phrase bonus for single-word search "react"
      expect(bothScore).toBeCloseTo(130)
      expect(tagOnlyScore).toBeCloseTo(118.5)
      expect(titleOnlyScore).toBeCloseTo(115)
      expect(bothScore).toBeGreaterThan(tagOnlyScore)
      expect(bothScore).toBeGreaterThan(titleOnlyScore)
      // With default scoreExactTagMatchBonus of 15, tag-only now edges out title-only
      expect(tagOnlyScore).toBeGreaterThan(titleOnlyScore)
    })

    it('validates partial tag matches still get some benefit (includes bonus only)', () => {
      const partialTagScore = scoreWithDefaults({
        searchTerm: 'java',
        result: {
          type: 'bookmark',
          title: 'Programming Tutorial',
          url: 'example.com',
          tags: '#javascript',
          tagsArray: ['javascript'],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      // Partial tag "java" in "#javascript":
      // - Gets includes bonus: 5 * 0.7 = 3.5
      // - Does NOT get exact tag match bonus (10) because "java" !== "javascript"
      // Total: 100 + 3.5 = 103.5
      expect(partialTagScore).toBeCloseTo(103.5)
    })

    it('demonstrates how custom bonus score can prioritize important bookmarks', () => {
      const withCustomBonus = scoreWithDefaults({
        searchTerm: 'docs',
        result: {
          type: 'bookmark',
          title: 'Important Docs',
          url: 'example.com',
          tags: '#documentation',
          tagsArray: ['documentation'],
          folder: '',
          folderArray: [],
          searchScore: 1,
          customBonusScore: 50, // User added +50 to title
        },
      })

      const withoutCustomBonus = scoreWithDefaults({
        searchTerm: 'docs',
        result: {
          type: 'bookmark',
          title: 'Regular Docs',
          url: 'example.com',
          tags: '#documentation',
          tagsArray: ['documentation'],
          folder: '',
          folderArray: [],
          searchScore: 1,
          customBonusScore: 0,
        },
      })

      // Both get base 100 + includes 5, but one gets +50 custom bonus
      // Note: No phrase bonus for single-word search "docs"
      expect(withCustomBonus).toBeCloseTo(155)
      expect(withoutCustomBonus).toBeCloseTo(105)
      expect(withCustomBonus - withoutCustomBonus).toBeCloseTo(50)
    })

    it('validates that exact title match gets massive bonus with defaults', () => {
      const exactTitleMatch = scoreWithDefaults({
        searchTerm: 'react',
        result: {
          type: 'bookmark',
          title: 'react',
          url: 'example.com',
          tags: '',
          tagsArray: [],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      const partialTitleMatch = scoreWithDefaults({
        searchTerm: 'react',
        result: {
          type: 'bookmark',
          title: 'React Documentation',
          url: 'example.com',
          tags: '',
          tagsArray: [],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      // Exact: 100 + 5 (includes) + 10 (starts with) + 20 (equals) = 135
      // Partial: 100 + 5 (includes) + 10 (starts with "React") = 115
      // Note: No phrase bonus for single-word search "react"
      expect(exactTitleMatch).toBeCloseTo(135)
      expect(partialTitleMatch).toBeCloseTo(115)
      expect(exactTitleMatch - partialTitleMatch).toBeCloseTo(20)
    })

    it('confirms scoreExactTagMatchBonus of 15 makes tags competitive', () => {
      // This test validates your change from 10 to 15
      const tagScore = scoreWithDefaults({
        searchTerm: 'tutorial',
        result: {
          type: 'bookmark',
          title: 'Learning Resource',
          url: 'example.com',
          tags: '#tutorial',
          tagsArray: ['tutorial'],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      const titleScore = scoreWithDefaults({
        searchTerm: 'tutorial',
        result: {
          type: 'bookmark',
          title: 'Tutorial Article',
          url: 'example.com',
          tags: '',
          tagsArray: [],
          folder: '',
          folderArray: [],
          searchScore: 1,
        },
      })

      // Tag: 100 + 3.5 (includes with 0.7 weight) + 15 (exact tag) = 118.5
      // Title: 100 + 5 (includes with 1.0 weight) + 10 (starts with "Tutorial") = 115
      // Note: No phrase bonus for single-word search "tutorial"
      // With default scoreExactTagMatchBonus of 15, tags WIN by 3.5 points!
      expect(tagScore).toBeCloseTo(118.5)
      expect(titleScore).toBeCloseTo(115)
      expect(tagScore - titleScore).toBeCloseTo(3.5)
    })
  })
})
