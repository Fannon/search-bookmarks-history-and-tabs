/**
 * @file Renders search results in the popup UI.
 *
 * Responsibilities:
 * - Render bookmark/tab/history results with metadata badges, highlights, and contextual actions (open, close, copy, edit).
 * - Surface visit counts, taxonomy labels, and scoring hints to keep the UI aligned with search models.
 * - Coordinate with searchNavigation.js for selection management and searchEvents.js for event delegation.
 */

import { escapeHtml, timeSince } from '../helper/utils.js'
import { printError } from './errorView.js'
import { setupResultItemsEvents } from './searchEvents.js'
import { selectListItem } from './searchNavigation.js'

/**
 * Render the search results in UI as result items.
 * Always uses ext.model.result as the source of truth.
 */
export async function renderSearchResults() {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    performance.mark('render-start')
  }
  try {
    const result = ext.model.result

    if (!result || result.length === 0) {
      ext.dom.resultList.replaceChildren()
      // Clear result counter when no results to show
      if (ext.dom.resultCounter) {
        ext.dom.resultCounter.innerText = ''
      }
      return
    }

    // Prepare for rendering - reset mouse movement tracking
    ext.model.mouseMoved = false

    // Cache configuration values for this render cycle
    const opts = ext.opts
    const shouldHighlight = opts.displaySearchMatchHighlight
    const searchTerm = ext.model.searchTerm

    // Set up right-click context menu prevention (one-time setup)
    if (!document.hasContextMenuListener) {
      document.addEventListener('contextmenu', (e) => {
        e.preventDefault()
      })
      document.hasContextMenuListener = true
    }

    // Use an array to accumulate HTML strings for all result items
    const itemsHTML = []
    const searchTermSuffix = `/search/${encodeURIComponent(searchTerm || '')}`

    const createBadge = (content, title, extraClass = '', extraLink = '', extraStyle = '') => {
      const classAttr = `badge ${extraClass}`.trim()
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      const linkAttr = extraLink ? ` x-link="${escapeHtml(extraLink)}"` : ''
      const styleAttr = extraStyle ? ` style="${extraStyle}"` : ''
      return `<span class="${classAttr}"${titleAttr}${linkAttr}${styleAttr}>${content}</span>`
    }

    for (let i = 0; i < result.length; i++) {
      const entry = result[i]
      if (!entry) continue

      const badges = []
      if (entry.type === 'bookmark' && entry.tab) badges.push(createBadge('T', 'Open Tab', 'source-tab'))
      if (entry.dupe) badges.push(createBadge('Duplicate', 'Duplicate Bookmark', 'duplicate'))

      if (opts.displayTags && entry.tagsArray) {
        entry.tagsArray.forEach((tag, j) => {
          const content =
            shouldHighlight && entry.highlightedTagsArray?.[j] ? entry.highlightedTagsArray[j] : `#${escapeHtml(tag)}`
          badges.push(createBadge(content, 'Bookmark Tags', 'tags', `#search/#${escapeHtml(tag)}`))
        })
      }

      if (opts.displayFolderName && entry.folderArray) {
        const trail = []
        const colorStyle = `background-color: ${escapeHtml(String(opts.bookmarkColor || 'none'))}`
        entry.folderArray.forEach((folder, j) => {
          trail.push(folder)
          const content =
            shouldHighlight && entry.highlightedFolderArray?.[j]
              ? entry.highlightedFolderArray[j]
              : `~${escapeHtml(folder)}`
          badges.push(createBadge(content, 'Bookmark Folder', 'folder', `#search/~${trail.join(' ~')}`, colorStyle))
        })
      }

      if (opts.displayLastVisit && entry.lastVisitSecondsAgo != null) {
        badges.push(
          createBadge(
            `-${escapeHtml(timeSince(new Date(Date.now() - entry.lastVisitSecondsAgo * 1000)))}`,
            'Last Visited',
            'last-visited',
          ),
        )
      }
      if (opts.displayVisitCounter && entry.visitCount !== undefined) {
        badges.push(createBadge(escapeHtml(String(entry.visitCount)), 'Visited Counter', 'visit-counter'))
      }
      if (opts.displayDateAdded && entry.dateAdded) {
        badges.push(
          createBadge(escapeHtml(new Date(entry.dateAdded).toISOString().split('T')[0]), 'Date Added', 'date-added'),
        )
      }
      if (opts.displayScore && entry.score) {
        badges.push(createBadge(escapeHtml(String(Math.round(entry.score))), 'Score', 'score'))
      }

      const title =
        shouldHighlight && entry.highlightedTitle ? entry.highlightedTitle : escapeHtml(entry.title || entry.url || '')
      const url = shouldHighlight && entry.highlightedUrl ? entry.highlightedUrl : escapeHtml(entry.url || '')
      const colorStyle = `border-left-color: ${escapeHtml(String(opts[`${entry.type}Color`]))}`

      itemsHTML.push(
        `<li class="${escapeHtml(entry.type || '')}"${entry.originalUrl ? ` x-open-url="${escapeHtml(entry.originalUrl)}"` : ''} x-index="${i}"${entry.originalId !== undefined ? ` x-original-id="${escapeHtml(String(entry.originalId))}"` : ''} style="${colorStyle}">${entry.type === 'bookmark' ? `<img class="edit-button" x-link="./editBookmark.html#bookmark/${encodeURIComponent(entry.originalId)}${searchTermSuffix}" title="Edit Bookmark" src="./img/edit.svg">` : ''}${entry.type === 'tab' ? '<img class="close-button" title="Close Tab" src="./img/x.svg">' : ''}<div class="title"><span class="title-text">${title} </span>${badges.join('')}</div><div class="url" title="${escapeHtml(entry.url || '')}">${url}</div></li>`,
      )
    }

    // Update the DOM with all new result items at once using innerHTML (faster for large updates)
    ext.dom.resultList.innerHTML = itemsHTML.join('')

    // Update result counter
    if (ext.dom.resultCounter) {
      ext.dom.resultCounter.innerText = `(${result.length})`
    }

    // Highlight the first result as the current selection
    selectListItem(0)

    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark('render-end')
      if (typeof performance.measure === 'function') {
        performance.measure('render-results', 'render-start', 'render-end')
      }
    }

    // Set up event delegation for better performance (one-time setup)
    setupResultItemsEvents()
  } catch (err) {
    // Reset mouse movement tracking even if rendering fails to prevent permanent UI breakage
    ext.model.mouseMoved = false
    printError(err, 'Failed to render search results')
    // Re-throw to allow caller to handle if needed
    throw err
  }
}
