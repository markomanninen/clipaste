const path = require('path')
const os = require('os')
const CLI = require('../src/cli')
const HistoryStore = require('../src/historyStore')
const ClipboardManager = require('../src/clipboard')

jest.mock('../src/clipboard')

describe('Phase 4A: History tags and search', () => {
  let cli
  let originalEnv
  let originalConsole
  let mockClipboard
  const tmpBase = path.join(os.tmpdir(), `clipaste-test-hist-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  beforeEach(() => {
    originalEnv = process.env
    // ensure config dir is under tmp
    process.env = { ...originalEnv, CLIPASTE_CONFIG_DIR: tmpBase }
    originalConsole = global.console
    global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() }
    mockClipboard = { writeText: jest.fn(), readText: jest.fn() }
    ClipboardManager.mockImplementation(() => mockClipboard)
    cli = new CLI()
  })

  afterEach(() => {
    process.env = originalEnv
    global.console = originalConsole
    jest.restoreAllMocks()
  })

  it('adds tags and searches history', async () => {
    const hs = new HistoryStore({ verbose: true })
    const entry = await hs.addEntry('FindMe content here')
    expect(entry && entry.id).toBeTruthy()

    // add tags via CLI handler
    await cli.handleHistory({ tagAdd: entry.id, tags: 'work,urgent' })
    // search via CLI handler
    await cli.handleHistory({ search: 'FindMe' })
    const logs = (global.console.log.mock.calls || []).map(c => c.join(' ')).join('\n')
    expect(logs).toMatch(entry.id)

    // remove one tag
    await cli.handleHistory({ tagRemove: entry.id, tags: 'urgent' })
    const hs2 = new HistoryStore({})
    const list = await hs2.search('', { tag: 'work' })
    expect(list.find(i => i.id === entry.id)).toBeTruthy()
    const listNone = await hs2.search('', { tag: 'urgent' })
    expect(listNone.find(i => i.id === entry.id)).toBeFalsy()
  })
})
