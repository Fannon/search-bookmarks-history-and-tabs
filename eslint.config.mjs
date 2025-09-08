import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
const compat = new FlatCompat()

export default [
  {
    ignores: ['popup/lib/**.*', '/reports/*'],
  },
  js.configs.recommended,
  ...compat.config({
    extends: ['plugin:cypress/recommended'],
  }),
  {
    files: ['popup/js/**/*.js'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        'browser': true,
        'es2021': true,
        'webextensions': true,
        'cypress/globals': true,
        'commonjs': true,

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
