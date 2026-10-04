import { isDeepStrictEqual } from 'node:util'

const predicate = Symbol('predicate')
const pattern = (check) => ({ [predicate]: check })

// Argument patterns keep browser-API assertions focused on the fields under test.
export function matches(actual, expected) {
  if (expected?.[predicate]) return expected[predicate](actual)
  if (isDeepStrictEqual(actual, expected)) return true
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, i) => matches(actual[i], value))
    )
  }
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(expected))) return false
    const keys = Object.keys(expected)
    return (
      keys.length === Object.keys(actual).length &&
      keys.every((key) => Object.hasOwn(actual, key) && matches(actual[key], expected[key]))
    )
  }
  return false
}

export const any = (Type) =>
  pattern((value) => {
    if (Type === String) return typeof value === 'string'
    if (Type === Number) return typeof value === 'number'
    if (Type === Function) return typeof value === 'function'
    if (Type === Boolean) return typeof value === 'boolean'
    return value instanceof Type
  })
export const anything = () => pattern((value) => value != null)
export const subset = (fields) =>
  pattern(
    (value) =>
      value != null && Object.keys(fields).every((key) => key in Object(value) && matches(value[key], fields[key])),
  )
export const containsItems = (items) =>
  pattern((value) => Array.isArray(value) && items.every((item) => value.some((candidate) => matches(candidate, item))))
export const containsText = (text) => pattern((value) => typeof value === 'string' && value.includes(text))
