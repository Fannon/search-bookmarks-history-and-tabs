import { getUserOptions } from '../model/options.js'
import { computeOverrides } from '../model/optionsDiff.js'
import { deepClone, deepEqual } from '../helper/objectUtils.js'

/**
 * Loads default and user options and returns a form state object that keeps
 * track of the current form data alongside customization metadata.
 */
export async function createFormState(defaultOptions) {
  const userOptions = await getUserOptions()
  const defaults = deepClone(defaultOptions)
  const overrides = deepClone(userOptions || {})
  const formData = mergeOptions(defaults, overrides)

  return {
    defaults,
    formData,
    customizedPaths: collectCustomizedPaths(defaults, formData),
  }
}

export function updateField(state, path, value) {
  setAtPath(state.formData, path, value)
  refreshCustomization(state, path)
}

export function resetField(state, path) {
  const defaultValue = getAtPath(state.defaults, path)
  if (typeof defaultValue === 'undefined') {
    deleteAtPath(state.formData, path)
  } else {
    setAtPath(state.formData, path, deepClone(defaultValue))
  }
  refreshCustomization(state, path)
}

export function resetAll(state) {
  state.formData = deepClone(state.defaults)
  state.customizedPaths = collectCustomizedPaths(state.defaults, state.formData)
}

export function appendItem(state, path, item) {
  const current = getAtPath(state.formData, path) || []
  const next = Array.isArray(current) ? [...current, item] : [item]
  setAtPath(state.formData, path, next)
  refreshCustomization(state, path)
}

export function removeItem(state, path, index) {
  const current = getAtPath(state.formData, path)
  if (!Array.isArray(current)) {
    return
  }
  const next = current.slice()
  next.splice(index, 1)
  setAtPath(state.formData, path, next)
  refreshCustomization(state, path)
}

export function getOverrides(state) {
  return computeOverrides(state.formData, state.defaults)
}

export function isCustomized(state, path) {
  return state.customizedPaths.has(path.join('.'))
}

export function customizedCount(state) {
  return state.customizedPaths.size
}

export function collectCustomizedPaths(defaults, current, basePath = []) {
  const customized = new Set()
  walkCustomization(defaults, current, basePath, customized)
  return customized
}

function walkCustomization(defaultValue, currentValue, basePath, customized) {
  if (!deepEqual(defaultValue, currentValue)) {
    const pathKey = basePath.join('.')
    if (pathKey.length) {
      customized.add(pathKey)
    }
  }

  if (Array.isArray(currentValue) || Array.isArray(defaultValue)) {
    const max = Math.max(
      Array.isArray(defaultValue) ? defaultValue.length : 0,
      Array.isArray(currentValue) ? currentValue.length : 0
    )
    for (let index = 0; index < max; index += 1) {
      const nextPath = [...basePath, String(index)]
      const defaultChild = Array.isArray(defaultValue) ? defaultValue[index] : undefined
      const currentChild = Array.isArray(currentValue) ? currentValue[index] : undefined
      walkCustomization(defaultChild, currentChild, nextPath, customized)
    }
    return
  }

  if (
    currentValue &&
    typeof currentValue === 'object' &&
    !Array.isArray(currentValue)
  ) {
    const keys = new Set([
      ...Object.keys(defaultValue || {}),
      ...Object.keys(currentValue || {}),
    ])
    for (const key of keys) {
      const nextPath = [...basePath, key]
      walkCustomization(
        defaultValue ? defaultValue[key] : undefined,
        currentValue ? currentValue[key] : undefined,
        nextPath,
        customized
      )
    }
  }
}

function refreshCustomization(state, path) {
  for (let length = path.length; length >= 1; length -= 1) {
    const slice = path.slice(0, length)
    const pathKey = slice.join('.')
    const defaultValue = getAtPath(state.defaults, slice)
    const currentValue = getAtPath(state.formData, slice)
    if (deepEqual(defaultValue, currentValue)) {
      state.customizedPaths.delete(pathKey)
    } else {
      state.customizedPaths.add(pathKey)
    }
  }
}

function mergeOptions(defaults, overrides) {
  const merged = deepClone(defaults)
  if (overrides && typeof overrides === 'object') {
    for (const [key, value] of Object.entries(overrides)) {
      merged[key] = deepClone(value)
    }
  }
  return merged
}

export function getAtPath(object, path) {
  return path.reduce((accumulator, segment) => {
    if (accumulator === undefined || accumulator === null) {
      return undefined
    }
    return accumulator[segment]
  }, object)
}

export function setAtPath(object, path, value) {
  if (!path.length) {
    throw new Error('Path must contain at least one segment')
  }
  let target = object
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    const nextSegment = path[index + 1]
    const expectsArray = isArrayIndex(nextSegment)
    let currentValue = target[segment]

    if (currentValue === undefined || currentValue === null) {
      currentValue = expectsArray ? [] : {}
      target[segment] = currentValue
    } else if (expectsArray && !Array.isArray(currentValue)) {
      currentValue = Array.isArray(currentValue) ? currentValue : [currentValue]
      target[segment] = currentValue
    } else if (!expectsArray && (typeof currentValue !== 'object' || Array.isArray(currentValue))) {
      currentValue = {}
      target[segment] = currentValue
    }

    target = currentValue
  }
  const lastSegment = path[path.length - 1]
  if (Array.isArray(target) && isArrayIndex(lastSegment)) {
    target[Number(lastSegment)] = value
  } else {
    target[lastSegment] = value
  }
}

export function deleteAtPath(object, path) {
  if (!path.length) {
    return
  }
  let target = object
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    if (target[segment] === undefined || target[segment] === null) {
      return
    }
    target = target[segment]
  }
  const lastSegment = path[path.length - 1]
  if (Array.isArray(target)) {
    target.splice(Number(lastSegment), 1)
  } else {
    delete target[lastSegment]
  }
}

function isArrayIndex(segment) {
  if (typeof segment === 'number') {
    return Number.isInteger(segment) && segment >= 0
  }
  if (typeof segment === 'string') {
    return /^[0-9]+$/.test(segment)
  }
  return false
}
