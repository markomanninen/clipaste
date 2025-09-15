const path = require('path')
const os = require('os')
const fs = require('fs')
const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')
jest.mock('../src/clipboard')

describe('Phase 4A: template list shows front-matter', () => {
  let cli
  let originalEnv
  let originalConsole

  const tmpBase = path.join(os.tmpdir(), `clipaste-test-fm-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, CLIPASTE_CONFIG_DIR: tmpBase }
    originalConsole = global.console
    global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() }
    ClipboardManager.mockImplementation(() => ({ writeText: jest.fn(), readText: jest.fn() }))
    cli = new CLI()
  })

  afterEach(() => {
    process.env = originalEnv
    global.console = originalConsole
    jest.restoreAllMocks()
  })

  it('prints name, description and tags for templates', async () => {
    const tpath = path.join(tmpBase, 'templates', 'greet', 'hello.tmpl')
    fs.mkdirSync(path.dirname(tpath), { recursive: true })
    const tmpl = ['---', 'description: Greeting template', 'tags: [docs, demo]', '---', 'Hello {{name}}'].join('\n')
    fs.writeFileSync(tpath, tmpl, 'utf8')

    await cli.handleTemplateList({})
    const line = (global.console.log.mock.calls[0] || [])[0]
    expect(line).toMatch('greet/hello')
    expect(line).toMatch('Greeting template')
    expect(line).toMatch('[docs,demo]')
  })
})
