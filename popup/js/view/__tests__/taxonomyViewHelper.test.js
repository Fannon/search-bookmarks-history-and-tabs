import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { renderTaxonomy } from '../taxonomyViewHelper.js'

describe('taxonomyViewHelper', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="test-container"></div>'
    // Clear localStorage
    localStorage.clear()
    jest.clearAllMocks()
  })

  test('renders empty state when no items provided', () => {
    renderTaxonomy({
      containerId: 'test-container',
      items: {},
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '<div class="empty">No items</div>',
      rerenderFn: jest.fn(),
    })

    const container = document.getElementById('test-container')
    expect(container.innerHTML).toBe('<div class="empty">No items</div>')
  })

  test('renders sorted badges alphabetically by default', () => {
    const items = {
      banana: ['1'],
      apple: ['2', '3'],
      carrot: ['4'],
    }

    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '',
      rerenderFn: jest.fn(),
    })

    const badges = document.querySelectorAll('.tag')
    expect(badges).toHaveLength(3)
    expect(badges[0].getAttribute('x-tag')).toBe('apple')
    expect(badges[1].getAttribute('x-tag')).toBe('banana')
    expect(badges[2].getAttribute('x-tag')).toBe('carrot')
  })

  test('renders sorted badges by count when configured', () => {
    localStorage.setItem('taxonomySortMode', 'count')
    const items = {
      banana: ['1'], // 1 item
      apple: ['2', '3', '4'], // 3 items
      carrot: ['5', '6'], // 2 items
    }

    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '',
      rerenderFn: jest.fn(),
    })

    const badges = document.querySelectorAll('.tag')
    expect(badges).toHaveLength(3)
    // Should be: apple (3), carrot (2), banana (1)
    expect(badges[0].getAttribute('x-tag')).toBe('apple')
    expect(badges[1].getAttribute('x-tag')).toBe('carrot')
    expect(badges[2].getAttribute('x-tag')).toBe('banana')
  })

  test('secondary sort is alphabetical when counts are equal', () => {
    localStorage.setItem('taxonomySortMode', 'count')
    const items = {
      zebra: ['1'],
      ant: ['2'],
    }

    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '',
      rerenderFn: jest.fn(),
    })

    const badges = document.querySelectorAll('.tag')
    expect(badges).toHaveLength(2)
    // Both have 1 item, so should be alphabetical: ant, zebra
    expect(badges[0].getAttribute('x-tag')).toBe('ant')
    expect(badges[1].getAttribute('x-tag')).toBe('zebra')
  })

  test('toggle button switches sort mode and calls rerenderFn', () => {
    const rerenderFn = jest.fn()
    const items = { a: ['1'], b: ['2'] }

    // Start in alpha mode
    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '',
      rerenderFn,
    })

    const toggleBtn = document.getElementById('sort-toggle')
    expect(toggleBtn).toBeTruthy()
    // Button should show "count" as the NEXT mode
    expect(toggleBtn.dataset.sort).toBe('count')

    // Click to toggle
    toggleBtn.click()

    expect(localStorage.getItem('taxonomySortMode')).toBe('count')
    expect(rerenderFn).toHaveBeenCalledTimes(1)
  })

  test('applies extra styles to badges if provided', () => {
    const items = { a: ['1'] }
    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '@',
      itemClass: 'group',
      attrName: 'x-group',
      emptyStateHtml: '',
      rerenderFn: jest.fn(),
      extraStyle: 'color: red',
    })

    const badge = document.querySelector('.group')
    expect(badge.getAttribute('style')).toBe('color: red')
  })

  test('escapes special characters in keys', () => {
    const items = { '<b>bold</b>': ['1'] }
    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '',
      rerenderFn: jest.fn(),
    })

    const badge = document.querySelector('.tag')
    // When set via innerHTML, the attribute value is parsed and entities are decoded.
    // So &lt;b&gt; becomes <b> in the attribute value.
    expect(badge.getAttribute('x-tag')).toBe('<b>bold</b>')

    // However, the InnerHTML content of the anchor tag should still show the escaped string visually
    // The innerHTML of the anchor will differ from textContent.
    // implementation: >${marker}${safeKey} <small>
    // safeKey is &lt;b&gt;bold&lt;/b&gt;
    // So innerHTML should contain &lt;b&gt;bold&lt;/b&gt;
    expect(badge.innerHTML).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })

  test('generates correct href with encoded components', () => {
    const items = { 'foo/bar': ['1'] }
    renderTaxonomy({
      containerId: 'test-container',
      items,
      marker: '~',
      itemClass: 'folder',
      attrName: 'x-folder',
      emptyStateHtml: '',
      rerenderFn: jest.fn(),
    })

    const badge = document.querySelector('.folder')
    // href should encoded: ~foo%2Fbar%20%20
    // Note: implementation does: ...marker}${encodedKey}%20%20"
    expect(badge.getAttribute('href')).toContain('#search/~foo%2Fbar%20%20')
  })
})
