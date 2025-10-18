/**
 * @file Calculates final relevance scores for popup search results.
 * Combines base weights with match quality, field bonuses, and usage signals.
 */

/**
 * Calculate the final score for each search result.
 * @param {Array} results
 * @param {string} searchTerm
 * @returns {Array}
 */
export function calculateFinalScore(results, searchTerm) {
  const now = Date.now()
  const hasSearchTerm = Boolean(ext.model.searchTerm)
  const searchTermParts = hasSearchTerm ? searchTerm.split(' ') : []
  const hyphenatedSearchTerm = hasSearchTerm ? searchTermParts.join('-') : ''
  const tagTerms = hasSearchTerm ? searchTerm.split('#').join('').split(' ') : []
  const folderTerms = hasSearchTerm ? searchTerm.split('~').join('').split(' ') : []

  // Only check includes bonus if configured and search term is long enough
  const canCheckIncludes =
    hasSearchTerm && ext.opts.scoreExactIncludesBonus && searchTerm.length >= ext.opts.scoreExactIncludesBonusMinChars

  // Cache scoring options to avoid repeated property lookups
  const opts = ext.opts
  const {
    scoreExactStartsWithBonus,
    scoreExactEqualsBonus,
    scoreExactTagMatchBonus,
    scoreExactFolderMatchBonus,
    scoreExactIncludesBonus,
    scoreExactIncludesBonusMinChars,
    scoreVisitedBonusScore,
    scoreVisitedBonusScoreMaximum,
    scoreRecentBonusScoreMaximum,
    historyDaysAgo,
    scoreDateAddedBonusScoreMaximum,
    scoreDateAddedBonusScorePerDay,
    scoreCustomBonusScore,
    scoreTitleWeight,
    scoreUrlWeight,
    scoreTagWeight,
    scoreFolderWeight,
  } = opts

  for (let i = 0; i < results.length; i++) {
    const el = results[i]
    const baseKey = BASE_SCORE_KEYS[el.type]
    if (!baseKey) {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // Step 1: start with the configured base score.
    let score = opts[baseKey]

    // Step 2: scale by match quality (0-1).
    const searchScoreMultiplier = el.searchScore || scoreTitleWeight
    score = score * searchScoreMultiplier

    if (hasSearchTerm) {
      // Pre-compute normalized field values for case-insensitive matching
      const lowerTitle = el.title ? el.title.toLowerCase().trim() : null
      const lowerUrl = el.url ? el.url.toLowerCase() : null
      const lowerTags = el.tags ? el.tags.toLowerCase() : null
      const lowerFolder = el.folder ? el.folder.toLowerCase() : null

      // Pre-compute normalized arrays for exact tag/folder matching
      const lowerTagValues = el.tagsArray ? el.tagsArray.map((tag) => tag.toLowerCase()) : []
      const lowerFolderValues = el.folderArray ? el.folderArray.map((folder) => folder.toLowerCase()) : []

      // Step 3a: exact-match bonuses.
      if (scoreExactStartsWithBonus) {
        if (lowerTitle && lowerTitle.startsWith(searchTerm)) {
          score += scoreExactStartsWithBonus * scoreTitleWeight
        } else if (lowerUrl && lowerUrl.startsWith(hyphenatedSearchTerm)) {
          score += scoreExactStartsWithBonus * scoreUrlWeight
        }
      }

      // Title exactly matches the term.
      if (scoreExactEqualsBonus && lowerTitle && lowerTitle === searchTerm) {
        score += scoreExactEqualsBonus * scoreTitleWeight
      }

      // Exact tag matches.
      if (scoreExactTagMatchBonus && el.tags && tagTerms.length) {
        const tagSet = new Set(lowerTagValues)
        for (const searchTag of tagTerms) {
          if (searchTag && tagSet.has(searchTag)) {
            score += scoreExactTagMatchBonus
          }
        }
      }

      // Exact folder matches.
      if (scoreExactFolderMatchBonus && el.folder && folderTerms.length) {
        const folderSet = new Set(lowerFolderValues)
        for (const searchFolder of folderTerms) {
          if (searchFolder && folderSet.has(searchFolder)) {
            score += scoreExactFolderMatchBonus
          }
        }
      }

      // Step 3b: substring bonuses, prioritizing title > url > tags > folder.
      if (canCheckIncludes) {
        for (const rawTerm of searchTermParts) {
          const term = rawTerm.trim()
          if (!term || term.length < scoreExactIncludesBonusMinChars) {
            continue
          }

          const normalizedUrlTerm = term.replace(/\s+/g, '-')

          if (lowerTitle && lowerTitle.includes(term)) {
            score += scoreExactIncludesBonus * scoreTitleWeight
          } else if (lowerUrl && lowerUrl.includes(normalizedUrlTerm)) {
            score += scoreExactIncludesBonus * scoreUrlWeight
          } else if (lowerTags && lowerTags.includes(term)) {
            score += scoreExactIncludesBonus * scoreTagWeight
          } else if (lowerFolder && lowerFolder.includes(term)) {
            score += scoreExactIncludesBonus * scoreFolderWeight
          }
        }
      }
    }

    // Step 4: behavioral bonuses (visits, recency, freshness).
    if (scoreVisitedBonusScore && el.visitCount) {
      score += Math.min(scoreVisitedBonusScoreMaximum, el.visitCount * scoreVisitedBonusScore)
    }

    if (scoreRecentBonusScoreMaximum && el.lastVisitSecondsAgo != null) {
      const maxSeconds = historyDaysAgo * 24 * 60 * 60
      if (maxSeconds > 0 && el.lastVisitSecondsAgo >= 0) {
        score += Math.max(0, (1 - el.lastVisitSecondsAgo / maxSeconds) * scoreRecentBonusScoreMaximum)
      } else if (el.lastVisitSecondsAgo === 0) {
        score += scoreRecentBonusScoreMaximum
      }
    }

    if (scoreDateAddedBonusScoreMaximum && scoreDateAddedBonusScorePerDay && el.dateAdded != null) {
      const daysAgo = (now - el.dateAdded) / 1000 / 60 / 60 / 24
      const penalty = daysAgo * scoreDateAddedBonusScorePerDay
      score += Math.max(0, scoreDateAddedBonusScoreMaximum - penalty)
    }

    // Step 5: optional manual bonus.
    if (scoreCustomBonusScore && el.customBonusScore) {
      score += el.customBonusScore
    }

    el.score = score
  }

  return results
}

/** Map result types to the corresponding base-score option keys. */
export const BASE_SCORE_KEYS = {
  bookmark: 'scoreBookmarkBase',
  tab: 'scoreTabBase',
  history: 'scoreHistoryBase',
  search: 'scoreSearchEngineBase',
  customSearch: 'scoreCustomSearchEngineBase',
  direct: 'scoreDirectUrlScore',
}
