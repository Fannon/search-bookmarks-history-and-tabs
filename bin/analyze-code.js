#!/usr/bin/env node
/**
 * @file Collects repository-wide file statistics for maintenance.
 *
 * Invoked via `npm run analyze` to summarize how many lines of code, comments,
 * and empty lines exist across source, test, and auxiliary files. The report
 * helps track documentation coverage and spot unexpected growth in bundles
 * without building the extension.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const INCLUDE_PATTERNS = [
  '**/*.js',
  '**/*.mjs',
  '**/*.ts',
  '**/*.json',
  '**/*.html',
  '**/*.css',
  '**/*.md',
  '**/*.yml',
  '**/*.yaml',
]

const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/test-results/**',
  '**/reports/**',
  'package-lock.json',
  '**/*.min.js',
  '**/mockData/**',
]

const TEST_PATTERNS = [
  '**/__tests__/**',
  '**/*.test.js',
  '**/*.spec.js',
  '**/*.test.mjs',
  '**/*.spec.mjs',
  '**/tests/**',
]

class CodeAnalyzer {
  constructor() {
    this.stats = {
      total: {
        files: 0,
        lines: 0,
        codeLines: 0,
        commentLines: 0,
        emptyLines: 0,
      },
      source: {
        files: 0,
        lines: 0,
        codeLines: 0,
        commentLines: 0,
        emptyLines: 0,
      },
      tests: {
        files: 0,
        lines: 0,
        codeLines: 0,
        commentLines: 0,
        emptyLines: 0,
      },
      other: {
        files: 0,
        lines: 0,
        codeLines: 0,
        commentLines: 0,
        emptyLines: 0,
      },
    }
  }

  /**
   * Determine whether a path should be included in the analysis run.
   *
   * @param {string} filePath - Path to evaluate.
   * @returns {boolean} True when the file matches include patterns.
   */
  shouldIncludeFile(filePath) {
    // Exclude build artifacts and vendor directories before considering matches
    for (const pattern of EXCLUDE_PATTERNS) {
      if (new RegExp(pattern.replace(/\*\*/g, '.*')).test(filePath)) {
        return false
      }
    }

    // Check include patterns
    for (const pattern of INCLUDE_PATTERNS) {
      if (
        new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\./g, '\\.')).test(
          filePath,
        )
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Check if a file should be categorised as a test artefact.
   *
   * @param {string} filePath - Path to evaluate.
   * @returns {boolean} True when the file matches test patterns.
   */
  isTestFile(filePath) {
    for (const pattern of TEST_PATTERNS) {
      if (new RegExp(pattern.replace(/\*\*/g, '.*')).test(filePath)) {
        return true
      }
    }
    return false
  }

  /**
   * Collect statistics for a single file and aggregate them into totals.
   *
   * @param {string} filePath - File to scan.
   */
  analyzeFile(filePath) {
    if (!this.shouldIncludeFile(filePath)) {
      return
    }

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const isTest = this.isTestFile(filePath)

    const fileStats = {
      lines: lines.length,
      codeLines: 0,
      commentLines: 0,
      emptyLines: 0,
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line === '') {
        fileStats.emptyLines++
      } else if (this.isCommentLine(line, filePath)) {
        fileStats.commentLines++
      } else {
        fileStats.codeLines++
      }
    }

    // Update totals
    this.stats.total.files++
    this.stats.total.lines += fileStats.lines
    this.stats.total.codeLines += fileStats.codeLines
    this.stats.total.commentLines += fileStats.commentLines
    this.stats.total.emptyLines += fileStats.emptyLines

    if (isTest) {
      this.stats.tests.files++
      this.stats.tests.lines += fileStats.lines
      this.stats.tests.codeLines += fileStats.codeLines
      this.stats.tests.commentLines += fileStats.commentLines
      this.stats.tests.emptyLines += fileStats.emptyLines
    } else {
      // Separate source files from other files
      const isSourceFile = this.isSourceFile(filePath)
      if (isSourceFile) {
        this.stats.source.files++
        this.stats.source.lines += fileStats.lines
        this.stats.source.codeLines += fileStats.codeLines
        this.stats.source.commentLines += fileStats.commentLines
        this.stats.source.emptyLines += fileStats.emptyLines
      } else {
        this.stats.other.files++
        this.stats.other.lines += fileStats.lines
        this.stats.other.codeLines += fileStats.codeLines
        this.stats.other.commentLines += fileStats.commentLines
        this.stats.other.emptyLines += fileStats.emptyLines
      }
    }
  }

