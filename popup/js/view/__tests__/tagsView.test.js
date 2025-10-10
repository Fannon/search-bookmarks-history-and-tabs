/**
 * ✅ Covered behaviors: tags overview visibility, alphabetical ordering, and badge markup.
 * ⚠️ Known gaps: does not assert custom styling beyond default behaviour.
 * 🐞 Added BUG tests: none.
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
      '#search/#alpha',
      '#search/#beta',
      '#search/#release',
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
})
