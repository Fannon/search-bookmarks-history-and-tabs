import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as initialUtils from '../popup/js/helper/utils.js'
import { resetModules } from './modules.js'

test('initial static and dynamic imports share module state', async () => {
  assert.strictEqual(await import('../popup/js/helper/utils.js'), initialUtils)
})

test('resetting modules creates fresh state without changing existing references', async () => {
  assert.strictEqual(initialUtils.generateRandomId(), 'R1')
  assert.strictEqual(initialUtils.generateRandomId(), 'R2')
  resetModules()
  const freshUtils = await import('../popup/js/helper/utils.js')
  assert.notStrictEqual(freshUtils, initialUtils)
  assert.strictEqual(freshUtils.generateRandomId(), 'R1')
  assert.strictEqual(initialUtils.generateRandomId(), 'R3')
})
