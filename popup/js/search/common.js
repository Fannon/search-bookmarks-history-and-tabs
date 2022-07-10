//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

import { renderSearchResults } from '../view/searchView.js'
import { addDefaultEntries } from './defaultEntries.js'
import { createPreciseIndexes, searchWithFlexSearch } from './flexSearch.js'
import { createFuzzyIndexes, searchWithFuseJs } from './fuseSearch.js'
import { addSearchEngines } from './searchEngines.js'
import { searchWithSimpleSearch } from './simpleSearch.js'
import { searchFolders, searchTags } from './taxonomySearch.js'

/**
 * Creates the search indexes.
 * Depending on search approach this is either fuzzy or precise
 */
export function createSearchIndexes() {
  if (ext.opts.searchStrategy === 'fuzzy') {
    createFuzzyIndexes()
  } else if (ext.opts.searchStrategy === 'precise') {
    createPreciseIndexes()
  } else if (ext.opts.searchStrategy === 'simple') {
    // No index needs to be created with 'simple' search
  } else if (ext.opts.searchStrategy === 'hybrid') {
    createFuzzyIndexes()
  } else {
    throw new Error(`The option "search.approach" has an unsupported value: ${ext.opts.searchStrategy}`)
  }
}

/**
 * This is the main search entry point.
 * It will decide which approaches and indexes to use.
 */
export async function search(event) {
  if (event) {
    // Don't execute search on navigation keys
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === 'Escape') {
      return
    }
    // Don't execute search on modifier keys
    if (event.key === 'Control' || event.key === 'Alt' || event.key === 'Shift') {
      return
    }
  }

  if (!ext.initialized) {
    console.warn('Extension not initialized (yet). Skipping search')
    return
  }

  performance.mark('search-start')

  // Get and clean up original search query
  let searchTerm = ext.dom.searchInput.value || ''
  searchTerm = searchTerm.trimStart().toLowerCase()
  searchTerm = searchTerm.replace(/ +(?= )/g, '') // Remove duplicate spaces

  ext.model.result = []
  let searchMode = 'all' // OR 'bookmarks' OR 'history'

  // Support for various search modes
  // This is detected by looking at the first chars of the search
  if (searchTerm.startsWith('h ')) {
    // Only history
    searchMode = 'history'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('b ')) {
    // Only bookmarks
    searchMode = 'bookmarks'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('t ')) {
    // Only Tabs
    searchMode = 'tabs'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('s ')) {
    // Only search engines
    searchMode = 'search'
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith('#')) {
    // Tag search
    searchMode = 'tags'
    searchTerm = searchTerm.substring(1)
  } else if (searchTerm.startsWith('~')) {
    // Tag search
    searchMode = 'folders'
    searchTerm = searchTerm.substring(1)
  }

  searchTerm = searchTerm.trim()

  ext.model.searchTerm = searchTerm
  ext.model.searchMode = searchMode

  if (searchTerm) {
    if (searchMode === 'tags') {
      ext.model.result = searchTags(searchTerm)
    } else if (searchMode === 'folders') {
      ext.model.result = searchFolders(searchTerm)
    } else if (ext.opts.searchStrategy === 'simple') {
      ext.model.result = await searchWithSimpleSearch(searchTerm, searchMode)
    } else if (ext.opts.searchStrategy === 'fuzzy') {
      ext.model.result = await searchWithFuseJs(searchTerm, searchMode)
    } else if (ext.opts.searchStrategy === 'precise') {
      ext.model.result = searchWithFlexSearch(searchTerm, searchMode)
    } else if (ext.opts.searchStrategy === 'hybrid') {
      // in this search mode, both precise and hybrid search is executed
      // and the search results are merged, with precise results given precedence.
      ext.model.result = []
      const preciseResultIndexes = {}
      const preciseResults = await searchWithSimpleSearch(searchTerm, searchMode)
      const fuzzyResults = await searchWithFuseJs(searchTerm, searchMode)
      for (const preciseResult of preciseResults) {
        preciseResult.searchApproach = 'precise'
        ext.model.result.push(preciseResult)
        preciseResultIndexes[preciseResult.index] = true
      }
      for (const fuzzyResult of fuzzyResults) {
        if (!preciseResultIndexes[fuzzyResult.index]) {
          fuzzyResult.searchApproach = 'fuzzy'
          ext.model.result.push(fuzzyResult)
        }
      }
    } else {
      throw new Error(`Unsupported option "search.approach" value: "${ext.opts.searchStrategy}"`)
    }
    // Add search engine result items
    if (searchMode === 'all' || searchMode === 'search') {
      ext.model.result.push(...addSearchEngines(searchTerm))
    }
    ext.model.result = calculateFinalScore(ext.model.result, searchTerm)
    ext.model.result = sortResults(ext.model.result, 'score')
  } else {
    ext.model.result = await addDefaultEntries()
    ext.model.result = calculateFinalScore(ext.model.result, searchTerm)
    if (searchMode === 'history' || searchMode === 'tabs') {
      ext.model.result = sortResults(ext.model.result, 'lastVisited')
    }
  }

  // Filter out all search results below a certain score
  ext.model.result = ext.model.result.filter((el) => el.score >= ext.opts.scoreMinScore)

  // Only render maxResults if given (to improve render performance)
  // Not applied on tabs, tag and folder search
  if (
    searchMode !== 'tags' &&
    searchMode !== 'folders' &&
    searchMode !== 'tabs' &&
    ext.model.result.length > ext.opts.searchMaxResults
  ) {
    ext.model.result = ext.model.result.slice(0, ext.opts.searchMaxResults)
  }

  ext.dom.resultCounter.innerText = `(${ext.model.result.length})`

  renderSearchResults(ext.model.result)
}

