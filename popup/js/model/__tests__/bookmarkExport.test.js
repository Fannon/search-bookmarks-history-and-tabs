import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createBookmarkExportFilename, createBookmarkExportHtml } from '../bookmarkExport.js'

describe('bookmark export', () => {
  test('creates Netscape bookmark HTML with folders, bookmarks, dates, and escaped content', () => {
    const html = createBookmarkExportHtml(
      [
        {
          id: '0',
          title: '',
          dateAdded: 1700000000000,
          dateGroupModified: 1700000300000,
          children: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              dateAdded: 1700000001,
              dateGroupModified: 1700000002,
              children: [
                {
                  id: 'b1',
                  title: 'Example & Docs',
                  url: 'https://example.test/?a=1&b=<two>',
                  dateAdded: 1700000003000,
                },
                {
                  id: 'empty',
                  title: 'Empty Folder',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      1700000004000,
    )
    assert(html.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>'))
    assert(html.includes('<H1>Bookmarks</H1>'))
    assert(
      html.includes(
        '<DT><H3 ADD_DATE="1700000001" LAST_MODIFIED="1700000002" ID="1" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Bar</H3>',
      ),
    )
    assert(
      html.includes(
        '<DT><A HREF="https://example.test/?a=1&amp;b=&lt;two&gt;" ADD_DATE="1700000003" ID="b1">Example &amp; Docs</A>',
      ),
    )
    assert(!html.includes('Empty Folder'))
  })
  test('omits ID attribute when bookmark or folder has no id', () => {
    const html = createBookmarkExportHtml(
      [
        {
          title: 'Anon Folder',
          dateAdded: 1700000001,
          dateGroupModified: 1700000002,
          children: [
            {
              title: 'Anon Bookmark',
              url: 'https://anon.test/',
              dateAdded: 1700000003000,
            },
          ],
        },
      ],
      1700000004000,
    )
    assert(html.includes('<DT><H3 ADD_DATE="1700000001" LAST_MODIFIED="1700000002">Anon Folder</H3>'))
    assert(html.includes('<DT><A HREF="https://anon.test/" ADD_DATE="1700000003">Anon Bookmark</A>'))
    assert.doesNotMatch(html, /ID=""/)
  })
  test('preserves title-based tags', () => {
    const html = createBookmarkExportHtml(
      [
        {
          title: 'Tagged Bookmark #docs #reference',
          url: 'https://example.test/',
          dateAdded: 1700000003000,
        },
      ],
      1700000004000,
    )
    assert(html.includes('>Tagged Bookmark #docs #reference</A>'))
  })
  test('creates dated html export filenames', () => {
    assert.strictEqual(createBookmarkExportFilename(new Date(2026, 4, 7)), 'bookmarks_07_05_2026.html')
  })
})
