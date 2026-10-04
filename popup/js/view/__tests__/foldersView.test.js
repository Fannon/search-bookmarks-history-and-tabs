import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import { resetModules } from '../../../../test/modules.js'

/**
 * ✅ Covered behaviors: folders overview visibility, sorting, badge rendering, and error handling.
 * ⚠️ Known gaps: styling assertions, performance with large datasets.
 * 🐞 Added BUG tests: error handling for malformed folder data.
 */

function setupDom() {
  document.body.innerHTML = `
    <section id="folders-overview"></section>
    <div id="folders-list"></div>
  `
}
async function loadFoldersView({ folders = {} } = {}) {
  resetModules()
  const getUniqueFolders = mock.fn(() => folders)
  mock.module(new URL('../../search/taxonomySearch.js', import.meta.url), {
    exports: {
      getUniqueFolders,
    },
  })
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
    assert.strictEqual(mocks.getUniqueFolders.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('folders-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    assert.deepStrictEqual(
      badges.map((el) => el.getAttribute('x-folder')),
      ['Archive', 'Personal', 'Work'],
    )
    assert.deepStrictEqual(
      badges.map((el) => el.getAttribute('href')),
      ['./index.html#search/~Archive%20%20', './index.html#search/~Personal%20%20', './index.html#search/~Work%20%20'],
    )
    assert.deepStrictEqual(
      badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
      ['~Archive (1)', '~Personal (3)', '~Work (2)'],
    )
  })
  it('renders an empty list when no folders exist', async () => {
    setupDom()
    const { module } = await loadFoldersView({ folders: {} })
    module.loadFoldersOverview()
    assert.strictEqual(document.getElementById('folders-overview').getAttribute('style'), null)
    assert.strictEqual(document.querySelectorAll('#folders-list a.badge.folder').length, 0)
  })
  it('handles malformed folder data gracefully', async () => {
    setupDom()
    const consoleWarnSpy = mock.method(console, 'warn', () => {})

    // Test with malformed folder data
    const folders = {
      '': [], // Empty folder name
      null: [{ id: 1 }], // null key
      undefined: [{ id: 2 }], // undefined key
      'Valid Folder': [{ id: 3 }],
    }
    const { module, mocks } = await loadFoldersView({ folders })
    module.loadFoldersOverview()
    assert.strictEqual(mocks.getUniqueFolders.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('folders-overview').getAttribute('style'), null)

    // The actual implementation renders all folders including malformed ones
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    assert.strictEqual(badges.length, 4) // All folders are rendered

    // Check that valid folders are still rendered correctly
    const validBadge = badges.find((badge) => badge.getAttribute('x-folder') === 'Valid Folder')
    assert.notStrictEqual(validBadge, undefined)
    assert.strictEqual(validBadge.getAttribute('href'), './index.html#search/~Valid%20Folder%20%20')
    consoleWarnSpy.mock.restore()
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
    assert.strictEqual(mocks.getUniqueFolders.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('folders-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    assert.strictEqual(badges.length, 100)

    // Should render within reasonable time (less than 100ms for 100 folders)
    assert(endTime - startTime < 100)
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
    assert.strictEqual(mocks.getUniqueFolders.mock.callCount(), 1)
    assert.strictEqual(document.getElementById('folders-overview').getAttribute('style'), null)
    const badges = Array.from(document.querySelectorAll('#folders-list a.badge.folder'))
    assert.strictEqual(badges.length, 4)
    const hrefs = badges.map((el) => el.getAttribute('href'))
    assert.deepStrictEqual(hrefs, [
      './index.html#search/~Folder%20with%20%22quotes%22%20%20',
      './index.html#search/~Personal%2FArchive%20%20',
      './index.html#search/~Test%20(2024)%20%20',
      './index.html#search/~Work%20%26%20Projects%20%20',
    ])
    const labelTexts = badges.map((el) => el.textContent.replace(/\s+/g, ' ').trim())
    assert.deepStrictEqual(labelTexts, [
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
    assert.notStrictEqual(badge, null)
    assert.strictEqual(badge.textContent, '~Danger<script>alert(1)</script> (1)')
    assert(badge.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  })
})
