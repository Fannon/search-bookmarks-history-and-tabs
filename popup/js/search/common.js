//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

import { printError } from '../helper/utils.js'
import { closeModals } from '../initSearch.js'
import { renderSearchResults } from '../view/searchView.js'
import { addDefaultEntries } from './defaultEntries.js'
import { fuzzySearch } from './fuzzySearch.js'
import { addSearchEngines, getCustomSearchEngineResult } from './searchEngines.js'
import { simpleSearch } from './simpleSearch.js'
import { searchTaxonomy } from './taxonomySearch.js'

/**
 * This is the main search entry point.
 * It will decide which approaches and indexes to use.
 */
export async function search(event) {
  try {
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

    closeModals()

    if (ext.opts.debug) {
      performance.mark('search-start')
    }

    // Get and clean up original search query
    let searchTerm = ext.dom.searchInput.value || ''
    searchTerm = searchTerm.trimStart().toLowerCase()
    searchTerm = searchTerm.replace(/ +(?= )/g, '') // Remove duplicate spaces

    ext.model.result = []
    let searchMode = 'all'

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
    } else if (ext.opts.customSearchEngines) {
      // Use custom search mode aliases
      for (const customSearchEngine of ext.opts.customSearchEngines) {
        let aliases = customSearchEngine.alias
        if (!Array.isArray(aliases)) {
          aliases = [aliases]
        }
        for (const alias of aliases) {
          if (searchTerm.startsWith(alias.toLowerCase() + ' ')) {
            ext.model.result.push(
              getCustomSearchEngineResult(
                searchTerm.replace(alias.toLowerCase() + ' ', ''.trim()),
                customSearchEngine.name,
                customSearchEngine.urlPrefix,
                customSearchEngine.blank,
                true,
              ),
            )
          }
        }
      }
    }

    searchTerm = searchTerm.trim()

    ext.model.searchTerm = searchTerm
    ext.model.searchMode = searchMode

    if (searchTerm) {
      if (searchMode === 'tags') {
        ext.model.result = searchTaxonomy(searchTerm, 'tags', ext.model.bookmarks)
      } else if (searchMode === 'folders') {
        ext.model.result = searchTaxonomy(searchTerm, 'folder', ext.model.bookmarks)
      } else if (ext.opts.searchStrategy === 'fuzzy') {
        ext.model.result.push(...(await searchWithAlgorithm('fuzzy', searchTerm, searchMode)))
      } else if (ext.opts.searchStrategy === 'precise') {
        ext.model.result.push(...(await searchWithAlgorithm('precise', searchTerm, searchMode)))
      } else if (ext.opts.searchStrategy === 'hybrid') {
        // in this search mode, both precise and hybrid search is executed
        // and the search results are merged, with precise results given precedence.
        const preciseResultIndexes = {}
        const preciseResults = await searchWithAlgorithm('precise', searchTerm, searchMode)
        const fuzzyResults = await searchWithAlgorithm('fuzzy', searchTerm, searchMode)
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
  } catch (err) {
    printError(err)
  }
}

/**
 * Search with a with a specific approach and combine the results.
 *
 * @searchApproach 'precise' | 'fuzzy'
 */
export async function searchWithAlgorithm(searchApproach, searchTerm, searchMode = 'all') {
  let results = []
  // If the search term is below minMatchCharLength, no point in starting search
  if (searchTerm.length < ext.opts.searchMinMatchCharLength) {
    return results
  }

  if (ext.opts.debug) {
    performance.mark('search-start')
    console.debug(
      `🔍 Searching with approach="${searchApproach}" and mode="${searchMode}" for searchTerm="${searchTerm}"`,
    )
  }

  if (searchApproach === 'precise') {
    results = simpleSearch(searchMode, searchTerm)
  } else if (searchApproach === 'fuzzy') {
    results = await fuzzySearch(searchMode, searchTerm)
  } else {
    throw new Error('Unknown search approach: ' + searchApproach)
  }

  if (ext.opts.debug) {
    performance.mark('search-end')
    performance.measure('search: ' + searchTerm, 'search-start', 'search-end')
    const searchPerformance = performance.getEntriesByType('measure')
    console.debug(
      'Found ' +
        results.length +
        ' results with approach="' +
        searchApproach +
        '" in ' +
        searchPerformance[0].duration +
        'ms',
      searchPerformance,
    )
    performance.clearMeasures()
  }

  return results
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
    } else if (el.type === 'customSearch') {
      score = ext.opts.scoreCustomSearchEngineBaseScore
    } else {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // Hybrid search: Add bonus / malus for precise and fuzzy matches
    if (ext.opts.searchStrategy === 'hybrid') {
      if (el.searchApproach === 'precise') {
        score += ext.opts.scoreHybridPreciseBonus
      } else if (el.searchApproach === 'fuzzy') {
        score += ext.opts.scoreHybridFuzzyBonus
      }
    }

    // Multiply by search library score.
    // This will reduce the score if the search is not a good match
    score = score * (el.searchScore || ext.opts.scoreTitleWeight)

    // Add custom bonus score to bookmarks
    if (ext.opts.scoreCustomBonusScore && el.customBonusScore) {
      score += el.customBonusScore
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
