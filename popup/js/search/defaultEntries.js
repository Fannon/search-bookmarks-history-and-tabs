import { getBrowserTabs } from '../helper/browserApi.js'

/**
 * If we don't have a search term yet (or not sufficiently long), display current tab related entries.
 *
 * Finds out if there are any bookmarks or history that match our current open URL.
 */
export async function addDefaultEntries() {
  let results = []

  if (ext.model.searchMode === 'history' && ext.model.history) {
    // Display recent history by default
    results = ext.model.history.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else if (ext.model.searchMode === 'tabs' && ext.model.tabs) {
    // Display last opened tabs by default
    results = ext.model.tabs
      .map((el) => {
        return {
          searchScore: 1,
          ...el,
        }
      })
      .sort((a, b) => {
        return a.lastVisitSecondsAgo - b.lastVisitSecondsAgo
      })
  } else if (ext.model.searchMode === 'bookmarks' && ext.model.bookmarks) {
    // Display all bookmarks by default
    results = ext.model.bookmarks.map((el) => {
      return {
        searchScore: 1,
        ...el,
      }
    })
  } else {
    // All other modes: Find bookmark / history that matches current page URL
    let currentUrl = window.location.href
    const [tab] = await getBrowserTabs({ active: true, currentWindow: true })

    // If we find no open tab, we're most likely not having a browser API. Return nothing.
    if (!tab) {
      return []
    }

    currentUrl = tab.url
    // Remove trailing slash from URL, so the startsWith search works better
    currentUrl = currentUrl.replace(/\/$/, '')

    // Find if current URL has corresponding bookmark(s)
    const foundBookmarks = ext.model.bookmarks.filter((el) => el.originalUrl.startsWith(currentUrl))
    results.push(...foundBookmarks)

    // Find if we have browser history that has the same URL
    let foundHistory = ext.model.history.filter((el) => currentUrl === el.originalUrl)
    results.push(...foundHistory)
  }

  ext.model.result = results
  return results
}

export function addHelp() {
  const parser = new DOMParser()
  var html = helpTexts[(Math.random() * helpTexts.length) | 0]
  const doc = parser.parseFromString(`<li class="tip">${html}</li>`, 'text/html')
  document.getElementById('result-list').appendChild(doc.body.firstChild)
}

export const helpTexts = [
  `<strong>Tips on startup</strong>: Disable via option: <code>enableHelp: false</code>`,

  `<strong>Search Strategies</strong>: Switch between <span class="precise">PRECISE</span> (faster, exact) and <span class="fuzzy">FUZZY</span> (slower, more results, fuzzy).<br/><br/>
   This can be done via clicking on the top-right corner of the popup or by setting it in the options like: <code>searchStrategy: precise</code>`,

  `<strong>Keyboard Shortcut</strong>: Trigger the extension via keyboard. <br/>
   The default is <code>CTRL</code> + <code>Shift</code> + <code>.</code>. <br/><br/>
   This can be customized in the browsers extensions settings.`,

  `<strong>History Size & History</strong>: By default the number of history items to load are limited.
   Consider increasing or decreasing this, depending on your performance situation and personal preferences:<br /><br />
   Add / adjust option: <code>historyMaxItems: 1024</code> <br/>
   Add / adjust option: <code>historyDaysAgo: 14</code>`,

  `<strong>Open selected results</strong>: By default, the extension will open the selected result in a new tab or switch to an existing tab if fitting.<br/><br/>
   Hold <code>Shift</code> or <code>Alt</code> to open the result in the current tab.<br />
   Hold <code>Ctrl</code> to open the result without closing the popup.`,

  `<strong>Custom Bonus Scores</strong>: Append <code> + [whole number]</code> to your bookmark title (before tags). <br/><br/>
   Example: <code>Another Bookmark +10 #tag1</code>`,

  `<strong>Custom Bonus Scores</strong>: Append <code> + [whole number]</code> to your bookmark title (before tags). <br/><br/>
   Example: <code>Another Bookmark +10 #tag1</code>`,

  `<strong>Copy to Clipboard</strong>: Right click a result item to copy its URL to the clipboard.`,

  `<strong>Search Modes</strong>: Use search modes to be more selective.<br/><br/>
   Start your search query with a search mode prefix:
   <ul>
    <li><code>#</code>: Only <strong>bookmarks with the tag</strong> will be returned</li>
    <li><code>~</code>: Only <strong>bookmarks within the folder</strong> will be returned</li>
    <li><code>t </code>: Only <strong>tabs</strong> will be searched.</li>
    <li><code>b </code>: Only <strong>bookmarks</strong> will be searched.</li>
    <li><code>h </code>: Only <strong>history</strong> and <strong>tabs</strong> will be searched.</li>
    <li><code>s </code>: Only <strong>search engines</strong> will be proposed.</li>
   </ul>`,

  `<strong>Special Browser Pages</strong>: You can add special browser pages to your bookmarks, like
   <code>chrome://downloads</code>.`,

  `<strong>Keyboard Navigation</strong>: You can navigate result entries Emacs / Vim Style:<br/><br/>
   <code>Ctrl+N</code> and <code>Ctrl+J</code> to navigate search results up.<br/>
   <code>Ctrl+P</code> and <code>Ctrl+K</code> to navigate search results down.`,
]
