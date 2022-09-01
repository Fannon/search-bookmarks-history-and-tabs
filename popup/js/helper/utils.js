/**
 * Get text how long a date is ago
 *
 * @see https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
 */
export function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000)

  let interval = seconds / 31536000

  if (interval > 1) {
    return Math.floor(interval) + ' years'
  }
  interval = seconds / 2592000
  if (interval > 1) {
    return Math.floor(interval) + ' months'
  }
  interval = seconds / 86400
  if (interval > 1) {
    return Math.floor(interval) + ' days'
  }
  interval = seconds / 3600
  if (interval > 1) {
    return Math.floor(interval) + ' hours'
  }
  interval = seconds / 60
  if (interval > 1) {
    return Math.floor(interval) + ' minutes'
  }
  return Math.floor(seconds) + ' seconds'
}

/**
 * Remove http:// or http:// and www from URLs
 * Remove trailing slashes
 * @see https://stackoverflow.com/a/57698415
 */
export function cleanUpUrl(url) {
  return url
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

/**
 * Dynamically load a Javascript file
 */
export async function loadScript(url) {
  return new Promise(function (resolve) {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.onload = resolve
    script.src = url
    document.getElementsByTagName('head')[0].appendChild(script)
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
