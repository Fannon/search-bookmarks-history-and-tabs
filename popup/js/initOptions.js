import { extensionNamespace } from './model/namespace.js'
import { initOptions } from './view/editOptionsView.js'

const ext = extensionNamespace
window.ext = ext

// Trigger initialization
initOptions().catch((err) => {
  console.error(err)
  document.getElementById('footer-error').innerText = err.message
})
