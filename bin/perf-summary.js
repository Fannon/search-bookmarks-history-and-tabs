#!/usr/bin/env node

/**
 * @file Aggregates and prints a summary of performance benchmark results.
 *
 * This script parses outputs from Jest and Playwright performance tests,
 * generates a formatted Markdown summary, and checks for performance regressions
 * against established baselines.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jestLog = 'reports/jest_output.txt'
const playwrightLog = 'reports/playwright_output.txt'
const summaryFile = 'reports/perf-summary.md'
const baselinesFile = path.join(__dirname, 'perf-baselines.json')

/**
 * Parse a timing string like "9.28ms" or "N/A" into milliseconds
 */
function parseMs(str) {
  if (!str || str === 'N/A') return null
  const match = str.match(/([\d.]+)\s*ms/)
  return match ? parseFloat(match[1]) : null
}

/**
 * Check performance results against baselines
 * @returns {Object} { passed: boolean, failures: Array<{test, actual, baseline, threshold}> }
 */
function checkRegressions(jestResults, playwrightResults) {
  if (!fs.existsSync(baselinesFile)) {
    console.log('⚠️  No baselines file found, skipping regression check')
    return { passed: true, failures: [] }
  }

  const baselines = JSON.parse(fs.readFileSync(baselinesFile, 'utf-8'))
  const tolerance = baselines.toleranceMultiplier || 2.0
  const failures = []

  // Check Jest results
  for (const [testName, actualMs] of Object.entries(jestResults)) {
    const baselineMs = baselines.baselines?.jest?.[testName]
    if (baselineMs != null && actualMs != null) {
      const threshold = baselineMs * tolerance
      if (actualMs > threshold) {
        failures.push({
          test: `[Jest] ${testName}`,
          actual: actualMs,
          baseline: baselineMs,
          threshold,
        })
      }
    }
  }

  // Check Playwright results
  for (const [testName, actualMs] of Object.entries(playwrightResults)) {
    const baselineMs = baselines.baselines?.playwright?.[testName]
    if (baselineMs != null && actualMs != null) {
      const threshold = baselineMs * tolerance
      if (actualMs > threshold) {
        failures.push({
          test: `[Playwright] ${testName}`,
          actual: actualMs,
          baseline: baselineMs,
          threshold,
        })
      }
    }
  }

  return { passed: failures.length === 0, failures }
}

