#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { globSync, mkdirSync } from 'node:fs'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    watch: { type: 'boolean' },
    coverage: { type: 'boolean' },
    'test-name-pattern': { type: 'string' },
    'test-concurrency': { type: 'string', default: '2' },
  },
})
const args = [
  '--test',
  '--experimental-test-module-mocks',
  '--test-timeout=5000',
  `--test-concurrency=${values['test-concurrency']}`,
  '--test-reporter=spec',
]
if (values.watch) args.push('--watch')
if (values['test-name-pattern']) args.push(`--test-name-pattern=${values['test-name-pattern']}`)
if (values.coverage) {
  mkdirSync('reports/unit-test-coverage', { recursive: true })
  args.push(
    '--experimental-test-coverage',
    '--test-coverage-include=popup/js/**/*.js',
    '--test-coverage-exclude=popup/js/**/__tests__/**',
    '--test-coverage-exclude=popup/js/**/*.bundle.min.js',
    '--test-reporter=lcov',
    '--test-reporter-destination=stdout',
    '--test-reporter-destination=reports/unit-test-coverage/lcov.info',
  )
}
const files = positionals.length
  ? positionals.flatMap((pattern) => globSync(pattern))
  : globSync(['popup/js/**/*.test.js', 'bin/**/*.test.js', 'test/**/*.test.js'])
if (!files.length) {
  console.error('No unit tests matched the supplied paths or globs.')
  process.exit(1)
}
const child = spawn(process.execPath, [...args, ...files], { stdio: 'inherit' })
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
