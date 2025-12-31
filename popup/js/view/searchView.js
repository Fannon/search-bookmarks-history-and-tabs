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

    for (let i = 0; i < result.length; i++) {
      const resultEntry = result[i]

      if (!resultEntry) {
        continue
      }

      // Use array for badge HTML generation (more efficient than string concatenation)
      const badges = []

      if (resultEntry.type === 'bookmark' && resultEntry.tab) {
        badges.push('<span class="badge source-tab" title="Open Tab">T</span>')
      }
      if (resultEntry.dupe) {
        badges.push('<span class="badge duplicate" title="Duplicate Bookmark">Duplicate</span>')
      }

      if (opts.displayTags && resultEntry.tagsArray) {
        for (let j = 0; j < resultEntry.tagsArray.length; j++) {
          const tag = resultEntry.tagsArray[j]
          const highlightedTag = resultEntry.highlightedTagsArray?.[j]
          const content = shouldHighlight && highlightedTag ? highlightedTag : `#${escapeHtml(tag)}`
          badges.push(
            `<span class="badge tags" x-link="#search/#${escapeHtml(tag)}" title="Bookmark Tags">${content}</span>`,
          )
        }
      }

      if (opts.displayFolderName && resultEntry.folderArray) {
        const trail = []
        const bookmarkColorStyle = `background-color: ${escapeHtml(String(opts.bookmarkColor || 'none'))}`
        for (let j = 0; j < resultEntry.folderArray.length; j++) {
          const folderName = resultEntry.folderArray[j]
          const highlightedFolder = resultEntry.highlightedFolderArray?.[j]
          trail.push(folderName)
          const folderLink = `#search/~${trail.join(' ~')}`
          const safeLink = escapeHtml(folderLink)
          const content = shouldHighlight && highlightedFolder ? highlightedFolder : `~${escapeHtml(folderName)}`
          badges.push(
            `<span class="badge folder" x-link="${safeLink}" title="Bookmark Folder" style="${bookmarkColorStyle}">${content}</span>`,
          )
        }
      }

      if (opts.displayLastVisit && resultEntry.lastVisitSecondsAgo != null) {
        const lastVisit = timeSince(new Date(Date.now() - resultEntry.lastVisitSecondsAgo * 1000))
        badges.push(`<span class="badge last-visited" title="Last Visited">-${escapeHtml(lastVisit)}</span>`)
      }

      if (opts.displayVisitCounter && resultEntry.visitCount !== undefined) {
        badges.push(
          `<span class="badge visit-counter" title="Visited Counter">${escapeHtml(String(resultEntry.visitCount))}</span>`,
        )
      }

      if (opts.displayDateAdded && resultEntry.dateAdded) {
        badges.push(
          `<span class="badge date-added" title="Date Added">${escapeHtml(
            new Date(resultEntry.dateAdded).toISOString().split('T')[0],
          )}</span>`,
        )
      }

      if (opts.displayScore && resultEntry.score) {
        badges.push(
          `<span class="badge score" title="Score">${escapeHtml(String(Math.round(resultEntry.score)))}</span>`,
        )
      }

      const badgesHTML = badges.join('')

      const titleContent =
        shouldHighlight && resultEntry.highlightedTitle
          ? resultEntry.highlightedTitle
          : escapeHtml(resultEntry.title || resultEntry.url || '')
      const urlContent =
        shouldHighlight && resultEntry.highlightedUrl ? resultEntry.highlightedUrl : escapeHtml(resultEntry.url || '')

      const typeClass = escapeHtml(resultEntry.type || '')
      const originalUrlAttr = resultEntry.originalUrl ? ` x-open-url="${escapeHtml(resultEntry.originalUrl)}"` : ''
      const originalIdAttr =
        resultEntry.originalId !== undefined ? ` x-original-id="${escapeHtml(String(resultEntry.originalId))}"` : ''
      const colorValue = escapeHtml(String(opts[`${resultEntry.type}Color`]))

      itemsHTML.push(`
        <li class="${typeClass}"${originalUrlAttr} x-index="${i}"${originalIdAttr}
            style="border-left: ${opts.colorStripeWidth}px solid ${colorValue}">
          ${
            resultEntry.type === 'bookmark'
              ? `<img class="edit-button" x-link="./editBookmark.html#bookmark/${encodeURIComponent(
                  resultEntry.originalId,
                )}${searchTermSuffix}" title="Edit Bookmark" src="./img/edit.svg">`
              : ''
          }
          ${resultEntry.type === 'tab' ? '<img class="close-button" title="Close Tab" src="./img/x.svg">' : ''}
          <div class="title">
            <span class="title-text">${titleContent} </span>
            ${badgesHTML}
          </div>
          <div class="url" title="${escapeHtml(resultEntry.url || '')}">${urlContent}</div>
        </li>
      `)
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
