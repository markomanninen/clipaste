jest.useFakeTimers()

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

function advance (ms) {
  jest.advanceTimersByTime(ms)
  return Promise.resolve()
}

describe('Watcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('detects change and saves to history (once)', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 200, verbose: false })

    // First tick empty, second tick has content
    mockReadText.mockResolvedValueOnce('').mockResolvedValueOnce('foo')

    await watcher.start({ save: true, history, once: true })
    await advance(250)

    expect(history.addEntry).toHaveBeenCalledWith('foo')
  })

  test('applies filter before acting', async () => {
    const history = { addEntry: jest.fn().mockResolvedValue(null) }
    const watcher = new Watcher({ interval: 200, verbose: false })

    mockReadText
      .mockResolvedValueOnce('foo')
      .mockResolvedValueOnce('bar')

    await watcher.start({ save: true, history, filter: 'bar', once: true })
    await advance(250)

    expect(history.addEntry).toHaveBeenCalledTimes(1)
    expect(history.addEntry).toHaveBeenCalledWith('bar')
  })

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
    mockReadText.mockResolvedValueOnce('data')

    await watcher.start({ exec: 'echo processed', once: true })
    // Allow immediate tick to run and child to close
    await Promise.resolve()

    expect(mockSpawn).toHaveBeenCalled()
    const child = mockSpawn.child
    expect(child._options.env.CLIPASTE_TEXT).toBe('data')
    expect(child._options.env.CLIPASTE_SHA256).toMatch(/^[a-f0-9]{64}$/)
  })
})
