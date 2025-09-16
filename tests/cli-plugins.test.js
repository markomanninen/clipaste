const lines = []
const originalLog = console.log

beforeEach(() => {
  lines.length = 0
})

afterAll(() => {
  console.log = originalLog
})

console.log = (...args) => {
  lines.push(args.join(' '))
}

const mockCommands = []

jest.mock('commander', () => {
  return {
    Command: jest.fn().mockImplementation(() => {
      return {
        commands: mockCommands,
        name: jest.fn().mockReturnThis(),
        description: jest.fn().mockReturnThis(),
       version: jest.fn().mockReturnThis(),
       command (name) {
          const cmd = {}
          cmd._name = name
          cmd.name = () => name
          cmd.description = jest.fn(() => cmd)
          cmd.option = jest.fn(() => cmd)
          cmd.argument = jest.fn(() => cmd)
          cmd.action = function (fn) {
            cmd._action = fn
            return cmd
          }
          mockCommands.push(cmd)
          return cmd
        }
      }
    })
  }
})

const mockStatus = {
  loaded: [{ id: 'clipaste-randomizer', name: 'clipaste-randomizer', version: '0.0.3' }],
  failed: [{ id: 'clipaste-extra', reason: 'not installed' }]
}

const mockLoadConfiguredPlugins = jest.fn()

jest.mock('../src/plugins/pluginManager', () => {
  return jest.fn().mockImplementation(() => ({
    loadConfiguredPlugins: mockLoadConfiguredPlugins,
    getStatus: jest.fn(() => mockStatus)
  }))
})

const CLI = require('../src/cli')

jest.spyOn(CLI.prototype, 'setupCommands').mockImplementation(function () {})

describe('CLI plugin diagnostics command', () => {
  test('reports loaded and failed plugins', () => {
    mockCommands.length = 0
    const cli = new CLI()
    expect(cli).toBeDefined()

    const pluginsCommand = mockCommands.find(cmd => cmd._name === 'plugins')
    expect(pluginsCommand).toBeDefined()

    pluginsCommand._action()

    expect(mockLoadConfiguredPlugins).toHaveBeenCalled()
    expect(lines.some(line => line.includes('Loaded plugins:'))).toBe(true)
    expect(lines.some(line => line.includes('- clipaste-randomizer v0.0.3'))).toBe(true)
    expect(lines.some(line => line.includes('Plugins not loaded:'))).toBe(true)
    expect(lines.some(line => line.includes('- clipaste-extra: not installed'))).toBe(true)
  })
})
