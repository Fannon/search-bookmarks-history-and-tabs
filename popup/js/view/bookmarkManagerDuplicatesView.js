/**
 * @file Render helpers for the bookmark manager duplicates panel.
 */

import { escapeHtml } from '../helper/utils.js'
import { t } from '../helper/i18n.js'
import {
  formatInteger,
  renderBookmarkTitle,
  renderDateBadge,
  renderFolderBadge,
  renderTagBadges,
  renderTrashIcon,
} from './bookmarkManagerRenderHelpers.js'

export function renderDuplicateSummary(stats) {
  if (!stats.duplicateGroupCount) {
    return `<p>${t('empty_duplicates', 'No duplicate bookmark URLs were found.')}</p>`
  }

  return `
    <p>${formatInteger(stats.duplicateBookmarkCount)} ${t('desc_duplicates_summary', 'bookmarks share URLs in')} ${formatInteger(
      stats.duplicateGroupCount,
    )} ${t('desc_duplicates_summary_2', 'groups. Ranking prefers more tags, cleaner titles, newer additions, then deeper folder placement. ')}${formatInteger(
      stats.removableDuplicateCount,
    )}${t('desc_duplicates_summary_3', ' lower-ranked copies can be selected for deletion.')}</p>
  `
}

export function renderDuplicates(duplicateGroups, canModifyBookmarks) {
  if (!duplicateGroups.length) {
    return `<p class="empty-state">${t('empty_duplicates', 'No duplicate bookmark URLs were found.')}</p>`
  }

  const deleteNotice = canModifyBookmarks
    ? ''
    : `<p class="manager-note">${t('notice_deletion_unavailable', 'Bookmark deletion is unavailable in this preview context.')}</p>`

  return `${deleteNotice}${duplicateGroups.map((group) => renderDuplicateGroup(group, canModifyBookmarks)).join('')}`
}

function renderDuplicateGroup(group, canModifyBookmarks) {
  return `
    <section class="duplicate-group" data-duplicate-group>
      <header class="duplicate-header">
        <div>
          <h3>${escapeHtml(group.displayUrl)}</h3>
          <p>${formatInteger(group.count)} bookmarks with the same normalized URL</p>
        </div>
        <button class="text-button" type="button" data-select-group${canModifyBookmarks ? '' : ' disabled'}>Select lower-ranked copies</button>
      </header>
      <ul class="duplicate-bookmarks">
        ${group.bookmarks.map((bookmark) => renderDuplicateBookmark(group, bookmark, canModifyBookmarks)).join('')}
      </ul>
    </section>
  `
}

function renderDuplicateBookmark(group, bookmark, canModifyBookmarks) {
  const bookmarkId = String(bookmark.originalId)
  const isKeep = bookmarkId === group.keepId
  const disabled = canModifyBookmarks ? '' : ' disabled'
  const checked = isKeep ? '' : ' checked'
  const deleteTitle = canModifyBookmarks ? 'Delete this bookmark' : 'Bookmark deletion is unavailable in this context'

  return `
    <li class="duplicate-bookmark${isKeep ? ' keep-bookmark' : ''}">
      <div class="duplicate-details">
        ${renderDuplicateSuggestion(bookmark)}
        <div class="bookmark-title">${renderBookmarkTitle(bookmark)}</div>
        <div class="bookmark-meta">
          ${renderFolderBadge(bookmark.folderArray, 'duplicate-folder')}
          ${renderDateBadge(bookmark.dateAdded)}
          ${renderTagBadges(bookmark.tagsArray)}
        </div>
        <div class="bookmark-url">${escapeHtml(bookmark.originalUrl || bookmark.url)}</div>
      </div>
      <div class="duplicate-row-actions">
        <label class="duplicate-bulk-delete">
          <input type="checkbox" data-delete-bookmark-id="${escapeHtml(bookmarkId)}"${checked}${disabled}>
          <span>Select</span>
        </label>
        <button class="button danger duplicate-delete-button" type="button" data-delete-single-bookmark-id="${escapeHtml(
          bookmarkId,
        )}" title="${escapeHtml(deleteTitle)}"${disabled}>
          ${renderTrashIcon()}
          <span>Delete</span>
        </button>
      </div>
    </li>
  `
}

function renderDuplicateSuggestion(bookmark) {
  const suggestion = bookmark.duplicateSuggestion
  if (!suggestion) {
    return ''
  }

  const suggestionClass = suggestion.recommended ? 'suggestion-best' : 'suggestion-copy'

  return `
    <div class="duplicate-suggestion">
      <span class="badge ${suggestionClass}">${escapeHtml(suggestion.label)}</span>
      <span>${escapeHtml(suggestion.detail)}</span>
    </div>
  `
}
