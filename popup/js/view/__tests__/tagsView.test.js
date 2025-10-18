/**
 * ✅ Covered behaviors: tags overview visibility, alphabetical ordering, badge markup, and error handling.
 * ⚠️ Known gaps: styling assertions, performance with large datasets.
 * 🐞 Added BUG tests: error handling for malformed tag data.
 */

import { jest } from '@jest/globals'

function setupDom() {
  document.body.innerHTML = `
    <section id="tags-overview"></section>
    <div id="tags-list"></div>
  `
}

function setupExtWithBookmarks(bookmarks = []) {
  global.ext = {
    model: {
      bookmarks,
    },
    index: {
      taxonomy: {
        tags: {},
        folders: {},
      },
    },
  }
}

async function loadTagsView({ bookmarks = [] } = {}) {
  jest.resetModules()
  setupExtWithBookmarks(bookmarks)

  const module = await import('../tagsView.js')

  return {
    module,
  }
}

describe('tagsView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    delete global.ext
  })

  it('renders sorted tag badges with counts and shows the overview', async () => {
    setupDom()
    const bookmarks = [
      { originalId: '1', tags: '#beta #alpha' },
      { originalId: '2', tags: '#alpha #release' },
      { originalId: '3', tags: '#release' },
    ]
    const { module } = await loadTagsView({ bookmarks })

    module.loadTagsOverview()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe(null)
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges.map((el) => el.getAttribute('x-tag'))).toEqual(['alpha', 'beta', 'release'])
    expect(badges.map((el) => el.getAttribute('href'))).toEqual([
      './index.html#search/#alpha',
      './index.html#search/#beta',
      './index.html#search/#release',
    ])
    expect(badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      '#alpha (2)',
      '#beta (1)',
      '#release (2)',
    ])
  })

  it('renders nothing when no tags are returned', async () => {
    setupDom()
    const { module } = await loadTagsView({
      bookmarks: [{ originalId: '1', tags: '' }],
    })

    module.loadTagsOverview()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe(null)
    expect(document.querySelectorAll('#tags-list a.badge.tags')).toHaveLength(0)
  })

  it('handles malformed tag data gracefully', async () => {
    setupDom()
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const bookmarks = [
      { originalId: '1', tags: '#  #valid-tag' },
      { originalId: '2', tags: '#valid-tag' },
    ]
    const { module } = await loadTagsView({ bookmarks })

    module.loadTagsOverview()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(1)
    expect(badges[0].getAttribute('x-tag')).toBe('valid-tag')
    expect(badges[0].textContent.replace(/\s+/g, ' ').trim()).toBe('#valid-tag (2)')

    consoleWarnSpy.mockRestore()
  })

  it('handles large number of tags efficiently', async () => {
    setupDom()

    const bookmarks = Array.from({ length: 100 }, (_, idx) => ({
      originalId: `bookmark-${idx}`,
      tags: `#tag${idx}`,
    }))

    const { module } = await loadTagsView({ bookmarks })

    const startTime = Date.now()
    module.loadTagsOverview()
    const endTime = Date.now()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(100)

    expect(endTime - startTime).toBeLessThan(100)
  })

  it('handles special characters in tag names', async () => {
    setupDom()
    const tags = [
      'tag with spaces',
      'tag-with-dashes',
      'tag_with_underscores',
      'tag.with.dots',
      'tag(with)parentheses',
    ]
    const bookmarks = tags.map((tagName, index) => ({
      originalId: `bookmark-${index}`,
      tags: `#${tagName}`,
    }))
    const { module } = await loadTagsView({ bookmarks })

    module.loadTagsOverview()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(tags.length)

    const hrefs = badges.map((el) => el.getAttribute('href'))
    expect(hrefs).toHaveLength(tags.length)

    const hrefStrings = hrefs.join(' ')
    for (const tag of tags) {
      expect(hrefStrings).toContain(tag)
    }
  })

  it('handles tags with unicode characters', async () => {
    setupDom()
    const tags = ['café', 'naïve', 'résumé', '日本語', '🚀']
    const bookmarks = tags.map((tagName, index) => ({
      originalId: `bookmark-${index}`,
      tags: `#${tagName}`,
    }))
    const { module } = await loadTagsView({ bookmarks })

    module.loadTagsOverview()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(tags.length)

    const hrefs = badges.map((el) => el.getAttribute('href'))
    expect(hrefs).toEqual([
      './index.html#search/#café',
      './index.html#search/#naïve',
      './index.html#search/#résumé',
      './index.html#search/#日本語',
      './index.html#search/#🚀',
    ])
  })

  it('escapes HTML content in tag names', async () => {
    setupDom()
    const dangerousTag = 'alpha<script>alert(1)</script>'
    const bookmarks = [{ originalId: 'bookmark-1', tags: `#${dangerousTag}` }]
    const { module } = await loadTagsView({ bookmarks })

    module.loadTagsOverview()

    const badge = document.querySelector('#tags-list a.badge.tags')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe('#alpha<script>alert(1)</script> (1)')
    expect(badge.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
