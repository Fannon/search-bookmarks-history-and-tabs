import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { fuzzySearch, resetFuzzySearchState } from '../fuzzySearch.js'

const delimiter = '\u00A6'
const cjkTerm = '\u6f22\u5b57'

class UFuzzyStub {
  constructor(options) {
    this.options = options
    UFuzzyStub.instances.push(this)
    UFuzzyStub.lastOptions = options
  }

  filter(haystack, term, idxs) {
    UFuzzyStub.lastTerm = term
    UFuzzyStub.lastFilterArgs = { haystack, term, idxs }
    return UFuzzyStub.mockFilterResult ?? [0]
  }

  info(idxs, haystack, term) {
    UFuzzyStub.lastTerm = term
    UFuzzyStub.lastInfoArgs = { idxs, haystack, term }
    return (
      UFuzzyStub.mockInfoResult ?? {
        idx: idxs,
        ranges: idxs.map(() => [[0, Math.max(0, term.length - 1)]]),
        intraIns: idxs.map(() => UFuzzyStub.intraInsValue),
      }
    )
  }

  static highlight(searchString, ranges) {
    UFuzzyStub.highlightCalls.push({ searchString, ranges })
    const [titlePart = '', urlPart = ''] = searchString.split(delimiter)
    const term = UFuzzyStub.lastTerm || ''
    const mark = term ? `<mark>${term}</mark>` : '<mark></mark>'
    const highlightTitle = titlePart.includes(term) ? titlePart.replace(term, mark) : `${titlePart}${mark}`
    const highlightUrl = urlPart.includes(term) ? urlPart.replace(term, mark) : `${urlPart}${mark}`
    return `${highlightTitle}${delimiter}${highlightUrl}`
  }

  static reset() {
    UFuzzyStub.instances = []
    UFuzzyStub.lastOptions = undefined
    UFuzzyStub.lastFilterArgs = null
    UFuzzyStub.lastInfoArgs = null
    UFuzzyStub.highlightCalls = []
    UFuzzyStub.lastTerm = ''
    UFuzzyStub.mockFilterResult = null
    UFuzzyStub.mockInfoResult = null
    UFuzzyStub.intraInsValue = 1
  }
}

UFuzzyStub.reset()

const resetModes = () => {
  for (const mode of ['bookmarks', 'tabs', 'history']) {
    resetFuzzySearchState(mode)
  }
}

describe('fuzzySearch', () => {
  beforeEach(() => {
    UFuzzyStub.reset()
    globalThis.ext = {
      model: {
        bookmarks: [],
        tabs: [],
        history: [],
      },
      opts: {
        searchFuzzyness: 0.3,
        uFuzzyOptions: null,
      },
    }
    window.uFuzzy = UFuzzyStub
    globalThis.uFuzzy = UFuzzyStub
    resetModes()
  })

  afterEach(() => {
    resetModes()
    UFuzzyStub.reset()
    delete window.uFuzzy
    delete globalThis.uFuzzy
    delete globalThis.ext
  })

  it('returns fuzzy results for bookmarks mode and populates highlight and score', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-1',
        title: 'Term bookmark',
        url: 'https://example.com/term',
        searchString: `term bookmark${delimiter}https://example.com/term`,
      },
    ]

    const results = await fuzzySearch('bookmarks', 'term')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'bookmark-1',
      searchApproach: 'fuzzy',
    })
    expect(results[0].searchScore).toBeCloseTo(0.8)
    expect(results[0].titleHighlighted).toContain('<mark>term</mark>')
    expect(results[0].urlHighlighted).toContain('<mark>term</mark>')
  })

  it('aggregates tab and history entries when searching in history mode', async () => {
    ext.model.tabs = [
      {
        id: 'tab-1',
        title: 'Term tab',
        url: 'https://example.com/term-tab',
        searchString: `term tab entry${delimiter}https://example.com/term-tab`,
      },
    ]
    ext.model.history = [
      {
        id: 'history-1',
        title: 'Term history',
        url: 'https://example.com/term-history',
        searchString: `term history entry${delimiter}https://example.com/term-history`,
      },
    ]

    const results = await fuzzySearch('history', 'term')

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('tab-1')
    expect(results[1].id).toBe('history-1')
    expect(results.every((result) => result.searchApproach === 'fuzzy')).toBe(true)
  })

  it('reuses cached state until resetFuzzySearchState is called', async () => {
    ext.model.bookmarks = [
      {
        id: 'bookmark-cache',
        title: 'Cached term',
        url: 'https://example.com/cached-term',
        searchString: `cached term entry${delimiter}https://example.com/cached-term`,
      },
    ]

    await fuzzySearch('bookmarks', 'cached')
    expect(UFuzzyStub.instances).toHaveLength(1)

    await fuzzySearch('bookmarks', 'cached term')
    expect(UFuzzyStub.instances).toHaveLength(1)

    resetFuzzySearchState('bookmarks')

    await fuzzySearch('bookmarks', 'cached term')
    expect(UFuzzyStub.instances).toHaveLength(2)
  })

  it('applies non-ASCII specific options when fuzzyness is high', async () => {
    ext.opts.searchFuzzyness = 0.85
    ext.opts.uFuzzyOptions = { extra: 'option' }

    ext.model.bookmarks = [
      {
        id: 'bookmark-warm',
        title: 'Warm entry',
        url: 'https://example.com/warm',
        searchString: `warm bookmark${delimiter}https://example.com/warm`,
      },
    ]

    await fuzzySearch('bookmarks', 'warm')
    expect(UFuzzyStub.instances).toHaveLength(1)
    expect(UFuzzyStub.instances[0].options).toMatchObject({
      intraIns: Math.round(0.85 * 4.2),
      extra: 'option',
    })
    expect(UFuzzyStub.instances[0].options.interSplit).toBeUndefined()

    ext.model.bookmarks = [
      {
        id: 'bookmark-cjk',
        title: `${cjkTerm} entry`,
        url: 'https://example.com/kanji',
        searchString: `${cjkTerm} bookmark${delimiter}https://example.com/${cjkTerm}`,
      },
    ]

    await fuzzySearch('bookmarks', cjkTerm)

    expect(UFuzzyStub.instances).toHaveLength(2)
    expect(UFuzzyStub.lastOptions).toMatchObject({
      intraIns: Math.round(0.85 * 4.2),
      intraMode: 1,
      intraSub: 1,
      intraTrn: 1,
      intraDel: 1,
      interSplit: '(p{Unified_Ideograph=yes})+',
      extra: 'option',
    })
  })
})
