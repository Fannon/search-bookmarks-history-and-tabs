import js from '@eslint/js'
import pluginCypress from 'eslint-plugin-cypress'
import globals from 'globals'

export default [
  {
    ignores: ['popup/lib/**.*', '/reports/*'],
  },
  js.configs.recommended,
  {
    plugins: {
      cypress: pluginCypress,
    },
    rules: {
      'cypress/unsafe-to-chain-command': 'error',
    },
  },
  {
    files: ['popup/js/**/*.js'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        'cypress/globals': true,
        'module': 'writable',
        'ext': 'writable',
        'Tagify': 'readonly',
        'Mark': 'readonly',
        'jsyaml': 'readonly',
        'uFuzzy': 'readonly',
      },
    },
    rules: {
      'no-console': ['error', { allow: ['debug', 'warn', 'error'] }],
      'semi': ['warn', 'never'],
      'comma-dangle': ['warn', 'only-multiline'],
    },
  },
]
