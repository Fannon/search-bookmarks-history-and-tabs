/**
 * @file Duplicate bookmark selection helpers for the bookmark manager view.
 */

/**
 * Return duplicate bookmark IDs checked for deletion.
 *
 * @param {ParentNode} [root=document] DOM root.
 * @returns {Array<string>} Selected bookmark ids.
 */
export function getSelectedDuplicateBookmarkIds(root = document) {
  return [...root.querySelectorAll('[data-delete-bookmark-id]:checked:not(:disabled)')].map(
    (input) => input.dataset.deleteBookmarkId,
  )
}

/**
 * Select lower-ranked copies in every rendered duplicate group.
 *
 * @param {ParentNode} [root=document] DOM root.
 */
export function selectSuggestedDuplicateBookmarks(root = document) {
  const groups = root.querySelectorAll('[data-duplicate-group]')
  for (const group of groups) {
    selectSuggestedDuplicateGroup(group)
  }
}

/**
 * Clear all rendered duplicate delete checkboxes.
 *
 * @param {ParentNode} [root=document] DOM root.
 */
export function clearDuplicateBookmarkSelection(root = document) {
  const inputs = root.querySelectorAll('[data-delete-bookmark-id]')
  for (const input of inputs) {
    input.checked = false
  }
}

/**
 * Update the duplicate delete button count and disabled state.
 *
 * @param {HTMLButtonElement} deleteButton Delete selected button.
 * @param {ParentNode} [root=document] DOM root.
 */
export function updateDuplicateSelectionAction(deleteButton, root = document) {
  const selectedCount = getSelectedDuplicateBookmarkIds(root).length

  deleteButton.disabled = selectedCount === 0
  deleteButton.querySelector('[data-selected-count]').textContent = String(selectedCount)
}

/**
 * Select lower-ranked copies within one duplicate group.
 *
 * @param {Element} group Duplicate group element.
 */
export function selectSuggestedDuplicateGroup(group) {
  const rows = group.querySelectorAll('.duplicate-bookmark')
  for (const row of rows) {
    const input = row.querySelector('[data-delete-bookmark-id]')
    if (input && !input.disabled) {
      input.checked = !row.classList.contains('keep-bookmark')
    }
  }
}
