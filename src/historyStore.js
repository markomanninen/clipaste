const fs = require('fs').promises
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')

function sha256 (text) {
  return crypto.createHash('sha256').update(text || '').digest('hex')
}

function getConfigDir () {
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
      if (Array.isArray(parsed)) this._data = parsed
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
    const slice = content.slice(0, Math.min(1024, content.length))
    return slice
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
      content
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
