import { registerHooks } from 'node:module'

const sourceRoot = new URL('../popup/js/', import.meta.url).href
let revision = 0

// Bootstrap tests need fresh application modules after changing their dependency mocks.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context)
    if (result.url.startsWith(sourceRoot) && !result.url.includes('/__tests__/')) {
      const url = new URL(result.url)
      url.searchParams.set('testRevision', revision)
      result.url = url.href
    }
    return result
  },
})

export function resetModules() {
  revision++
}
