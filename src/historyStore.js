const fs = require('fs').promises
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

function sha256 (text) {
  return crypto.createHash('sha256').update(text || '').digest('hex')
}

function getConfigDir () {
  if (process.env.CLIPASTE_CONFIG_DIR) return process.env.CLIPASTE_CONFIG_DIR
  const platform = process.platform
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'clipaste')
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'clipaste')
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
    return path.join(xdg, 'clipaste')
  }
}

class HistoryStore {
  constructor (opts = {}) {
    this.dir = opts.dir || getConfigDir()
    this.file = opts.file || path.join(this.dir, 'history.json')
    this.maxItems = typeof opts.maxItems === 'number' ? opts.maxItems : 100
    this.maxItemSize = typeof opts.maxItemSize === 'number' ? opts.maxItemSize : 256 * 1024 // 256 KB
    this.maxTotalSize = typeof opts.maxTotalSize === 'number' ? opts.maxTotalSize : 5 * 1024 * 1024 // 5 MB
    this.persist = opts.persist !== false
    this.verbose = !!opts.verbose
    this._data = []
    this._loaded = false
  }

  async _ensureDir () {
    try {
      await fs.mkdir(this.dir, { recursive: true })
    } catch {}
  }

  async _load () {
    if (this._loaded) return
    if (!this.persist) { this._loaded = true; return }
    try {
      await this._ensureDir()
      const raw = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // Validate each entry to avoid prototype pollution and unexpected data
        this._data = parsed.filter(e => {
          return e && typeof e === 'object' &&
            typeof e.id === 'string' &&
            typeof e.ts === 'string' &&
            typeof e.content === 'string' &&
            typeof e.sha256 === 'string' &&
            typeof e.len === 'number' &&
            typeof e.preview === 'string'
        })
      } else {
        this._data = []
      }
    } catch {
      this._data = []
    } finally {
      this._loaded = true
    }
  }

  async _save () {
    if (!this.persist) return
    await this._ensureDir()
    const json = JSON.stringify(this._data, null, 2)
    await fs.writeFile(this.file, json, 'utf8')
  }

  _preview (content) {
    return content.slice(0, 1024)
  }

  _totalSize () {
    // Approximate size by summing content length in bytes
    return this._data.reduce((sum, e) => sum + Buffer.byteLength(e.content || '', 'utf8'), 0)
  }

  async addEntry (content) {
    await this._load()

    if (typeof content !== 'string' || content.length === 0) return null

    const bytes = Buffer.byteLength(content, 'utf8')
    if (bytes > this.maxItemSize) {
      if (this.verbose) console.error('[history] skip: item exceeds maxItemSize')
      return null
    }

    const entry = {
      id: uuidv4(),
      ts: new Date().toISOString(),
      sha256: sha256(content),
      len: content.length,
      preview: this._preview(content),
      content,
      // optional metadata fields
      tags: []
    }

    this._data.push(entry)

    // Enforce count cap
    while (this._data.length > this.maxItems) {
      this._data.shift()
    }

    // Enforce total size cap (persisted only)
    if (this.persist) {
      while (this._totalSize() > this.maxTotalSize && this._data.length > 1) {
        this._data.shift()
      }
    }

    await this._save()
    return entry
  }

  async addTags (id, tags) {
    await this._load()
    const entry = this._data.find(e => e.id === id)
    if (!entry) throw new Error('History item not found')
    if (!Array.isArray(entry.tags)) entry.tags = []
    const set = new Set(entry.tags)
    for (const t of (tags || [])) if (t) set.add(String(t))
    entry.tags = Array.from(set)
    await this._save()
    return entry.tags
  }

  async removeTags (id, tags) {
    await this._load()
    const entry = this._data.find(e => e.id === id)
    if (!entry) throw new Error('History item not found')
    if (!Array.isArray(entry.tags)) return []
    const remove = new Set((tags || []).map(String))
    entry.tags = entry.tags.filter(t => !remove.has(t))
    await this._save()
    return entry.tags
  }

  async search (query, opts = {}) {
    await this._load()
    const q = (query || '').toLowerCase()
    const tag = opts.tag
    const inBody = !!opts.body
    return this._data
      .filter(e => {
        const matchesTag = tag ? Array.isArray(e.tags) && e.tags.includes(tag) : true
        if (!q) return matchesTag
        const hay = (e.preview || '') + (inBody ? ('\n' + (e.content || '')) : '')
        return matchesTag && hay.toLowerCase().includes(q)
      })
      .map(({ id, ts, sha256: h, len, preview, tags }) => ({ id, ts, sha256: h, len, preview, tags }))
  }

  async list () {
    await this._load()
    // Return a lightweight view
    return this._data.map(({ id, ts, sha256: h, len, preview }) => ({ id, ts, sha256: h, len, preview }))
  }

  async get (id) {
    await this._load()
    return this._data.find(e => e.id === id) || null
  }

  async restore (id, clipboard) {
    await this._load()
    const entry = await this.get(id)
    if (!entry) throw new Error('History item not found')
    if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('Clipboard manager required')
    await clipboard.writeText(entry.content)
    return true
  }

  async clear () {
    await this._load()
    this._data = []
    await this._save()
  }

  async exportTo (filepath) {
    await this._load()
    const dir = path.dirname(filepath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filepath, JSON.stringify(this._data, null, 2), 'utf8')
    return filepath
  }
}

module.exports = HistoryStore
