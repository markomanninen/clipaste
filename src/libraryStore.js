const fs = require('fs').promises
const path = require('path')
const os = require('os')

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

class LibraryStore {
  constructor (opts = {}) {
    const base = opts.baseDir || process.env.CLIPASTE_CONFIG_DIR || getConfigDir()
    this.templatesDir = opts.templatesDir || path.join(base, 'templates')
    this.snippetsDir = opts.snippetsDir || path.join(base, 'snippets')
    this.verbose = !!opts.verbose
  }

  async _ensureDirs () {
    await fs.mkdir(this.templatesDir, { recursive: true })
    await fs.mkdir(this.snippetsDir, { recursive: true })
  }

  // Utilities
  _nameToPath (type, name) {
    const safeName = name.replace(/\\/g, '/').replace(/\.+\//g, '')
    const base = type === 'template' ? this.templatesDir : this.snippetsDir
    const ext = type === 'template' ? '.tmpl' : '.txt'
    return path.join(base, safeName + ext)
  }

  _indexPath (type) {
    const base = type === 'template' ? this.templatesDir : this.snippetsDir
    return path.join(base, 'index.json')
  }

  async _loadIndex (type) {
    const file = this._indexPath(type)
    try {
      const raw = await fs.readFile(file, 'utf8')
      const idx = JSON.parse(raw)
      return (idx && typeof idx === 'object') ? idx : {}
    } catch {
      return {}
    }
  }

  async _saveIndex (type, idx) {
    const file = this._indexPath(type)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(idx, null, 2), 'utf8')
  }

  async addSnippet (name, content) {
    await this._ensureDirs()
    const p = this._nameToPath('snippet', name)
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, content, 'utf8')
    return p
  }

  async getSnippet (name) {
    const p = this._nameToPath('snippet', name)
    const content = await fs.readFile(p, 'utf8')
    return { path: p, content }
  }

  async deleteSnippet (name) {
    const p = this._nameToPath('snippet', name)
    await fs.unlink(p)
  }

  async listSnippets () {
    // naive recursive list
    const result = []
    const base = this.snippetsDir
    async function walk (dir) {
      let entries = []
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) await walk(full)
        else if (e.isFile() && e.name.endsWith('.txt')) {
          const rel = path.relative(base, full).replace(/\\/g, '/')
          const name = rel.replace(/\.txt$/, '')
          result.push({ name, path: full })
        }
      }
    }
    await walk(base)
    return result
  }

  async saveTemplate (name, content) {
    await this._ensureDirs()
    const p = this._nameToPath('template', name)
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, content, 'utf8')
    return p
  }

  async getTemplate (name) {
    const p = this._nameToPath('template', name)
    const content = await fs.readFile(p, 'utf8')
    return { path: p, content }
  }

  async deleteTemplate (name) {
    const p = this._nameToPath('template', name)
    await fs.unlink(p)
  }

  async listTemplates () {
    const result = []
    const base = this.templatesDir
    async function walk (dir) {
      let entries = []
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) await walk(full)
        else if (e.isFile() && e.name.endsWith('.tmpl')) {
          const rel = path.relative(base, full).replace(/\\/g, '/')
          const name = rel.replace(/\.tmpl$/, '')
          result.push({ name, path: full })
        }
      }
    }
    await walk(base)
    return result
  }

  async addTags (type, name, tags) {
    const idx = await this._loadIndex(type)
    const key = name
    const entry = idx[key] || { tags: [] }
    const set = new Set(entry.tags || [])
    for (const t of (tags || [])) if (t) set.add(String(t))
    entry.tags = Array.from(set)
    idx[key] = entry
    await this._saveIndex(type, idx)
    return entry.tags
  }

  async removeTags (type, name, tags) {
    const idx = await this._loadIndex(type)
    const key = name
    const entry = idx[key] || { tags: [] }
    const remove = new Set((tags || []).map(String))
    entry.tags = (entry.tags || []).filter(t => !remove.has(t))
    idx[key] = entry
    await this._saveIndex(type, idx)
    return entry.tags
  }

  async search (opts = {}) {
    const target = opts.target || 'templates'
    const q = (opts.query || '').toLowerCase()
    const tag = opts.tag
    const body = !!opts.body
    const list = target === 'snippets' ? await this.listSnippets() : await this.listTemplates()
    const idx = await this._loadIndex(target === 'snippets' ? 'snippet' : 'template')
    const out = []
    for (const item of list) {
      const meta = idx[item.name] || {}
      const matchesTag = tag ? Array.isArray(meta.tags) && meta.tags.includes(tag) : true
      let matches = !!matchesTag
      if (matches && q) {
        let hay = item.name.toLowerCase()
        if (body) {
          try {
            const text = await fs.readFile(item.path, 'utf8')
            hay += '\n' + text.toLowerCase()
          } catch {}
        }
        matches = hay.includes(q)
      }
      if (matches) out.push({ name: item.name, path: item.path, tags: meta.tags || [] })
    }
    return out
  }
}

module.exports = LibraryStore
