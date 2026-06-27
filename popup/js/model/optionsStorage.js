/**
 * @file Lightweight runtime option storage helpers.
 */

import { printError } from '../view/errorView.js'
import { defaultOptions } from './optionsDefaults.js'

const legacyUserOptionKeys = new Set(['displayIcons'])

/**
 * Writes trusted user settings to sync storage, falling back to local storage.
 *
 * @param {Object} [userOptions={}] User overrides to persist.
 * @returns {Promise<void>}
 */
export async function setUserOptions(userOptions = {}) {
  return new Promise((resolve, reject) => {
    if (ext.browserApi.storage?.sync) {
      ext.browserApi.storage.sync.set({ userOptions }, () => {
        if (ext.browserApi.runtime.lastError) {
          return reject(ext.browserApi.runtime.lastError)
        }
        return resolve()
      })
    } else {
      console.warn('No storage API found. Falling back to local Web Storage')
      window.localStorage.setItem('userOptions', JSON.stringify(userOptions))
      return resolve()
    }
  })
}

/**
 * Get stored user option overrides.
 *
 * @returns {Promise<Object>} Stored user overrides.
 */
export async function getUserOptions() {
  return new Promise((resolve, reject) => {
    try {
      if (ext.browserApi.storage?.sync) {
        ext.browserApi.storage.sync.get(['userOptions'], (result) => {
          if (ext.browserApi.runtime.lastError) {
            return reject(ext.browserApi.runtime.lastError)
          }
          return resolve(removeLegacyUserOptions(result.userOptions || {}))
        })
      } else {
        console.warn('No storage API found. Falling back to local Web Storage')
        const userOptionsString = window.localStorage.getItem('userOptions')
        return resolve(removeLegacyUserOptions(userOptionsString ? JSON.parse(userOptionsString) : {}))
      }
    } catch (err) {
      return reject(err)
    }
  })
}

/**
 * Gets effective runtime options by merging trusted stored overrides onto defaults.
 *
 * Stored keys that are not present in `defaultOptions` are silently dropped,
 * guarding against stale keys left over from previous extension versions.
 *
 * @returns {Promise<Object>} Effective options object.
 */
export async function getEffectiveOptions() {
  try {
    const userOptions = await getUserOptions()
    const filtered = filterKnownOptions(userOptions)
    return {
      ...defaultOptions,
      ...filtered,
    }
  } catch (err) {
    printError(err, 'Could not get valid user options, falling back to defaults.')
    return { ...defaultOptions }
  }
}

/**
 * Strip stored keys that are not present in the current defaults.
 *
 * @param {Object} userOptions Raw stored overrides.
 * @returns {Object} Overrides whose keys exist in `defaultOptions`.
 */
function filterKnownOptions(userOptions) {
  if (!userOptions || typeof userOptions !== 'object') return {}

  const filtered = {}

  for (const key of Object.keys(userOptions)) {
    if (Object.hasOwn(defaultOptions, key)) {
      filtered[key] = userOptions[key]
    } else {
      console.warn(`Unknown user option: "${key}". It will be ignored and removed.`)
    }
  }

  return filtered
}

function removeLegacyUserOptions(userOptions) {
  if (!userOptions || typeof userOptions !== 'object') return {}

  const filtered = {}

  for (const [key, value] of Object.entries(userOptions)) {
    if (!legacyUserOptionKeys.has(key)) {
      filtered[key] = value
    }
  }

  return filtered
}
