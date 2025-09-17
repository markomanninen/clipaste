#!/usr/bin/env node
/**
 * Simple benchmark harness for core clipboard operations.
 * Usage: node bench/clipboard-bench.js --iterations 200 --json
 *
 * Measures: hasContent, readText, writeText, getContentType, (optional) image write/read if supported platform & sample image present.
 * Outputs summary stats: total ms, avg ms, min, max, ops/sec.
 */

const path = require('path')
const fs = require('fs')
const { performance } = require('perf_hooks')
const ClipboardManager = require('../src/clipboard')
// If phase profiling is requested we will enable it dynamically prior to creating manager

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1) {
    const val = args[idx + 1]
    if (!val || val.startsWith('--')) return true
    return val
  }
  return def
}

const iterations = parseInt(getArg('iterations', '100'), 10)
const jsonOutput = !!getArg('json', false)
const includeImage = !!getArg('image', false)
const phasesEnabled = !!getArg('phases', false)
const jsonFile = getArg('jsonFile', null)
const csvFile = getArg('csvFile', null)
const historyFlag = getArg('history', false)

// History output directory (only used if --history specified)
const defaultHistoryDir = path.join(__dirname, 'history')

function statSummary (arr) {
  if (!arr.length) return null
  const total = arr.reduce((a, b) => a + b, 0)
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const avg = total / arr.length
  const opsPerSec = 1000 / avg
  return { total: +total.toFixed(3), avg: +avg.toFixed(3), min: +min.toFixed(3), max: +max.toFixed(3), opsPerSec: +opsPerSec.toFixed(2) }
}

async function main () {
  if (phasesEnabled) {
    // Dynamically enable phase profiling (works even if env var set too late)
    if (ClipboardManager.enablePhaseProfiling) {
      ClipboardManager.enablePhaseProfiling()
    } else {
      process.env.CLIPASTE_PHASE_PROF = '1'
    }
  }
  const cm = new ClipboardManager()
  const results = {
    iterations,
    platform: process.platform,
    timings: {}
  }

  const measures = {
    hasContent: [],
    readText: [],
    writeText: [],
    getContentType: [],
    writeImage: [],
    readImage: []
  }

  // Preload clipboardy once
  await cm.writeText('')

  // Use a small rotating payload for writeText
  const payloads = Array.from({ length: 5 }, (_, i) => `sample-payload-${i}-${'x'.repeat(20)}`)

  let imagePath = null
  if (includeImage) {
    // Try to locate a sample PNG (user can supply path via --imagePath <path>)
    const provided = getArg('imagePath')
    if (provided && fs.existsSync(provided)) {
      imagePath = provided
    } else {
      const guess = path.join(__dirname, '..', 'demo', 'sample.png')
      if (fs.existsSync(guess)) imagePath = guess
    }
  }

  for (let i = 0; i < iterations; i++) {
    const pay = payloads[i % payloads.length]

    // writeText
    let t0 = performance.now()
    await cm.writeText(pay)
    measures.writeText.push(performance.now() - t0)

    // hasContent
    t0 = performance.now()
    await cm.hasContent()
    measures.hasContent.push(performance.now() - t0)

    // readText
    t0 = performance.now()
    await cm.readText()
    measures.readText.push(performance.now() - t0)

    // getContentType
    t0 = performance.now()
    await cm.getContentType()
    measures.getContentType.push(performance.now() - t0)

    // Optional image tests every 10 iterations to reduce overhead
    if (imagePath && i % 10 === 0) {
      t0 = performance.now()
      await cm.writeImage(imagePath).catch(() => {})
      measures.writeImage.push(performance.now() - t0)

      t0 = performance.now()
      await cm.readImage().catch(() => null)
      measures.readImage.push(performance.now() - t0)
    }
  }

  results.timings.hasContent = statSummary(measures.hasContent)
  results.timings.readText = statSummary(measures.readText)
  results.timings.writeText = statSummary(measures.writeText)
  results.timings.getContentType = statSummary(measures.getContentType)
  if (measures.writeImage.length) results.timings.writeImage = statSummary(measures.writeImage)
  if (measures.readImage.length) results.timings.readImage = statSummary(measures.readImage)

  // Phase stats (requires instrumentation in ClipboardManager)
  if (phasesEnabled && ClipboardManager.getPhaseStats) {
    const phaseStats = ClipboardManager.getPhaseStats()
    results.phases = phaseStats
  }

  // Write JSON to file or stdout
  if (jsonOutput || jsonFile || phasesEnabled) {
    const jsonData = JSON.stringify(results, null, 2)
    if (jsonFile) {
      fs.writeFileSync(jsonFile, jsonData, 'utf8')
    }
    if (jsonOutput) {
      console.log(jsonData)
    } else if (!csvFile) {
      // Provide brief summary when only writing JSON file
      console.log(`JSON results written to ${jsonFile || '(not specified)'}`)
    }
  } else {
    console.log('Clipboard Benchmark Results')
    console.log('Iterations:', iterations)
    for (const [k, v] of Object.entries(results.timings)) {
      if (!v) continue
      console.log(`  ${k}: avg=${v.avg}ms min=${v.min}ms max=${v.max}ms ops/sec=${v.opsPerSec}`)
    }
    if (imagePath) console.log('Image ops used sample:', imagePath)
  }

  if (csvFile) {
    const lines = []
    lines.push('metric,avg_ms,min_ms,max_ms,ops_per_sec,total_ms,count')
    for (const [name, stat] of Object.entries(results.timings)) {
      if (!stat) continue
      lines.push(`${name},${stat.avg},${stat.min},${stat.max},${stat.opsPerSec},${stat.total},${iterations}`)
    }
    if (results.phases) {
      // phases: each key has count & avgMs & totalMs
      lines.push('\n# Phase breakdown')
      lines.push('phase,avg_ms,total_ms,count')
      for (const [p, s] of Object.entries(results.phases)) {
        lines.push(`${p},${s.avgMs},${s.totalMs},${s.count}`)
      }
    }
    fs.writeFileSync(csvFile, lines.join('\n'), 'utf8')
    console.log(`CSV written to ${csvFile}`)
  }

  // Optional timestamped history output (JSON + CSV) for longitudinal comparison
  if (historyFlag) {
    try {
      const historyDir = (typeof historyFlag === 'string' && historyFlag !== 'true') ? historyFlag : defaultHistoryDir
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
      const base = `bench_${process.platform}_${iterations}iter_${stamp}`
      const jsonPath = path.join(historyDir, base + '.json')
      const csvPath = path.join(historyDir, base + '.csv')

      // Write JSON history file
      fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8')

      // Build CSV for history (reuse logic, independent of --csvFile flag)
      const csvLines = []
      csvLines.push('metric,avg_ms,min_ms,max_ms,ops_per_sec,total_ms,count')
      for (const [name, stat] of Object.entries(results.timings)) {
        if (!stat) continue
        csvLines.push(`${name},${stat.avg},${stat.min},${stat.max},${stat.opsPerSec},${stat.total},${iterations}`)
      }
      if (results.phases) {
        csvLines.push('\n# Phase breakdown')
        csvLines.push('phase,avg_ms,total_ms,count')
        for (const [p, s] of Object.entries(results.phases)) {
          csvLines.push(`${p},${s.avgMs},${s.totalMs},${s.count}`)
        }
      }
      fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')

      console.log(`History artifacts written:\n  JSON: ${jsonPath}\n  CSV:  ${csvPath}`)
    } catch (e) {
      console.error('Failed to write history artifacts:', e.message)
    }
  }
}

main().catch(e => {
  console.error('Benchmark failed:', e)
  process.exit(1)
})
