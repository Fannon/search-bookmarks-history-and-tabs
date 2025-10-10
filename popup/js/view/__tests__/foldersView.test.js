/**
 * ✅ Covered behaviors: folders overview visibility, sorting, and badge rendering.
 * ⚠️ Known gaps: only exercises default styling; custom CSS classes are not asserted.
 * 🐞 Added BUG tests: none.
 */

import { jest } from '@jest/globals'

function setupDom() {
  document.body.innerHTML = `
    <section id="folders-overview" style="display:none"></section>
    <div id="folders-list"></div>
  `
}

async function loadFoldersView({ folders = {} } = {}) {
  jest.resetModules()

  const getUniqueFolders = jest.fn(() => folders)
  jest.unstable_mockModule('../../search/taxonomySearch.js', () => ({
    getUniqueFolders,
  }))

  const module = await import('../foldersView.js')

  return {
    module,
    mocks: {
      getUniqueFolders,
    },
  }
}

describe('foldersView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders sorted folder badges with counts and makes overview visible', async () => {
    setupDom()
    const folders = {
      Work: [{ id: 1 }, { id: 2 }],
      Archive: [{ id: 3 }],
      Personal: [{ id: 4 }, { id: 5 }, { id: 6 }],
    }
    const { module, mocks } = await loadFoldersView({ folders })

    module.loadFoldersOverview()

    expect(mocks.getUniqueFolders).toHaveBeenCalledTimes(1)
    expect(document.getElementById('folders-overview').getAttribute('style')).toBe('')
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges.map((el) => el.getAttribute('x-folder'))).toEqual(['Archive', 'Personal', 'Work'])
    expect(badges.map((el) => el.getAttribute('href'))).toEqual([
      '#search/~Archive',
      '#search/~Personal',
      '#search/~Work',
    ])
    expect(badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      '~Archive (1)',
      '~Personal (3)',
      '~Work (2)',
    ])
  })

  it('renders an empty list when no folders exist', async () => {
    setupDom()
    const { module } = await loadFoldersView({ folders: {} })

    module.loadFoldersOverview()

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe('')
    expect(document.querySelectorAll('#folders-list a.badge.folder')).toHaveLength(0)
  })
})
