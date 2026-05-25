import { browserApi } from '../helper/browserApi.js'

export const SEARCH_DATA_CACHE_KEY = 'searchDataCache:v1'

function getExtensionStorage() {
  return ext.browserApi?.storage?.local || browserApi.storage?.local
}

function getLastStorageError() {
  return ext.browserApi?.runtime?.lastError || browserApi.runtime?.lastError
}

export async function loadRawSearchDataCache() {
  const startTime = performance.now()
  try {
    const raw = window.localStorage?.getItem(SEARCH_DATA_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      console.debug(`Cache localStorage read took ${Math.round(performance.now() - startTime)}ms (${raw.length} chars)`)
      return parsed
    }
  } catch (_err) {
    // localStorage unavailable or parse failed — fall through to extension storage
  }

  const storage = getExtensionStorage()
  if (storage?.get) {
    return new Promise((resolve, reject) => {
      try {
        const maybePromise = storage.get([SEARCH_DATA_CACHE_KEY], (result) => {
          const error = getLastStorageError()
          if (error) {
            reject(error)
          } else {
            const value = result?.[SEARCH_DATA_CACHE_KEY]
            console.debug(`Cache extension storage read took ${Math.round(performance.now() - startTime)}ms`)
            resolve(value)
          }
        })

        if (maybePromise?.then) {
          maybePromise
            .then((result) => {
              const value = result?.[SEARCH_DATA_CACHE_KEY]
              console.debug(`Cache extension storage read took ${Math.round(performance.now() - startTime)}ms`)
              resolve(value)
            })
            .catch(reject)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  return undefined
}

export async function saveRawSearchDataCache(value) {
  const startTime = performance.now()
  const serialized = JSON.stringify(value)

  try {
    window.localStorage?.setItem(SEARCH_DATA_CACHE_KEY, serialized)
    console.debug(
      `Cache localStorage write took ${Math.round(performance.now() - startTime)}ms (${serialized.length} chars)`,
    )
    return
  } catch (_err) {
    // Quota exceeded or localStorage unavailable — fall back to extension storage
  }

  const storage = getExtensionStorage()
  if (storage?.set) {
    return new Promise((resolve, reject) => {
      try {
        const maybePromise = storage.set({ [SEARCH_DATA_CACHE_KEY]: value }, () => {
          const error = getLastStorageError()
          if (error) {
            reject(error)
          } else {
            console.debug(
              `Cache extension storage write took ${Math.round(performance.now() - startTime)}ms (${serialized.length} chars)`,
            )
            resolve()
          }
        })

        if (maybePromise?.then) {
          maybePromise
            .then(() => {
              console.debug(
                `Cache extension storage write took ${Math.round(performance.now() - startTime)}ms (${serialized.length} chars)`,
              )
              resolve()
            })
            .catch(reject)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  console.warn('Could not write search data cache to localStorage or extension storage.')
}

export async function clearSearchDataCache() {
  try {
    window.localStorage?.removeItem(SEARCH_DATA_CACHE_KEY)
    return
  } catch (_err) {
    // fall through
  }

  const storage = getExtensionStorage()
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
}
