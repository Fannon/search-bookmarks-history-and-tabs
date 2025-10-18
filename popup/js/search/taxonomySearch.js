/**
 * @file Implements tag (`#`) and folder (`~`) taxonomy searches with AND semantics.
 * Maintains cached indexes so the popup can resolve taxonomy views quickly.
 */

/**
 * Perform an AND-based taxonomy search across tags or folders.
 * @param {string} searchTerm
 * @param {'tags' | 'folder'} taxonomyType
 * @param {Array<Object>} data
 * @returns {Array<Object>}
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

/**
 * Build a tag-to-bookmark index from the current bookmark model.
 * @returns {Object<string, Array<string>>}
 */
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

/**
 * Build (or reuse) a memoized folder-to-bookmark index.
 * @returns {Object<string, Array<string>>}
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

/**
 * Clear the memoized folders dictionary so it can be rebuilt on demand.
 */
export function resetUniqueFoldersCache() {
  if (ext && ext.index && ext.index.taxonomy) {
    ext.index.taxonomy.folders = undefined
  }
}
