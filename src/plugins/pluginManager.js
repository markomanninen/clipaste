const { createRequire } = require('module')
const path = require('path')

class PluginManager {
  constructor ({ program, services, config = {}, logger = console, baseDir } = {}) {
    if (!program) {
      throw new Error('PluginManager requires a commander program instance')
    }

    this.program = program
    this.services = services || {}
    this.config = config
    this.logger = logger
    this.baseDir = baseDir || path.resolve(__dirname, '../..')
    this.require = createRequire(path.join(this.baseDir, 'package.json'))
    this.loadedPlugins = []
    this.failedPlugins = []
  }

  getConfiguredPluginIds () {
    const configured = new Set()

    const fromConfig = Array.isArray(this.config.plugins) ? this.config.plugins : []
    for (const pluginId of fromConfig) {
      if (pluginId) configured.add(pluginId)
    }

    const envValue = process.env.CLIPASTE_PLUGINS
    if (envValue) {
      for (const token of envValue.split(',').map(v => v.trim()).filter(Boolean)) {
        configured.add(token)
      }
    }

    return Array.from(configured)
  }

  resolveSpecifier (id) {
    if (!id) return id
    if (id.startsWith('.') || id.startsWith('/')) {
      return path.resolve(this.baseDir, id)
    }
    return id
  }

  loadConfiguredPlugins () {
    const pluginIds = this.getConfiguredPluginIds()
    for (const pluginId of pluginIds) {
      this.loadPlugin(pluginId)
    }
    return this.loadedPlugins
  }

  loadPlugin (id) {
    const specifier = this.resolveSpecifier(id)

    let pluginModule
    try {
      pluginModule = this.require(specifier)
    } catch (error) {
      this.failedPlugins.push({
        id,
        reason: this.isModuleNotFound(error, specifier) ? 'not installed' : error.message
      })
      return false
    }

    const plugin = pluginModule?.default || pluginModule
    if (!plugin || typeof plugin.register !== 'function') {
      this.failedPlugins.push({
        id,
        reason: 'invalid plugin interface'
      })
      return false
    }

    try {
      const context = {
        program: this.program,
        services: this.services,
        logger: this.logger,
        pluginId: id
      }
      const result = plugin.register(context)
      if (result && typeof result.then === 'function') {
        result.catch(err => {
          this.logger?.warn?.(`[clipaste] Plugin ${id} registration rejected: ${err.message}`)
        })
      }

      this.loadedPlugins.push({
        id,
        name: plugin.name || id,
        version: plugin.version
      })
      return true
    } catch (error) {
      this.failedPlugins.push({ id, reason: error.message })
      this.logger?.warn?.(`[clipaste] Plugin ${id} threw during registration: ${error.message}`)
      return false
    }
  }

  isModuleNotFound (error, specifier) {
    return error && error.code === 'MODULE_NOT_FOUND' && error.message.includes(specifier)
  }

  getStatus () {
    return {
      loaded: [...this.loadedPlugins],
      failed: [...this.failedPlugins]
    }
  }
}

module.exports = PluginManager
