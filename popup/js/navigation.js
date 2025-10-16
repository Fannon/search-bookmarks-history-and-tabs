/**
 * Redirects the popup to a different HTML file while preserving the hash.
 * @param {string} relativePath Target path including hash.
 */
export function redirectTo(relativePath) {
  window.location.replace(relativePath)
}
