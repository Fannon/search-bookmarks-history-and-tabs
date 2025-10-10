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
}
