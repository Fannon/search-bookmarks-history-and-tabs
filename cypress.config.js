const { defineConfig } = require('cypress')

module.exports = defineConfig({
  viewportWidth: 500,
  viewportHeight: 600,
  video: false,
  defaultCommandTimeout: 8000, // E2E Edge test is slow in CI/CD
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.js')(on, config)
    },
    baseUrl: 'http://localhost:8080/popup',
  },
})
