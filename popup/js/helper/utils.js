/**
 * Get text how long a date is ago
 *
 * @see https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
 */
export function timeSince(date) {
  // Handle invalid inputs
  if (!date || isNaN(new Date(date).getTime())) {
    return 'Invalid date'
  }

  const seconds = Math.floor((new Date() - new Date(date)) / 1000)

  // Handle future dates
  if (seconds < 0) {
    return '0 seconds'
  }

  const intervals = [
    { unitSeconds: 31536000, label: 'year' },
    { unitSeconds: 2592000, label: 'month' },
    { unitSeconds: 86400, label: 'day' },
    { unitSeconds: 3600, label: 'hour' },
    { unitSeconds: 60, label: 'minute' },
  ]

  for (const { unitSeconds, label } of intervals) {
    const count = Math.floor(seconds / unitSeconds)
    if (count >= 1) {
      return `${count} ${label}${count === 1 ? '' : 's'}`
    }
  }

  const secondsCount = Math.floor(seconds)
  const secondsLabel = secondsCount === 1 ? 'second' : 'seconds'
  return `${secondsCount} ${secondsLabel}`
}

/**
 * Remove http://, http://, www, trailing slashes from URLs
 * @see https://stackoverflow.com/a/57698415
 */
export function cleanUpUrl(url) {
  // Handle null, undefined, or empty inputs
  if (!url) {
    return ''
  }

  // Convert to string and clean up
  const urlString = String(url)
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .replace(/\/$/, '')
    .toLowerCase()

  return urlString
}

// Cache for loaded scripts to avoid duplicate loading
const loadedScripts = new Set()

export async function loadScript(url) {
  // Return immediately if already loaded
  if (loadedScripts.has(url)) {
    return Promise.resolve()
  }

  return new Promise(function (resolve, reject) {
    const s = document.createElement('script')
    s.type = 'text/javascript'
    s.onload = () => {
      loadedScripts.add(url)
      resolve()
    }
    s.onerror = () => {
      reject(new Error(`Failed to load script: ${url}`))
    }
    s.src = url
    document.getElementsByTagName('head')[0].appendChild(s)
  })
}

export function printError(err, text) {
  let html = ''
  if (text) {
    html += `<li class="error"><b>Error</b>: ${text}</span>`
    console.error(text)
  }
  console.error(err)
  html += `<li class="error"><b>Error Message</b>: ${err.message}</span>`
  if (err.stack) {
    html += `<li class="error"><b>Error Stack</b>: ${err.stack}</li>`
  }
  const errorList = document.getElementById('error-list')
  errorList.innerHTML = html + errorList.innerHTML
  errorList.style = 'display: block;'
}
