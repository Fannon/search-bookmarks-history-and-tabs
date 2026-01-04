import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// Mock dependencies
const mockGetUniqueGroups = jest.fn()
const mockRenderTaxonomy = jest.fn()

// Use unstable_mockModule for ESM mocking
jest.unstable_mockModule('../../search/taxonomySearch.js', () => ({
  getUniqueGroups: mockGetUniqueGroups,
}))

jest.unstable_mockModule('../taxonomyViewHelper.js', () => ({
  renderTaxonomy: mockRenderTaxonomy,
}))

// Import the module under test
// Note: We need to import it AFTER mocking
// But we also need to re-import it in tests if we want to reset module state?
// Actually loadGroupsOverview is an exported function, so we can just import it once.

describe('groupsView', () => {
  let loadGroupsOverview

  beforeEach(async () => {
    jest.clearAllMocks()
    document.body.innerHTML = '<div id="groups-list"></div>'

    // Mock global chrome object
    global.chrome = {
      permissions: {
        contains: jest.fn(),
      },
      tabGroups: {},
    }

    // Dynamic import to ensure mocks are applied
    const module = await import('../groupsView.js')
    loadGroupsOverview = module.loadGroupsOverview
  })

  test('renders warning when permission is missing', async () => {
    // specific behavior: if chrome.permissions.contains returns false
    global.chrome.permissions.contains.mockImplementation(({ permissions }, cb) => cb(false))
    // And tabGroups API is NOT available (mocking undefined would be hard on global, let's rely on permissions check flow)
    // Actually the code checks permissions.contains OR chrome.tabGroups presence as a fallback.
    // If we want to simulate missing permission, we should probably ensure both fail.

    // However, the code:
    // if (chrome.permissions && chrome.permissions.contains) { ... } else if (chrome.tabGroups) { hasPermission = true }
    // So if permissions.contains says false, it falls through to check chrome.tabGroups.
    // If chrome.tabGroups exists (which we mocked), it sets hasPermission = true!
    // So to test "Permission missing", strict check: we need chrome.tabGroups to be undefined?

    // Let's adjust mock for this specific test
    delete global.chrome.tabGroups

    await loadGroupsOverview()

    const container = document.getElementById('groups-list')
    expect(container.innerHTML).toContain('Permission missing')
    expect(mockGetUniqueGroups).not.toHaveBeenCalled()
  })

  test('fetches and renders groups when permissions are granted', async () => {
    // Mock permission granted
    global.chrome.permissions.contains.mockImplementation(({ permissions }, cb) => cb(true))
    global.chrome.tabGroups = {} // API exists

    const mockGroups = {
      'My Group': ['tab-1'],
    }
    mockGetUniqueGroups.mockResolvedValue(mockGroups)

    await loadGroupsOverview()

    expect(mockGetUniqueGroups).toHaveBeenCalled()
    expect(mockRenderTaxonomy).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: 'groups-list',
        items: mockGroups,
        marker: '@',
        itemClass: 'group',
      }),
    )
  })

  test('renders correctly when chrome.permissions API is missing but chrome.tabGroups exists', async () => {
    // Firefox might not have permissions API but might support tabGroups?
    // Or just a browser that exposes the API directly.
    delete global.chrome.permissions
    global.chrome.tabGroups = {}

    const mockGroups = { Work: ['t1'] }
    mockGetUniqueGroups.mockResolvedValue(mockGroups)

    await loadGroupsOverview()

    expect(mockGetUniqueGroups).toHaveBeenCalled()
    expect(mockRenderTaxonomy).toHaveBeenCalledWith(
      expect.objectContaining({
        items: mockGroups,
      }),
    )
  })

  test('does nothing if container is missing', async () => {
    document.body.innerHTML = '' // No container
    global.chrome.permissions.contains.mockImplementation((_, cb) => cb(true))

    await loadGroupsOverview()

    expect(mockGetUniqueGroups).not.toHaveBeenCalled()
  })
})
