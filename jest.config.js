export default {
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['<rootDir>/playwright/tests/'],
  moduleFileExtensions: ['js', 'json'],
  transform: {},
}
