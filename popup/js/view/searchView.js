/**
 * @file Renders search results in the popup UI.
 *
 * Responsibilities:
 * - Render bookmark/tab/history results with metadata badges, highlights, and contextual actions (open, close, copy, edit).
 * - Surface visit counts, taxonomy labels, and scoring hints to keep the UI aligned with search models.
 * - Coordinate with searchNavigation.js for selection management and searchEvents.js for event delegation.
 */

import { escapeHtml, timeSince } from '../helper/utils.js'
import { selectListItem } from './searchNavigation.js'
import { setupResultItemsEvents } from './searchEvents.js'
import { printError } from './errorView.js'

/**
 * Render the search results in UI as result items.
 * Always uses ext.model.result as the source of truth.
 */
export async function renderSearchResults() {
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

    // Prepare for rendering - disable hover until results are fully rendered
    ext.model.mouseHoverEnabled = false

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

    // Use DocumentFragment to batch DOM updates for smoother rendering
    const fragment = document.createDocumentFragment()
    const searchTermSuffix = `/search/${encodeURIComponent(searchTerm || '')}`

    for (let i = 0; i < result.length; i++) {
      const resultEntry = result[i]

      if (!resultEntry) {
        continue
      }

      let badgesHTML = ''

      if (resultEntry.type === 'bookmark' && resultEntry.tab) {
        badgesHTML += '<span class="badge source-tab" title="Open Tab">T</span>'
      }
      if (resultEntry.dupe) {
        badgesHTML += '<span class="badge duplicate" title="Duplicate Bookmark">Duplicate</span>'
      }

      if (opts.displayTags && resultEntry.tagsArray) {
        for (const tag of resultEntry.tagsArray) {
          const safeTag = escapeHtml(tag)
          badgesHTML += `<span class="badge tags" x-link="#search/#${safeTag}" title="Bookmark Tags">#${safeTag}</span>`
        }
      }

      if (opts.displayFolderName && resultEntry.folderArray) {
        const trail = []
        for (const folderName of resultEntry.folderArray) {
          trail.push(folderName)
          const folderLink = `#search/~${trail.join(' ~')}`
          const safeLink = escapeHtml(folderLink)
          const label = `~${folderName}`
          badgesHTML += `<span class="badge folder" x-link="${safeLink}" title="Bookmark Folder" style="background-color: ${escapeHtml(
            String(opts.bookmarkColor || 'none'),
          )}">${escapeHtml(label)}</span>`
        }
      }

      if (opts.displayLastVisit && resultEntry.lastVisitSecondsAgo != null) {
        const lastVisit = timeSince(new Date(Date.now() - resultEntry.lastVisitSecondsAgo * 1000))
        badgesHTML += `<span class="badge last-visited" title="Last Visited">-${escapeHtml(lastVisit)}</span>`
      }

      if (opts.displayVisitCounter && resultEntry.visitCount !== undefined) {
        badgesHTML += `<span class="badge visit-counter" title="Visited Counter">${escapeHtml(
          String(resultEntry.visitCount),
        )}</span>`
      }

      if (opts.displayDateAdded && resultEntry.dateAdded) {
        badgesHTML += `<span class="badge date-added" title="Date Added">${escapeHtml(
          new Date(resultEntry.dateAdded).toISOString().split('T')[0],
        )}</span>`
      }

      if (opts.displayScore && resultEntry.score) {
        badgesHTML += `<span class="badge score" title="Score">${escapeHtml(
          String(Math.round(resultEntry.score)),
        )}</span>`
      }

      const highlightCandidate =
        resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url || ''
      const titleContent =
        shouldHighlight && searchTerm && searchTerm.trim()
          ? // escape everything first, then allow only the `<mark>` tags that the highlighter inserts
            escapeHtml(highlightCandidate).replace(/&lt;(\/?)mark&gt;/gi, '<$1mark>')
          : escapeHtml(resultEntry.title || resultEntry.url || '')

      const urlContent =
        shouldHighlight && searchTerm && searchTerm.trim() && resultEntry.urlHighlighted
          ? // same approach for the URL snippet – keep highlight markup, escape everything else
            escapeHtml(resultEntry.urlHighlighted).replace(/&lt;(\/?)mark&gt;/gi, '<$1mark>')
          : escapeHtml(resultEntry.url || '')

      const typeClass = escapeHtml(resultEntry.type || '')
      const originalUrlAttr = resultEntry.originalUrl ? ` x-open-url="${escapeHtml(resultEntry.originalUrl)}"` : ''
      const originalIdAttr =
        resultEntry.originalId !== undefined ? ` x-original-id="${escapeHtml(String(resultEntry.originalId))}"` : ''
      const colorValue = escapeHtml(String(opts[resultEntry.type + 'Color']))

      const itemHTML = `
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
      `

      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = itemHTML
      const resultListItem = tempDiv.firstElementChild

      if (shouldHighlight && searchTerm && searchTerm.trim() && window.Mark) {
        if (!resultEntry.titleHighlighted || !resultEntry.urlHighlighted) {
          const mark = new window.Mark(resultListItem)
          mark.mark(searchTerm, {
            exclude: ['.last-visited', '.score', '.visit-counter', '.date-added'],
          })
        }
      }

      fragment.appendChild(resultListItem)
    }

    // Update the DOM with all new result items at once
    ext.dom.resultList.replaceChildren(fragment)

    // Update result counter
    if (ext.dom.resultCounter) {
      ext.dom.resultCounter.innerText = `(${result.length})`
    }

    // Highlight the first result as the current selection
    selectListItem(0)

    // Set up event delegation for better performance (one-time setup)
    setupResultItemsEvents()
  } catch (err) {
    // Re-enable mouse hover even if rendering fails to prevent permanent UI breakage
    ext.model.mouseHoverEnabled = true
    printError(err, 'Failed to render search results')
    // Re-throw to allow caller to handle if needed
    throw err
  }
}
