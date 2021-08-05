//////////////////////////////////////////
// TAXONOMY SEARCH SUPPORT              //
//////////////////////////////////////////

// This helps finding bookmarks that include tags or are part of a folder

export function searchTags(searchTerm) {
  const results = []
  const tags = getUniqueTags()
  for (const tagName in tags) {
    const tag = tags[tagName]

    if (tagName.startsWith(searchTerm)) {
      for (const elIndex of tag) {
        const el = ext.model.bookmarks[elIndex]
        results.push({
          searchScore: tagName === searchTerm ? 1 : 0.8,
          ...el
        })
      }
    }
  }

  return results
}

export function searchFolders(searchTerm) {
  const results = []
  const folders = getUniqueFolders()
  for (const folderName in folders) {
    const folder = folders[folderName]
    if (folderName.startsWith(searchTerm)) {
      for (const elIndex of folder) {
        const el = ext.model.bookmarks[elIndex]
        results.push({
          searchScore: folderName === searchTerm ? 1 : 0.8,
          ...el
        })
      }
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

  if (!ext || !ext.index.taxonomy.tags) {
    const tagsDictionary = {}
    for (const el of ext.model.bookmarks) {
      if (el.tags) {
        for (let tag of el.tags.split('#')) {
          tag = tag.trim()
          if (tag) {
            if (!tagsDictionary[tag]) {
              tagsDictionary[tag] = [el.index]
            } else {
              tagsDictionary[tag].push(el.index)
            }
          }
        }
      }
    }
    ext.index.taxonomy.tags = tagsDictionary
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
