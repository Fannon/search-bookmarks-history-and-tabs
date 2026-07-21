/**
 * @file Render helpers for the bookmark manager overview panel.
 */

import { escapeHtml } from '../helper/utils.js'
import { t } from '../helper/i18n.js'
import { formatDecimal, formatInteger, renderBookmarkListItem } from './bookmarkManagerRenderHelpers.js'

export const RECENT_BOOKMARKS_PER_PAGE = 20

export function renderStats(stats) {
  return [
    renderStat(
      t('lbl_stat_bookmarks', 'Bookmarks'),
      formatInteger(stats.bookmarkCount),
      t('lbl_stat_total_entries', 'Total bookmark entries'),
      '#bookmarks',
      'bookmark',
    ),
    renderStat(
      t('lbl_stat_duplicates', 'Duplicates'),
      formatInteger(stats.duplicateGroupCount),
      `${formatInteger(stats.removableDuplicateCount)} ${t('lbl_stat_removable_copies', 'removable copies')}`,
      '#duplicates',
      'duplicate',
    ),
    renderStat(
      t('lbl_stat_tagged', 'Tagged'),
      formatInteger(stats.taggedBookmarkCount),
      `${formatInteger(stats.untaggedBookmarkCount)} ${t('lbl_stat_without_tags', 'without tags')}`,
      '#tags',
      'tag',
      t('lbl_stat_manage_tags', 'Manage tags'),
    ),
    renderStat(
      t('lbl_stat_unique_tags', 'Unique Tags'),
      formatInteger(stats.uniqueTagCount),
      `${formatInteger(stats.tagAssignmentCount)} ${t('lbl_stat_tag_assignments', 'tag assignments')}`,
      '#tags',
      'tag',
      t('lbl_stat_manage_tags', 'Manage tags'),
    ),
    renderStat(
      t('lbl_stat_avg_tags', 'Avg Tags'),
      formatDecimal(stats.averageTagsPerBookmark),
      `${formatDecimal(stats.averageTagsPerTaggedBookmark)} ${t('lbl_stat_on_tagged', 'on tagged bookmarks')}`,
      '#tags',
      'tag',
      t('lbl_stat_manage_tags', 'Manage tags'),
    ),
    renderStat(
      t('lbl_stat_domains', 'Domains'),
      formatInteger(stats.uniqueDomainCount),
      t('lbl_stat_unique_hostnames', 'Unique URL hostnames'),
      undefined,
      'domain',
    ),
  ].join('')
}

export function renderTagSummary(stats) {
  if (!stats.uniqueTagCount) {
    return `<p>${t('empty_tags', 'No bookmark tags were found.')}</p>`
  }

  return `
    <p>${formatInteger(stats.uniqueTagCount)} ${t('desc_tag_summary', 'unique tags are assigned')} ${formatInteger(
      stats.tagAssignmentCount,
    )} ${t('desc_tag_summary_2', 'times across')} ${formatInteger(stats.taggedBookmarkCount)} ${t('desc_tag_summary_3', 'tagged bookmarks.')}</p>
  `
}

export function renderTopList(items, emptyText, createHref) {
  if (!items.length) {
    return `<p class="empty-state">${escapeHtml(emptyText)}</p>`
  }

  return `
    <ol class="rank-list">
      ${items.map((item) => renderTopListItem(item, createHref)).join('')}
    </ol>
  `
}

export function createDomainBookmarkHref(item) {
  const params = new URLSearchParams()
  params.set('folder', 'all')
  params.set('search', item.name)
  return `?${params.toString()}#bookmarks`
}

export function createTagManagerHref(item) {
  const params = new URLSearchParams()
  params.set('tag', item.name)
  return `?${params.toString()}#tags`
}

export function createFolderBookmarkHref(item) {
  const params = new URLSearchParams()
  params.set('folder', item.id || 'all')
  return `?${params.toString()}#bookmarks`
}

export function renderRecentBookmarks(bookmarks, requestedPage = 1) {
  const recentBookmarks = bookmarks
    .filter((bookmark) => Number.isFinite(bookmark.dateAdded))
    .sort((a, b) => b.dateAdded - a.dateAdded)

  if (!recentBookmarks.length) {
    return {
      html: `<p class="empty-state">${t('empty_date_metadata', 'No bookmark date metadata found.')}</p>`,
      page: 1,
    }
  }

  const pageCount = Math.ceil(recentBookmarks.length / RECENT_BOOKMARKS_PER_PAGE)
  const currentPage = clampRecentPage(requestedPage, pageCount)
  const startIndex = (currentPage - 1) * RECENT_BOOKMARKS_PER_PAGE
  const pageBookmarks = recentBookmarks.slice(startIndex, startIndex + RECENT_BOOKMARKS_PER_PAGE)

  return {
    html: `
      <ul class="bookmark-list recent-bookmark-list">
        ${pageBookmarks.map(renderBookmarkListItem).join('')}
      </ul>
      ${renderRecentPagination(currentPage, pageCount, recentBookmarks.length)}
    `,
    page: currentPage,
  }
}

function renderStat(label, value, detail, href, tone = '', title = '') {
  const tagName = href ? 'a' : 'article'
  const hrefAttribute = href ? ` href="${escapeHtml(href)}"` : ''
  const titleAttribute = href ? ` title="${escapeHtml(title || `Open ${label}`)}"` : ''
  const linkClass = href ? ' stat-link' : ''
  const toneClass = tone ? ` stat-${tone}` : ''

  return `
    <${tagName} class="stat${linkClass}${toneClass}"${hrefAttribute}${titleAttribute}>
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      <div class="stat-detail">${escapeHtml(detail)}</div>
    </${tagName}>
  `
}

function renderTopListItem(item, createHref) {
  const name = escapeHtml(item.name)
  const count = formatInteger(item.count)

  if (!createHref) {
    return `
      <li>
        <span class="rank-name">${name}</span>
        <span class="rank-count">${count}</span>
      </li>
    `
  }

  const href = createHref(item)
  return `
    <li>
      <a class="rank-link" href="${escapeHtml(href)}" title="Show bookmarks for ${name}">
        <span class="rank-name">${name}</span>
        <span class="rank-count">${count}</span>
      </a>
    </li>
  `
}

function renderRecentPagination(currentPage, pageCount, bookmarkCount) {
  if (pageCount <= 1) {
    return ''
  }

  const previousPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(pageCount, currentPage + 1)
  const start = (currentPage - 1) * RECENT_BOOKMARKS_PER_PAGE + 1
  const end = Math.min(bookmarkCount, currentPage * RECENT_BOOKMARKS_PER_PAGE)

  return `
    <div class="pagination">
      <button class="button" type="button" data-recent-page="${previousPage}"${currentPage === 1 ? ' disabled' : ''}>
        Previous
      </button>
      <span>${formatInteger(start)}-${formatInteger(end)} of ${formatInteger(bookmarkCount)}</span>
      <button class="button" type="button" data-recent-page="${nextPage}"${
        currentPage === pageCount ? ' disabled' : ''
      }>
        Next
      </button>
    </div>
  `
}

function clampRecentPage(page, pageCount) {
  return Math.min(pageCount, Math.max(1, page))
}
