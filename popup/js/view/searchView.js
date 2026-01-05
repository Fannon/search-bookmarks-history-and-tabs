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

    // Pre-calculate type-based colors once
    const typeColors = {}
    for (const t of ['bookmark', 'tab', 'history', 'search', 'customSearch', 'direct']) {
      typeColors[t] = escapeHtml(String(opts[`${t}Color`] || ''))
    }

    const createBadge = (content, title, extraClass = '', extraLink = '', extraStyle = '') =>
      `<span class="badge ${extraClass}"${title ? ` title="${escapeHtml(title)}"` : ''}${extraLink ? ` x-link="${escapeHtml(extraLink)}"` : ''}${extraStyle ? ` style="${extraStyle}"` : ''}>${content}</span>`

    // Pre-render static badges
    const BADGE_DUPLICATE = createBadge('Duplicate', 'Duplicate Bookmark', 'duplicate')
    const bookmarkBaseColorStyle = opts.bookmarkColor ? `background-color: ${typeColors.bookmark}` : ''

    const resultLen = result.length
    for (let i = 0; i < resultLen; i++) {
      const entry = result[i]
      if (!entry) continue

      const badges = []
      const type = entry.type || ''
      if (entry.dupe) badges.push(BADGE_DUPLICATE)

      const tagsArray = entry.tagsArray
      if (opts.displayTags && tagsArray) {
        const highlightedTags = entry.highlightedTagsArray
        for (let j = 0; j < tagsArray.length; j++) {
          const tag = tagsArray[j]
          const content = shouldHighlight && highlightedTags?.[j] ? highlightedTags[j] : `#${escapeHtml(tag)}`
          badges.push(createBadge(content, 'Bookmark Tags', 'tags', `#search/#${encodeURIComponent(tag)}%20%20`))
        }
      }

      const folderArray = entry.folderArray
      if (opts.displayFolderName && folderArray) {
        const highlightedFolders = entry.highlightedFolderArray
        let trail = ''
        for (let j = 0; j < folderArray.length; j++) {
          trail += (j === 0 ? '' : ' ~') + folderArray[j]
          const folder = folderArray[j]
          const content = shouldHighlight && highlightedFolders?.[j] ? highlightedFolders[j] : `~${escapeHtml(folder)}`
          badges.push(
            createBadge(
              content,
              'Bookmark Folder',
              'folder',
              `#search/~${encodeURIComponent(trail)}%20%20`,
              bookmarkBaseColorStyle,
            ),
          )
        }
      }

      const group = entry.group
      if (opts.displayTabGroup && group) {
        const content = shouldHighlight && entry.highlightedGroup ? entry.highlightedGroup : `@${escapeHtml(group)}`
        badges.push(
          createBadge(
            content,
            'Tab Group',
            'group',
            `#search/@${encodeURIComponent(group)}%20%20`,
            'background-color: #6a4fbb',
          ),
        )
      }

      if (opts.displayLastVisit && entry.lastVisitSecondsAgo != null) {
        badges.push(
          createBadge(
            `-${escapeHtml(timeSince(Date.now() - entry.lastVisitSecondsAgo * 1000))}`,
            'Last Visited',
            'last-visited',
          ),
        )
      }
      if (opts.displayVisitCounter && entry.visitCount !== undefined) {
        badges.push(createBadge(escapeHtml(String(entry.visitCount)), 'Visited Counter', 'visit-counter'))
      }
      if (opts.displayDateAdded && entry.dateAdded) {
        const dateStr = new Date(entry.dateAdded).toISOString().substring(0, 10)
        badges.push(createBadge(escapeHtml(dateStr), 'Date Added', 'date-added'))
      }
      if (opts.displayScore && entry.score) {
        badges.push(createBadge(escapeHtml(String(Math.round(entry.score))), 'Score', 'score'))
      }

      const title =
        shouldHighlight && entry.highlightedTitle ? entry.highlightedTitle : escapeHtml(entry.title || entry.url || '')
      const url = shouldHighlight && entry.highlightedUrl ? entry.highlightedUrl : escapeHtml(entry.url || '')

      let colorStyle = `border-left-color: ${typeColors[type] || ''}`
      if (type === 'bookmark' && entry.tab) {
        // Use a vertical gradient as indicator for "both bookmark and tab"
        // background-origin: border-box is used to ensure the gradient fills the border area
        colorStyle = `border-left-color: transparent; background-image: linear-gradient(to bottom, ${typeColors.bookmark} 0%, ${typeColors.bookmark} 20%, ${typeColors.tab} 80%, ${typeColors.tab} 100%); background-size: 4px 100%; background-repeat: no-repeat; background-origin: border-box;`
      }

      const originalUrl = entry.originalUrl ? ` x-open-url="${escapeHtml(entry.originalUrl)}"` : ''
      const originalId =
        entry.originalId !== undefined ? ` x-original-id="${escapeHtml(String(entry.originalId))}"` : ''

      // Build favicon HTML if enabled
      let faviconHtml = ''
      if (opts.displayFavicon) {
        // Calculate DDG fallback URL
        let fallbackUrl = ''
        if (opts.displayFaviconFallback && entry.url?.startsWith('http')) {
          try {
            const url = new URL(entry.originalUrl || entry.url)
            fallbackUrl = `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`
          } catch (_e) {
            /* ignore */
          }
        }

        const primaryUrl = entry.favIconUrl || fallbackUrl

        // Always render the img tag to maintain layout alignment.
        // If no URL is available initially, it will just show the type-specific background icon from CSS.
        // We use a 1x1 transparent spacer as initial src to avoid broken icon symbols in some browsers.
        const initialSrc =
          primaryUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

        // Note: No inline onload or onerror here! They violate CSP.
        // Events are handled via delegation in searchEvents.js using capturing listeners.
        faviconHtml = `
          <span class="favicon-col">
            <img class="favicon" src="${escapeHtml(initialSrc)}" alt="" data-fallback="${escapeHtml(fallbackUrl)}">
          </span>`
      }

      itemsHTML.push(
        `<li class="${escapeHtml(type)}"${originalUrl} x-index="${i}"${originalId} style="${colorStyle}">${type === 'bookmark' ? `<img class="edit" x-link="./editBookmark.html#bookmark/${encodeURIComponent(entry.originalId)}${searchTermSuffix}" title="Edit Bookmark" src="./img/edit.svg">` : ''}${type === 'tab' ? '<img class="close" title="Close Tab" src="./img/x.svg">' : ''}<div class="title">${faviconHtml}<span class="title-text">${title} </span>${badges.join('')}</div><div class="url" title="${escapeHtml(entry.url || '')}">${url}</div></li>`,
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
