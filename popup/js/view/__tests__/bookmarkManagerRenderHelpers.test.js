import { describe, expect, test } from '@jest/globals'

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

    expect(html).toContain('data-open-managed-bookmark-id="bookmark-1"')
    expect(html).toContain('x-open-url="https://example.test/?q=&lt;script&gt;"')
    expect(html).toContain('Docs &lt;Guide&gt;')
    expect(html).toContain('~Dev / Docs &amp; APIs')
    expect(html).toContain('#xss&lt;tag&gt;')
    expect(html).toContain('Jan 2, 2024')
    expect(html).not.toContain('<Guide>')
    expect(html).not.toContain('<script>')
  })

  test('renders safe title links only for http and https URLs', () => {
    expect(renderBookmarkTitle({ title: 'Safe', originalUrl: 'https://example.test' })).toBe(
      '<a href="https://example.test" target="_blank" rel="noreferrer">Safe</a>',
    )
    expect(renderBookmarkTitle({ title: 'Also safe', originalUrl: 'http://example.test' })).toContain(
      'href="http://example.test"',
    )
    expect(renderBookmarkTitle({ title: 'Unsafe', originalUrl: 'javascript:alert(1)' })).toBe('Unsafe')
    expect(renderBookmarkTitle({ title: 'Browser URL', originalUrl: 'chrome://bookmarks' })).toBe('Browser URL')
    expect(renderBookmarkTitle({ title: '<Unsafe>', originalUrl: 'javascript:alert(1)' })).toBe('&lt;Unsafe&gt;')
  })

  test('renders folder, tag, date, icon, and number helpers', () => {
    expect(renderFolderBadge([])).toContain('~Root')
    expect(renderFolderBadge(['Bookmarks', 'Docs'], 'active')).toContain('folder active')
    expect(renderFolderBadge(['Bookmarks', 'Docs'], 'active')).toContain('~Bookmarks / Docs')

    expect(renderTagBadges([])).toBe('')
    expect(renderTagBadges(['one', 'two & three'])).toContain('#two &amp; three')

    expect(renderDateBadge(undefined)).toContain('No date')
    expect(renderDateBadge(Date.UTC(2024, 4, 9, 12))).toContain('May 9, 2024')

    expect(renderTrashIcon()).toContain('aria-hidden="true"')
    expect(formatInteger(12345)).toBe('12,345')
    expect(formatDecimal(1234.56)).toBe('1,234.6')
  })
})
