jest.setTimeout(15000)

// Mock clipboard manager used inside watcher
const mockReadText = jest.fn()
jest.mock('../src/clipboard', () => {
  return jest.fn().mockImplementation(() => ({
    readText: () => mockReadText()
  }))
})

// Mock child_process.spawn
const events = require('events')
const mockSpawn = jest.fn()
jest.mock('child_process', () => {
  return {
    spawn: (...args) => mockSpawn(...args)
  }
})

const Watcher = require('../src/watcher')

describe('Watcher', () => {
  let watchers = []

  beforeEach(() => {
    jest.clearAllMocks()
    watchers = []
  })

  afterEach(async () => {
    // Stop all watchers to prevent infinite loops
    await Promise.all(watchers.map(w => w.stop()))
    watchers = []
  })

  test('detects change and saves to history (once)', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 200, verbose: false })
    watchers.push(watcher)

    // First tick empty, second tick has content
    mockReadText.mockResolvedValueOnce('').mockResolvedValueOnce('foo')

    await watcher.start({ save: true, history, once: true })
    await new Promise(resolve => setTimeout(resolve, 250))

    expect(history.addEntry).toHaveBeenCalledWith('foo')
  }, 30000)

  test('stops on idle-timeout when no changes occur', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 100, verbose: true })
    watchers.push(watcher)

    // Always empty clipboard content
    mockReadText.mockResolvedValue('')

    await watcher.start({ save: true, history, idleTimeout: 300 })
    // Wait longer than idleTimeout to ensure it stops
    await new Promise(resolve => setTimeout(resolve, 500))

    // Should have stopped and not saved anything
    expect(watcher._stopped).toBe(true)
    expect(history.addEntry).not.toHaveBeenCalled()
  }, 30000)

  test('no-echo suppresses preview in verbose logs', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 200, verbose: true })
    watchers.push(watcher)

    mockReadText.mockResolvedValueOnce('secret-content')

    const origErr = console.error
    const calls = []
    console.error = (...args) => { calls.push(args.join(' ')) }

    try {
      await watcher.start({ save: true, history, once: true, noEcho: true })
      // allow immediate tick to run
      await new Promise(resolve => setTimeout(resolve, 50))

      // We should see a change log without the preview marker
      const changeLine = calls.find(l => l.startsWith('[watch] change'))
      expect(changeLine).toBeTruthy()
      expect(changeLine).not.toContain('preview=')
    } finally {
      console.error = origErr
    }
  })

  test('applies filter before acting', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 200, verbose: false })
    watchers.push(watcher)

    mockReadText
      .mockResolvedValueOnce('foo')
      .mockResolvedValueOnce('bar')

    await watcher.start({ save: true, history, filter: 'bar', once: true })
    await new Promise(resolve => setTimeout(resolve, 250))

    expect(history.addEntry).toHaveBeenCalledTimes(1)
    expect(history.addEntry).toHaveBeenCalledWith('bar')
  }, 30000)

  test('executes command with content on stdin and env', async () => {
    // Setup spawn to emulate a child process that closes immediately
    mockSpawn.mockImplementation((cmd, args, options) => {
      const child = new events.EventEmitter()
      child.stdin = {
        _buf: '',
        write: function (c) { this._buf += c },
        end: function () { setImmediate(() => child.emit('close', 0)) }
      }
      // Expose for assertions
      child._options = options
      mockSpawn.child = child
      return child
    })

    const watcher = new Watcher({ interval: 200, verbose: false })
    watchers.push(watcher)
    mockReadText.mockResolvedValueOnce('data')

    await watcher.start({ exec: 'echo processed', once: true })
    // Allow immediate tick to run and child to close
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(mockSpawn).toHaveBeenCalled()
    const child = mockSpawn.child
    expect(child._options.env.CLIPASTE_TEXT).toBe('data')
    expect(child._options.env.CLIPASTE_SHA256).toMatch(/^[a-f0-9]{64}$/)
  })

  test('stops after maxEvents is reached', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 200, verbose: false })
    watchers.push(watcher)

    // Three different contents -> should stop after handling 2
    mockReadText
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b')
      .mockResolvedValueOnce('c')
      .mockResolvedValue('c')

    await watcher.start({ save: true, history, maxEvents: 2 })
    await new Promise(resolve => setTimeout(resolve, 1000))

    expect(history.addEntry).toHaveBeenCalledTimes(2)
  }, 30000)

  test('stops on absolute timeout', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 50, verbose: false })
    watchers.push(watcher)

    // Keep returning new content rapidly
    let i = 0
    mockReadText.mockImplementation(() => Promise.resolve('x' + (i++)))

    await watcher.start({ save: true, history, timeout: 200 })
    // Wait for timeout to trigger
    await new Promise(resolve => setTimeout(resolve, 300))
    const countAfterTimeout = history.addEntry.mock.calls.length

    // Wait longer; count should not increase after stop
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(history.addEntry.mock.calls.length).toBe(countAfterTimeout)
    expect(watcher._stopped).toBe(true)
  }, 30000)
})
