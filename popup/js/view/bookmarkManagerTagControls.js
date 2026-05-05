/**
 * @file Tag input helpers for the bookmark manager view.
 */

/**
 * Ensure the manager's Tagify widgets exist and have the latest tag whitelist.
 *
 * @param {Object} extContext Extension context.
 */
export function ensureManagerTagControls(extContext) {
  const tags = (extContext.model.bookmarkManager?.tagGroups || []).map((tag) => tag.name)
  const dom = extContext.dom.manager

  extContext.managerBulkTagify = ensureTagify(dom.bulkTagsInput, extContext.managerBulkTagify, tags)
  extContext.managerEditTagify = ensureTagify(dom.bookmarkEditTags, extContext.managerEditTagify, tags)
}

/**
 * Read Tagify or plain input values from one manager tag control.
 *
 * @param {Object} extContext Extension context.
 * @param {'bulk'|'edit'} source Tag input source.
 * @returns {Array<string>} Normalized tag names.
 */
export function getManagerTagControlValues(extContext, source) {
  const { tagify, input } = getManagerTagControl(extContext, source)
  if (tagify) {
    return normalizeManagerTagValues(tagify.value.map((tag) => tag.value))
  }

  return normalizeManagerTagValues(String(input.value || '').split(/[#,]/))
}

/**
 * Replace one manager tag control's values.
 *
 * @param {Object} extContext Extension context.
 * @param {'bulk'|'edit'} target Tag input target.
 * @param {Array<string>} tags Tag names.
 */
export function setManagerTagControlValues(extContext, target, tags) {
  const { tagify, input } = getManagerTagControl(extContext, target)

  if (tagify) {
    tagify.removeAllTags()
    if (tags.length) {
      tagify.addTags(tags)
    }
    return
  }

  input.value = tags.join(', ')
}

/**
 * Toggle one manager tag control.
 *
 * @param {Object} extContext Extension context.
 * @param {'bulk'|'edit'} target Tag input target.
 * @param {boolean} disabled Whether the control should be disabled.
 */
export function setManagerTagControlDisabled(extContext, target, disabled) {
  const { tagify, input } = getManagerTagControl(extContext, target)
  if (tagify && typeof tagify.setDisabled === 'function') {
    tagify.setDisabled(disabled)
  }
  input.disabled = disabled
}

/**
 * Normalize tag values from Tagify or comma/hash-separated plain inputs.
 *
 * @param {Array<string>} tags Raw tag values.
 * @returns {Array<string>} Normalized unique values.
 */
export function normalizeManagerTagValues(tags) {
  const seen = new Set()
  const result = []

  for (let i = 0; i < tags.length; i++) {
    const value = String(tags[i] || '')
      .replaceAll('#', '')
      .replace(/\s+/g, ' ')
      .trim()
    const key = value.toLowerCase()

    if (!value || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(value)
  }

  return result
}

function getManagerTagControl(extContext, source) {
  if (source === 'edit') {
    return {
      tagify: extContext.managerEditTagify,
      input: extContext.dom.manager.bookmarkEditTags,
    }
  }

  return {
    tagify: extContext.managerBulkTagify,
    input: extContext.dom.manager.bulkTagsInput,
  }
}

function ensureTagify(input, currentTagify, whitelist) {
  if (!input || typeof Tagify === 'undefined') {
    return currentTagify
  }

  if (currentTagify) {
    currentTagify.whitelist = whitelist
    return currentTagify
  }

  return new Tagify(input, {
    whitelist,
    trim: true,
    transformTag,
    skipInvalid: false,
    editTags: {
      clicks: 1,
      keepInvalid: false,
    },
    dropdown: {
      position: 'all',
      enabled: 0,
      maxItems: 12,
      closeOnSelect: false,
    },
  })
}

function transformTag(tagData) {
  if (tagData.value.includes('#')) {
    tagData.value = tagData.value.split('#').join('')
  }
}
