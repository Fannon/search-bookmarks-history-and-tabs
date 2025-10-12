import { deepClone, deepEqual, isPlainObject } from '../helper/objectUtils.js'

export function computeOverrides(current, defaults) {
  const diff = diffRecursive(current, defaults)
  if (diff === undefined) {
    return {}
  }
  return diff
}

export function diffUserOptions(current, defaults) {
  const overrides = computeOverrides(current, defaults)
  return {
    overrides,
    isDirty: Object.keys(overrides).length > 0,
  }
}

function diffRecursive(current, defaults) {
  if (deepEqual(current, defaults)) {
    return undefined
  }

  if (Array.isArray(current)) {
    if (!Array.isArray(defaults)) {
      return deepClone(current)
    }
    if (current.length !== defaults.length) {
      return deepClone(current)
    }
    for (let index = 0; index < current.length; index += 1) {
      if (!deepEqual(current[index], defaults[index])) {
        return deepClone(current)
      }
    }
    return undefined
  }

  if (isPlainObject(current)) {
    if (!isPlainObject(defaults)) {
      return deepClone(current)
    }
    const keys = new Set([...Object.keys(current), ...Object.keys(defaults)])
    const result = {}
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        continue
      }
      const diff = diffRecursive(current[key], defaults[key])
      if (diff !== undefined) {
        result[key] = diff
      }
    }
    if (Object.keys(result).length === 0) {
      return undefined
    }
    return result
  }

  return deepClone(current)
}