function generateSummary() {
  const lines = []
  const jestResults = {}
  const playwrightResults = {}

  lines.push('# Performance Benchmark Summary')
  lines.push('')

  fs.ensureDirSync('./reports')

  // 1. Parse Jest output into sections
  if (fs.existsSync(jestLog)) {
    const content = fs.readFileSync(jestLog, 'utf-8')
    const contentLines = content.split('\n')

    // Parse sections based on headers
    const sections = {
      dataLoading: { header: 'Data Loading/Conversion Performance', rows: [], cols: 2 },
      scoring: { header: 'Scoring Algorithm Performance', rows: [], cols: 2 },
      singleQuery: { header: 'Single-Query Search Performance', rows: [], cols: 3 },
      incremental: { header: 'Incremental Typing Performance', rows: [], cols: 3 },
      coldStart: { header: 'Cold Start', rows: [], cols: 3 },
    }

    let currentSection = null

    for (const line of contentLines) {
      // Check for section headers
      if (line.includes('Data Loading')) {
        currentSection = 'dataLoading'
      } else if (line.includes('Scoring Algorithm')) {
        currentSection = 'scoring'
      } else if (line.includes('Single-Query Search')) {
        currentSection = 'singleQuery'
      } else if (line.includes('Incremental Typing')) {
        currentSection = 'incremental'
      } else if (line.includes('Cold Start') && line.includes('|') && line.includes('ms')) {
        // Cold start is a single row, parse it directly
        const parts = line
          .split('|')
          .map((p) => p.trim())
          .filter((p) => p !== '')
        if (parts.length === 3) {
          sections.coldStart.rows.push(parts)
          const preciseMs = parseMs(parts[1])
          const fuzzyMs = parseMs(parts[2])
          if (preciseMs != null) jestResults[`${parts[0]} Precise`] = preciseMs
          if (fuzzyMs != null) jestResults[`${parts[0]} Fuzzy`] = fuzzyMs
        }
      } else if (currentSection && line.includes('|') && line.includes('ms')) {
        // Parse table row
        const parts = line
          .split('|')
          .map((p) => p.trim())
          .filter((p) => p !== '')

        if (parts.length >= sections[currentSection].cols) {
          sections[currentSection].rows.push(parts)

          // Extract timing for regression check
          const scenario = parts[0]
          if (parts.length === 2) {
            const ms = parseMs(parts[1])
            if (ms != null) jestResults[`${currentSection} ${scenario}`] = ms
          } else if (parts.length === 3) {
            const preciseMs = parseMs(parts[1])
            const fuzzyMs = parseMs(parts[2])
            if (preciseMs != null) jestResults[`${scenario} Precise`] = preciseMs
            if (fuzzyMs != null) jestResults[`${scenario} Fuzzy`] = fuzzyMs
          }
        }
      }
    }

    // Helper to render a table
    const renderTable = (title, headers, rows) => {
      if (rows.length === 0) return
      const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || '').length)))
      const pad = (str, width) => ` ${(str || '').padEnd(width, ' ')} `

      lines.push(`### ${title}`)
      lines.push('')
      lines.push(`|${headers.map((h, i) => pad(h, colWidths[i])).join('|')}|`)
      lines.push(`|${colWidths.map((w) => '-'.repeat(w + 2)).join('|')}|`)
      for (const row of rows) {
        lines.push(`|${headers.map((_, i) => pad(row[i], colWidths[i])).join('|')}|`)
      }
      lines.push('')
    }

    // Render Data Loading section
    if (sections.dataLoading.rows.length > 0) {
      renderTable('Data Loading Performance', ['Dataset Size', 'Time (Avg)'], sections.dataLoading.rows)
    }

    // Render Scoring section
    if (sections.scoring.rows.length > 0) {
      renderTable('Scoring Algorithm Performance', ['Result Count', 'Time (Avg)'], sections.scoring.rows)
    }

    // Render Cold Start + Single-Query in combined strategy table
    const strategyRows = [...sections.coldStart.rows, ...sections.singleQuery.rows]
    if (strategyRows.length > 0) {
      renderTable('Search Performance', ['Scenario', 'Precise (Avg)', 'Fuzzy (Avg)'], strategyRows)
    }

    // Render Incremental Typing as separate table
    if (sections.incremental.rows.length > 0) {
      renderTable(
        'Incremental Typing Performance',
        ['Dataset Size', 'Precise (Total)', 'Fuzzy (Total)'],
        sections.incremental.rows,
      )
    }

    // 2. Focused Logic Timings
    const logicTimings = content.split('\n').filter((l) => l.includes('took:'))
    if (logicTimings.length > 0) {
      const rows = []
      for (const l of logicTimings) {
        // Parse "Precise Search ("resource-123") took: 9.28ms" format
        const match = l.trim().match(/^(.+)\s+took:\s*(.+)$/)
        if (match) {
          const testName = match[1].trim()
          const timeStr = match[2].trim()
          rows.push([testName, timeStr])

          // Extract timing for regression check
          const ms = parseMs(timeStr)
          if (ms != null) jestResults[testName] = ms
        }
      }

      if (rows.length > 0) {
        const headers = ['Test', 'Time']
        const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
        const pad = (str, width) => ` ${str.padEnd(width, ' ')} `

        lines.push('### Core Logic Latency')
        lines.push('')
        lines.push(`|${pad(headers[0], colWidths[0])}|${pad(headers[1], colWidths[1])}|`)
        lines.push(`|${'-'.repeat(colWidths[0] + 2)}|${'-'.repeat(colWidths[1] + 2)}|`)
        for (const row of rows) {
          lines.push(`|${pad(row[0], colWidths[0])}|${pad(row[1], colWidths[1])}|`)
        }
        lines.push('')
      }
    }
  }

  // 3. E2E / Rendering (from Playwright)
  if (fs.existsSync(playwrightLog)) {
    const content = fs.readFileSync(playwrightLog, 'utf-8')
    const renderTimings = content.split('\n').filter((l) => l.includes('Playwright:'))

    if (renderTimings.length > 0) {
      const rows = []
      for (const l of renderTimings) {
        // Parse "Playwright: Worst-case Rendering (1000 items with all badges) took: 2.00ms" format
        const cleaned = l.trim().replace(/^·+/, '') // Remove all leading dots
        const match = cleaned.match(/^Playwright:\s*(.+)\s+took:\s*(.+)$/)
        if (match) {
          const testName = match[1].trim()
          const timeStr = match[2].trim()
          rows.push([testName, timeStr])

          // Extract timing for regression check
          const ms = parseMs(timeStr)
          if (ms != null) playwrightResults[testName] = ms
        }
      }

      if (rows.length > 0) {
        const headers = ['Test', 'Time']
        const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
        const pad = (str, width) => ` ${str.padEnd(width, ' ')} `

        lines.push('## Rendering & Interaction (Playwright)')
        lines.push('')
        lines.push(`|${pad(headers[0], colWidths[0])}|${pad(headers[1], colWidths[1])}|`)
        lines.push(`|${'-'.repeat(colWidths[0] + 2)}|${'-'.repeat(colWidths[1] + 2)}|`)
        for (const row of rows) {
          lines.push(`|${pad(row[0], colWidths[0])}|${pad(row[1], colWidths[1])}|`)
        }
        lines.push('')
      }
    }
  }

  // 4. Check for performance regressions
  const { passed, failures } = checkRegressions(jestResults, playwrightResults)

  if (failures.length > 0) {
    lines.push('## ⚠️ Performance Regressions Detected')
    lines.push('')
    lines.push('The following tests exceeded their performance thresholds:')
    lines.push('')
    lines.push('| Test | Actual | Baseline | Threshold |')
    lines.push('|------|--------|----------|-----------|')
    for (const f of failures) {
      lines.push(`| ${f.test} | ${f.actual.toFixed(2)}ms | ${f.baseline}ms | ${f.threshold.toFixed(2)}ms |`)
    }
    lines.push('')
    lines.push('> **Note:** Threshold = Baseline × tolerance multiplier (default 2.0)')
    lines.push('')
  } else {
    lines.push('## ✅ No Performance Regressions')
    lines.push('')
    lines.push('All tests are within acceptable thresholds.')
    lines.push('')
  }

  const finalSummary = lines.join('\n')

  // Output to console for local visibility
  console.log(`\n${'-'.repeat(80)}\n`)
  console.log(finalSummary)
  console.log(`${'-'.repeat(80)}\n`)

  // Save to file for CI
  fs.writeFileSync(summaryFile, finalSummary)

  // Exit with error if regressions detected (fails CI)
  if (!passed) {
    console.error('\n❌ Performance regression detected! CI will fail.')
    console.error('   To update baselines, edit bin/perf-baselines.json\n')
    process.exit(1)
  }
}

generateSummary()
