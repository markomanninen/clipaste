#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const fallback = path.join(process.cwd(), 'out.txt')
const destination = process.env.OUT_FILE || fallback

let data = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  data += chunk
})

const writeOutput = () => {
  const bytes = Buffer.from(data, 'utf8').length
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, String(bytes), 'utf8')
  process.exit(0)
}

process.stdin.on('end', writeOutput)
process.stdin.on('close', writeOutput)
process.stdin.on('error', () => {
  process.exit(1)
})
