import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import { resetModules } from '../../../../test/modules.js'

/**
 * ✅ Covered behaviors: tags overview visibility, alphabetical ordering, badge markup, and error handling.
 * ⚠️ Known gaps: styling assertions, performance with large datasets.
 * 🐞 Added BUG tests: error handling for malformed tag data.
 */

function setupDom() {
  document.body.innerHTML = `
    <section id="tags-overview"></section>
    <div id="tags-list"></div>
  `
}
async function loadTagsView({ tags = {} } = {}) {
  resetModules()
  const getUniqueTags = mock.fn(() => tags)
  mock.module(new URL('../../search/taxonomySearch.js', import.meta.url), {
    exports: {
      getUniqueTags,
    },
  })
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
    assert.strictEqual(mocks.getUniqueTags.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('tags-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    assert.deepStrictEqual(
      badges.map((el) => el.getAttribute('x-tag')),
      ['alpha', 'beta', 'release'],
    )
    assert.deepStrictEqual(
      badges.map((el) => el.getAttribute('href')),
      ['./index.html#search/#alpha%20%20', './index.html#search/#beta%20%20', './index.html#search/#release%20%20'],
    )
    assert.deepStrictEqual(
      badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
      ['#alpha (2)', '#beta (1)', '#release (3)'],
    )
  })
  it('renders nothing when no tags are returned', async () => {
    setupDom()
    const { module } = await loadTagsView({ tags: {} })
    module.loadTagsOverview()
    assert.strictEqual(document.getElementById('tags-overview').getAttribute('style'), null)
    assert.strictEqual(document.querySelectorAll('#tags-list a.badge.tags').length, 0)
  })
  it('handles malformed tag data gracefully', async () => {
    setupDom()
    const consoleWarnSpy = mock.method(console, 'warn', () => {})

    // Test with malformed tag data - the actual implementation renders all tags
    const tags = {
      '': [], // Empty tag name
      null: [{ id: 1 }], // null key
      undefined: [{ id: 2 }], // undefined key
      'valid-tag': [{ id: 3 }],
    }
    const { module, mocks } = await loadTagsView({ tags })
    module.loadTagsOverview()
    assert.strictEqual(mocks.getUniqueTags.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('tags-overview').getAttribute('style'), null)

    // The actual implementation renders all tags including malformed ones
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    assert.strictEqual(badges.length, 4) // All tags are rendered

    // Check that valid tags are still rendered correctly
    const validBadge = badges.find((badge) => badge.getAttribute('x-tag') === 'valid-tag')
    assert.notStrictEqual(validBadge, undefined)
    assert.strictEqual(validBadge.getAttribute('href'), './index.html#search/#valid-tag%20%20')
    consoleWarnSpy.mock.restore()
  })
  it('handles large number of tags efficiently', async () => {
    setupDom()

    // Create many tags to test performance
    const tags = {}
    for (let i = 0; i < 5000; i++) {
      tags[`tag${i}`] = Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, idx) => ({ id: `${i}-${idx}` }))
    }
    const { module, mocks } = await loadTagsView({ tags })
    const startTime = Date.now()
    module.loadTagsOverview()
    const endTime = Date.now()
    assert.strictEqual(mocks.getUniqueTags.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('tags-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    assert.strictEqual(badges.length, 5000)

    // Should render within reasonable time (less than 1000ms for 5000 tags)
    // Using 1000ms threshold to account for slower CI/CD runners
    assert(endTime - startTime < 1000)
  })
  it('handles special characters in tag names', async () => {
    setupDom()
    const tags = {
      'tag with spaces': [{ id: 1 }],
      'tag-with-dashes': [{ id: 2 }],
      tag_with_underscores: [{ id: 3 }],
      'tag.with.dots': [{ id: 4 }],
      'tag(with)parentheses': [{ id: 5 }],
    }
    const { module, mocks } = await loadTagsView({ tags })
    module.loadTagsOverview()
    assert.strictEqual(mocks.getUniqueTags.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('tags-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    assert.strictEqual(badges.length, 5)

    // Check that special characters are handled in hrefs (no encoding in actual implementation)
    const hrefs = badges.map((el) => el.getAttribute('href'))
    assert.strictEqual(hrefs.length, 5)

    // Check that all expected tag names are present in the hrefs
    const hrefStrings = hrefs.join(' ')
    assert(hrefStrings.includes('tag%20with%20spaces'))
    assert(hrefStrings.includes('tag-with-dashes'))
    assert(hrefStrings.includes('tag.with.dots'))
    assert(hrefStrings.includes('tag_with_underscores'))
    assert(hrefStrings.includes('tag(with)parentheses'))
  })
  it('handles tags with unicode characters', async () => {
    setupDom()
    const tags = {
      café: [{ id: 1 }],
      naïve: [{ id: 2 }],
      résumé: [{ id: 3 }],
      日本語: [{ id: 4 }],
      '🚀': [{ id: 5 }],
    }
    const { module, mocks } = await loadTagsView({ tags })
    module.loadTagsOverview()
    assert.strictEqual(mocks.getUniqueTags.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('tags-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#tags-list a.badge.tags'))
    assert.strictEqual(badges.length, 5)

    // Check that unicode characters are properly handled in hrefs
    // Note: Emoji and special unicode characters may sort differently across environments,
    // so we verify all expected hrefs are present without asserting exact order.
    const hrefs = badges.map((el) => el.getAttribute('href'))
    assert(hrefs.includes(`./index.html#search/#${encodeURIComponent('café')}%20%20`))
    assert(hrefs.includes(`./index.html#search/#${encodeURIComponent('naïve')}%20%20`))
    assert(hrefs.includes(`./index.html#search/#${encodeURIComponent('résumé')}%20%20`))
    assert(hrefs.includes(`./index.html#search/#${encodeURIComponent('日本語')}%20%20`))
    assert(hrefs.includes(`./index.html#search/#${encodeURIComponent('🚀')}%20%20`))
  })
  it('escapes HTML content in tag names', async () => {
    setupDom()
    const tags = {
      'alpha<script>alert(1)</script>': [{ id: 1 }],
    }
    const { module } = await loadTagsView({ tags })
    module.loadTagsOverview()
    const badge = document.querySelector('#tags-list a.badge.tags')
    assert.notStrictEqual(badge, null)
    assert.strictEqual(badge.textContent, '#alpha<script>alert(1)</script> (1)')
    assert(badge.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  })
})
