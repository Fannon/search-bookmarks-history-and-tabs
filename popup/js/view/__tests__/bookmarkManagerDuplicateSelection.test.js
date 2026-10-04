import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  clearDuplicateBookmarkSelection,
  getSelectedDuplicateBookmarkIds,
  selectSuggestedDuplicateBookmarks,
  selectSuggestedDuplicateGroup,
  updateDuplicateSelectionAction,
} from '../bookmarkManagerDuplicateSelection.js'

function renderDuplicatesDom() {
  document.body.innerHTML = `
    <button id="delete-selected"><span data-selected-count>0</span></button>
    <section data-duplicate-group>
      <li class="duplicate-bookmark keep-bookmark">
        <input type="checkbox" data-delete-bookmark-id="keep">
      </li>
      <li class="duplicate-bookmark">
        <input type="checkbox" data-delete-bookmark-id="copy-1">
      </li>
      <li class="duplicate-bookmark">
        <input type="checkbox" data-delete-bookmark-id="copy-2" disabled>
      </li>
    </section>
    <section data-duplicate-group>
      <li class="duplicate-bookmark keep-bookmark">
        <input type="checkbox" data-delete-bookmark-id="keep-2">
      </li>
      <li class="duplicate-bookmark">
        <input type="checkbox" data-delete-bookmark-id="copy-3">
      </li>
    </section>
  `
}
describe('bookmark manager duplicate selection', () => {
  test('selects lower-ranked copies without selecting keep rows or disabled inputs', () => {
    renderDuplicatesDom()
    selectSuggestedDuplicateBookmarks()
    assert.deepStrictEqual(getSelectedDuplicateBookmarkIds(), ['copy-1', 'copy-3'])
  })
  test('can select a single duplicate group', () => {
    renderDuplicatesDom()
    const group = document.querySelector('[data-duplicate-group]')
    selectSuggestedDuplicateGroup(group)
    assert.deepStrictEqual(getSelectedDuplicateBookmarkIds(), ['copy-1'])
  })
  test('clears selection and updates the delete action state', () => {
    renderDuplicatesDom()
    const deleteButton = document.getElementById('delete-selected')
    selectSuggestedDuplicateBookmarks()
    updateDuplicateSelectionAction(deleteButton)
    assert.strictEqual(deleteButton.disabled, false)
    assert.strictEqual(deleteButton.querySelector('[data-selected-count]').textContent, '2')
    clearDuplicateBookmarkSelection()
    updateDuplicateSelectionAction(deleteButton)
    assert.strictEqual(deleteButton.disabled, true)
    assert.strictEqual(deleteButton.querySelector('[data-selected-count]').textContent, '0')
  })
})
