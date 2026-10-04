import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  formatDecimal,
  formatInteger,
  renderBookmarkListItem,
  renderBookmarkTitle,
  renderDateBadge,
  renderFolderBadge,
  renderTagBadges,
  renderTrashIcon,
} from '../bookmarkManagerRenderHelpers.js'

describe('bookmark manager render helpers', () => {
  test('renders bookmark list items with escaped fields and metadata badges', () => {
    const html = renderBookmarkListItem({
      originalId: 'bookmark-1',
      title: 'Docs <Guide>',
      originalUrl: 'https://example.test/?q=<script>',
      folderArray: ['Dev', 'Docs & APIs'],
      tagsArray: ['api', 'xss<tag>'],
      dateAdded: Date.UTC(2024, 0, 2, 12),
    })
    assert(html.includes('data-open-managed-bookmark-id="bookmark-1"'))
    assert(html.includes('x-open-url="https://example.test/?q=&lt;script&gt;"'))
    assert(html.includes('Docs &lt;Guide&gt;'))
    assert(html.includes('~Dev / Docs &amp; APIs'))
    assert(html.includes('#xss&lt;tag&gt;'))
    assert(html.includes('Jan 2, 2024'))
    assert(!html.includes('<Guide>'))
    assert(!html.includes('<script>'))
  })
  test('renders safe title links only for http and https URLs', () => {
    assert.strictEqual(
      renderBookmarkTitle({ title: 'Safe', originalUrl: 'https://example.test' }),
      '<a href="https://example.test" target="_blank" rel="noreferrer">Safe</a>',
    )
    assert(
      renderBookmarkTitle({ title: 'Also safe', originalUrl: 'http://example.test' }).includes(
        'href="http://example.test"',
      ),
    )
    assert.strictEqual(renderBookmarkTitle({ title: 'Unsafe', originalUrl: 'javascript:alert(1)' }), 'Unsafe')
    assert.strictEqual(renderBookmarkTitle({ title: 'Browser URL', originalUrl: 'chrome://bookmarks' }), 'Browser URL')
    assert.strictEqual(renderBookmarkTitle({ title: '<Unsafe>', originalUrl: 'javascript:alert(1)' }), '&lt;Unsafe&gt;')
  })
  test('escapes accessible link labels and keeps unsafe URLs unlinked', () => {
    const bookmark = { title: '↗', originalUrl: 'https://example.test' }
    assert(
      renderBookmarkTitle(bookmark, 'Open "Docs" <Guide>').includes('aria-label="Open &quot;Docs&quot; &lt;Guide&gt;"'),
    )
    assert.strictEqual(renderBookmarkTitle({ ...bookmark, originalUrl: 'javascript:alert(1)' }, 'Open'), '↗')
  })
  test('renders folder, tag, date, icon, and number helpers', () => {
    assert(renderFolderBadge([]).includes('~Root'))
    assert(renderFolderBadge(['Bookmarks', 'Docs'], 'active').includes('folder active'))
    assert(renderFolderBadge(['Bookmarks', 'Docs'], 'active').includes('~Bookmarks / Docs'))
    assert.strictEqual(renderTagBadges([]), '')
    assert(renderTagBadges(['one', 'two & three']).includes('#two &amp; three'))
    assert(renderDateBadge(undefined).includes('No date'))
    assert(renderDateBadge(Date.UTC(2024, 4, 9, 12)).includes('May 9, 2024'))
    assert(renderTrashIcon().includes('aria-hidden="true"'))
    assert.strictEqual(formatInteger(12345), '12,345')
    assert.strictEqual(formatDecimal(1234.56), '1,234.6')
  })
})
