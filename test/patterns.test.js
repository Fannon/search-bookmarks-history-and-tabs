import assert from 'node:assert/strict'
import { test } from 'node:test'
import { any, anything, containsItems, containsText, matches, subset } from './patterns.js'

test('exact argument patterns reject missing and extra object fields', () => {
  assert(matches({ id: 1, callback: () => {} }, { id: 1, callback: any(Function) }))
  assert(!matches({ id: 1 }, { id: 1, callback: any(Function) }))
  assert(!matches({ id: 1, extra: true }, { id: 1 }))
})

test('argument arrays preserve ordering and arity', () => {
  assert(matches([1, 'value'], [any(Number), any(String)]))
  assert(!matches(['value', 1], [any(Number), any(String)]))
  assert(!matches([1, 'value', true], [any(Number), any(String)]))
})

test('partial patterns allow additional fields but require the requested fields', () => {
  assert(matches({ id: 1, extra: true }, subset({ id: 1 })))
  assert(!matches({ id: 2 }, subset({ id: 1 })))
  assert(!matches({}, subset({ id: undefined })))
})

test('type and non-null patterns reject incorrect values', () => {
  assert(matches(1, any(Number)))
  assert(!matches('1', any(Number)))
  assert(matches(false, any(Boolean)))
  assert(!matches(null, any(Object)))
  assert(matches(0, anything()))
  assert(!matches(undefined, anything()))
  assert(!matches(null, anything()))
})

test('array membership patterns reject absent elements', () => {
  assert(matches([{ id: 1, extra: true }, { id: 2 }], containsItems([subset({ id: 1 })])))
  assert(!matches([{ id: 2 }], containsItems([subset({ id: 1 })])))
  assert(!matches({}, containsItems([])))
})

test('text patterns reject missing text and non-strings', () => {
  assert(matches('before target after', containsText('target')))
  assert(!matches('other text', containsText('target')))
  assert(!matches(123, containsText('123')))
})

test('dates and regular expressions retain their value comparisons', () => {
  assert(matches(new Date(0), new Date(0)))
  assert(!matches(new Date(0), new Date(1)))
  assert(matches(/value/i, /value/i))
  assert(!matches(/value/i, /other/i))
})
