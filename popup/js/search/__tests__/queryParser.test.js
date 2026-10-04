import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
/**
 * Tests for queryParser.js - query parsing and mode detection logic.
 *
 * ✅ Covered behaviors: mode prefix detection, taxonomy marker detection, fallback to 'all' mode
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */

import { resolveSearchMode } from '../queryParser.js'

describe('resolveSearchMode', () => {
  test('detects history mode prefix', () => {
    const result = resolveSearchMode('h example search')
    assert.deepStrictEqual(result, {
      mode: 'history',
      term: 'example search',
    })
  })
  test('detects bookmarks mode prefix', () => {
    const result = resolveSearchMode('b my bookmark')
    assert.deepStrictEqual(result, {
      mode: 'bookmarks',
      term: 'my bookmark',
    })
  })
  test('detects tabs mode prefix', () => {
    const result = resolveSearchMode('t open tab')
    assert.deepStrictEqual(result, {
      mode: 'tabs',
      term: 'open tab',
    })
  })
  test('detects search mode prefix', () => {
    const result = resolveSearchMode('s google query')
    assert.deepStrictEqual(result, {
      mode: 'search',
      term: 'google query',
    })
  })
  test('detects tags taxonomy marker', () => {
    const result = resolveSearchMode('#javascript')
    assert.deepStrictEqual(result, {
      mode: 'tags',
      term: 'javascript',
    })
  })
  test('detects folders taxonomy marker', () => {
    const result = resolveSearchMode('~work/projects')
    assert.deepStrictEqual(result, {
      mode: 'folders',
      term: 'work/projects',
    })
  })
  test('returns all mode for normal search without prefix', () => {
    const result = resolveSearchMode('normal search term')
    assert.deepStrictEqual(result, {
      mode: 'all',
      term: 'normal search term',
    })
  })
  test('handles empty search term', () => {
    const result = resolveSearchMode('')
    assert.deepStrictEqual(result, {
      mode: 'all',
      term: '',
    })
  })
  test('handles search term with only spaces', () => {
    const result = resolveSearchMode('   ')
    assert.deepStrictEqual(result, {
      mode: 'all',
      term: '   ',
    })
  })
  test('mode prefix takes precedence over taxonomy marker in term', () => {
    const result = resolveSearchMode('h #tag')
    assert.deepStrictEqual(result, {
      mode: 'history',
      term: '#tag',
    })
  })
  test('preserves term case', () => {
    const result = resolveSearchMode('b MyBookmark')
    assert.deepStrictEqual(result, {
      mode: 'bookmarks',
      term: 'MyBookmark',
    })
  })
  test('handles prefix without space as normal search', () => {
    const result = resolveSearchMode('hello')
    assert.deepStrictEqual(result, {
      mode: 'all',
      term: 'hello',
    })
  })
})
