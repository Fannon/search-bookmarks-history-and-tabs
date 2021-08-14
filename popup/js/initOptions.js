import { initOptions } from "./view/editOptionsView.js"

// Trigger initialization
initOptions().catch((err) => {
  console.error(err)
  document.getElementById("footer-error").innerText = err.message
})
