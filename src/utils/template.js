function systemVars () {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return {
    date,
    time,
    datetime: `${date} ${time}`,
    cwd: process.cwd(),
    hostname: require('os').hostname()
  }
}

function buildContext (vars = {}) {
  const env = { ...process.env }
  const sys = systemVars()
  return { ...env, ...sys, ...vars }
}

function getPath (obj, keyPath) {
  const parts = String(keyPath).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

function renderTemplate (tpl, vars = {}) {
  const ctx = buildContext(vars)
  return tpl.replace(/\{\{\s*([\w.]+)(?:\|([^}]+))?\s*\}\}/g, (m, key, def) => {
    const val = getPath(ctx, key)
    if (val === undefined || val === null || val === '') return def !== undefined ? String(def) : ''
    return String(val)
  })
}

function parseFrontMatter (text) {
  // Very small front-matter parser: ---\nkey: value\ntags: [a, b]\nrequired: [x,y]\n---\nbody
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return { meta: {}, body: text }
  const block = fmMatch[1]
  const body = fmMatch[2]
  const meta = {}
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!m) continue
    const k = m[1]
    let v = m[2].trim()
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    }
    meta[k] = v
  }
  return { meta, body }
}

module.exports = { renderTemplate, buildContext, parseFrontMatter, getPath }
