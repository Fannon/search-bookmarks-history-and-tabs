/**
 * @file Calculates final relevance scores for popup search results.
 *
 * For a detailed explanation of the scoring process, see the `calculateFinalScore` function documentation.
 */

/**
 * Calculates the final search item score for each result
 *
 * SCORING FLOW (5 STEPS):
 *
 * 1. START WITH BASE SCORE
 *    - Uses scoreBookmarkBase (100), scoreTabBase (70), scoreHistoryBase (45), etc.
 *
 * 2. MULTIPLY BY SEARCH QUALITY SCORE (0-1)
 *    - From fuzzy/precise search algorithms; poor matches reduce the score
 *
 * 3. ADD FIELD-SPECIFIC BONUSES
 *    STEP 3A - Exact Match Bonuses:
 *      - scoreExactStartsWithBonus: title/URL starts with search term
 *      - scoreExactEqualsBonus: title exactly equals search term
 *      - scoreExactTagMatchBonus: tag name matches a search term (15 points default)
 *      - scoreExactFolderMatchBonus: folder name matches a search term
 *      - scoreExactPhraseTitleBonus: title contains the full search phrase (8 points default)
 *      - scoreExactPhraseUrlBonus: URL contains the full search phrase (hyphen-normalized, 4 points default)
 *    STEP 3B - Includes Bonuses (substring matching):
 *      - scoreExactIncludesBonus: weighted by field (title × 1.0, tag × 0.7, url × 0.6, folder × 0.5)
 *      - Only FIRST matching field per search term gets bonus (no double-counting)
 *
 * 4. ADD BEHAVIORAL BONUSES (USAGE PATTERNS)
 *    - scoreVisitedBonusScore: per visit (up to scoreVisitedBonusScoreMaximum)
 *    - scoreRecentBonusScoreMaximum: linear decay based on lastVisitSecondsAgo and historyDaysAgo
 *    - scoreDateAddedBonusScoreMaximum: linear decay based on dateAdded and scoreDateAddedBonusScorePerDay
 *
 * 5. ADD CUSTOM USER-DEFINED BONUS
 *    - scoreCustomBonusScore: extracted from "Title +20 #tag" notation (if enabled)
 *
 * FIELD PRIORITY (for includes bonus):
 * - Title match (weight 1.0) - highest priority
 * - URL match (weight 0.6)
 * - Tag match (weight 0.7)
 * - Folder match (weight 0.5) - lowest priority
 *
 * @param {Array} results - Search results to score
 * @param {string} searchTerm - The search query string
 * @returns {Array} Results with calculated scores
 */
