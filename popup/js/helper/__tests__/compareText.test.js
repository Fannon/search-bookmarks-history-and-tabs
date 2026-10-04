import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareText } from '../compareText.js'

test('popup label comparison ignores case and accents', () => {
  assert.strictEqual(compareText('Café', 'CAFE'), 0)
  assert.strictEqual(compareText('Résumé', 'resume'), 0)
  assert(compareText('apple', 'banana') < 0)
  assert(compareText('banana', 'apple') > 0)
})

test('popup label sorting preserves localeCompare order and stable ties', () => {
  const labels = ['東京', 'tag2', 'ΣΟΣ', 'Résumé', 'CAFE', 'tag10', 'café', 'Alpha', 'Ångström', 'resume', 'alpha']
  const expected = labels.toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  assert.deepStrictEqual(labels.toSorted(compareText), expected)
})
