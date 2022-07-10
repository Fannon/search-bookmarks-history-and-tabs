//////////////////////////////////////////
// TAXONOMY SEARCH SUPPORT              //
//////////////////////////////////////////

// This helps finding bookmarks that include tags or are part of a folder

export function searchTaxonomy(searchTerm, taxonomyType, data) {
  /** Search results */
  const results = []
  const taxonomyMarker = taxonomyType === 'tags' ? '#' : '~'

  // Simulate an OR search with the terms in searchTerm, separated by spaces
  let searchTermArray = searchTerm
    .split(taxonomyMarker)
    .map((el) => el.trim())
    .filter((el) => !!el)

  if (!searchTermArray.length) {
    // Early return if none of the search terms have enough char length
    return []
  }

  for (const entry of data) {
    const searchString = `${entry[taxonomyType] || ''}`.toLowerCase()
    let searchTermMatches = 0
    for (const term of searchTermArray) {
      if (searchString.includes(taxonomyMarker + term)) {
        searchTermMatches++
      }
    }
    if (searchTermMatches === searchTermArray.length) {
      results.push({
        ...entry,
        searchScore: 1,
        searchApproach: 'taxonomy',
      })
    }
  }

  return results
}

/**
 * Extract tags from bookmark titles
 *
 * @returns a dictionary where the key is the unique tag name
 * and the value is an array of the found bookmarks index
 */
export function getUniqueTags() {
  ext.index.taxonomy.tags = {}
  for (const el of ext.model.bookmarks) {
    if (el.tags) {
      for (let tag of el.tags.split('#')) {
        tag = tag.trim()
        if (tag) {
          if (!ext.index.taxonomy.tags[tag]) {
            ext.index.taxonomy.tags[tag] = [el.index]
          } else {
            ext.index.taxonomy.tags[tag].push(el.index)
          }
        }
      }
    }
  }
  return ext.index.taxonomy.tags
}

/**
 * Extract folders from bookmarks
 *
 * @returns a dictionary where the key is the unique tag name
 * and the value is an array of the found bookmarks index
 */
export function getUniqueFolders() {
  // This function is memoized, as the folders don't change while the extension is open
  if (!ext || !ext.index.taxonomy.folders) {
    const foldersDictionary = {}
    for (const el of ext.model.bookmarks) {
      if (el.folder) {
        for (let folderName of el.folder.split('~')) {
          folderName = folderName.trim()
          if (folderName) {
            if (!foldersDictionary[folderName]) {
              foldersDictionary[folderName] = [el.index]
            } else {
              foldersDictionary[folderName].push(el.index)
            }
          }
        }
      }
    }
    ext.index.taxonomy.folders = foldersDictionary
  }
  return ext.index.taxonomy.folders
}