  /**
   * Determine whether a file should count as source code.
   *
   * @param {string} filePath - Path to evaluate.
   * @returns {boolean} True when the file is source (non-test) code.
   */
  isSourceFile(filePath) {
    // Consider .js, .mjs, .ts files as source (but not test files)
    return /\.(js|mjs|ts)$/.test(filePath) && !this.isTestFile(filePath)
  }

  /**
   * Detect if a trimmed line represents a comment for supported file types.
   *
   * @param {string} line - Trimmed line text.
   * @param {string} filePath - Path of the file being analyzed.
   * @returns {boolean} True when line is a comment.
   */
  isCommentLine(line, filePath) {
    if (
      filePath.endsWith('.js') ||
      filePath.endsWith('.mjs') ||
      filePath.endsWith('.ts')
    ) {
      // JavaScript/TypeScript comments
      return (
        line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')
      )
    } else if (filePath.endsWith('.html')) {
      // HTML comments
      return line.startsWith('<!--')
    } else if (filePath.endsWith('.css')) {
      // CSS comments
      return line.startsWith('/*')
    } else if (filePath.endsWith('.md')) {
      // Markdown comments (no standard comments, but could consider HTML comments)
      return line.startsWith('<!--')
    } else if (filePath.endsWith('.json')) {
      // JSON doesn't have comments
      return false
    } else if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      // YAML comments
      return line.startsWith('#')
    }
    return false
  }

  /**
   * Walk directories recursively and feed every file into the analyzer.
   *
   * @param {string} dir - Directory to traverse.
   */
  walkDirectory(dir) {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        this.walkDirectory(filePath)
      } else {
        this.analyzeFile(filePath)
      }
    }
  }

  /**
   * Print the aggregated statistics to stderr in a readable format.
   */
  generateReport() {
    console.error('📊 CODEBASE ANALYSIS REPORT')
    console.error('=====================================\n')

    const formatSection = (title, stats) => {
      if (stats.files === 0) return ''

      const codePercentage = ((stats.codeLines / stats.lines) * 100).toFixed(1)
      const commentPercentage = (
        (stats.commentLines / stats.lines) *
        100
      ).toFixed(1)
      const emptyPercentage = ((stats.emptyLines / stats.lines) * 100).toFixed(
        1,
      )

      return `
${title}:
  Files: ${stats.files}
  Total Lines: ${stats.lines.toLocaleString()}
  Code Lines: ${stats.codeLines.toLocaleString()} (${codePercentage}%)
  Comment Lines: ${stats.commentLines.toLocaleString()} (${commentPercentage}%)
  Empty Lines: ${stats.emptyLines.toLocaleString()} (${emptyPercentage}%)
`
    }

    console.error(formatSection('TOTAL', this.stats.total))
    console.error(formatSection('SOURCE CODE', this.stats.source))
    console.error(formatSection('TESTS', this.stats.tests))
    console.error(formatSection('OTHER FILES', this.stats.other))

    // Summary ratios
    console.error('\nSUMMARY RATIOS:')
    console.error('=====================================')
    if (this.stats.source.lines > 0) {
      const testToSourceRatio = (
        (this.stats.tests.lines / this.stats.source.lines) *
        100
      ).toFixed(1)
      console.error(`Test to Source Code Ratio: ${testToSourceRatio}%`)
    }

    if (this.stats.total.lines > 0) {
      const commentToCodeRatio = (
        (this.stats.total.commentLines / this.stats.total.codeLines) *
        100
      ).toFixed(1)
      console.error(`Comment to Code Ratio: ${commentToCodeRatio}%`)
    }
  }
}

// Run analysis
const analyzer = new CodeAnalyzer()
analyzer.walkDirectory(path.join(__dirname, '..', 'popup'))
analyzer.generateReport()
