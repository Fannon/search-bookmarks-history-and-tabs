//////////////////////////////////////////
// SEARCH                               //
//////////////////////////////////////////

import { renderSearchResults } from "../view/searchView.js"
import { addDefaultEntries } from "./defaultEntries.js"
import { createPreciseIndexes, searchWithFlexSearch } from "./flexSearch.js"
import { createFuzzyIndexes, searchWithFuseJs } from "./fuseSearch.js"
import { addSearchEngines } from "./searchEngines.js"
import { searchFolders, searchTags } from "./taxonomySearch.js"

/**
 * Creates the search indexes.
 * Depending on search approach this is either fuzzy or precise
 */
export function createSearchIndexes() {
  if (ext.opts.search.approach === "fuzzy") {
    createFuzzyIndexes()
  } else if (ext.opts.search.approach === "precise") {
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
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter" || event.key === "Escape") {
      return
    }
  }

  if (!ext.initialized) {
    console.warn("Extension not initialized (yet). Skipping search")
    return
  }

  performance.mark("search-start")

  let searchTerm = ext.dom.searchInput.value || ""
  searchTerm = searchTerm.trim().toLowerCase()
  searchTerm = searchTerm.replace(/ +(?= )/g, "") // Remove duplicate spaces
  ext.model.result = []
  let searchMode = "all" // OR 'bookmarks' OR 'history'

  // Support for various search modes
  // This is detected by looking at the first chars of the search
  if (searchTerm.startsWith("h ")) {
    // Only history
    searchMode = "history"
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith("b ")) {
    // Only bookmarks
    searchMode = "bookmarks"
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith("t ")) {
    // Only Tabs
    searchMode = "tabs"
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith("s ")) {
    // Only search engines
    searchMode = "search"
    searchTerm = searchTerm.substring(2)
  } else if (searchTerm.startsWith("#")) {
    // Tag search
    searchMode = "tags"
    searchTerm = searchTerm.substring(1)
  } else if (searchTerm.startsWith("~")) {
    // Tag search
    searchMode = "folders"
    searchTerm = searchTerm.substring(1)
  }

  ext.model.searchTerm = searchTerm
  ext.model.searchMode = searchMode

  if (searchTerm) {
    if (searchMode === "tags") {
      ext.model.result.push(...searchTags(searchTerm))
    } else if (searchMode === "folders") {
      ext.model.result.push(...searchFolders(searchTerm))
    } else if (ext.opts.search.approach === "fuzzy") {
      const results = await searchWithFuseJs(searchTerm, searchMode)
      ext.model.result.push(...results)
    } else if (ext.opts.search.approach === "precise") {
      const results = searchWithFlexSearch(searchTerm, searchMode)
      ext.model.result.push(...results)
    } else {
      throw new Error(`Unsupported option "search.approach" value: "${ext.opts.search.approach}"`)
    }
    // Add search engine result items
    if (searchMode === "all" || searchMode === "search") {
      ext.model.result.push(...addSearchEngines(searchTerm))
    }
  } else {
    const defaultEntries = await addDefaultEntries()
    ext.model.result.push(...defaultEntries)
  }

  ext.model.result = calculateFinalScore(ext.model.result, searchTerm, true)

  // Filter out all search results below a certain score
  ext.model.result = ext.model.result.filter((el) => el.score >= ext.opts.score.minScore)

  // Only render maxResults if given (to improve render performance)
  // Not applied on tag and folder search
  if (searchMode !== "tags" && searchMode !== "folders" && ext.model.result.length > ext.opts.search.maxResults) {
    ext.model.result = ext.model.result.slice(0, ext.opts.search.maxResults)
  }

  ext.dom.resultCounter.innerText = `(${ext.model.result.length})`

  renderSearchResults(ext.model.result)
}

/**
 * Calculates the final search item score on basis of the search score and some own rules
 * Optionally sorts the result by that score
 */
export function calculateFinalScore(result, searchTerm, sort) {
  for (let i = 0; i < result.length; i++) {
    const el = result[i]
    let score

    // Decide which base Score to chose
    if (el.type === "bookmark") {
      score = ext.opts.score.bookmarkBaseScore
    } else if (el.type === "tab") {
      score = ext.opts.score.tabBaseScore
    } else if (el.type === "history") {
      score = ext.opts.score.historyBaseScore
    } else if (el.type === "search") {
      score = ext.opts.score.searchEngineBaseScore
    } else {
      throw new Error(`Search result type "${el.type}" not supported`)
    }

    // Multiply by search library score.
    // This will reduce the score if the search is not a good match
    score = score * (el.searchScore || ext.opts.score.titleWeight)

    // Increse score if we have an exact "includes" match in title or url
    if (ext.opts.score.exactIncludesBonus) {
      // Treat each search term separated by a space individually
      searchTerm.split(" ").forEach((term) => {
        if (term) {
          if (el.title && el.title.toLowerCase().includes(term)) {
            score += ext.opts.score.exactIncludesBonus * ext.opts.score.titleWeight
          } else if (el.url.includes(searchTerm.split(" ").join("-"))) {
            score += ext.opts.score.exactIncludesBonus * ext.opts.score.urlWeight
          }
        }
      })
    }

    // Increase score if we have exact "startsWith" match in title or url
    if (ext.opts.score.exactStartsWithBonus) {
      if (el.title && el.title.toLowerCase().startsWith(searchTerm)) {
        score += ext.opts.score.exactStartsWithBonus * ext.opts.score.titleWeight
      } else if (el.url.startsWith(searchTerm.split(" ").join("-"))) {
        score += ext.opts.score.exactStartsWithBonus * ext.opts.score.urlWeight
      }
    }

    // Increase score if we have an exact equal match in the title
    if (ext.opts.score.exactEqualsBonus && el.title && el.title.toLowerCase() === searchTerm) {
      score += ext.opts.score.exactEqualsBonus * ext.opts.score.titleWeight
    }

    // Increase score if we have an exact tag match
    if (ext.opts.score.exactTagMatchBonus && el.tags && searchTerm.includes("#")) {
      let searchTermTags = searchTerm.split("#")
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
    if (ext.opts.score.exactFolderMatchBonus && el.folder && searchTerm.includes("~")) {
      let searchTermFolders = searchTerm.split("~")
      searchTermFolders.shift()
      searchTermFolders.forEach((folderName) => {
        el.folderArray.map((el) => {
          if (folderName === el.toLowerCase()) {
            score += ext.opts.score.exactFolderMatchBonus
          }
        })
      })
    }

    // Increase score if result has been open frequently or recently
    if (el.visitCount) {
      score += Math.min(ext.opts.score.visitedBonusScoreMaximum, el.visitCount * ext.opts.score.visitedBonusScore)
    }

    el.score = score
  }

  if (sort) {
    result = result.sort((a, b) => {
      return b.score - a.score
    })
  }

  return result
}