/**
 * Calculates the final search item score on basis of the search score and some own rules
 *
 * @param sortMode: "score" | "lastVisited"
 */
export function calculateFinalScore(results, searchTerm) {
  for (let i = 0; i < results.length; i++) {
    const el = results[i]
    const now = Date.now()
    let score

    // Decide which base Score to chose
    if (el.type === 'bookmark') {
      score = ext.opts.scoreBookmarkBaseScore
    } else if (el.type === 'tab') {
      score = ext.opts.scoreTabBaseScore
    } else if (el.type === 'history') {
      score = ext.opts.scoreHistoryBaseScore
    } else if (el.type === 'search') {
      score = ext.opts.scoreSearchEngineBaseScore
    } else {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // Hybrid search: Add bonus / malus for precise and fuzzy matches
    if (ext.opts.searchStrategy === 'hybrid') {
      if (el.searchApproach === 'simple') {
        score += ext.opts.scoreHybridPreciseBonus
      } else if (el.searchApproach === 'fuzzy') {
        score += ext.opts.scoreHybridFuzzyBonus
      }
    }

    // Multiply by search library score.
    // This will reduce the score if the search is not a good match
    score = score * (el.searchScore || ext.opts.scoreTitleWeight)

    // Add custom bonus score to bookmarks
    if (ext.opts.scoreCustomBonusScore && el.type === 'bookmark') {
      const regex = /[ ][+]([0-9]+)/
      const match = el.title.match(regex)
      if (match && match.length > 0) {
        el.title = el.title.replace(match[0], '')
        score += parseInt(match[1])
        if (match.length !== 2) {
          console.error(`Unexpected custom bonus score match length`, match, el)
        }
      }
    }

    if (ext.model.searchTerm) {
      // Increase score if we have exact "startsWith" match in title or url
      if (ext.opts.scoreExactStartsWithBonus) {
        if (el.title && el.title.toLowerCase().startsWith(searchTerm)) {
          score += ext.opts.scoreExactStartsWithBonus * ext.opts.scoreTitleWeight
        } else if (el.url.startsWith(searchTerm.split(' ').join('-'))) {
          score += ext.opts.scoreExactStartsWithBonus * ext.opts.scoreUrlWeight
        }
      }

      // Increase score if we have an exact equal match in the title
      if (ext.opts.scoreExactEqualsBonus && el.title && el.title.toLowerCase() === searchTerm) {
        score += ext.opts.scoreExactEqualsBonus * ext.opts.scoreTitleWeight
      }

      // Increase score if we have an exact tag match
      if (ext.opts.scoreExactTagMatchBonus && el.tags) {
        let searchTermTags = searchTerm.split('#').join('').split(' ')
        searchTermTags.forEach((tag) => {
          el.tagsArray.map((el) => {
            if (tag === el.toLowerCase()) {
              score += ext.opts.scoreExactTagMatchBonus
            }
          })
        })
      }

      // Increase score if we have an exact folder name match
      if (ext.opts.scoreExactFolderMatchBonus && el.folder) {
        let searchTermFolders = searchTerm.split('~').join('').split(' ')
        searchTermFolders.forEach((folderName) => {
          el.folderArray.map((el) => {
            if (folderName === el.toLowerCase()) {
              score += ext.opts.scoreExactFolderMatchBonus
            }
          })
        })
      }

      // Increase score if we have an exact "includes" match
      if (ext.opts.scoreExactIncludesBonus && searchTerm.length >= ext.opts.scoreExactIncludesBonusMinChars) {
        // Treat each search term separated by a space individually
        searchTerm.split(' ').forEach((term) => {
          if (term && term.length >= ext.opts.scoreExactIncludesBonusMinChars) {
            if (el.title && el.title.toLowerCase().includes(term)) {
              score += ext.opts.scoreExactIncludesBonus * ext.opts.scoreTitleWeight
            } else if (el.url && el.url.includes(searchTerm.split(' ').join('-'))) {
              score += ext.opts.scoreExactIncludesBonus * ext.opts.scoreUrlWeight
            } else if (el.tags && el.tags.toLowerCase().includes(searchTerm)) {
              score += ext.opts.scoreExactIncludesBonus * ext.opts.scoreTagWeight
            } else if (el.folderName && el.folderName.toLowerCase().includes(searchTerm)) {
              score += ext.opts.scoreExactIncludesBonus * ext.opts.scoreFolderWeight
            }
          }
        })
      }
    }

    // Increase score if result has been open frequently
    if (ext.opts.scoreVisitedBonusScore && el.visitCount) {
      score += Math.min(ext.opts.scoreVisitedBonusScoreMaximum, el.visitCount * ext.opts.scoreVisitedBonusScore)
    }

    // Increase score if result has been opened recently
    if (
      ext.opts.scoreRecentBonusScoreMaximum &&
      ext.opts.scoreRecentBonusScorePerHour &&
      el.lastVisitSecondsAgo != null
    ) {
      // Bonus score is always at least 0 (no negative scores)
      // Take the recentBonusScoreMaximum
      // Subtract recentBonusScorePerHour points for each hour in the past
      score += Math.max(
        0,
        ext.opts.scoreRecentBonusScoreMaximum -
          (el.lastVisitSecondsAgo / 60 / 60) * ext.opts.scoreRecentBonusScorePerHour,
      )
    }

    // Increase score if bookmark has been added more recently
    if (ext.opts.scoreDateAddedBonusScoreMaximum && ext.opts.scoreDateAddedBonusScorePerDay && el.dateAdded != null) {
      // Bonus score is always at least 0 (no negative scores)
      // Take the dateAddedBonusScoreMaximum
      // Subtract dateAddedBonusScorePerDay points for each hour in the past
      score += Math.max(
        0,
        ext.opts.scoreDateAddedBonusScoreMaximum -
          ((now - el.dateAdded) / 1000 / 60 / 60 / 24) * ext.opts.scoreDateAddedBonusScorePerDay,
      )
    }

    el.score = score
  }

  return results
}

/**
 * Sorts the results according to some modes
 *
 * @param sortMode: "score" | "lastVisited"
 */
export function sortResults(results, sortMode) {
  if (sortMode === 'score') {
    results = results.sort((a, b) => {
      return b.score - a.score
    })
  } else if (sortMode === 'lastVisited') {
    results = results.sort((a, b) => {
      return (a.lastVisitSecondsAgo || 99999999) - (b.lastVisitSecondsAgo || 99999999)
    })
  } else {
    throw new Error(`Unknown sortMode="${sortMode}"`)
  }

  return results
}
