const fs = require('fs').promises
const path = require('path')
const os = require('os')

// Mock clipboard for watcher via the shared module
const mockReadText = jest.fn()
jest.mock('../src/clipboard', () => {
  return jest.fn().mockImplementation(() => ({
    readText: () => mockReadText()
  }))
})

describe('Watch smoke test with temp config', () => {
  let tmpConfig
  const oldEnv = { ...process.env }

  beforeEach(async () => {
    tmpConfig = await fs.mkdtemp(path.join(os.tmpdir(), 'clipaste-watch-'))
    process.env.XDG_CONFIG_HOME = tmpConfig // HistoryStore will use this dir on Linux-like envs
    process.env.HOME = tmpConfig // Influence os.homedir on Unix/macOS
    process.env.USERPROFILE = tmpConfig // Influence homedir on Windows
    jest.resetModules()
  })

  afterEach(async () => {
    process.env = { ...oldEnv }
    try { await fs.rm(tmpConfig, { recursive: true, force: true }) } catch {}
  })

  test('watch --save --once writes to history.json', async () => {
    const Watcher = require('../src/watcher')
    const HistoryStore = require('../src/historyStore')

    // Use a temp directory explicitly for history storage
    const histDir = path.join(tmpConfig, 'clipaste')
    const history = new HistoryStore({ dir: histDir, persist: true })
    const watcher = new Watcher({ interval: 50, verbose: false })

    mockReadText.mockResolvedValueOnce('smoke-data')

    await watcher.start({ save: true, history, once: true })

    // Give onTick a moment to run and write
    await new Promise((resolve) => setTimeout(resolve, 200))

    const historyPath = path.join(histDir, 'history.json')
    const json = await fs.readFile(historyPath, 'utf8')
    const arr = JSON.parse(json)
    expect(Array.isArray(arr)).toBe(true)
    expect(arr.length).toBeGreaterThanOrEqual(1)
    expect(arr[arr.length - 1].content).toBe('smoke-data')
  })
})
