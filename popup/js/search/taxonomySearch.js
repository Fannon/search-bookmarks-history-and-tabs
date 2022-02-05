//////////////////////////////////////////
// TAXONOMY SEARCH SUPPORT              //
//////////////////////////////////////////

// This helps finding bookmarks that include tags or are part of a folder

/**
 * Find bookmarks with given tag
 * Prefers full tag matches, but will also return "starts with" matches
 * Supports AND search, if multiple tags are chosen, e.g. "#github #pr"
 */
export function searchTags(searchTerm) {
  const resultDict = {}
  const intersectionCalc = []
  const tags = getUniqueTags()

  const searchTags = searchTerm.split('#').map((el) => el.trim())

  for (const searchTag of searchTags) {
    if (!searchTag) {
      continue
    }
    const foundResults = []
    for (const tagName in tags) {
      const tag = tags[tagName]
      if (tagName.toLowerCase().startsWith(searchTag)) {
        for (const elIndex of tag) {
          const el = ext.model.bookmarks[elIndex]
          const result = {
            searchScore: tagName === searchTag ? 1 : 0.8,
            ...el,
          }

          if (!resultDict[el.index]) {
            resultDict[el.index] = result
          }
          // If we already have a match, the one with the higher score wins
          if (resultDict[el.index].searchScore < result.searchScore) {
            resultDict[el.index] = result
          }
          foundResults.push(el.index)
        }
      }
    }
    intersectionCalc.push(foundResults)
  }

  const resultIntersection = intersectionCalc.reduce((a, b) => a.filter((c) => b.includes(c)))

  return resultIntersection.map((resultIndex) => {
    return resultDict[resultIndex]
  })
}

/**
 * Find bookmarks that are part of given folder name
 * Prefers full folder name matches, but will also return "starts with" matches
 * Supports AND search, if multiple tags are chosen, e.g. "~Sites ~Blogs"
 */
export function searchFolders(searchTerm) {
  const resultDict = {}
  const intersectionCalc = []
  const folders = getUniqueFolders()

  const searchFolders = searchTerm.split('~').map((el) => el.trim())

  for (const searchFolder of searchFolders) {
    if (!searchFolder) {
      continue
    }
    const foundResults = []
    for (const folderName in folders) {
      const folder = folders[folderName]
      if (folderName.toLowerCase().startsWith(searchFolder)) {
        for (const elIndex of folder) {
          const el = ext.model.bookmarks[elIndex]
          const result = {
            searchScore: folderName === searchFolder ? 1 : 0.8,
            ...el,
          }
          if (!resultDict[el.index]) {
            resultDict[el.index] = result
          }
          if (resultDict[el.index].searchScore < result.searchScore) {
            resultDict[el.index] = result
          }
          foundResults.push(el.index)
        }
      }
    }
    intersectionCalc.push(foundResults)
  }

  const resultIntersection = intersectionCalc.reduce((a, b) => a.filter((c) => b.includes(c)))

  console.info(intersectionCalc, resultIntersection)

  return resultIntersection.map((resultIndex) => {
    return resultDict[resultIndex]
  })
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
