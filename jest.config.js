/**
 * @fileoverview Jest configuration tailored to the popup codebase.
 *
 * Focuses on unit tests living beside their modules under popup/js while
 * ignoring Playwright specs and production bundles.
 */
export default {
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['<rootDir>/playwright/tests/'],
  coverageDirectory: 'reports/unit-test-coverage',
  collectCoverageFrom: [
    'popup/js/**/*.js',
    '!popup/js/**/*.test.js',
    '!popup/js/**/__tests__/**',
    '!popup/js/**/*.bundle.min.js',
  ],
  moduleFileExtensions: ['js', 'json'],
  transform: {},

  reporters: [['default', { summaryThreshold: 0 }]],

  // Parallelization and performance optimizations
  maxWorkers: '80%', // Use 80% of available cores for better resource management
  cache: true, // Enable test result caching
  cacheDirectory: '<rootDir>/node_modules/.jest-cache',

  // Test execution optimizations
  testTimeout: 5000, // 5 second timeout to prevent hanging tests
  detectOpenHandles: true, // Detect handles that prevent Jest from exiting
  forceExit: true, // Force Jest to exit after tests complete

  // Performance optimizations
  collectCoverage: false, // Disable coverage collection during regular test runs
  coverageProvider: 'v8', // Use V8 coverage provider for better performance

  // Additional performance settings
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
}
