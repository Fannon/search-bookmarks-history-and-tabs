import { describe, expect, test } from '@jest/globals'

import {
  getManagerTagControlValues,
  normalizeManagerTagValues,
  setManagerTagControlDisabled,
  setManagerTagControlValues,
} from '../bookmarkManagerTagControls.js'

function createExt() {
  document.body.innerHTML = `
    <input id="bookmark-edit-tags" />
    <input id="bookmark-bulk-tags" />
  `

  return {
    dom: {
      manager: {
        bookmarkEditTags: document.getElementById('bookmark-edit-tags'),
        bulkTagsInput: document.getElementById('bookmark-bulk-tags'),
      },
    },
    model: {},
  }
}

describe('bookmark manager tag controls', () => {
  test('normalizes comma, hash, whitespace, and duplicate tag values', () => {
    expect(normalizeManagerTagValues([' #Docs ', 'docs', 'Project   Notes', '', '#Read'])).toEqual([
      'Docs',
      'Project Notes',
      'Read',
    ])
  })

  test('reads and writes plain fallback inputs without Tagify', () => {
    const ext = createExt()
    ext.dom.manager.bulkTagsInput.value = '#Docs, Project  Notes, docs'

    expect(getManagerTagControlValues(ext, 'bulk')).toEqual(['Docs', 'Project Notes'])

    setManagerTagControlValues(ext, 'edit', ['Docs', 'Read'])

    expect(ext.dom.manager.bookmarkEditTags.value).toBe('Docs, Read')
  })

  test('toggles native input and Tagify disabled states together', () => {
    const ext = createExt()
    const disabledCalls = []
    ext.managerEditTagify = {
      setDisabled: (disabled) => disabledCalls.push(disabled),
    }

    setManagerTagControlDisabled(ext, 'edit', true)
    setManagerTagControlDisabled(ext, 'edit', false)

    expect(disabledCalls).toEqual([true, false])
    expect(ext.dom.manager.bookmarkEditTags.disabled).toBe(false)
  })
})
