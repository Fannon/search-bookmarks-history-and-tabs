/**
 * @file Calculates final relevance scores for popup search results.
 *
 * For a detailed explanation of the scoring process, see the `calculateFinalScore` function documentation.
 */

// Pre-compiled regexes for performance
const TAXONOMY_PREFIX_REGEX = /^[#~@]+/
const WHITESPACE_REGEX = /\s+/g
const NUMERIC_TERM_REGEX = /^\d+$/

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
 *      - scoreExactPhraseUrlBonus: URL contains the full search phrase (hyphen-normalized, 5 points default)
 *    STEP 3B - Includes Bonuses (substring matching):
 *      - scoreExactIncludesBonus: weighted by field (title × 1.0, tag × 0.7, url × 0.6, folder × 0.5)
 *      - Only FIRST matching field per search term gets bonus (no double-counting)
 *
 * 4. ADD BEHAVIORAL BONUSES (USAGE PATTERNS)
 *    - scoreVisitedBonusScore: per visit (up to scoreVisitedBonusScoreMaximum)
 *    - scoreRecentBonusScoreMaximum: linear decay based on lastVisitSecondsAgo and historyDaysAgo
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
  const hasSearchTerm = Boolean(ext.model.searchTerm)

  // searchTerm is already lowercased from normalizeSearchTerm() in common.js
  const normalizedSearchTerm = hasSearchTerm ? searchTerm.trim() : ''
  const rawSearchTermParts = hasSearchTerm ? normalizedSearchTerm.split(' ') : []

  // Cache scoring options to avoid repeated property lookups
  const opts = ext.opts
  const {
    scoreExactStartsWithBonus,
    scoreExactEqualsBonus,
    scoreExactTagMatchBonus,
    scoreExactGroupMatchBonus,
    scoreExactFolderMatchBonus,
    scoreExactIncludesBonus,
    scoreExactPhraseTitleBonus,
    scoreExactPhraseUrlBonus,
    scoreVisitedBonusScore,
    scoreVisitedBonusScoreMaximum,
    scoreRecentBonusScoreMaximum,
    historyDaysAgo,
    scoreCustomBonusScore,
    scoreUrlWeight,
    scoreTagWeight,
    scoreGroupWeight,
    scoreFolderWeight,
    scoreBookmarkOpenTabBonus,
  } = opts

  // Hard-coded scoring constants (not user-configurable)
  const scoreExactIncludesBonusMinChars = 3
  const scoreExactIncludesMaxBonuses = 3

  // Pre-calculate base scores for each type to avoid repeated lookups
  const baseScores = {
    bookmark: opts.scoreBookmarkBase || 0,
    tab: opts.scoreTabBase || 0,
    history: opts.scoreHistoryBase || 0,
    search: opts.scoreSearchEngineBase || 0,
    customSearch: opts.scoreCustomSearchEngineBase || 0,
    direct: opts.scoreDirectUrlScore || 0,
  }

  const startsWithUrlBonus = scoreExactStartsWithBonus * scoreUrlWeight
  const includesUrlBonus = scoreExactIncludesBonus * scoreUrlWeight
  const includesTagBonus = scoreExactIncludesBonus * scoreTagWeight
  const includesGroupBonus = scoreExactIncludesBonus * scoreGroupWeight
  const includesFolderBonus = scoreExactIncludesBonus * scoreFolderWeight

  // Build all term arrays in a single pass
  const tagTerms = []
  const folderTerms = []
  const includeTerms = []

  for (let i = 0; i < rawSearchTermParts.length; i++) {
    const part = rawSearchTermParts[i]
    if (!part) continue

    // Clean taxonomy prefixes
    const cleanedPart = part.replace(TAXONOMY_PREFIX_REGEX, '').trim()
    if (!cleanedPart) continue

    // Add to tag/folder terms (these include # and ~ prefixed terms)
    tagTerms.push(cleanedPart)
    folderTerms.push(cleanedPart)

    // Add to includeTerms if meets min length or is numeric
    if (cleanedPart.length >= scoreExactIncludesBonusMinChars || NUMERIC_TERM_REGEX.test(cleanedPart)) {
      includeTerms.push(cleanedPart)
    }
  }

  const hyphenatedSearchTerm = rawSearchTermParts.filter(Boolean).join('-')

  // Only check includes bonus if configured and there are tokens that qualify
  const canCheckIncludes = hasSearchTerm && scoreExactIncludesBonus && includeTerms.length > 0

  // Pre-calculate URL-normalized terms for the includes check
  const normalizedUrlTerms = canCheckIncludes ? includeTerms.map((term) => term.replace(WHITESPACE_REGEX, '-')) : []

  const includesBonusCap = Number.isFinite(scoreExactIncludesMaxBonuses) ? scoreExactIncludesMaxBonuses : 999
  const maxRecentSeconds = historyDaysAgo * 24 * 60 * 60
  const recentBonusFactor = maxRecentSeconds > 0 ? scoreRecentBonusScoreMaximum / maxRecentSeconds : 0

  const hasExactStartsWithBonus = Boolean(scoreExactStartsWithBonus)
  const hasExactEqualsBonus = Boolean(scoreExactEqualsBonus)
  const hasExactTagMatchBonus = Boolean(scoreExactTagMatchBonus)
  const hasExactGroupMatchBonus = Boolean(scoreExactGroupMatchBonus)
  const hasExactFolderMatchBonus = Boolean(scoreExactFolderMatchBonus)
  const hasExactPhraseTitleBonus = Boolean(scoreExactPhraseTitleBonus)
  const hasExactPhraseUrlBonus = Boolean(scoreExactPhraseUrlBonus)
  const hasVisitedBonus = Boolean(scoreVisitedBonusScore)
  const hasRecentBonus = Boolean(scoreRecentBonusScoreMaximum)
  const hasCustomBonus = Boolean(scoreCustomBonusScore)
  const hasBookmarkOpenTabBonus = Boolean(scoreBookmarkOpenTabBonus)

  const tagTermsLen = tagTerms.length
  const folderTermsLen = folderTerms.length
  const includeTermsLen = includeTerms.length

  for (let i = 0; i < results.length; i++) {
    const el = results[i]
    const type = el.type

    // STEP 1: Start with base score (bookmark=100, tab=70, history=45, etc.)
    let score = baseScores[type]
    if (score === undefined) {
      throw new Error(`Search result type "${type}" not supported`)
    }

    if (hasSearchTerm) {
      // STEP 3A: Exact match bonuses
      const normalizedUrl = el.url
      const titleLower = el.titleLower

      if (hasExactStartsWithBonus) {
        if (titleLower?.startsWith(normalizedSearchTerm)) {
          score += scoreExactStartsWithBonus
        } else if (normalizedUrl?.startsWith(hyphenatedSearchTerm)) {
          score += startsWithUrlBonus
        }
      }

      // Award bonus if title exactly equals the search term
      if (hasExactEqualsBonus && titleLower === normalizedSearchTerm) {
        score += scoreExactEqualsBonus
      }

      // Award bonus for each exact tag name match
      if (hasExactTagMatchBonus && tagTermsLen > 0 && el.tags) {
        const tags = el.tagsArrayLower
        if (tags) {
          for (let j = 0; j < tagTermsLen; j++) {
            if (tags.includes(tagTerms[j])) {
              score += scoreExactTagMatchBonus
            }
          }
        }
      }

      // Award bonus for each exact folder name match
      if (hasExactFolderMatchBonus && folderTermsLen > 0 && el.folder) {
        const folders = el.folderArrayLower
        if (folders) {
          for (let j = 0; j < folderTermsLen; j++) {
            if (folders.includes(folderTerms[j])) {
              score += scoreExactFolderMatchBonus
            }
          }
        }
      }

      // Award bonus for exact group name match
      if (hasExactGroupMatchBonus && tagTermsLen > 0 && el.group) {
        if (tagTerms.includes(el.groupLower)) {
          score += scoreExactGroupMatchBonus
        }
      }

      // STEP 3B: Includes bonuses (substring matching)
      if (canCheckIncludes) {
        let includesBonusesAwarded = 0
        const normalizedTags = el.tagsLower
        const normalizedFolder = el.folderLower

        for (let j = 0; j < includeTermsLen; j++) {
          if (includesBonusesAwarded >= includesBonusCap) {
            break
          }

          const term = includeTerms[j]
          const normalizedUrlTerm = normalizedUrlTerms[j]

          // Check fields in priority order - first match wins
          if (titleLower?.includes(term)) {
            score += scoreExactIncludesBonus
            includesBonusesAwarded++
          } else if (normalizedUrl?.includes(normalizedUrlTerm)) {
            score += includesUrlBonus
            includesBonusesAwarded++
          } else if (normalizedTags?.includes(term)) {
            score += includesTagBonus
            includesBonusesAwarded++
          } else if (el.groupLower?.includes(term)) {
            score += includesGroupBonus
            includesBonusesAwarded++
          } else if (normalizedFolder?.includes(term)) {
            score += includesFolderBonus
            includesBonusesAwarded++
          }
        }
      }

      // Award bonus for full phrase match (multi-word searches only)
      if (rawSearchTermParts.length > 1) {
        if (hasExactPhraseTitleBonus && titleLower && titleLower.includes(normalizedSearchTerm)) {
          score += scoreExactPhraseTitleBonus
        }
        if (hasExactPhraseUrlBonus && normalizedUrl && normalizedUrl.includes(hyphenatedSearchTerm)) {
          score += scoreExactPhraseUrlBonus
        }
      }
    }

    // STEP 4: Behavioral bonuses
    if (hasVisitedBonus && el.visitCount) {
      const visitBonus = el.visitCount * scoreVisitedBonusScore
      score += visitBonus > scoreVisitedBonusScoreMaximum ? scoreVisitedBonusScoreMaximum : visitBonus
    }

    if (hasRecentBonus && el.lastVisitSecondsAgo != null) {
      const lastVisitSecondsAgo = el.lastVisitSecondsAgo
      if (recentBonusFactor > 0 && lastVisitSecondsAgo > 0) {
        const recentBonus = scoreRecentBonusScoreMaximum - lastVisitSecondsAgo * recentBonusFactor
        if (recentBonus > 0) {
          score += recentBonus
        }
      } else if (lastVisitSecondsAgo === 0) {
        score += scoreRecentBonusScoreMaximum
      }
    }

    if (hasBookmarkOpenTabBonus && type === 'bookmark' && el.tab) {
      score += scoreBookmarkOpenTabBonus
    }

    // STEP 5: Custom bonus
    if (hasCustomBonus && el.customBonusScore) {
      score += el.customBonusScore
    }

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
