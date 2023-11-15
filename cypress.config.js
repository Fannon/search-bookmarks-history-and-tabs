const { defineConfig } = require('cypress')

module.exports = defineConfig({
  viewportWidth: 500,
  viewportHeight: 600,
  video: false,
  defaultCommandTimeout: 8000, // E2E Edge test is slow in CI/CD
  e2e: {
    baseUrl: 'http://localhost:8080/popup',
  },
})
