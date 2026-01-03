import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import {
  browserApi,
  convertBrowserBookmarks,
  convertBrowserHistory,
  convertBrowserTabs,
  createSearchStringLower,
  getBrowserTabs,
  getTitle,
  shortenTitle,
} from '../browserApi.js'

const baseExtOptions = {
  tabsOnlyCurrentWindow: false,
  bookmarksIgnoreFolderList: [],
  historyIgnoreList: [],
  debug: false,
}

beforeEach(() => {
  globalThis.ext = { opts: { ...baseExtOptions } }
})

afterEach(() => {
  delete globalThis.ext
  jest.restoreAllMocks()
  delete browserApi.tabs
})

describe('getBrowserTabs', () => {
  it('filters out entries missing a usable url but includes all other URLs including extension URLs', async () => {
    const queryMock = jest.fn().mockResolvedValue([
      { id: 1, title: 'Internal tab' },
      { id: 2, url: '', title: 'Empty url' },
      { id: 3, url: 'chrome-extension://abcdef', title: 'Extension page' },
      { id: 4, url: 'https://example.com', title: 'Example' },
      { id: 5, url: 'moz-extension://xyz', title: 'Firefox extension' },
    ])

    browserApi.tabs = { query: queryMock }

    const result = await getBrowserTabs()

    expect(queryMock).toHaveBeenCalledWith({})
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ id: 3, url: 'chrome-extension://abcdef' })
    expect(result[1]).toMatchObject({ id: 4, url: 'https://example.com' })
    expect(result[2]).toMatchObject({ id: 5, url: 'moz-extension://xyz' })
  })
})

describe('convertBrowserTabs', () => {
  it('normalizes url fields and derives metadata for tabs', () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000)

    const tabs = [
      {
        url: 'https://Example.com/path/',
        title: 'Example',
        id: 5,
        active: true,
        windowId: 3,
        lastAccessed: 1_000,
      },
    ]

    const [tab] = convertBrowserTabs(tabs)

    expect(tab).toMatchObject({
      type: 'tab',
      title: 'Example',
      url: 'example.com/path',
      originalUrl: 'https://Example.com/path',
      originalId: 5,
      active: true,
      windowId: 3,
      searchStringLower: 'example¦example.com/path',
    })
    expect(tab.lastVisitSecondsAgo).toBe(1)
  })

  it('skips tabs without a usable url', () => {
    const tabs = [
      { id: 1, title: 'Missing url' },
      { id: 2, url: '', title: 'Empty url' },
      { id: 3, url: '   ', title: 'Whitespace url' },
      {
        id: 4,
        url: 'https://valid.example.com/',
        title: 'Valid tab',
        lastAccessed: 1_000,
      },
    ]

    const result = convertBrowserTabs(tabs)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      originalId: 4,
      url: 'valid.example.com',
      originalUrl: 'https://valid.example.com',
    })
  })
})

describe('createSearchStringLower', () => {
  it('includes title, url, tags and folder when available', () => {
    const result = createSearchStringLower('Example title', 'example.com', '#tag', '~Folder')
    expect(result).toBe('example title¦example.com¦#tag¦~folder')
  })

  it('avoids duplicating url when the title already includes it', () => {
    const result = createSearchStringLower('example.com', 'example.com', undefined, undefined)
    expect(result).toBe('example.com')
  })

  it('returns a search string from available data when no url is provided', () => {
    const result = createSearchStringLower('Title', '', '#tag', undefined)
    expect(result).toBe('title¦#tag')
  })
})

describe('getTitle', () => {
  it('cleans title when it is a raw url', () => {
    expect(getTitle('https://Example.com/path', 'https://Example.com/path')).toBe('example.com/path')
  })

  it('falls back to cleaned url when title is empty', () => {
    expect(getTitle('', 'https://example.com/')).toBe('example.com')
  })
})

