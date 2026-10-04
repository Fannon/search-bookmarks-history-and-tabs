import '../../../../test/setup.js'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { matches } from '../../../../test/patterns.js'
import { closeErrors, printError } from '../errorView.js'

describe('closeErrors', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="error-overlay" class="error-overlay" style="display: block">content</div>
    `
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })
  it('hides the error overlay when present', () => {
    closeErrors()
    const overlay = document.getElementById('error-overlay')
    assert.strictEqual(overlay.style.display, 'none')
    assert.strictEqual(overlay.innerHTML, '')
  })
  it('does nothing when error elements are missing', () => {
    document.body.innerHTML = ''
    assert.doesNotThrow(() => closeErrors())
  })
})
describe('printError with overlay', () => {
  let consoleErrorSpy
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="error-overlay" class="error-overlay" style="display: none"></div>
    `
    consoleErrorSpy = mock.method(console, 'error', () => {})
  })
  afterEach(() => {
    consoleErrorSpy.mock.restore()
    closeErrors() // Clear error queue between tests
    document.body.innerHTML = ''
  })
  it('renders error in the overlay with dismiss button', () => {
    const err = new Error('Test error message')
    printError(err, 'Something went wrong')
    const overlay = document.getElementById('error-overlay')
    assert.strictEqual(overlay.style.display, 'block')
    assert(overlay.innerHTML.includes('⚠️ An Error Occurred'))
    assert(overlay.innerHTML.includes('Something went wrong'))
    assert(overlay.innerHTML.includes('Test error message'))
    assert(overlay.innerHTML.includes('DISMISS'))
    assert(consoleErrorSpy.mock.callCount() > 0)
  })
  it('renders context with strong tag', () => {
    printError(new Error('Test'), 'Context message')
    const overlay = document.getElementById('error-overlay')
    assert(overlay.innerHTML.includes('<strong>Context message</strong>'))
  })
  it('renders stack trace with word wrap', () => {
    const err = new Error('Test')
    err.stack = 'Error: Test\n    at someFunction (file.js:10:5)'
    printError(err)
    const overlay = document.getElementById('error-overlay')
    assert(overlay.innerHTML.includes('error-stack'))
    assert(overlay.innerHTML.includes('at someFunction'))
  })
  it('accumulates multiple errors with count in header', () => {
    printError(new Error('First error'))
    printError(new Error('Second error'))
    const overlay = document.getElementById('error-overlay')
    assert(overlay.innerHTML.includes('⚠️ 2 Errors Occurred'))
    assert(overlay.innerHTML.includes('First error'))
    assert(overlay.innerHTML.includes('Second error'))
  })
  it('sanitizes HTML in error messages', () => {
    const err = new Error('<script>alert(1)</script>')
    printError(err, '<b>bad markup</b>')
    const overlay = document.getElementById('error-overlay')
    assert(overlay.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
    assert(overlay.innerHTML.includes('&lt;b&gt;bad markup&lt;/b&gt;'))
  })
  it('removes the Escape listener when the overlay is dismissed by button', () => {
    const addSpy = mock.method(document, 'addEventListener')
    const removeSpy = mock.method(document, 'removeEventListener')
    printError(new Error('Dismiss me'))
    const keydownHandler = addSpy.mock.calls
      .map((call) => call.arguments)
      .find(([eventName]) => eventName === 'keydown')?.[1]
    document.getElementById('btn-dismiss-error').click()
    assert.notStrictEqual(keydownHandler, undefined)
    assert(removeSpy.mock.calls.some((call) => matches(call.arguments, ['keydown', keydownHandler])))
    addSpy.mock.restore()
    removeSpy.mock.restore()
  })
})
describe('printError no DOM element', () => {
  let consoleErrorSpy
  let consoleWarnSpy
  beforeEach(() => {
    document.body.innerHTML = ''
    consoleErrorSpy = mock.method(console, 'error', () => {})
    consoleWarnSpy = mock.method(console, 'warn', () => {})
  })
  afterEach(() => {
    consoleErrorSpy.mock.restore()
    consoleWarnSpy.mock.restore()
    closeErrors() // Clear error queue between tests
  })
  it('handles missing error elements gracefully', () => {
    assert.doesNotThrow(() => printError(new Error('boom')))
    assert(consoleErrorSpy.mock.callCount() > 0)
    assert(consoleWarnSpy.mock.callCount() > 0)
  })
})
