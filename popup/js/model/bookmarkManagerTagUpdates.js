/**
 * @file Pure helpers for bookmark-manager tag update plans.
 */

export function createTagUpdatePlans(bookmarks, getNextTags) {
  const tagPlans = []

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    const currentTags = bookmark.tagsArray || []
    const nextTags = getNextTags(currentTags)
    if (areSameTags(currentTags, nextTags)) {
      continue
    }
    tagPlans.push({ bookmark, currentTags, nextTags })
  }

  return tagPlans
}

export function createBulkTagDescription(tagPlans) {
  const { addedTags, removedTags } = getBulkTagDiff(tagPlans)
  const bookmarkText = formatBookmarkCount(tagPlans.length)

  if (addedTags.length && removedTags.length) {
    return `Changed tags on ${bookmarkText}: added "${addedTags.join(', ')}"; removed "${removedTags.join(', ')}"`
  }
  if (addedTags.length) {
    return `Added tags "${addedTags.join(', ')}" to ${bookmarkText}`
  }
  if (removedTags.length) {
    return `Removed tags "${removedTags.join(', ')}" from ${bookmarkText}`
  }
  return `Updated tags on ${bookmarkText}`
}

export function createBulkTagMetadata(tagPlans) {
  const { addedTags, removedTags } = getBulkTagDiff(tagPlans)

  return {
    action: addedTags.length && removedTags.length ? 'updateTags' : addedTags.length ? 'addTags' : 'removeTags',
    tagsAdded: addedTags,
    tagsRemoved: removedTags,
  }
}

function getBulkTagDiff(tagPlans) {
  const addedTags = []
  const removedTags = []

  for (let i = 0; i < tagPlans.length; i++) {
    const { currentTags, nextTags } = tagPlans[i]
    appendTagDiff(addedTags, nextTags, currentTags)
    appendTagDiff(removedTags, currentTags, nextTags)
  }

  return { addedTags, removedTags }
}

function appendTagDiff(result, sourceTags, compareTags) {
  const compareKeys = new Set(compareTags.map((tag) => tag.toLowerCase()))
  const resultKeys = new Set(result.map((tag) => tag.toLowerCase()))

  for (let i = 0; i < sourceTags.length; i++) {
    const tag = sourceTags[i]
    const key = tag.toLowerCase()
    if (!compareKeys.has(key) && !resultKeys.has(key)) {
      result.push(tag)
      resultKeys.add(key)
    }
  }
}

function areSameTags(firstTags, secondTags) {
  if (firstTags.length !== secondTags.length) {
    return false
  }

  const firstKeys = new Set(firstTags.map((tag) => tag.toLowerCase()))
  for (let i = 0; i < secondTags.length; i++) {
    if (!firstKeys.has(secondTags[i].toLowerCase())) {
      return false
    }
  }
  return true
}

function formatBookmarkCount(bookmarkCount) {
  return `${bookmarkCount} bookmark${bookmarkCount === 1 ? '' : 's'}`
}