describe('shortenTitle', () => {
  it('truncates titles longer than the url length restriction (hard-coded to 80)', () => {
    const longTitle = 'a'.repeat(90)
    // Hard-coded limit is 80, so it truncates to 77 characters + '...'
    expect(shortenTitle(longTitle)).toBe(`${'a'.repeat(77)}...`)
  })

  it('returns the title unchanged when it is under the limit', () => {
    expect(shortenTitle('short title')).toBe('short title')
  })
})

describe('convertBrowserBookmarks', () => {
  it('maps bookmark entries including tags, folders and bonus score', () => {
    const tree = [
      {
        title: 'Parent folder',
        children: [
          {
            title: 'Work',
            children: [
              {
                id: 'bookmark-1',
                title: 'Example +5 #tag1 #tag2',
                url: 'https://Example.com/',
                dateAdded: 123,
              },
            ],
          },
        ],
      },
    ]

    const [bookmark] = convertBrowserBookmarks(tree, ['Root'], 3)

    expect(bookmark).toMatchObject({
      type: 'bookmark',
      originalId: 'bookmark-1',
      title: 'Example',
      url: 'example.com',
      originalUrl: 'https://Example.com',
      dateAdded: 123,
      customBonusScore: 5,
      tags: '#tag1 #tag2',
      tagsArray: ['tag1', 'tag2'],
      folder: '~Root ~Parent folder ~Work',
      folderArrayLower: ['root', 'parent folder', 'work'],
      searchStringLower: 'example¦example.com¦#tag1 #tag2¦~root ~parent folder ~work',
    })
  })

  it('parses custom bonus scores correctly with radix 10', () => {
    const tree = [
      {
        title: 'Root',
        children: [
          {
            id: 'bookmark-1',
            title: 'Score with leading zero +08',
            url: 'https://example.com/',
          },
          {
            id: 'bookmark-2',
            title: 'Double digit score +10',
            url: 'https://test.com/',
          },
          {
            id: 'bookmark-3',
            title: 'Large score +100',
            url: 'https://large.com/',
          },
        ],
      },
    ]

    const bookmarks = convertBrowserBookmarks(tree)

    expect(bookmarks[0]).toMatchObject({
      title: 'Score with leading zero',
      customBonusScore: 8,
    })
    expect(bookmarks[1]).toMatchObject({
      title: 'Double digit score',
      customBonusScore: 10,
    })
    expect(bookmarks[2]).toMatchObject({
      title: 'Large score',
      customBonusScore: 100,
    })
  })

  it('skips bookmarks located in ignored folders', () => {
    ext.opts.bookmarksIgnoreFolderList = ['Ignore me']

    const tree = [
      {
        title: 'Ignore me',
        children: [
          {
            title: 'Hidden bookmark',
            url: 'https://hidden.example.com',
          },
        ],
      },
    ]

    const result = convertBrowserBookmarks(tree, ['Ignore me'], 3)
    expect(result).toHaveLength(0)
  })

  it('flags duplicate bookmarks when detection is enabled', () => {
    ext.opts.bookmarksIgnoreFolderList = []
    ext.opts.detectDuplicateBookmarks = true
    const tree = [
      {
        title: 'Root',
        children: [
          {
            id: 'bookmark-1',
            title: 'First entry',
            url: 'https://duplicate.example.com',
          },
          {
            id: 'bookmark-2',
            title: 'Second entry',
            url: 'https://duplicate.example.com',
          },
        ],
      },
    ]

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const result = convertBrowserBookmarks(tree)

      const duplicates = result.filter((bookmark) => bookmark.dupe)
      expect(duplicates).toHaveLength(2)
      expect(duplicates.every((bookmark) => bookmark.dupe)).toBe(true)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('Duplicate bookmark detected')
      expect(warnSpy.mock.calls[0][0]).toContain('https://duplicate.example.com')
      expect(warnSpy.mock.calls[0][0]).toContain('folder: /')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('skips duplicate detection when disabled', () => {
    ext.opts.bookmarksIgnoreFolderList = []
    ext.opts.detectDuplicateBookmarks = false
    const tree = [
      {
        title: 'Root',
        children: [
          {
            id: 'bookmark-1',
            title: 'First entry',
            url: 'https://duplicate.example.com',
          },
          {
            id: 'bookmark-2',
            title: 'Second entry',
            url: 'https://duplicate.example.com',
          },
        ],
      },
    ]

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const result = convertBrowserBookmarks(tree)

      // When detection is disabled, dupe flag should not be set
      const duplicates = result.filter((bookmark) => bookmark.dupe)
      expect(duplicates).toHaveLength(0)
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('convertBrowserHistory', () => {
  beforeEach(() => {
    // Clear the memoized regex state before each test
    if (globalThis.ext) {
      ext.state = {}
    }
  })

  it('filters ignored urls and normalizes history entries', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000)
    ext.opts.historyIgnoreList = ['ignore.example.com']

    const history = [
      {
        id: '1',
        url: 'https://keep.example.com/page',
        title: 'Keep',
        visitCount: 3,
        lastVisitTime: 9_000,
      },
      {
        id: '2',
        url: 'https://ignore.example.com/secret',
        title: 'Ignore',
        visitCount: 5,
        lastVisitTime: 8_500,
      },
    ]

    const result = convertBrowserHistory(history)
    expect(result).toHaveLength(1)

    const [entry] = result

    expect(entry).toMatchObject({
      type: 'history',
      originalId: '1',
      title: 'Keep',
      url: 'keep.example.com/page',
      originalUrl: 'https://keep.example.com/page',
      visitCount: 3,
      lastVisitSecondsAgo: 1,
      searchStringLower: 'keep¦keep.example.com/page',
    })
  })

  it('handles multiple ignore patterns and case sensitivity', () => {
    ext.opts.historyIgnoreList = ['GOOG.LE', 'test.com']

    const history = [
      { id: '1', url: 'https://goog.le/search', title: 'Google' },
      { id: '2', url: 'https://TEST.COM/path', title: 'Test' },
      { id: '3', url: 'https://example.com', title: 'KeepMe' },
    ]

    const result = convertBrowserHistory(history)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('KeepMe')
  })

  it('correctly escapes regex special characters in patterns', () => {
    // Patterns with dots, pluses, parentheses, etc.
    ext.opts.historyIgnoreList = ['example.com/a+b', 'site(dot)com', 'bank.com?id=']

    const history = [
      { id: '1', url: 'https://example.com/a+b', title: 'Match Plus' },
      { id: '2', url: 'https://site(dot)com/page', title: 'Match Parens' },
      { id: '3', url: 'https://bank.com?id=123', title: 'Match QMark' },
      { id: '4', url: 'https://example.com/ab', title: 'No Match Plus' },
      { id: '5', url: 'https://sitedot.com', title: 'No Match Parens' },
    ]

    const result = convertBrowserHistory(history)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.title)).toContain('No Match Plus')
    expect(result.map((r) => r.title)).toContain('No Match Parens')
  })

  it('handles empty, null, or whitespace patterns without matching everything', () => {
    ext.opts.historyIgnoreList = ['', null, '   ', 'valid.com']

    const history = [
      { id: '1', url: 'https://valid.com/page', title: 'Ignored' },
      { id: '2', url: 'https://anything.else', title: 'Kept' },
    ]

    const result = convertBrowserHistory(history)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Kept')
  })

  it('handles complex URL characters like slashes and hyphens in ignore patterns', () => {
    ext.opts.historyIgnoreList = ['my-site.com/sub-path/']

    const history = [
      { id: '1', url: 'https://my-site.com/sub-path/page', title: 'Ignored' },
      { id: '2', url: 'https://my-site.com/other', title: 'Kept' },
    ]

    const result = convertBrowserHistory(history)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Kept')
  })
})
