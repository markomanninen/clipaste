// Mock Watcher and HistoryStore to validate wiring
const mockStart = jest.fn().mockResolvedValue()
jest.mock('../src/watcher', () => {
  return jest.fn().mockImplementation(() => ({ start: (...args) => mockStart(...args) }))
})

const mockHistoryMethods = {
  list: jest.fn().mockResolvedValue([]),
  restore: jest.fn().mockResolvedValue(true),
  clear: jest.fn().mockResolvedValue(),
  exportTo: jest.fn().mockResolvedValue('/tmp/export.json')
}
const mockHistoryStore = jest.fn().mockImplementation(() => mockHistoryMethods)
jest.mock('../src/historyStore', () => mockHistoryStore)

describe('CLI watch/history wiring', () => {
  let cli
  const mockConsole = { log: jest.fn(), error: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    global.console = mockConsole
    const CLI = require('../src/cli')
    cli = new CLI()
  })

  test('handleWatch passes options and constructs HistoryStore', async () => {
    await cli.handleWatch({
      interval: '250',
      filter: 'foo',
      exec: 'cat >/dev/null',
      save: true,
      timeout: '1000',
      once: true,
      maxEvents: '5',
      idleTimeout: '5000',
      maxItemSize: '1024',
      maxItems: '50',
      persist: false, // simulates --no-persist
      echo: false // simulates --no-echo
    })

    expect(mockHistoryStore).toHaveBeenCalledWith({
      persist: false,
      maxItems: 50,
      maxItemSize: 1024,
      verbose: false
    })

    expect(mockStart).toHaveBeenCalled()
    const arg = mockStart.mock.calls[0][0]
    expect(arg.filter).toBe('foo')
    expect(arg.exec).toBe('cat >/dev/null')
    expect(arg.save).toBe(true)
    expect(arg.timeout).toBe(1000)
    expect(arg.once).toBe(true)
    expect(arg.maxEvents).toBe(5)
    expect(arg.idleTimeout).toBe(5000)
    expect(arg.noEcho).toBe(true)
  })

  test('handleHistory list/restore/clear/export', async () => {
    await cli.handleHistory({ list: true })
    expect(mockHistoryMethods.list).toHaveBeenCalled()

    await cli.handleHistory({ restore: 'id-1' })
    expect(mockHistoryMethods.restore).toHaveBeenCalledWith('id-1', expect.anything())

    await cli.handleHistory({ export: '/tmp/out.json' })
    expect(mockHistoryMethods.exportTo).toHaveBeenCalledWith('/tmp/out.json')

    await cli.handleHistory({ clear: true })
    expect(mockHistoryMethods.clear).toHaveBeenCalled()
  })
})
