import { describe, expect, test } from '@jest/globals'

import { browserApi } from '../browserApi.js'
import { createExtensionContext } from '../extensionContext.js'

describe('extension context', () => {
  test('creates the default popup context shape', () => {
    const context = createExtensionContext()

    expect(context).toEqual({
      opts: {},
      model: {
        currentItem: 0,
        result: [],
        activeSearchPromise: null,
        mouseMoved: false,
      },
      index: {
        taxonomy: {},
      },
      dom: {},
      browserApi,
      initialized: false,
    })
  })

  test('returns a fresh mutable context for each popup instance', () => {
    const first = createExtensionContext()
    const second = createExtensionContext()

    first.opts.enableBookmarks = false
    first.model.result.push({ title: 'First result' })
    first.index.taxonomy.tags = ['docs']
    first.dom.input = {}

    expect(second.opts).toEqual({})
    expect(second.model.result).toEqual([])
    expect(second.index.taxonomy).toEqual({})
    expect(second.dom).toEqual({})
  })
})
