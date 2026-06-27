/**
 * Clone matched search items and annotate the search strategy used.
 *
 * @param {Array<Object>} data - Source search items.
 * @param {Array<number>} idxs - Matched source indexes.
 * @param {string} searchApproach - Strategy label to attach.
 * @returns {Array<Object>} Cloned search result objects.
 */
export function createSearchResultObjects(data, idxs, searchApproach) {
  if (!idxs?.length) {
    return []
  }

  const count = idxs.length
  const results = new Array(count)
  for (let i = 0; i < count; i++) {
    results[i] = {
      ...data[idxs[i]],
      searchApproach,
    }
  }
  return results
}
