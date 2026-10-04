import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { browserApi } from '../browserApi.js'
import { createExtensionContext } from '../extensionContext.js'

describe('extension context', () => {
  test('creates the default popup context shape', () => {
    const context = createExtensionContext()
    assert.deepStrictEqual(context, {
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
    assert.deepStrictEqual(second.opts, {})
    assert.deepStrictEqual(second.model.result, [])
    assert.deepStrictEqual(second.index.taxonomy, {})
    assert.deepStrictEqual(second.dom, {})
  })
})
