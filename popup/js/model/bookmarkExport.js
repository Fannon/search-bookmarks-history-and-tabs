/**
 * @file Exports browser bookmarks in Netscape bookmark HTML format.
 */

/**
 * Create a browser-compatible bookmark export document.
 *
 * @param {Array<Object>} bookmarkTree Browser bookmark tree.
 * @param {number} [exportedAt=Date.now()] Export timestamp.
 * @returns {string} Netscape bookmark HTML.
 */
export function createBookmarkExportHtml(bookmarkTree = [], exportedAt = Date.now()) {
  const exportedAtSeconds = toUnixSeconds(exportedAt)
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ]

  for (let i = 0; i < bookmarkTree.length; i++) {
    appendBookmarkRoot(lines, bookmarkTree[i], exportedAtSeconds)
  }

  lines.push('</DL><p>', '')
  return lines.join('\r\n')
}

/**
 * Create a dated export filename.
 *
 * @param {Date} [date=new Date()] Export date.
 * @returns {string} Filename.
 */
export function createBookmarkExportFilename(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `bookmarks_${day}_${month}_${year}.html`
}

function appendBookmarkRoot(lines, node, fallbackDate) {
  if (!node?.children || node.title) {
    appendBookmarkNode(lines, node, 1, fallbackDate)
    return
  }

  for (let i = 0; i < node.children.length; i++) {
    appendBookmarkNode(lines, node.children[i], 1, fallbackDate)
  }
}

function appendBookmarkNode(lines, node, depth, fallbackDate) {
  if (!node) {
    return
  }

  if (node.url) {
    appendBookmark(lines, node, depth, fallbackDate)
    return
  }

  if (node.children) {
    if (!hasBookmarkDescendant(node)) {
      return
    }
    appendFolder(lines, node, depth, fallbackDate)
  }
}

function appendFolder(lines, folder, depth, fallbackDate) {
  const indent = getIndent(depth)
  const addDate = toUnixSeconds(folder.dateAdded, fallbackDate)
  const modifiedDate = toUnixSeconds(folder.dateGroupModified, addDate)
  const title = escapeBookmarkHtml(folder.title || 'Bookmarks')
  const attributes = [`ADD_DATE="${addDate}"`, `LAST_MODIFIED="${modifiedDate}"`]

  if (depth === 1 && isBookmarksBarFolder(folder)) {
    attributes.push('PERSONAL_TOOLBAR_FOLDER="true"')
  }

  lines.push(`${indent}<DT><H3 ${attributes.join(' ')}>${title}</H3>`)
  lines.push(`${indent}<DL><p>`)

  const children = folder.children || []
  for (let i = 0; i < children.length; i++) {
    appendBookmarkNode(lines, children[i], depth + 1, fallbackDate)
  }

  lines.push(`${indent}</DL><p>`)
}

function appendBookmark(lines, bookmark, depth, fallbackDate) {
  const indent = getIndent(depth)
  const addDate = toUnixSeconds(bookmark.dateAdded, fallbackDate)
  const url = escapeBookmarkHtml(bookmark.url)
  const title = escapeBookmarkHtml(bookmark.title || bookmark.url)

  lines.push(`${indent}<DT><A HREF="${url}" ADD_DATE="${addDate}">${title}</A>`)
}

function isBookmarksBarFolder(folder) {
  const id = String(folder.id || '').toLowerCase()
  const title = String(folder.title || '').toLowerCase()
  return id === 'toolbar_____' || id === '1' || title === 'bookmarks bar' || title === 'bookmarks toolbar'
}

function toUnixSeconds(timestamp, fallback = Date.now()) {
  const value = Number.isFinite(timestamp) ? timestamp : fallback
  const seconds = value > 100000000000 ? value / 1000 : value
  return Math.max(0, Math.floor(seconds))
}

function hasBookmarkDescendant(folder) {
  const children = folder.children || []

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child?.url) {
      return true
    }
    if (child?.children && hasBookmarkDescendant(child)) {
      return true
    }
  }

  return false
}

function getIndent(depth) {
  return '    '.repeat(depth)
}

const ESCAPE_HTML_RE = /[&<>"']/g

function escapeBookmarkHtml(value) {
  return String(value || '').replace(ESCAPE_HTML_RE, (character) => {
    if (character === '&') {
      return '&amp;'
    }
    if (character === '<') {
      return '&lt;'
    }
    if (character === '>') {
      return '&gt;'
    }
    if (character === '"') {
      return '&quot;'
    }
    return '&#39;'
  })
}
