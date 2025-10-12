export function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry))
  }
  if (value && typeof value === 'object') {
    const result = {}
    for (const [key, nested] of Object.entries(value)) {
      result[key] = deepClone(nested)
    }
    return result
  }
  return value
}

export function deepEqual(left, right) {
  if (left === right) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) {
        return false
      }
    }
    return true
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }
    for (const key of leftKeys) {
      if (!deepEqual(left[key], right[key])) {
        return false
      }
    }
    return true
  }

  return false
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
