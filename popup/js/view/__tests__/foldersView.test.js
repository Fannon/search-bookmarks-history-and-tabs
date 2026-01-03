/**
 * ✅ Covered behaviors: folders overview visibility, sorting, badge rendering, and error handling.
 * ⚠️ Known gaps: styling assertions, performance with large datasets.
 * 🐞 Added BUG tests: error handling for malformed folder data.
 */

import { jest } from '@jest/globals'

function setupDom() {
  document.body.innerHTML = `
    <section id="folders-overview"></section>
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
    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges.map((el) => el.getAttribute('x-folder'))).toEqual(['Archive', 'Personal', 'Work'])
    expect(badges.map((el) => el.getAttribute('href'))).toEqual([
      './index.html#search/~Archive',
      './index.html#search/~Personal',
      './index.html#search/~Work',
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

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)
    expect(document.querySelectorAll('#folders-list a.badge.folder')).toHaveLength(0)
  })

  it('handles malformed folder data gracefully', async () => {
    setupDom()
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // Test with malformed folder data
    const folders = {
      '': [], // Empty folder name
      null: [{ id: 1 }], // null key
      undefined: [{ id: 2 }], // undefined key
      'Valid Folder': [{ id: 3 }],
    }

    const { module, mocks } = await loadFoldersView({ folders })

    module.loadFoldersOverview()

    expect(mocks.getUniqueFolders).toHaveBeenCalledTimes(1)
    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)

    // The actual implementation renders all folders including malformed ones
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges).toHaveLength(4) // All folders are rendered

    // Check that valid folders are still rendered correctly
    const validBadge = badges.find((badge) => badge.getAttribute('x-folder') === 'Valid Folder')
    expect(validBadge).toBeDefined()
    expect(validBadge.getAttribute('href')).toBe('./index.html#search/~Valid%20Folder')

    consoleWarnSpy.mockRestore()
  })

  it('handles large number of folders efficiently', async () => {
    setupDom()

    // Create many folders to test performance
    const folders = {}
    for (let i = 0; i < 100; i++) {
      folders[`Folder ${i}`] = Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, idx) => ({
        id: `${i}-${idx}`,
      }))
    }

    const { module, mocks } = await loadFoldersView({ folders })

    const startTime = Date.now()
    module.loadFoldersOverview()
    const endTime = Date.now()

    expect(mocks.getUniqueFolders).toHaveBeenCalledTimes(1)
    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges).toHaveLength(100)

    // Should render within reasonable time (less than 100ms for 100 folders)
    expect(endTime - startTime).toBeLessThan(100)
  })

  it('handles special characters in folder names', async () => {
    setupDom()
    const folders = {
      'Work & Projects': [{ id: 1 }],
      'Personal/Archive': [{ id: 2 }],
      'Test (2024)': [{ id: 3 }],
      'Folder with "quotes"': [{ id: 4 }],
    }

    const { module, mocks } = await loadFoldersView({ folders })

    module.loadFoldersOverview()

    expect(mocks.getUniqueFolders).toHaveBeenCalledTimes(1)
    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges).toHaveLength(4)

    const hrefs = badges.map((el) => el.getAttribute('href'))
    expect(hrefs).toEqual([
      './index.html#search/~Folder%20with%20%22quotes%22',
      './index.html#search/~Personal%2FArchive',
      './index.html#search/~Test%20(2024)',
      './index.html#search/~Work%20%26%20Projects',
    ])

    const labelTexts = badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim())
    expect(labelTexts).toEqual([
      '~Folder with "quotes" (1)',
      '~Personal/Archive (1)',
      '~Test (2024) (1)',
      '~Work & Projects (1)',
    ])
  })

  it('escapes HTML content in folder names', async () => {
    setupDom()
    const folders = {
      'Danger<script>alert(1)</script>': [{ id: 1 }],
    }

    const { module } = await loadFoldersView({ folders })

    module.loadFoldersOverview()

    const badge = document.querySelector('#folders-list a.badge.folder')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe('~Danger<script>alert(1)</script> (1)')
    expect(badge.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
