
//////////////////////////////////////////
// OPTIONS                              //
//////////////////////////////////////////

export const options = {
  general: {
    /** Extract tags from title and display it as a badge with different search prio */
    tags: true,
    /** Highlight search matches in result */
    highlight: true,
    /** Display last visit */
    lastVisit: true,
    /** Display visit count */
    visitCounter: true,
    /** Display search result score */
    displayScore: true,
    /**
     * Enables fuse.js extended search, which additional operators to fine-tune results.
     * @see https://fusejs.io/examples.html#weighted-search
     */
    extendedSearch: true,
  },
  search: {
    /** Max results to render. Reduce for better performance */
    maxResults: 256,
    /** Min characters that need to match */
    minMatchCharLength: 2,
    /** Fuzzy search threshold (increase to increase fuzziness) */
    threshold: 0.4,
    /** Filters out all search results below this minimum score */
    minScore: 30,
    /** Weight for a title match. From 0-1. */
    titleWeight: 1,
    /** Weight for a tag match. From 0-1. */
    tagWeight: 0.7,
    /** Weight for an url match. From 0-1. */
    urlWeight: 0.55,
    /** Weight for a folder match. From 0-1. */
    folderWeight: 0.2,
    /** Base score for bookmark results */
    bookmarkBaseScore: 100,
    /** Base score for tab results */
    tabBaseScore: 90,
    /** Base score for history results */
    historyBaseScore: 50,
    /** Additional score points per visit within history hoursAgo */
    visitedBonusScore: 2,
    /** Maximum score points for visitied bonus */
    maxVisitedBonusScore: 40,
    /** 
     * Additional score points if title, url and tag starts exactly with search text.
     * The points can be added multiple times, if more than one has a "starts with" match.
     */
    startsWithBonusScore: 10,
  },
  tabs: {
    enabled: true,
  },
  bookmarks: {
    enabled: true,
  },
  history: {
    enabled: true,
    hoursAgo: 24,
    maxItems: 1024,
  },
  
}
