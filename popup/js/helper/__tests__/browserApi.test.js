import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { containsText, matches } from '../../../../test/patterns.js'
import {
  browserApi,
  convertBrowserBookmarks,
  convertBrowserHistory,
  convertBrowserTabs,
  createSearchStringLower,
  getBrowserTabGroups,
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
  mock.restoreAll()
  delete browserApi.tabs
})
describe('getBrowserTabs', () => {
  it('filters out entries missing a usable url but includes all other URLs including extension URLs', async () => {
    const queryMock = mock.fn(() =>
      Promise.resolve([
        { id: 1, title: 'Internal tab' },
        { id: 2, url: '', title: 'Empty url' },
        { id: 3, url: 'chrome-extension://abcdef', title: 'Extension page' },
        { id: 4, url: 'https://example.com', title: 'Example' },
        { id: 5, url: 'moz-extension://xyz', title: 'Firefox extension' },
      ]),
    )
    browserApi.tabs = { query: queryMock }
    const result = await getBrowserTabs()
    assert(queryMock.mock.calls.some((call) => matches(call.arguments, [{}])))
    assert.strictEqual(result.length, 3)
    assert.partialDeepStrictEqual(result[0], { id: 3, url: 'chrome-extension://abcdef' })
    assert.partialDeepStrictEqual(result[1], { id: 4, url: 'https://example.com' })
    assert.partialDeepStrictEqual(result[2], { id: 5, url: 'moz-extension://xyz' })
  })
})
describe('getBrowserTabGroups', () => {
  it('handles query errors gracefully', async () => {
    browserApi.tabGroups = {
      query: mock.fn(() => Promise.reject(new Error('API Error'))),
    }
    const warnSpy = mock.method(console, 'warn', () => {})
    const result = await getBrowserTabGroups()
    assert.deepStrictEqual(result, [])
    assert(warnSpy.mock.calls.some((call) => matches(call.arguments, [containsText('Error fetching tab groups')])))
    warnSpy.mock.restore()
  })
})
describe('convertBrowserBookmarks - edge cases', () => {
  it('rejects tags that start with a number (e.g. version numbers)', () => {
    const tree = [
      {
        title: 'Folder',
        children: [
          {
            id: 'bm-num',
            title: 'C# 11 Features #11 #valid',
            url: 'https://example.com',
          },
        ],
      },
    ]
    const [bookmark] = convertBrowserBookmarks(tree)
    assert.strictEqual(bookmark.tags, '#valid')
    assert.strictEqual(bookmark.title, 'C# 11 Features #11')
  })
})
describe('convertBrowserTabs', () => {
  it('normalizes url fields and derives metadata for tabs', () => {
    mock.method(Date, 'now', () => 2_000)
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
    assert.partialDeepStrictEqual(tab, {
      type: 'tab',
      title: 'Example',
      url: 'example.com/path',
      originalUrl: 'https://Example.com/path/',
      originalId: 5,
      active: true,
      windowId: 3,
      searchStringLower: 'example¦example.com/path',
    })
    assert.strictEqual(tab.lastVisitSecondsAgo, 1)
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
    assert.strictEqual(result.length, 1)
    assert.partialDeepStrictEqual(result[0], {
      originalId: 4,
      url: 'valid.example.com',
      originalUrl: 'https://valid.example.com/',
    })
  })
})
describe('createSearchStringLower', () => {
  it('includes title, url, tags and folder when available', () => {
    const result = createSearchStringLower('Example title', 'example.com', '#tag', '~Folder')
    assert.strictEqual(result, 'example title¦example.com¦#tag¦~folder')
  })
  it('avoids duplicating url when the title already includes it', () => {
    const result = createSearchStringLower('example.com', 'example.com', undefined, undefined)
    assert.strictEqual(result, 'example.com')
  })
  it('returns a search string from available data when no url is provided', () => {
    const result = createSearchStringLower('Title', '', '#tag', undefined)
    assert.strictEqual(result, 'title¦#tag')
  })
})
describe('getTitle', () => {
  it('cleans title when it is a raw url', () => {
    assert.strictEqual(getTitle('https://Example.com/path', 'https://Example.com/path'), 'example.com/path')
  })
  it('falls back to cleaned url when title is empty', () => {
    assert.strictEqual(getTitle('', 'https://example.com/'), 'example.com')
  })
})
describe('shortenTitle', () => {
  it('truncates titles longer than the url length restriction (hard-coded to 80)', () => {
    const longTitle = 'a'.repeat(90)
    // Hard-coded limit is 80, so it truncates to 77 characters + '...'
    assert.strictEqual(shortenTitle(longTitle), `${'a'.repeat(77)}...`)
  })
  it('returns the title unchanged when it is under the limit', () => {
    assert.strictEqual(shortenTitle('short title'), 'short title')
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
    assert.partialDeepStrictEqual(bookmark, {
      type: 'bookmark',
      originalId: 'bookmark-1',
      title: 'Example',
      url: 'example.com',
      originalUrl: 'https://Example.com/',
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
    assert.partialDeepStrictEqual(bookmarks[0], {
      title: 'Score with leading zero',
      customBonusScore: 8,
    })
    assert.partialDeepStrictEqual(bookmarks[1], {
      title: 'Double digit score',
      customBonusScore: 10,
    })
    assert.partialDeepStrictEqual(bookmarks[2], {
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
    assert.strictEqual(result.length, 0)
  })
  it('skips bookmarks in folders matched by trail path', () => {
    ext.opts.bookmarksIgnoreFolderList = ['Work/Old Bookmarks']

    // Mirror a real bookmark tree: root (depth 1) -> system folder (depth 2) ->
    // user folders (depth 3+), which is when folderTrail tracking starts.
    const tree = [
      {
        title: 'root',
        children: [
          {
            title: 'Bookmarks bar',
            children: [
              {
                title: 'Work',
                children: [
                  {
                    title: 'Old Bookmarks',
                    children: [{ id: 'bm-1', title: 'Old', url: 'https://old.example.com' }],
                  },
                  {
                    title: 'Current',
                    children: [{ id: 'bm-2', title: 'Current', url: 'https://current.example.com' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]
    const result = convertBrowserBookmarks(tree)
    assert.deepStrictEqual(
      result.map((bookmark) => bookmark.originalId),
      ['bm-2'],
    )
  })
  it('ignores subfolders below a path-ignored folder', () => {
    ext.opts.bookmarksIgnoreFolderList = ['Work/Old Bookmarks']
    const tree = [
      {
        title: 'root',
        children: [
          {
            title: 'Bookmarks bar',
            children: [
              {
                title: 'Work',
                children: [
                  {
                    title: 'Old Bookmarks',
                    children: [
                      {
                        title: 'Deeper',
                        children: [{ id: 'bm-1', title: 'Deep', url: 'https://deep.example.com' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]
    assert.strictEqual(convertBrowserBookmarks(tree).length, 0)
  })
  it('does not ignore folders with a partially matching path', () => {
    ext.opts.bookmarksIgnoreFolderList = ['Work/Old Bookmarks']
    const tree = [
      {
        title: 'root',
        children: [
          {
            title: 'Bookmarks bar',
            children: [
              {
                title: 'Other',
                children: [
                  {
                    title: 'Old Bookmarks',
                    children: [{ id: 'bm-1', title: 'Kept', url: 'https://kept.example.com' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]
    const result = convertBrowserBookmarks(tree)
    assert.strictEqual(result.length, 1)
  })
  it('checks ignored folders before preparing child folder metadata', () => {
    ext.opts.bookmarksIgnoreFolderList = ['Ignored']
    const folderTrail = {
      length: 1,
      map: mock.fn(() => {
        throw new Error('folder trail should not be mapped for ignored folders')
      }),
    }
    const result = convertBrowserBookmarks(
      [
        {
          title: 'Ignored',
          children: [
            {
              title: 'Hidden bookmark',
              url: 'https://hidden.example.com',
            },
          ],
        },
      ],
      folderTrail,
      3,
      '',
    )
    assert.strictEqual(result.length, 0)
    assert(folderTrail.map.mock.callCount() === 0)
  })
  it('preserves duplicate bookmark URLs without popup duplicate flags', () => {
    ext.opts.bookmarksIgnoreFolderList = []
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
    const result = convertBrowserBookmarks(tree)
    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(
      result.map((bookmark) => bookmark.url),
      ['duplicate.example.com', 'duplicate.example.com'],
    )
    assert.strictEqual(
      result.some((bookmark) => bookmark.dupe),
      false,
    )
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
    mock.method(Date, 'now', () => 10_000)
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
    assert.strictEqual(result.length, 1)
    const [entry] = result
    assert.partialDeepStrictEqual(entry, {
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
  it('preserves trailing slashes in history originalUrl', () => {
    const history = [
      {
        id: '1',
        url: 'https://keep.example.com/page/',
        title: 'Keep',
        visitCount: 3,
        lastVisitTime: 9_000,
      },
    ]
    const [entry] = convertBrowserHistory(history)
    assert.partialDeepStrictEqual(entry, {
      url: 'keep.example.com/page',
      originalUrl: 'https://keep.example.com/page/',
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
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].title, 'KeepMe')
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
    assert.strictEqual(result.length, 2)
    assert(result.map((r) => r.title).includes('No Match Plus'))
    assert(result.map((r) => r.title).includes('No Match Parens'))
  })
  it('handles empty, null, or whitespace patterns without matching everything', () => {
    ext.opts.historyIgnoreList = ['', null, '   ', 'valid.com']
    const history = [
      { id: '1', url: 'https://valid.com/page', title: 'Ignored' },
      { id: '2', url: 'https://anything.else', title: 'Kept' },
    ]
    const result = convertBrowserHistory(history)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].title, 'Kept')
  })
  it('handles complex URL characters like slashes and hyphens in ignore patterns', () => {
    ext.opts.historyIgnoreList = ['my-site.com/sub-path/']
    const history = [
      { id: '1', url: 'https://my-site.com/sub-path/page', title: 'Ignored' },
      { id: '2', url: 'https://my-site.com/other', title: 'Kept' },
    ]
    const result = convertBrowserHistory(history)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].title, 'Kept')
  })
})
