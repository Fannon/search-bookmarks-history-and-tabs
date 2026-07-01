import { describe, expect, test } from '@jest/globals'

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

    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
    expect(html).toContain('<H1>Bookmarks</H1>')
    expect(html).toContain(
      '<DT><H3 ADD_DATE="1700000001" LAST_MODIFIED="1700000002" ID="1" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Bar</H3>',
    )
    expect(html).toContain(
      '<DT><A HREF="https://example.test/?a=1&amp;b=&lt;two&gt;" ADD_DATE="1700000003" ID="b1">Example &amp; Docs</A>',
    )
    expect(html).not.toContain('Empty Folder')
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

    expect(html).toContain('<DT><H3 ADD_DATE="1700000001" LAST_MODIFIED="1700000002">Anon Folder</H3>')
    expect(html).toContain('<DT><A HREF="https://anon.test/" ADD_DATE="1700000003">Anon Bookmark</A>')
    expect(html).not.toMatch(/ID=""/)
  })

  test('creates dated html export filenames', () => {
    expect(createBookmarkExportFilename(new Date(2026, 4, 7))).toBe('bookmarks_07_05_2026.html')
  })
})
