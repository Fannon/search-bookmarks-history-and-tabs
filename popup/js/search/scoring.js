/**
 * @file Calculates final relevance scores for popup search results.
 *
 * Blends base weights, match-quality multipliers, field-specific bonuses, behavioural heuristics, and user-defined overrides
 * so every strategy (simple, fuzzy, taxonomy) produces stable, comparable ordering before results render.
 *
 * Scoring flow (five stages):
 * 1. Start with base type score — bookmarks (100), tabs (70), history (45), etc. via `BASE_SCORE_KEYS`.
 * 2. Multiply by search quality multiplier — fuzzy/precise match score between 0-1 dampens weak matches.
 * 3. Add field bonuses — exact/starts-with/substring boosts for title, URL, tag, and folder matches with per-field weighting.
 * 4. Layer behavioural boosts — visit count, recency, and creation date heuristics keep frequently used items near the top.
 * 5. Apply custom overrides — parse `Title +20 #tag` syntax to honour user-specified bonus scores.
 *
 * Field priority for substring bonuses:
 * - Title (weight 1.0) outranks every other field.
 * - URL (weight 0.6) rewards address matches without dominating title results.
 * - Tag (weight 0.7) helps taxonomy-driven workflows.
 * - Folder (weight 0.5) keeps navigation metadata in play without overwhelming main content.
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

    // STEP 1: Start with base score (bookmark=100, tab=70, history=45, etc.)
    let score = opts[baseKey]

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
        if (lowerTitle && lowerTitle.startsWith(searchTerm)) {
          score += scoreExactStartsWithBonus * scoreTitleWeight
        } else if (lowerUrl && lowerUrl.startsWith(hyphenatedSearchTerm)) {
          score += scoreExactStartsWithBonus * scoreUrlWeight
        }
      }

      // Award bonus if title exactly equals the search term
      if (scoreExactEqualsBonus && lowerTitle && lowerTitle === searchTerm) {
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
        for (const rawTerm of searchTermParts) {
          const term = rawTerm.trim()
          if (!term || term.length < scoreExactIncludesBonusMinChars) {
            continue
          }

          // URLs use hyphens instead of spaces, so normalize for matching
          const normalizedUrlTerm = term.replace(/\s+/g, '-')

          // Check fields in priority order - first match wins
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
        // Calculate proportional bonus: 0 seconds ago = full bonus, maxSeconds ago = 0 bonus
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
