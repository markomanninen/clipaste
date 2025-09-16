const { Command } = require('commander')
const PluginManager = require('../src/plugins/pluginManager')

describe('PluginManager', () => {
  const baseServices = {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(true)
    }
  }

  beforeEach(() => {
    delete process.env.CLIPASTE_PLUGINS
    jest.resetModules()
  })

  it('merges config and env plugin ids without duplicates', () => {
    process.env.CLIPASTE_PLUGINS = 'clipaste-extra, clipaste-extra , custom-plugin'
    const manager = new PluginManager({
      program: new Command(),
      services: baseServices,
      config: { plugins: ['clipaste-randomizer', 'clipaste-extra'] },
      logger: { warn: jest.fn() }
    })

    const ids = manager.getConfiguredPluginIds()
    expect(ids).toContain('clipaste-randomizer')
    expect(ids).toContain('clipaste-extra')
    expect(ids).toContain('custom-plugin')
    expect(ids.filter(id => id === 'clipaste-extra').length).toBe(1)
  })

  it('records failures when modules are missing', () => {
    const manager = new PluginManager({
      program: new Command(),
      services: baseServices,
      config: { plugins: ['clipaste-not-installed'] },
      logger: { warn: jest.fn() }
    })

    manager.loadConfiguredPlugins()
    const status = manager.getStatus()
    expect(status.loaded).toHaveLength(0)
    expect(status.failed).toEqual([
      expect.objectContaining({ id: 'clipaste-not-installed', reason: 'not installed' })
    ])
  })

  it('loads virtual modules that expose register', () => {
    const register = jest.fn()
    jest.doMock('clipaste-demo-plugin', () => ({
      name: 'clipaste-demo-plugin',
      version: '0.1.0',
      register
    }), { virtual: true })

    const manager = new PluginManager({
      program: new Command(),
      services: baseServices,
      config: { plugins: ['clipaste-demo-plugin'] },
      logger: { warn: jest.fn() }
    })

    manager.loadConfiguredPlugins()
    const status = manager.getStatus()

    expect(register).toHaveBeenCalledTimes(1)
    expect(status.loaded).toEqual([
      expect.objectContaining({
        id: 'clipaste-demo-plugin',
        name: 'clipaste-demo-plugin',
        version: '0.1.0'
      })
    ])
  })

  it('can load a plugin from a relative path (clipaste-randomizer)', () => {
    const manager = new PluginManager({
      program: new Command(),
      services: baseServices,
      config: {},
      logger: { warn: jest.fn() }
    })

    manager.loadPlugin('../clipaste-randomizer')
    const status = manager.getStatus()

    expect(status.failed).toHaveLength(0)
    expect(status.loaded[0]).toEqual(expect.objectContaining({ id: '../clipaste-randomizer' }))
  })
})
