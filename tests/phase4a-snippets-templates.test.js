const path = require('path')
const os = require('os')
const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')

jest.mock('../src/clipboard')

describe('Phase 4A: Snippets and Templates', () => {
  let cli
  let mockClipboard
  let originalEnv
  let originalConsole
  let originalProcess
  const tmpBase = path.join(os.tmpdir(), `clipaste-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, CLIPASTE_CONFIG_DIR: tmpBase }
    originalConsole = global.console
    originalProcess = global.process
    global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() }
    global.process = { ...process, exit: jest.fn() }
    mockClipboard = {
      writeText: jest.fn(),
      readText: jest.fn()
    }
    ClipboardManager.mockImplementation(() => mockClipboard)
    cli = new CLI()
  })

  afterEach(() => {
    global.console = originalConsole
    global.process = originalProcess
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('creates and copies a snippet', async () => {
    await cli.handleSnippetAdd('code/log', { text: 'console.log(1)\n' })
    await cli.handleSnippetCopy('code/log')
    expect(mockClipboard.writeText).toHaveBeenCalledWith('console.log(1)\n')
  })

  it('saves a template from clipboard and renders with vars', async () => {
    mockClipboard.readText.mockResolvedValue('Hello {{name|World}}!')
    await cli.handleTemplateSave('greet/hello', { fromClipboard: true })
    await cli.handleTemplateUse('greet/hello', { vars: ['name=Alice'], copy: true })
    expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello Alice!')
  })

  it('tags a template and finds it via search', async () => {
    mockClipboard.readText.mockResolvedValue('Readme {{project}}')
    await cli.handleTemplateSave('proj/readme', { fromClipboard: true })
    await cli.handleTagAdd('template', 'proj/readme', 'docs,project')
    await cli.handleSearch('read', { templates: true, tag: 'project' })
    const logs = (global.console.log.mock.calls || []).map(c => c.join(' ')).join('\n')
    expect(logs).toMatch('[template] proj/readme [docs,project]')
  })

  it('auto-fills from clipboard JSON via --auto and dot paths', async () => {
    // clipboard contains JSON the auto-vars should read
    mockClipboard.readText.mockResolvedValue(JSON.stringify({ user: { name: 'Zoe' } }))
    const fs = require('fs')
    const base = process.env.CLIPASTE_CONFIG_DIR
    const tpath = path.join(base, 'templates', 'json', 'hello.tmpl')
    fs.mkdirSync(path.dirname(tpath), { recursive: true })
    fs.writeFileSync(tpath, 'Hello {{clipboard.user.name}}', 'utf8')
    await cli.handleTemplateUse('json/hello', { auto: true, copy: true })
    expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello Zoe')
  })

  it('fails with missing required vars when --no-prompt is set', async () => {
    const tmpl = ['---', 'required: [ticket]', '---', 'Ticket: {{ticket}}'].join('\n')
    const base = process.env.CLIPASTE_CONFIG_DIR
    const tpath = path.join(base, 'templates', 'req', 'tmpl.tmpl')
    const fs = require('fs')
    fs.mkdirSync(path.dirname(tpath), { recursive: true })
    fs.writeFileSync(tpath, tmpl, 'utf8')
    await expect(cli.handleTemplateUse('req/tmpl', { prompt: false })).resolves.toBeUndefined()
    // handleTemplateUse exits process on error; we can't catch easily without refactor
    // So just ensure it logs an Error by checking console.error got called
    expect(global.console.error).toHaveBeenCalled()
  })
})
