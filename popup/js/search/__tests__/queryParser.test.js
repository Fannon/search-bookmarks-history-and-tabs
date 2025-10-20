/**
 * Tests for queryParser.js - query parsing and mode detection logic.
 *
 * ✅ Covered behaviors: mode prefix detection, taxonomy marker detection, fallback to 'all' mode
 * ⚠️ Known gaps: none
 * 🐞 Added BUG tests: none
 */
import { describe, test, expect } from '@jest/globals'
import { resolveSearchMode } from '../queryParser.js'

describe('resolveSearchMode', () => {
  test('detects history mode prefix', () => {
    const result = resolveSearchMode('h example search')
    expect(result).toEqual({
      mode: 'history',
      term: 'example search',
    })
  })

  test('detects bookmarks mode prefix', () => {
    const result = resolveSearchMode('b my bookmark')
    expect(result).toEqual({
      mode: 'bookmarks',
      term: 'my bookmark',
    })
  })

  test('detects tabs mode prefix', () => {
    const result = resolveSearchMode('t open tab')
    expect(result).toEqual({
      mode: 'tabs',
      term: 'open tab',
    })
  })

  test('detects search mode prefix', () => {
    const result = resolveSearchMode('s google query')
    expect(result).toEqual({
      mode: 'search',
      term: 'google query',
    })
  })

  test('detects tags taxonomy marker', () => {
    const result = resolveSearchMode('#javascript')
    expect(result).toEqual({
      mode: 'tags',
      term: 'javascript',
    })
  })

  test('detects folders taxonomy marker', () => {
    const result = resolveSearchMode('~work/projects')
    expect(result).toEqual({
      mode: 'folders',
      term: 'work/projects',
    })
  })

  test('returns all mode for normal search without prefix', () => {
    const result = resolveSearchMode('normal search term')
    expect(result).toEqual({
      mode: 'all',
      term: 'normal search term',
    })
  })

  test('handles empty search term', () => {
    const result = resolveSearchMode('')
    expect(result).toEqual({
      mode: 'all',
      term: '',
    })
  })

  test('handles search term with only spaces', () => {
    const result = resolveSearchMode('   ')
    expect(result).toEqual({
      mode: 'all',
      term: '   ',
    })
  })

  test('mode prefix takes precedence over taxonomy marker in term', () => {
    const result = resolveSearchMode('h #tag')
    expect(result).toEqual({
      mode: 'history',
      term: '#tag',
    })
  })

  test('preserves term case', () => {
    const result = resolveSearchMode('b MyBookmark')
    expect(result).toEqual({
      mode: 'bookmarks',
      term: 'MyBookmark',
    })
  })

  test('handles prefix without space as normal search', () => {
    const result = resolveSearchMode('hello')
    expect(result).toEqual({
      mode: 'all',
      term: 'hello',
    })
  })
})
