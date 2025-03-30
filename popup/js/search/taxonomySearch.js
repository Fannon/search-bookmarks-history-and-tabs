//////////////////////////////////////////
// TAXONOMY SEARCH SUPPORT              //
//////////////////////////////////////////

// This helps finding bookmarks that include tags or are part of a folder

/**
 * Simple, precise search for bookmark tags and folder names
 * Executes AND search with the terms in searchTerm, separated by spaces
 *
 * @param {string} searchTerm
 * @param {'tags' | 'folder'} taxonomyType
 */
export function searchTaxonomy(searchTerm, taxonomyType, data) {
  /** Search results */
  const results = []
  /** Marker for taxonomy search mode */
  const taxonomyMarker = taxonomyType === 'tags' ? '#' : '~'

  let searchTermArray = searchTerm.split(taxonomyMarker)

  if (searchTermArray.length) {
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
  }

  return results
}

export function getUniqueTags() {
  ext.index.taxonomy.tags = {}
  for (const el of ext.model.bookmarks) {
    if (el.tags) {
      for (let tag of el.tags.split('#')) {
        tag = tag.trim()
        if (tag) {
          if (!ext.index.taxonomy.tags[tag]) {
            ext.index.taxonomy.tags[tag] = [el.originalId]
          } else {
            ext.index.taxonomy.tags[tag].push(el.originalId)
          }
        }
      }
    }
  }
  return ext.index.taxonomy.tags
}

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
              foldersDictionary[folderName] = [el.originalId]
            } else {
              foldersDictionary[folderName].push(el.originalId)
            }
          }
        }
      }
    }
    ext.index.taxonomy.folders = foldersDictionary
  }
  return ext.index.taxonomy.folders
}
