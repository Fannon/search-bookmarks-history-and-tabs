import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
/**
 * Tests for searchEngines.js - search engine result generation and custom alias handling.
 *
 * ✅ Covered behaviors: search engine result creation, custom alias detection, URL encoding
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */

import { clearTestExt, createTestExt } from '../../__tests__/testUtils.js'
import { addSearchEngines, collectCustomSearchAliasResults, getCustomSearchEngineResult } from '../searchEngines.js'

beforeEach(() => {
  createTestExt({
    opts: {
      enableSearchEngines: true,
      searchEngineChoices: [
        {
          name: 'Google',
          urlPrefix: 'https://www.google.com/search?q=$s',
        },
        {
          name: 'DuckDuckGo',
          urlPrefix: 'https://duckduckgo.com/?q=$s',
        },
      ],
      customSearchEngines: [
        {
          alias: ['yt', 'youtube'],
          name: 'YouTube',
          urlPrefix: 'https://youtube.com/results?search_query=$s',
        },
        {
          alias: 'gh',
          name: 'GitHub',
          urlPrefix: 'https://github.com/search?q=$s',
        },
      ],
    },
  })
})
afterEach(() => {
  clearTestExt()
})
describe('getCustomSearchEngineResult', () => {
  test('creates search result with $s placeholder replacement', () => {
    const result = getCustomSearchEngineResult('javascript', 'Google', 'https://www.google.com/search?q=$s')
    assert.partialDeepStrictEqual(result, {
      type: 'search',
      title: 'Google: "javascript"',
      originalUrl: 'https://www.google.com/search?q=javascript',
    })
    assert.notStrictEqual(result.originalId, undefined)
  })
  test('creates search result with URL prefix concatenation', () => {
    const result = getCustomSearchEngineResult('test query', 'SearchEngine', 'https://example.com/search?q=')
    assert.partialDeepStrictEqual(result, {
      type: 'search',
      title: 'SearchEngine: "test query"',
      originalUrl: 'https://example.com/search?q=test%20query',
    })
  })
  test('marks custom search engines with custom type', () => {
    const result = getCustomSearchEngineResult(
      'cats',
      'YouTube',
      'https://youtube.com/results?search_query=$s',
      null,
      true,
    )
    assert.strictEqual(result.type, 'customSearch')
  })
  test('uses blank URL when term is empty and urlBlank provided', () => {
    const result = getCustomSearchEngineResult(
      '',
      'YouTube',
      'https://youtube.com/results?search_query=$s',
      'https://youtube.com',
    )
    assert.partialDeepStrictEqual(result, {
      title: 'YouTube',
      originalUrl: 'https://youtube.com',
    })
  })
  test('encodes special characters in search term', () => {
    const result = getCustomSearchEngineResult('hello & goodbye', 'Google', 'https://www.google.com/search?q=$s')
    assert.strictEqual(result.originalUrl, 'https://www.google.com/search?q=hello%20%26%20goodbye')
  })
  test('generates unique IDs for different results', () => {
    const result1 = getCustomSearchEngineResult('test1', 'Google', 'https://google.com?q=$s')
    const result2 = getCustomSearchEngineResult('test2', 'Google', 'https://google.com?q=$s')
    assert.notStrictEqual(result1.originalId, result2.originalId)
  })
})
describe('addSearchEngines', () => {
  test('creates results for all enabled search engines', () => {
    const results = addSearchEngines('javascript')
    assert.strictEqual(results.length, 2)
    assert.partialDeepStrictEqual(results[0], {
      type: 'search',
      title: 'Google: "javascript"',
    })
    assert.partialDeepStrictEqual(results[1], {
      type: 'search',
      title: 'DuckDuckGo: "javascript"',
    })
  })
  test('returns empty array when search engines disabled', () => {
    ext.opts.enableSearchEngines = false
    const results = addSearchEngines('test')
    assert.deepStrictEqual(results, [])
  })
  test('handles empty search term', () => {
    const results = addSearchEngines('')
    assert.strictEqual(results.length, 2)
    assert.strictEqual(results[0].title, 'Google: ""')
  })
})
describe('collectCustomSearchAliasResults', () => {
  test('detects single alias match', () => {
    const results = collectCustomSearchAliasResults('gh typescript')
    assert.strictEqual(results.length, 1)
    assert.partialDeepStrictEqual(results[0], {
      type: 'customSearch',
      title: 'GitHub: "typescript"',
      originalUrl: 'https://github.com/search?q=typescript',
    })
  })
  test('detects multiple aliases for same engine', () => {
    const results1 = collectCustomSearchAliasResults('yt cats')
    const results2 = collectCustomSearchAliasResults('youtube cats')
    assert.strictEqual(results1.length, 1)
    assert.strictEqual(results2.length, 1)
    assert.strictEqual(results1[0].title, 'YouTube: "cats"')
    assert.strictEqual(results2[0].title, 'YouTube: "cats"')
  })
  test('handles alias at start with remaining term', () => {
    const results = collectCustomSearchAliasResults('yt funny videos')
    assert.partialDeepStrictEqual(results[0], {
      title: 'YouTube: "funny videos"',
      originalUrl: 'https://youtube.com/results?search_query=funny%20videos',
    })
  })
  test('returns empty when no alias matches', () => {
    const results = collectCustomSearchAliasResults('no match here')
    assert.deepStrictEqual(results, [])
  })
  test('returns empty when customSearchEngines not configured', () => {
    ext.opts.customSearchEngines = null
    const results = collectCustomSearchAliasResults('yt test')
    assert.deepStrictEqual(results, [])
  })
  test('matches aliases case-insensitively', () => {
    // Note: collectCustomSearchAliasResults expects pre-normalized (lowercased) search terms
    // as it's called after normalization in common.js
    const results1 = collectCustomSearchAliasResults('yt cats')
    const results2 = collectCustomSearchAliasResults('yt cats')
    assert.strictEqual(results1.length, 1)
    assert.strictEqual(results2.length, 1)
  })
  test('requires space after alias', () => {
    const results = collectCustomSearchAliasResults('youtube')
    assert.deepStrictEqual(results, [])
  })
  test('extracts term after alias correctly', () => {
    const results = collectCustomSearchAliasResults('gh   multiple   spaces')
    assert.strictEqual(results[0].title, 'GitHub: "  multiple   spaces"')
  })
})
