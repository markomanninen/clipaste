const fs = require('fs').promises
const path = require('path')
const os = require('os')

function resolveConfigDir () {
  const envDir = process.env.CLIPASTE_CONFIG_DIR
  if (envDir) return envDir
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'clipaste')
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'clipaste')
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(xdg, 'clipaste')
}

function mergeDeep (target, source) {
  const out = { ...target }
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] && typeof out[key] === 'object' ? out[key] : {}, value)
    } else {
      out[key] = value
    }
  }
  return out
}

class ConfigStore {
  constructor (opts = {}) {
    this.configDir = opts.baseDir || resolveConfigDir()
    this.configFile = opts.configFile || path.join(this.configDir, 'config.json')
    this.defaults = opts.defaults || {}
    this.cache = null
  }

  async load () {
    if (this.cache) return this.cache
    let data = {}
    try {
      const raw = await fs.readFile(this.configFile, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') data = parsed
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    this.cache = mergeDeep(this.defaults, data)
    return this.cache
  }

  async reload () {
    this.cache = null
    return await this.load()
  }

  async get (key, fallback) {
    const cfg = await this.load()
    if (!key) return cfg
    const parts = key.split('.')
    let cur = cfg
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
        cur = cur[part]
      } else {
        return fallback
      }
    }
    return cur === undefined ? fallback : cur
  }
}

module.exports = { ConfigStore, resolveConfigDir, mergeDeep }
