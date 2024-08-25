import { defineConfig } from 'cypress'

export default defineConfig({
  viewportWidth: 500,
  viewportHeight: 600,
  video: false,
  defaultCommandTimeout: 4000, // E2E Edge test is slow in CI/CD
  e2e: {
    baseUrl: 'http://localhost:8080/popup',
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
})