export function calculateFinalScore(results, searchTerm) {
  const now = Date.now()
  const hasSearchTerm = Boolean(ext.model.searchTerm)

  // Normalize query once for all downstream checks to keep comparisons consistent and cheap.
  const normalizedSearchTerm = hasSearchTerm ? searchTerm.toLowerCase().trim() : ''
  const rawSearchTermParts = hasSearchTerm ? normalizedSearchTerm.split(/\s+/).filter(Boolean) : []
  const hyphenatedSearchTerm = rawSearchTermParts.join('-')
  const tagTerms = hasSearchTerm ? normalizedSearchTerm.split('#').join(' ').split(/\s+/).filter(Boolean) : []
  const folderTerms = hasSearchTerm ? normalizedSearchTerm.split('~').join(' ').split(/\s+/).filter(Boolean) : []

  // Cache scoring options to avoid repeated property lookups
  const opts = ext.opts
  const {
    scoreExactStartsWithBonus,
    scoreExactEqualsBonus,
    scoreExactTagMatchBonus,
    scoreExactFolderMatchBonus,
    scoreExactIncludesBonus,
    scoreExactIncludesBonusMinChars,
    scoreExactIncludesMaxBonuses,
    scoreExactPhraseTitleBonus,
    scoreExactPhraseUrlBonus,
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
    scoreBookmarkOpenTabBonus,
  } = opts

  const includeTerms = rawSearchTermParts
    .map((token) => token.replace(/^[#~]+/, ''))
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) {
        return false
      }

      if (token.length < scoreExactIncludesBonusMinChars && !/^\d+$/.test(token)) {
        return false
      }

      return true
    })

  // Only check includes bonus if configured and there are tokens that qualify
  const canCheckIncludes = hasSearchTerm && scoreExactIncludesBonus && includeTerms.length > 0

  const includesBonusCap = Number.isFinite(scoreExactIncludesMaxBonuses) ? scoreExactIncludesMaxBonuses : Infinity

  for (let i = 0; i < results.length; i++) {
    const el = results[i]
    const baseKey = BASE_SCORE_KEYS[el.type]
    if (!baseKey) {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // STEP 1: Start with base score (bookmark=100, tab=70, history=45, etc.)
    let score = getBaseScoreForType(opts, baseKey)

    // STEP 2: Multiply by search quality score (0-1 from fuzzy/precise search)
    // This reduces score if the match quality is poor
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

      // STEP 3A: Exact match bonuses
      // Award bonus if title/URL starts with the exact search term
      if (scoreExactStartsWithBonus) {
        if (lowerTitle && lowerTitle.startsWith(normalizedSearchTerm)) {
          score += scoreExactStartsWithBonus * scoreTitleWeight
        } else if (lowerUrl && lowerUrl.startsWith(hyphenatedSearchTerm)) {
          score += scoreExactStartsWithBonus * scoreUrlWeight
        }
      }

      // Award bonus if title exactly equals the search term
      if (scoreExactEqualsBonus && lowerTitle && lowerTitle === normalizedSearchTerm) {
        score += scoreExactEqualsBonus * scoreTitleWeight
      }

      // Award bonus for each exact tag name match
      // Example: searching "react hooks" matches tags "#react" and "#hooks"
      if (scoreExactTagMatchBonus && el.tags && tagTerms.length) {
        const tagSet = new Set(lowerTagValues)
        for (const searchTag of tagTerms) {
          if (searchTag && tagSet.has(searchTag)) {
            score += scoreExactTagMatchBonus
          }
        }
      }

      // Award bonus for each exact folder name match
      // Example: searching "work projects" matches folders "~Work" and "~Projects"
      if (scoreExactFolderMatchBonus && el.folder && folderTerms.length) {
        const folderSet = new Set(lowerFolderValues)
        for (const searchFolder of folderTerms) {
          if (searchFolder && folderSet.has(searchFolder)) {
            score += scoreExactFolderMatchBonus
          }
        }
      }

      // STEP 3B: Includes bonuses (substring matching)
      // Check each word in the search query for matches in title/url/tags/folder
      // Priority order: title > url > tags > folder (only first match counts per term)
      if (canCheckIncludes) {
        let includesBonusesAwarded = 0

        for (const term of includeTerms) {
          if (includesBonusesAwarded >= includesBonusCap) {
            break
          }

          // URLs use hyphens instead of spaces, so normalize for matching
          const normalizedUrlTerm = term.replace(/\s+/g, '-')

          // Check fields in priority order - first match wins
          if (lowerTitle && lowerTitle.includes(term)) {
            score += scoreExactIncludesBonus * scoreTitleWeight
            includesBonusesAwarded++
          } else if (lowerUrl && lowerUrl.includes(normalizedUrlTerm)) {
            score += scoreExactIncludesBonus * scoreUrlWeight
            includesBonusesAwarded++
          } else if (lowerTags && lowerTags.includes(term)) {
            score += scoreExactIncludesBonus * scoreTagWeight
            includesBonusesAwarded++
          } else if (lowerFolder && lowerFolder.includes(term)) {
            score += scoreExactIncludesBonus * scoreFolderWeight
            includesBonusesAwarded++
          }
        }
      }

      // Award bonus for full phrase match (multi-word searches only)
      // Single-word searches already get includes/exact bonuses, so phrase bonus is redundant
      if (rawSearchTermParts.length > 1) {
        if (scoreExactPhraseTitleBonus && lowerTitle && lowerTitle.includes(normalizedSearchTerm)) {
          score += scoreExactPhraseTitleBonus
        }

        if (scoreExactPhraseUrlBonus && lowerUrl && lowerUrl.includes(hyphenatedSearchTerm)) {
          score += scoreExactPhraseUrlBonus
        }
      }
    }

    // STEP 4: Behavioral bonuses (usage patterns)

    // Award bonus based on visit frequency (more visits = higher score, up to cap)
    // Example: visited 50 times with 0.5 points per visit = +20 (capped at scoreVisitedBonusScoreMaximum)
    if (scoreVisitedBonusScore && el.visitCount) {
      score += Math.min(scoreVisitedBonusScoreMaximum, el.visitCount * scoreVisitedBonusScore)
    }

    // Award bonus based on recency of last visit (linear decay)
    // Recently visited items get max bonus, older items get less, oldest items get 0
    // Example: visited 1 hour ago within 7-day window = high bonus
    if (scoreRecentBonusScoreMaximum && el.lastVisitSecondsAgo != null) {
      const maxSeconds = historyDaysAgo * 24 * 60 * 60
      if (maxSeconds > 0 && el.lastVisitSecondsAgo >= 0) {
        // Calculate proportional bonus: 0 s ago = full bonus, maxSeconds ago = 0 bonus
        score += Math.max(0, (1 - el.lastVisitSecondsAgo / maxSeconds) * scoreRecentBonusScoreMaximum)
      } else if (el.lastVisitSecondsAgo === 0) {
        // Special case: visited in this exact moment gets maximum bonus
        score += scoreRecentBonusScoreMaximum
      }
    }

    // Award bonus for recently added bookmarks (linear decay over time)
    // Newer bookmarks score higher, older bookmarks score lower
    // Example: added today = max bonus, added 10 days ago = max - (10 * perDayPenalty)
    if (scoreDateAddedBonusScoreMaximum && scoreDateAddedBonusScorePerDay && el.dateAdded != null) {
      const daysAgo = (now - el.dateAdded) / 1000 / 60 / 60 / 24
      const penalty = daysAgo * scoreDateAddedBonusScorePerDay
      score += Math.max(0, scoreDateAddedBonusScoreMaximum - penalty)
    }

    // Award bonus when bookmark already has a matching open tab (prevents duplicate opens)
    if (scoreBookmarkOpenTabBonus && el.type === 'bookmark' && el.tab) {
      score += scoreBookmarkOpenTabBonus
    }

    // STEP 5: Add custom user-defined bonus score (e.g., "Title +20 #tag")
    // This allows users to manually prioritize specific bookmarks
    if (scoreCustomBonusScore && el.customBonusScore) {
      score += el.customBonusScore
    }

    // Set final calculated score on the result object
    el.score = score
  }

  return results
}

/**
 * Maps result types to their corresponding base score option keys
 */
export const BASE_SCORE_KEYS = {
  bookmark: 'scoreBookmarkBase',
  tab: 'scoreTabBase',
  history: 'scoreHistoryBase',
  search: 'scoreSearchEngineBase',
  customSearch: 'scoreCustomSearchEngineBase',
  direct: 'scoreDirectUrlScore',
}

/**
 * Resolves the base score for a given result type.
 *
 * @param {Record<string, number>} opts - Effective extension options.
 * @param {string} baseKey - The canonical base score option key.
 * @returns {number}
 */
function getBaseScoreForType(opts, baseKey) {
  return opts[baseKey]
}
