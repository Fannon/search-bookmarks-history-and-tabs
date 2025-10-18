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

function setupExtWithBookmarks(bookmarks = []) {
  global.ext = {
    model: {
      bookmarks,
    },
    index: {
      taxonomy: {
        tags: {},
        folders: undefined,
      },
    },
  }
}

async function loadFoldersView({ bookmarks = [] } = {}) {
  jest.resetModules()
  setupExtWithBookmarks(bookmarks)

  const module = await import('../foldersView.js')

  return {
    module,
  }
}

describe('foldersView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    delete global.ext
  })

  it('renders sorted folder badges with counts and makes overview visible', async () => {
    setupDom()
    const bookmarks = [
      { originalId: '1', folder: '~Work ~Programming' },
      { originalId: '2', folder: '~Work ~Programming' },
      { originalId: '3', folder: '~Archive' },
    ]
    const { module } = await loadFoldersView({ bookmarks })

    module.loadFoldersOverview()

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges.map((el) => el.getAttribute('x-folder'))).toEqual(['Archive', 'Programming', 'Work'])
    expect(badges.map((el) => el.getAttribute('href'))).toEqual([
      './index.html#search/~Archive',
      './index.html#search/~Programming',
      './index.html#search/~Work',
    ])
    expect(badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      '~Archive (1)',
      '~Programming (2)',
      '~Work (2)',
    ])
  })

  it('renders an empty list when no folders exist', async () => {
    setupDom()
    const { module } = await loadFoldersView({
      bookmarks: [{ originalId: '1', folder: '' }],
    })

    module.loadFoldersOverview()

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)
    expect(document.querySelectorAll('#folders-list a.badge.folder')).toHaveLength(0)
  })

  it('handles malformed folder data gracefully', async () => {
    setupDom()
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const bookmarks = [
      { originalId: '1', folder: '~  ~~Valid Folder' },
      { originalId: '2', folder: '~Valid Folder' },
    ]
    const { module } = await loadFoldersView({ bookmarks })

    module.loadFoldersOverview()

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges).toHaveLength(1)
    const validBadge = badges[0]
    expect(validBadge.getAttribute('x-folder')).toBe('Valid Folder')
    expect(validBadge.textContent.replace(/\s+/g, ' ').trim()).toBe('~Valid Folder (2)')

    consoleWarnSpy.mockRestore()
  })

  it('handles large number of folders efficiently', async () => {
    setupDom()

    const bookmarks = Array.from({ length: 100 }, (_, idx) => ({
      originalId: `bookmark-${idx}`,
      folder: `~Folder ${idx}`,
    }))

    const { module } = await loadFoldersView({ bookmarks })

    const startTime = Date.now()
    module.loadFoldersOverview()
    const endTime = Date.now()

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges).toHaveLength(100)

    expect(endTime - startTime).toBeLessThan(100)
  })

  it('handles special characters in folder names', async () => {
    setupDom()
    const folders = ['Work & Projects', 'Personal/Archive', 'Test (2024)', 'Folder with "quotes"']
    const bookmarks = folders.map((folderName, index) => ({
      originalId: `bookmark-${index}`,
      folder: `~${folderName}`,
    }))
    const { module } = await loadFoldersView({ bookmarks })

    module.loadFoldersOverview()

    expect(document.getElementById('folders-overview').getAttribute('style')).toBe(null)

    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    expect(badges).toHaveLength(folders.length)

    const hrefs = badges.map((el) => el.getAttribute('href'))
    expect(hrefs).toEqual([
      './index.html#search/~Folder with "quotes"',
      './index.html#search/~Personal/Archive',
      './index.html#search/~Test (2024)',
      './index.html#search/~Work & Projects',
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
    const dangerousFolder = 'Danger<script>alert(1)</script>'
    const bookmarks = [{ originalId: 'bookmark-1', folder: `~${dangerousFolder}` }]
    const { module } = await loadFoldersView({ bookmarks })

    module.loadFoldersOverview()

    const badge = document.querySelector('#folders-list a.badge.folder')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe('~Danger<script>alert(1)</script> (1)')
    expect(badge.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
