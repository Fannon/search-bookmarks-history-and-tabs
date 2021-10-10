//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

import { renderSearchResults } from '../view/searchView.js'
import { addDefaultEntries } from './defaultEntries.js'
import { createPreciseIndexes, searchWithFlexSearch } from './flexSearch.js'
import { createFuzzyIndexes, searchWithFuseJs } from './fuseSearch.js'
import { addSearchEngines } from './searchEngines.js'
import { searchFolders, searchTags } from './taxonomySearch.js'

/**
 * Creates the search indexes.
 * Depending on search approach this is either fuzzy or precise
 */
export function createSearchIndexes() {
  if (ext.opts.search.approach === 'fuzzy') {
    createFuzzyIndexes()
  } else if (ext.opts.search.approach === 'precise') {
    createPreciseIndexes()
  } else {
    throw new Error(`The option "search.approach" has an unsupported value: ${ext.opts.search.approach}`)
  }
}

/**
 * Executes a search
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

  let searchTerm = ext.dom.searchInput.value || ''
  searchTerm = searchTerm.trimLeft().toLowerCase()
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
    } else if (ext.opts.search.approach === 'fuzzy') {
      ext.model.result = await searchWithFuseJs(searchTerm, searchMode)
    } else if (ext.opts.search.approach === 'precise') {
      ext.model.result = searchWithFlexSearch(searchTerm, searchMode)
    } else {
      throw new Error(`Unsupported option "search.approach" value: "${ext.opts.search.approach}"`)
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
    } else {
      ext.model.result = sortResults(ext.model.result, 'score')
    }
  }

  // Filter out all search results below a certain score
  ext.model.result = ext.model.result.filter((el) => el.score >= ext.opts.score.minScore)

  // Only render maxResults if given (to improve render performance)
  // Not applied on tabs, tag and folder search
  if (
    searchMode !== 'tags' &&
    searchMode !== 'folders' &&
    searchMode !== 'tabs' &&
    ext.model.result.length > ext.opts.search.maxResults
  ) {
    ext.model.result = ext.model.result.slice(0, ext.opts.search.maxResults)
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
      score = ext.opts.score.bookmarkBaseScore
    } else if (el.type === 'tab') {
      score = ext.opts.score.tabBaseScore
    } else if (el.type === 'history') {
      score = ext.opts.score.historyBaseScore
    } else if (el.type === 'search') {
      score = ext.opts.score.searchEngineBaseScore
    } else {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // Multiply by search library score.
    // This will reduce the score if the search is not a good match
    score = score * (el.searchScore || ext.opts.score.titleWeight)

    // Increase score if we have an exact "includes" match in title or url
    if (ext.opts.score.exactIncludesBonus) {
      // Treat each search term separated by a space individually
      searchTerm.split(' ').forEach((term) => {
        if (term) {
          if (el.title && el.title.toLowerCase().includes(term)) {
            score += ext.opts.score.exactIncludesBonus * ext.opts.score.titleWeight
          } else if (el.url.includes(searchTerm.split(' ').join('-'))) {
            score += ext.opts.score.exactIncludesBonus * ext.opts.score.urlWeight
          }
        }
      })
    }

    // Add custom bonus score to bookmarks
    if (ext.opts.score.customBonusScore && el.type === 'bookmark') {
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
      if (ext.opts.score.exactStartsWithBonus) {
        if (el.title && el.title.toLowerCase().startsWith(searchTerm)) {
          score += ext.opts.score.exactStartsWithBonus * ext.opts.score.titleWeight
        } else if (el.url.startsWith(searchTerm.split(' ').join('-'))) {
          score += ext.opts.score.exactStartsWithBonus * ext.opts.score.urlWeight
        }
      }

      // Increase score if we have an exact equal match in the title
      if (ext.opts.score.exactEqualsBonus && el.title && el.title.toLowerCase() === searchTerm) {
        score += ext.opts.score.exactEqualsBonus * ext.opts.score.titleWeight
      }

      // Increase score if we have an exact tag match
      if (ext.opts.score.exactTagMatchBonus && el.tags && searchTerm.includes('#')) {
        let searchTermTags = searchTerm.split('#')
        searchTermTags.shift()
        searchTermTags.forEach((tag) => {
          el.tagsArray.map((el) => {
            if (tag === el.toLowerCase()) {
              score += ext.opts.score.exactTagMatchBonus
            }
          })
        })
      }

      // Increase score if we have an exact folder name match
      if (ext.opts.score.exactFolderMatchBonus && el.folder && searchTerm.includes('~')) {
        let searchTermFolders = searchTerm.split('~')
        searchTermFolders.shift()
        searchTermFolders.forEach((folderName) => {
          el.folderArray.map((el) => {
            if (folderName === el.toLowerCase()) {
              score += ext.opts.score.exactFolderMatchBonus
            }
          })
        })
      }
    }

    // Increase score if result has been open frequently
    if (ext.opts.score.visitedBonusScore && el.visitCount) {
      score += Math.min(ext.opts.score.visitedBonusScoreMaximum, el.visitCount * ext.opts.score.visitedBonusScore)
    }

    // Increase score if result has been opened recently
    if (
      ext.opts.score.recentBonusScoreMaximum &&
      ext.opts.score.recentBonusScorePerHour &&
      el.lastVisitSecondsAgo != null
    ) {
      // Bonus score is always at least 0 (no negative scores)
      // Take the recentBonusScoreMaximum
      // Substract recentBonusScorePerHour points for each hour in the past
      score += Math.max(
        0,
        ext.opts.score.recentBonusScoreMaximum -
          (el.lastVisitSecondsAgo / 60 / 60) * ext.opts.score.recentBonusScorePerHour,
      )
    }

    // Increase score if bookmark has been added more recently
    if (ext.opts.score.dateAddedBonusScoreMaximum && ext.opts.score.dateAddedBonusScorePerDay && el.dateAdded != null) {
      // Bonus score is always at least 0 (no negative scores)
      // Take the dateAddedBonusScoreMaximum
      // Substract dateAddedBonusScorePerDay points for each hour in the past
      score += Math.max(
        0,
        ext.opts.score.dateAddedBonusScoreMaximum -
          ((now - el.dateAdded) / 1000 / 60 / 60 / 24) * ext.opts.score.dateAddedBonusScorePerDay,
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
  // results = results || []
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
