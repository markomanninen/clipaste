const fs = require('fs')
const path = require('path')
const os = require('os')
const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')

jest.mock('../src/clipboard')

describe('Phase 4A: CLI coverage targets', () => {
  let cli
  let originalEnv
  let originalConsole
  let originalProcess
  const tmpBase = path.join(os.tmpdir(), `clipaste-test-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, CLIPASTE_CONFIG_DIR: tmpBase }
    originalConsole = global.console
    originalProcess = global.process
    global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() }
    global.process = { ...process, exit: jest.fn(), stdin: { isTTY: false }, stdout: { write: jest.fn() } }
    ClipboardManager.mockImplementation(() => ({ writeText: jest.fn(), readText: jest.fn() }))
    cli = new CLI()
  })

  afterEach(() => {
    process.env = originalEnv
    global.console = originalConsole
    global.process = originalProcess
    jest.restoreAllMocks()
  })

  it('handleTemplateDelete error path', async () => {
    await cli.handleTemplateDelete('does/not/exist')
    expect(global.console.error).toHaveBeenCalled()
    expect(global.process.exit).toHaveBeenCalledWith(1)
  })

  it('handleSearch with JSON output and snippet/template targets', async () => {
    const tdir = path.join(tmpBase, 'templates', 'demo')
    const sdir = path.join(tmpBase, 'snippets', 'demo')
    fs.mkdirSync(tdir, { recursive: true })
    fs.mkdirSync(sdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 'alpha.tmpl'), 'Alpha body', 'utf8')
    fs.writeFileSync(path.join(sdir, 'beta.txt'), 'Beta body', 'utf8')

    await cli.handleSearch('body', { templates: true, snippets: true, json: true, body: true })
    const out = (global.process.stdout.write.mock.calls[0] || [])[0]
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed.templates)).toBe(true)
    expect(Array.isArray(parsed.snippets)).toBe(true)
    expect(parsed.templates.find(x => x.name.endsWith('alpha'))).toBeTruthy()
    expect(parsed.snippets.find(x => x.name.endsWith('beta'))).toBeTruthy()
  })

  it('handleSearch prints [history] entries when not JSON', async () => {
    // seed history by writing a file and using HistoryStore directly
    const HistoryStore = require('../src/historyStore')
    const hs = new HistoryStore({})
    await hs.addEntry('HistoryFindMe text')
    await cli.handleSearch('FindMe', { history: true })
    const out = (global.console.log.mock.calls || []).map(c => c.join(' ')).join('\n')
    expect(out).toMatch('[history]')
  })

  it('handleSearch catches errors and exits', async () => {
    const orig = cli.library.search
    cli.library.search = jest.fn(() => { throw new Error('boom') })
    await cli.handleSearch('x', { templates: true })
    expect(global.console.error).toHaveBeenCalled()
    expect(global.process.exit).toHaveBeenCalledWith(1)
    cli.library.search = orig
  })

  it('pick uses fzf output if available', async () => {
    // prepare two templates
    const tdir = path.join(tmpBase, 'templates', 'pickfzf')
    fs.mkdirSync(tdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 'one.tmpl'), 'One', 'utf8')
    fs.writeFileSync(path.join(tdir, 'two.tmpl'), 'Two', 'utf8')
    // mock spawnSync to emulate fzf selection
    jest.spyOn(require('child_process'), 'spawnSync').mockReturnValue({ stdout: 'pickfzf/one\n' })
    const origIn = global.process.stdin
    const origOut = global.process.stdout
    global.process.stdin = { ...global.process.stdin, isTTY: true }
    global.process.stdout = { ...global.process.stdout, isTTY: true, write: jest.fn() }
    await cli.handlePick({ templates: true })
    const lines = (global.console.log.mock.calls || []).map(c => c.join(' ')).join('\n')
    expect(lines.trim().endsWith('pickfzf/one')).toBe(true)
    global.process.stdin = origIn
    global.process.stdout = origOut
  })

  it('pick interactive fallback (TTY) reads a number and prints selected name', async () => {
    // prepare templates
    const tdir = path.join(tmpBase, 'templates', 'picktty')
    fs.mkdirSync(tdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 'one.tmpl'), 'One', 'utf8')
    fs.writeFileSync(path.join(tdir, 'two.tmpl'), 'Two', 'utf8')
    // make stdin TTY and stub once to immediately return '2' (second item)
    const origStdin = global.process.stdin
    global.process.stdin = { isTTY: true, once: (ev, cb) => cb(Buffer.from('2\n')) }
    await cli.handlePick({ templates: true })
    const out = (global.console.log.mock.calls || []).map(c => c.join(' ')).join('\n')
    expect(out).toMatch('picktty/two')
    global.process.stdin = origStdin
  })

  it('template use --out writes rendered file', async () => {
    const tdir = path.join(tmpBase, 'templates', 'out')
    fs.mkdirSync(tdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 'tmpl.tmpl'), 'File: {{name}}', 'utf8')
    const outfile = path.join(tmpBase, 'result.txt')
    await cli.handleTemplateUse('out/tmpl', { vars: ['name=Demo'], out: outfile })
    expect(fs.existsSync(outfile)).toBe(true)
    expect(fs.readFileSync(outfile, 'utf8')).toBe('File: Demo')
  })

  it('template delete success path', async () => {
    const tdir = path.join(tmpBase, 'templates', 'delok')
    fs.mkdirSync(tdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 't.tmpl'), 'x', 'utf8')
    await cli.handleTemplateDelete('delok/t')
    const out = (global.console.log.mock.calls || []).map(c => c.join(' ')).join('\n')
    expect(out).toMatch("Deleted template 'delok/t'")
  })

  it('template list --json outputs array of items', async () => {
    const tdir = path.join(tmpBase, 'templates', 'listjson')
    fs.mkdirSync(tdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 'a.tmpl'), '---\ndescription: D\ntags: [x]\n---\nBody', 'utf8')
    global.process.stdout.write.mockReset()
    await cli.handleTemplateList({ json: true })
    const payload = (global.process.stdout.write.mock.calls[0] || [])[0]
    const arr = JSON.parse(payload)
    expect(Array.isArray(arr)).toBe(true)
    expect(arr.find(i => i.name.endsWith('listjson/a'))).toBeTruthy()
  })

  it('handleTagRemove error path', async () => {
    const orig = cli.library.removeTags
    cli.library.removeTags = jest.fn(() => { throw new Error('tag error') })
    await cli.handleTagRemove('template', 'name', 'x')
    expect(global.console.error).toHaveBeenCalled()
    expect(global.process.exit).toHaveBeenCalledWith(1)
    cli.library.removeTags = orig
  })
  it('handlePick fallback prints numbered list when no TTY', async () => {
    const tdir = path.join(tmpBase, 'templates', 'pick')
    fs.mkdirSync(tdir, { recursive: true })
    fs.writeFileSync(path.join(tdir, 'one.tmpl'), 'One', 'utf8')
    fs.writeFileSync(path.join(tdir, 'two.tmpl'), 'Two', 'utf8')
    await cli.handlePick({ templates: true })
    const lines = (global.console.log.mock.calls || []).map(c => c.join(' '))
    const joined = lines.join('\n')
    expect(joined).toMatch('pick/one')
    expect(joined).toMatch('pick/two')
  })

  it('handleTagAdd error on empty tag list', async () => {
    await cli.handleTagAdd('template', 'demo/name', '')
    expect(global.console.error).toHaveBeenCalled()
    expect(global.process.exit).toHaveBeenCalledWith(1)
  })
})
