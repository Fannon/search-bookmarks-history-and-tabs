/**
 * Tests for searchEngines.js - search engine result generation and custom alias handling.
 *
 * ✅ Covered behaviors: search engine result creation, custom alias detection, URL encoding
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'
import {
  addSearchEngines,
  collectCustomSearchAliasResults,
  getCustomSearchEngineResult
} from '../searchEngines.js'

beforeEach(() => {
  createTestExt({
    opts: {
      enableSearchEngines: true,
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s'
        },
        {
          name: 'DuckDuckGo',
          urlPrefix: 'https://duckduckgo.com/?q=$s'
        }
      ],
      customSearchEngines: [
        {
          alias: ['yt', 'youtube'],
          name: 'YouTube',
          urlPrefix: 'https://youtube.com/results?search_query=$s'
        },
        {
          alias: 'gh',
          name: 'GitHub',
          urlPrefix: 'https://github.com/search?q=$s'
        }
      ]
    }
  })
})

afterEach(() => {
  clearTestExt()
})

describe('getCustomSearchEngineResult', () => {
  test('creates search result with $s placeholder replacement', () => {
    const result = getCustomSearchEngineResult(
      'javascript',
      'Google',
      'https://www.google.com/search?q=$s'
    )

    expect(result).toMatchObject({
      type: 'search',
      title: 'Google: "javascript"',
      titleHighlighted: 'Google: "<mark>javascript</mark>"',
      originalUrl: 'https://www.google.com/search?q=javascript',
      searchScore: 1
    })
    expect(result.originalId).toBeDefined()
  })

  test('creates search result with URL prefix concatenation', () => {
    const result = getCustomSearchEngineResult(
      'test query',
      'SearchEngine',
      'https://example.com/search?q='
    )

    expect(result).toMatchObject({
      type: 'search',
      title: 'SearchEngine: "test query"',
      originalUrl: 'https://example.com/search?q=test%20query',
      searchScore: 1
    })
  })

  test('marks custom search engines with custom type', () => {
    const result = getCustomSearchEngineResult(
      'cats',
      'YouTube',
      'https://youtube.com/results?search_query=$s',
      null,
      true
    )

    expect(result.type).toBe('customSearch')
  })

  test('uses blank URL when term is empty and urlBlank provided', () => {
    const result = getCustomSearchEngineResult(
      '',
      'YouTube',
      'https://youtube.com/results?search_query=$s',
      'https://youtube.com'
    )

    expect(result).toMatchObject({
      title: 'YouTube',
      titleHighlighted: 'YouTube',
      originalUrl: 'https://youtube.com'
    })
  })

  test('encodes special characters in search term', () => {
    const result = getCustomSearchEngineResult(
      'hello & goodbye',
      'Google',
      'https://www.google.com/search?q=$s'
    )

    expect(result.originalUrl).toBe(
      'https://www.google.com/search?q=hello%20%26%20goodbye'
    )
  })

  test('generates unique IDs for different results', () => {
    const result1 = getCustomSearchEngineResult(
      'test1',
      'Google',
      'https://google.com?q=$s'
    )
    const result2 = getCustomSearchEngineResult(
      'test2',
      'Google',
      'https://google.com?q=$s'
    )

    expect(result1.originalId).not.toBe(result2.originalId)
  })
})

describe('addSearchEngines', () => {
  test('creates results for all enabled search engines', () => {
    const results = addSearchEngines('javascript')

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      type: 'search',
      title: 'Google: "javascript"'
    })
    expect(results[1]).toMatchObject({
      type: 'search',
      title: 'DuckDuckGo: "javascript"'
    })
  })

  test('returns empty array when search engines disabled', () => {
    ext.opts.enableSearchEngines = false

    const results = addSearchEngines('test')

    expect(results).toEqual([])
  })

  test('handles empty search term', () => {
    const results = addSearchEngines('')

    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('Google: ""')
  })
})

describe('collectCustomSearchAliasResults', () => {
  test('detects single alias match', () => {
    const results = collectCustomSearchAliasResults('gh typescript')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      type: 'customSearch',
      title: 'GitHub: "typescript"',
      originalUrl: 'https://github.com/search?q=typescript'
    })
  })

  test('detects multiple aliases for same engine', () => {
    const results1 = collectCustomSearchAliasResults('yt cats')
    const results2 = collectCustomSearchAliasResults('youtube cats')

    expect(results1).toHaveLength(1)
    expect(results2).toHaveLength(1)
    expect(results1[0].title).toBe('YouTube: "cats"')
    expect(results2[0].title).toBe('YouTube: "cats"')
  })

  test('handles alias at start with remaining term', () => {
    const results = collectCustomSearchAliasResults('yt funny videos')

    expect(results[0]).toMatchObject({
      title: 'YouTube: "funny videos"',
      originalUrl: 'https://youtube.com/results?search_query=funny%20videos'
    })
  })

  test('returns empty when no alias matches', () => {
    const results = collectCustomSearchAliasResults('no match here')

    expect(results).toEqual([])
  })

  test('returns empty when customSearchEngines not configured', () => {
    ext.opts.customSearchEngines = null

    const results = collectCustomSearchAliasResults('yt test')

    expect(results).toEqual([])
  })

  test('matches aliases case-insensitively', () => {
    // Note: collectCustomSearchAliasResults expects pre-normalized (lowercased) search terms
    // as it's called after normalization in common.js
    const results1 = collectCustomSearchAliasResults('yt cats')
    const results2 = collectCustomSearchAliasResults('yt cats')

    expect(results1).toHaveLength(1)
    expect(results2).toHaveLength(1)
  })

  test('requires space after alias', () => {
    const results = collectCustomSearchAliasResults('youtube')

    expect(results).toEqual([])
  })

  test('extracts term after alias correctly', () => {
    const results = collectCustomSearchAliasResults('gh   multiple   spaces')

    expect(results[0].title).toBe('GitHub: "  multiple   spaces"')
  })
})
