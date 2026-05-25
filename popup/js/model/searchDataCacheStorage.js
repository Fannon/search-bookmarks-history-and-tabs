import { browserApi } from '../helper/browserApi.js'

export const SEARCH_DATA_CACHE_KEY = 'searchDataCache:v1'

function getLocalStorageArea() {
  return ext.browserApi?.storage?.local || browserApi.storage?.local
}

function getLastStorageError() {
  return ext.browserApi?.runtime?.lastError || browserApi.runtime?.lastError
}

export async function loadRawSearchDataCache() {
  const storage = getLocalStorageArea()
  if (storage?.get) {
    return new Promise((resolve, reject) => {
      try {
        const maybePromise = storage.get([SEARCH_DATA_CACHE_KEY], (result) => {
          const error = getLastStorageError()
          if (error) {
            reject(error)
          } else {
            resolve(result?.[SEARCH_DATA_CACHE_KEY])
          }
        })

        if (maybePromise?.then) {
          maybePromise.then((result) => resolve(result?.[SEARCH_DATA_CACHE_KEY])).catch(reject)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  try {
    const value = window.localStorage?.getItem(SEARCH_DATA_CACHE_KEY)
    return value ? JSON.parse(value) : undefined
  } catch (err) {
    console.warn('Could not read search data cache from localStorage.', err)
    return undefined
  }
}

export async function saveRawSearchDataCache(value) {
  const storage = getLocalStorageArea()
  if (storage?.set) {
    return new Promise((resolve, reject) => {
      try {
        const maybePromise = storage.set({ [SEARCH_DATA_CACHE_KEY]: value }, () => {
          const error = getLastStorageError()
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })

        if (maybePromise?.then) {
          maybePromise.then(resolve).catch(reject)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  try {
    window.localStorage?.setItem(SEARCH_DATA_CACHE_KEY, JSON.stringify(value))
  } catch (err) {
    console.warn('Could not write search data cache to localStorage.', err)
  }
}

export async function clearSearchDataCache() {
  const storage = getLocalStorageArea()
  if (storage?.remove) {
    return new Promise((resolve, reject) => {
      try {
        const maybePromise = storage.remove(SEARCH_DATA_CACHE_KEY, () => {
          const error = getLastStorageError()
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })

        if (maybePromise?.then) {
          maybePromise.then(resolve).catch(reject)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  try {
    window.localStorage?.removeItem(SEARCH_DATA_CACHE_KEY)
  } catch (err) {
    console.warn('Could not remove search data cache from localStorage.', err)
  }
}
