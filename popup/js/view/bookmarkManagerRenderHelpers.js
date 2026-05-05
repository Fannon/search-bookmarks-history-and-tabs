/**
 * @file Shared HTML render helpers for bookmark manager panels.
 */

import { escapeHtml } from '../helper/utils.js'

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function renderBookmarkListItem(bookmark) {
  const displayUrl = bookmark.originalUrl || bookmark.url || ''
  const bookmarkId = bookmark.originalId !== undefined ? String(bookmark.originalId) : ''
  const originalId = bookmarkId ? ` x-original-id="${escapeHtml(bookmarkId)}"` : ''
  const openBookmark = bookmarkId ? ` data-open-managed-bookmark-id="${escapeHtml(bookmarkId)}"` : ''
  const openUrl = displayUrl ? ` x-open-url="${escapeHtml(displayUrl)}"` : ''

  return `
    <li class="bookmark"${openUrl}${originalId}${openBookmark}>
      <div class="recent-bookmark-main">
        <div class="title">
          <span class="title-text">${renderBookmarkTitle(bookmark)} </span>
          ${renderDateBadge(bookmark.dateAdded)}
          ${renderFolderBadge(bookmark.folderArray)}
          ${renderTagBadges(bookmark.tagsArray)}
        </div>
        <div class="url" title="${escapeHtml(displayUrl)}">${escapeHtml(displayUrl)}</div>
      </div>
    </li>
  `
}

export function renderBookmarkTitle(bookmark) {
  const title = bookmark.title || bookmark.originalUrl || bookmark.url
  const url = bookmark.originalUrl || bookmark.url

  if (isSafeLinkUrl(url)) {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
  }

  return escapeHtml(title)
}

export function renderFolderBadge(folderArray, extraClass = '') {
  const folder = formatFolder(folderArray)
  return `<span class="badge folder ${extraClass}" title="Bookmark Folder">~${escapeHtml(folder)}</span>`
}

export function renderTagBadges(tags = []) {
  if (!tags.length) {
    return ''
  }

  return tags.map((tag) => `<span class="badge tags" title="Bookmark Tags">#${escapeHtml(tag)}</span>`).join('')
}

export function renderDateBadge(timestamp) {
  const text = Number.isFinite(timestamp) ? formatDate(timestamp) : 'No date'
  return `<span class="badge date-added" title="Date Added">${escapeHtml(text)}</span>`
}

export function renderTrashIcon() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  `
}

export function formatInteger(value) {
  return Number(value || 0).toLocaleString('en-US')
}

export function formatDecimal(value) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  })
}

function formatDate(timestamp) {
  return DATE_FORMATTER.format(new Date(timestamp))
}

function formatFolder(folderArray) {
  if (!folderArray || folderArray.length === 0) {
    return 'Root'
  }
  return folderArray.join(' / ')
}

function isSafeLinkUrl(url) {
  if (!url) {
    return false
  }

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch (_error) {
    return false
  }
}
