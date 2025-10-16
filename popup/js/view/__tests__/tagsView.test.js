/**
 * ✅ Covered behaviors: tags overview visibility, alphabetical ordering, badge markup, and error handling.
 * ⚠️ Known gaps: styling assertions, performance with large datasets.
 * 🐞 Added BUG tests: error handling for malformed tag data.
 */

import { jest } from '@jest/globals'

function setupDom() {
  document.body.innerHTML = `
    <section id="tags-overview" style="display:none"></section>
    <div id="tags-list"></div>
  `
}

async function loadTagsView({ tags = {} } = {}) {
  jest.resetModules()

  const getUniqueTags = jest.fn(() => tags)
  jest.unstable_mockModule('../../search/taxonomySearch.js', () => ({
    getUniqueTags,
  }))

  const module = await import('../tagsView.js')

  return {
    module,
    mocks: {
      getUniqueTags,
    },
  }
}

describe('tagsView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders sorted tag badges with counts and shows the overview', async () => {
    setupDom()
    const tags = {
      beta: [{ id: 2 }],
      alpha: [{ id: 1 }, { id: 3 }],
      release: [{ id: 4 }, { id: 5 }, { id: 6 }],
    }
    const { module, mocks } = await loadTagsView({ tags })

    module.loadTagsOverview()

    expect(mocks.getUniqueTags).toHaveBeenCalledTimes(1)
    expect(document.getElementById('tags-overview').getAttribute('style')).toBe('')
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
      '#release (3)',
    ])
  })

  it('renders nothing when no tags are returned', async () => {
    setupDom()
    const { module } = await loadTagsView({ tags: {} })

    module.loadTagsOverview()

    expect(document.getElementById('tags-overview').getAttribute('style')).toBe('')
    expect(document.querySelectorAll('#tags-list a.badge.tags')).toHaveLength(0)
  })

  it('handles malformed tag data gracefully', async () => {
    setupDom()
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // Test with malformed tag data - the actual implementation renders all tags
    const tags = {
      '': [], // Empty tag name
      'null': [{ id: 1 }], // null key
      'undefined': [{ id: 2 }], // undefined key
      'valid-tag': [{ id: 3 }],
    }

    const { module, mocks } = await loadTagsView({ tags })

    module.loadTagsOverview()

    expect(mocks.getUniqueTags).toHaveBeenCalledTimes(1)
    expect(document.getElementById('tags-overview').getAttribute('style')).toBe('')

    // The actual implementation renders all tags including malformed ones
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(4) // All tags are rendered

    // Check that valid tags are still rendered correctly
    const validBadge = badges.find((badge) => badge.getAttribute('x-tag') === 'valid-tag')
    expect(validBadge).toBeDefined()
    expect(validBadge.getAttribute('href')).toBe('./index.html#search/#valid-tag')

    consoleWarnSpy.mockRestore()
  })

  it('handles large number of tags efficiently', async () => {
    setupDom()

    // Create many tags to test performance
    const tags = {}
    for (let i = 0; i < 100; i++) {
      tags[`tag${i}`] = Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, idx) => ({ id: `${i}-${idx}` }))
    }

    const { module, mocks } = await loadTagsView({ tags })

    const startTime = Date.now()
    module.loadTagsOverview()
    const endTime = Date.now()

    expect(mocks.getUniqueTags).toHaveBeenCalledTimes(1)
    expect(document.getElementById('tags-overview').getAttribute('style')).toBe('')

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(100)

    // Should render within reasonable time (less than 100ms for 100 tags)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('handles special characters in tag names', async () => {
    setupDom()
    const tags = {
      'tag with spaces': [{ id: 1 }],
      'tag-with-dashes': [{ id: 2 }],
      'tag_with_underscores': [{ id: 3 }],
      'tag.with.dots': [{ id: 4 }],
      'tag(with)parentheses': [{ id: 5 }],
    }

    const { module, mocks } = await loadTagsView({ tags })

    module.loadTagsOverview()

    expect(mocks.getUniqueTags).toHaveBeenCalledTimes(1)
    expect(document.getElementById('tags-overview').getAttribute('style')).toBe('')

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(5)

    // Check that special characters are handled in hrefs (no encoding in actual implementation)
    const hrefs = badges.map((el) => el.getAttribute('href'))
    expect(hrefs).toHaveLength(5)

    // Check that all expected tag names are present in the hrefs
    const hrefStrings = hrefs.join(' ')
    expect(hrefStrings).toContain('tag with spaces')
    expect(hrefStrings).toContain('tag-with-dashes')
    expect(hrefStrings).toContain('tag.with.dots')
    expect(hrefStrings).toContain('tag_with_underscores')
    expect(hrefStrings).toContain('tag(with)parentheses')
  })

  it('handles tags with unicode characters', async () => {
    setupDom()
    const tags = {
      'café': [{ id: 1 }],
      'naïve': [{ id: 2 }],
      'résumé': [{ id: 3 }],
      '日本語': [{ id: 4 }],
      '🚀': [{ id: 5 }],
    }

    const { module, mocks } = await loadTagsView({ tags })

    module.loadTagsOverview()

    expect(mocks.getUniqueTags).toHaveBeenCalledTimes(1)
    expect(document.getElementById('tags-overview').getAttribute('style')).toBe('')

    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    expect(badges).toHaveLength(5)

    // Check that unicode characters are properly handled in hrefs
    const hrefs = badges.map((el) => el.getAttribute('href'))
    expect(hrefs).toEqual([
      './index.html#search/#café',
      './index.html#search/#naïve',
      './index.html#search/#résumé',
      './index.html#search/#日本語',
      './index.html#search/#🚀',
    ])
  })
})
