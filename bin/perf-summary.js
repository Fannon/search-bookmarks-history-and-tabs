#!/usr/bin/env node

/**
 * @file Aggregates and prints a summary of performance benchmark results.
 *
 * This script parses outputs from Jest and Playwright performance tests
 * and generates a formatted Markdown summary.
 */

import fs from 'fs-extra'

const jestLog = 'reports/jest_output.txt'
const playwrightLog = 'reports/playwright_output.txt'
const summaryFile = 'reports/perf-summary.md'

function generateSummary() {
  const lines = []

  lines.push('# Performance Benchmark Summary')
  lines.push('')

  fs.ensureDirSync('./reports')

  // 1. Comparison Matrix (from Jest)
  if (fs.existsSync(jestLog)) {
    const content = fs.readFileSync(jestLog, 'utf-8')
    const tableLines = content.split('\n').filter((l) => l.includes('|') && l.includes('ms'))

    if (tableLines.length > 0) {
      const rows = []
      // Parse rows - be flexible with whitespace
      for (const l of tableLines) {
        const parts = l
          .split('|')
          .map((p) => p.trim())
          .filter((p) => p !== '')
        if (parts.length === 3) {
          rows.push(parts)
        }
      }

      if (rows.length > 0) {
        const headers = ['Scenario', 'Precise (Avg)', 'Fuzzy (Avg)']
        const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
        const pad = (str, width) => ` ${str.padEnd(width, ' ')} `

        lines.push('## Strategy Comparison (Micro-benchmarks)')
        lines.push('')
        lines.push(
          `|${pad(headers[0], colWidths[0])}|${pad(headers[1], colWidths[1])}|${pad(headers[2], colWidths[2])}|`,
        )
        lines.push(`|${'-'.repeat(colWidths[0] + 2)}|${'-'.repeat(colWidths[1] + 2)}|${'-'.repeat(colWidths[2] + 2)}|`)

        for (const row of rows) {
          lines.push(`|${pad(row[0], colWidths[0])}|${pad(row[1], colWidths[1])}|${pad(row[2], colWidths[2])}|`)
        }
        lines.push('')
      }
    }

    // 2. Focused Logic Timings
    const logicTimings = content.split('\n').filter((l) => l.includes('took:'))
    if (logicTimings.length > 0) {
      const rows = []
      for (const l of logicTimings) {
        // Parse "Precise Search ("resource-123") took: 9.28ms" format
        const match = l.trim().match(/^(.+)\s+took:\s*(.+)$/)
        if (match) {
          rows.push([match[1].trim(), match[2].trim()])
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
          rows.push([match[1].trim(), match[2].trim()])
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

  const finalSummary = lines.join('\n')

  // Output to console for local visibility
  console.log(`\n${'-'.repeat(80)}\n`)
  console.log(finalSummary)
  console.log(`${'-'.repeat(80)}\n`)

  // Save to file for CI
  fs.writeFileSync(summaryFile, finalSummary)
}

generateSummary()
