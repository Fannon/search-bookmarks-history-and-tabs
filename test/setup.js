import { after, afterEach, mock } from 'node:test'
import { JSDOM } from 'jsdom'
import './modules.js'

const dom = new JSDOM('', { url: 'http://localhost/', pretendToBeVisual: true })
for (const name of Object.getOwnPropertyNames(dom.window)) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, { value: dom.window[name], writable: true, configurable: true })
  }
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
globalThis.window = globalThis
for (const name of ['Event', 'EventTarget', 'AbortController', 'AbortSignal']) {
  globalThis[name] = dom.window[name]
}
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  get: () => dom.window.location,
  set: (value) => {
    dom.window.location.href = value
  },
})
const listeners = []
globalThis.addEventListener = (type, listener, options) => {
  listeners.push({ type, listener, options })
  dom.window.addEventListener(type, listener, options)
}
for (const name of ['removeEventListener', 'dispatchEvent', 'getComputedStyle']) {
  globalThis[name] = dom.window[name].bind(dom.window)
}
afterEach(() => {
  mock.restoreAll()
  for (const { type, listener, options } of listeners) dom.window.removeEventListener(type, listener, options)
  listeners.length = 0
})
after(() => dom.window.close())
