import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { beforeEach, describe, mock, test } from 'node:test'
import { renderTaxonomy } from '../taxonomyViewHelper.js'

describe('taxonomyViewHelper', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="test-container"></div>'
    // Clear localStorage
    localStorage.clear()
  })
  test('renders empty state when no items provided', () => {
    renderTaxonomy({
      containerId: 'test-container',
      items: {},
      marker: '#',
      itemClass: 'tag',
      attrName: 'x-tag',
      emptyStateHtml: '<div class="empty">No items</div>',
      rerenderFn: mock.fn(),
    })
    const container = document.getElementById('test-container')
    assert.strictEqual(container.innerHTML, '<div class="empty">No items</div>')
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
      rerenderFn: mock.fn(),
    })
    const badges = document.querySelectorAll('.tag')
    assert.strictEqual(badges.length, 3)
    assert.strictEqual(badges[0].getAttribute('x-tag'), 'apple')
    assert.strictEqual(badges[1].getAttribute('x-tag'), 'banana')
    assert.strictEqual(badges[2].getAttribute('x-tag'), 'carrot')
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
      rerenderFn: mock.fn(),
    })
    const badges = document.querySelectorAll('.tag')
    assert.strictEqual(badges.length, 3)
    // Should be: apple (3), carrot (2), banana (1)
    assert.strictEqual(badges[0].getAttribute('x-tag'), 'apple')
    assert.strictEqual(badges[1].getAttribute('x-tag'), 'carrot')
    assert.strictEqual(badges[2].getAttribute('x-tag'), 'banana')
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
      rerenderFn: mock.fn(),
    })
    const badges = document.querySelectorAll('.tag')
    assert.strictEqual(badges.length, 2)
    // Both have 1 item, so should be alphabetical: ant, zebra
    assert.strictEqual(badges[0].getAttribute('x-tag'), 'ant')
    assert.strictEqual(badges[1].getAttribute('x-tag'), 'zebra')
  })
  test('toggle button switches sort mode and calls rerenderFn', () => {
    const rerenderFn = mock.fn()
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
    assert(!!toggleBtn)
    // Button should show "count" as the NEXT mode
    assert.strictEqual(toggleBtn.dataset.sort, 'count')

    // Click to toggle
    toggleBtn.click()
    assert.strictEqual(localStorage.getItem('taxonomySortMode'), 'count')
    assert.strictEqual(rerenderFn.mock.callCount(), 1)
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
      rerenderFn: mock.fn(),
      extraStyle: 'color: red',
    })
    const badge = document.querySelector('.group')
    assert.strictEqual(badge.getAttribute('style'), 'color: red')
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
      rerenderFn: mock.fn(),
    })
    const badge = document.querySelector('.tag')
    // When set via innerHTML, the attribute value is parsed and entities are decoded.
    // So &lt;b&gt; becomes <b> in the attribute value.
    assert.strictEqual(badge.getAttribute('x-tag'), '<b>bold</b>')

    // However, the InnerHTML content of the anchor tag should still show the escaped string visually
    // The innerHTML of the anchor will differ from textContent.
    // implementation: >${marker}${safeKey} <small>
    // safeKey is &lt;b&gt;bold&lt;/b&gt;
    // So innerHTML should contain &lt;b&gt;bold&lt;/b&gt;
    assert(badge.innerHTML.includes('&lt;b&gt;bold&lt;/b&gt;'))
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
      rerenderFn: mock.fn(),
    })
    const badge = document.querySelector('.folder')
    // href should encoded: ~foo%2Fbar%20%20
    // Note: implementation does: ...marker}${encodedKey}%20%20"
    assert(badge.getAttribute('href').includes('#search/~foo%2Fbar%20%20'))
  })
})
