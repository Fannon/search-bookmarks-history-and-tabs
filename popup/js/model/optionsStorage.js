/**
 * @file Lightweight runtime option storage helpers.
 */

import { defaultOptions, emptyOptions } from './optionsDefaults.js'

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
          return resolve(result.userOptions || emptyOptions)
        })
      } else {
        console.warn('No storage API found. Falling back to local Web Storage')
        const userOptionsString = window.localStorage.getItem('userOptions')
        return resolve(userOptionsString ? JSON.parse(userOptionsString) : emptyOptions)
      }
    } catch (err) {
      return reject(err)
    }
  })
}

/**
 * Gets effective runtime options by merging trusted stored overrides onto defaults.
 *
 * @returns {Promise<Object>} Effective options object.
 */
export async function getEffectiveOptions() {
  try {
    return {
      ...defaultOptions,
      ...(await getUserOptions()),
    }
  } catch (err) {
    console.warn('Could not get valid user options, falling back to defaults.', err)
    return defaultOptions
  }
}
