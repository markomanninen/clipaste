const sharp = require('sharp')

function base64Encode (text) {
  return Buffer.from(String(text || ''), 'utf8').toString('base64')
}

function base64Decode (b64) {
  const input = String(b64 || '').trim()
  if (!/^[A-Za-z0-9+/\s]*={0,2}$/.test(input)) {
    throw new Error('Invalid base64 input')
  }
  try {
    return Buffer.from(input.replace(/\s+/g, ''), 'base64').toString('utf8')
  } catch (e) {
    throw new Error('Invalid base64 input')
  }
}

function urlEncode (text) {
  return encodeURIComponent(String(text || ''))
}

function urlDecode (text) {
  try {
    return decodeURIComponent(String(text || ''))
  } catch (e) {
    throw new Error('Invalid URL-encoded input')
  }
}

function jsonPretty (text) {
  const str = String(text || '')
  const parsed = JSON.parse(str)
  return JSON.stringify(parsed, null, 2)
}

function parseResizeSpec (spec) {
  if (!spec) return null
  const m = String(spec).trim().match(/^(\d*)x(\d*)$/i)
  if (!m) return null
  const width = m[1] ? parseInt(m[1], 10) : undefined
  const height = m[2] ? parseInt(m[2], 10) : undefined
  if ((!width && !height) || (width && width < 1) || (height && height < 1)) return null
  return { width, height }
}

function extensionForTextContent (text) {
  if (!text || typeof text !== 'string') return '.txt'
  const s = text.trim()
  // JSON
  if (s.startsWith('{') || s.startsWith('[')) {
    try { JSON.parse(s); return '.json' } catch {}
  }
  // Markdown
  if (/^(# |[*-] |\d+\. |```)/m.test(s)) return '.md'
  // Shell via shebang
  if (/^#!.*\b(bash|sh|zsh)\b/.test(s)) return '.sh'
  // Node/JS via shebang or common tokens
  if (/^#!.*\bnode\b/.test(s) || /(module\.exports|require\(|import\s+|export\s+|function\s+)/.test(s)) return '.js'
  return '.txt'
}
async function imageMetadataFromBuffer (buf, { safeMaxBytes = 25 * 1024 * 1024 } = {}) {
  const sizeBytes = Buffer.isBuffer(buf) ? buf.length : 0
  if (!sizeBytes) return null
  if (sizeBytes > safeMaxBytes) {
    return { sizeBytes }
  }
  try {
    const md = await sharp(buf).metadata()
    return {
      format: md.format,
      width: md.width,
      height: md.height,
      sizeBytes
    }
  } catch {
    return { sizeBytes }
  }
}

module.exports = {
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  jsonPretty,
  parseResizeSpec,
  extensionForTextContent,
  imageMetadataFromBuffer
}
