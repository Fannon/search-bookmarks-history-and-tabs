import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['popup/lib/**.*', '/reports/*', 'playwright/**/*'],
  },
  js.configs.recommended,
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
        module: 'writable',
        ext: 'writable',
        Tagify: 'readonly',
        Mark: 'readonly',
        jsyaml: 'readonly',
        uFuzzy: 'readonly',
      },
    },
    rules: {
      'no-console': ['error', { allow: ['debug', 'warn', 'error'] }],
      'semi': ['warn', 'never'],
      'comma-dangle': ['warn', 'only-multiline'],
    },
  },
]
