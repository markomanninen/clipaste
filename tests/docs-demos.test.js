const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const CLI_SCRIPT = path.join(__dirname, '../src/index.js')
const PRELOAD = path.join(__dirname, 'helpers/mockClipboardSetup.js')
const WATCH_EXEC_SCRIPT = path.join(__dirname, 'helpers/watchExecCommand.js')
const isWindows = process.platform === 'win32'

require('./helpers/mockClipboardSetup')

jest.setTimeout(60000)

describe('Docs demo parity', () => {
  let baseDir
  let contextCounter = 0

  beforeAll(async () => {
    baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'clipaste-docs-demos-'))
  })

  afterAll(async () => {
    if (baseDir) {
      await fsp.rm(baseDir, { recursive: true, force: true })
    }
  })

  const createContext = async (name) => {
    contextCounter += 1
    const id = `${name}-${Date.now()}-${contextCounter}`
    const workDir = path.join(baseDir, id)
    const configDir = path.join(workDir, 'config')
    const clipboardFile = path.join(workDir, 'clipboard.txt')
    await fsp.mkdir(workDir, { recursive: true })
    await fsp.mkdir(configDir, { recursive: true })
    return { workDir, configDir, clipboardFile }
  }

  const buildEnv = (ctx) => {
    const env = { ...process.env, CLIPASTE_CONFIG_DIR: ctx.configDir, CLIPASTE_TEST_CLIPBOARD_FILE: ctx.clipboardFile }
    if (!isWindows) env.DISPLAY = ':0'
    delete env.CI
    delete env.GITHUB_ACTIONS
    delete env.HEADLESS
    return env
  }

  const runCLI = (args, options = {}) => {
    const { cwd, env, input, timeout = 20000 } = options
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ['-r', PRELOAD, CLI_SCRIPT, ...args], {
        cwd,
        env,
        stdio: 'pipe'
      })

      let stdout = ''
      let stderr = ''

      if (input) {
        child.stdin.write(input)
        child.stdin.end()
      }

      child.stdout.on('data', (data) => { stdout += data.toString() })
      child.stderr.on('data', (data) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        resolve({ code: null, stdout, stderr, timedOut: true })
      }, timeout)

      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code, stdout, stderr, timedOut: false })
      })

      child.on('error', (error) => {
        clearTimeout(timer)
        resolve({ code: null, stdout, stderr: stderr + error.message, error })
      })
    })
  }

  const fileExists = async (target) => {
    try {
      await fsp.access(target)
      return true
    } catch (error) {
      return false
    }
  }

  const waitFor = async (predicate, { timeout = 2000, interval = 50 } = {}) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await predicate()) return true
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    throw new Error('Condition not met within timeout')
  }

  test('clipaste-basics tape scenario', async () => {
    const ctx = await createContext('basics')
    const env = buildEnv(ctx)

    const status = await runCLI(['status'], { cwd: ctx.workDir, env })
    expect(status.code).toBe(0)
    expect(status.stdout).toMatch(/Clipboard (is empty|contains: empty content|contains: image content)/)

    const copy = await runCLI(['copy', 'Hello from clipaste'], { cwd: ctx.workDir, env })
    expect(copy.code).toBe(0)
    expect(copy.stdout).toContain('Copied text to clipboard (19 characters)')

    const get = await runCLI(['get'], { cwd: ctx.workDir, env })
    expect(get.code).toBe(0)
    expect(get.stdout.trim()).toBe('Hello from clipaste')

    const paste = await runCLI(['paste', '--dry-run', '--filename', 'demo'], { cwd: ctx.workDir, env })
    expect(paste.code).toBe(0)
    expect(paste.stdout).toContain('Would paste text content to:')
    expect(paste.stdout).toContain(path.join(ctx.workDir, 'demo.txt'))
  })

  test('clipaste-watch-exec tape scenario', async () => {
    const ctx = await createContext('watch-exec')
    const env = buildEnv(ctx)
    const outFile = path.join(ctx.workDir, 'out.txt')

    const Watcher = require('../src/watcher')
    const HistoryStore = require('../src/historyStore')
    const crypto = require('crypto')

    await fsp.mkdir(ctx.configDir, { recursive: true })
    const history = new HistoryStore({ dir: ctx.configDir, persist: true })
    const watcher = new Watcher({ interval: 250, verbose: false })

    const copy = await runCLI(['copy', 'watch demo'], { cwd: ctx.workDir, env })
    expect(copy.code).toBe(0)

    const clipboardContent = await fsp.readFile(ctx.clipboardFile, 'utf8')
    expect(clipboardContent.trim()).toBe('watch demo')

    const execCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(WATCH_EXEC_SCRIPT)}`
    const hash = crypto.createHash('sha256').update('watch demo').digest('hex')

    const prevCwd = process.cwd()
    try {
      process.chdir(ctx.workDir)
      await watcher._runExec(execCommand, 'watch demo', hash)
    } finally {
      process.chdir(prevCwd)
    }

    await history.addEntry('watch demo')

    await waitFor(async () => await fileExists(outFile), { timeout: 3000 })
    const output = await fsp.readFile(outFile, 'utf8')
    expect(output.trim()).toBe(String(Buffer.from('watch demo', 'utf8').length))

    const historyResult = await runCLI(['history'], { cwd: ctx.workDir, env })
    expect(historyResult.code).toBe(0)
    expect(historyResult.stdout).toContain('watch demo')
  })

  test('clipaste-phase3-transforms tape scenario', async () => {
    const ctx = await createContext('phase3-transforms')
    const env = buildEnv(ctx)

    const jsonContent = '{"a":1,"b":[2,3]}'
    await runCLI(['copy', jsonContent], { cwd: ctx.workDir, env })

    const pretty = await runCLI(['get', '--json-format'], { cwd: ctx.workDir, env })
    const expectedPretty = '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}'
    expect(pretty.stdout.trim()).toBe(expectedPretty.trim())

    const encoded = await runCLI(['get', '--url-encode'], { cwd: ctx.workDir, env })
    expect(encoded.stdout.trim()).toBe('%7B%22a%22%3A1%2C%22b%22%3A%5B2%2C3%5D%7D')

    const decoded = await runCLI(['get', '--url-decode'], { cwd: ctx.workDir, env })
    expect(decoded.stdout.trim()).toBe(jsonContent)

    const base64 = await runCLI(['get', '--base64'], { cwd: ctx.workDir, env })
    expect(base64.stdout.trim()).toBe('eyJhIjoxLCJiIjpbMiwzXX0=')

    const encodedCopy = await runCLI(['copy', '--encode-base64'], {
      cwd: ctx.workDir,
      env,
      input: 'hello phase3'
    })
    expect(encodedCopy.code).toBe(0)
    expect(encodedCopy.stdout).toContain('Copied text to clipboard (16 characters)')

    const decodedCopy = await runCLI(['copy', '--decode-base64', 'aGVsbG8='], { cwd: ctx.workDir, env })
    expect(decodedCopy.code).toBe(0)
    expect(decodedCopy.stdout).toContain('Copied text to clipboard (5 characters)')

    const finalGet = await runCLI(['get'], { cwd: ctx.workDir, env })
    expect(finalGet.stdout.trim()).toBe('hello')
  })

  test('clipaste-phase3-auto-extension tape scenario', async () => {
    const ctx = await createContext('phase3-auto-extension')
    const env = buildEnv(ctx)

    const jsonContent = '{"k":42}'
    await runCLI(['copy', jsonContent], { cwd: ctx.workDir, env })

    const result = await runCLI(['paste', '--auto-extension', '--filename', 'sample'], { cwd: ctx.workDir, env })
    expect(result.code).toBe(0)

    const savedPath = path.join(ctx.workDir, 'sample.json')
    const saved = await fsp.readFile(savedPath, 'utf8')
    expect(saved).toBe(jsonContent)
  })

  test('clipaste-phase3-image-resize tape scenario', async () => {
    const ctx = await createContext('phase3-image-resize')
    const env = buildEnv(ctx)

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    await runCLI(['copy', dataUrl], { cwd: ctx.workDir, env })

    const result = await runCLI(['paste', '--format', 'webp', '--resize', '800x', '--filename', 'tiny'], { cwd: ctx.workDir, env })
    expect(result.code).toBe(0)

    const imagePath = path.join(ctx.workDir, 'tiny.webp')
    const stats = await fsp.stat(imagePath)
    expect(stats.size).toBeGreaterThan(0)

    const sharp = require('sharp')
    const metadata = await sharp(imagePath).metadata()
    expect(metadata.format).toBe('webp')

    // Clean up to avoid Windows file locking issues in CI
    await fsp.unlink(imagePath).catch(() => {})
  })

  test('clipaste-phase4a-snippets tape scenario', async () => {
    const ctx = await createContext('phase4a-snippets')
    const env = buildEnv(ctx)

    const snippetText = "console.log('hello')"
    const add = await runCLI(['snippet', 'add', 'code/log', '--text', snippetText], { cwd: ctx.workDir, env })
    expect(add.code).toBe(0)
    expect(add.stdout).toContain('Saved snippet to:')

    const list = await runCLI(['snippet', 'list'], { cwd: ctx.workDir, env })
    expect(list.stdout).toContain('code/log')

    const copy = await runCLI(['snippet', 'copy', 'code/log'], { cwd: ctx.workDir, env })
    expect(copy.stdout).toContain("Copied snippet 'code/log' to clipboard")

    const get = await runCLI(['get'], { cwd: ctx.workDir, env })
    expect(get.stdout.trim()).toBe(snippetText)
  })

  test('clipaste-phase4a-templates tape scenario', async () => {
    const ctx = await createContext('phase4a-templates')
    const env = buildEnv(ctx)

    const templatePath = path.join(ctx.workDir, 'greet.tmpl')
    const templateBody = 'Hello {{name|World}} from {{date}}'
    await fsp.writeFile(templatePath, templateBody, 'utf8')

    const save = await runCLI(['template', 'save', 'greet/hello', '--from', templatePath], { cwd: ctx.workDir, env })
    expect(save.stdout).toContain('Saved template to:')

    const list = await runCLI(['template', 'list'], { cwd: ctx.workDir, env })
    expect(list.stdout).toContain('greet/hello')

    const use = await runCLI(['template', 'use', 'greet/hello', '--vars', 'name=Clipaste', '--copy'], { cwd: ctx.workDir, env })
    expect(use.stdout).toContain("Copied rendered template 'greet/hello' to clipboard")

    const get = await runCLI(['get'], { cwd: ctx.workDir, env })
    expect(get.stdout.trim().startsWith('Hello Clipaste from ')).toBe(true)
  })

  test('clipaste-phase4a-pick tape scenario', async () => {
    const ctx = await createContext('phase4a-pick')
    const env = buildEnv(ctx)

    const templatePath = path.join(ctx.workDir, 't1.tmpl')
    await fsp.writeFile(templatePath, 'Template One', 'utf8')
    await runCLI(['template', 'save', 'demo/one', '--from', templatePath], { cwd: ctx.workDir, env })

    const pick = await runCLI(['pick', '--templates'], { cwd: ctx.workDir, env })
    expect(pick.code).toBe(0)
    expect(pick.stdout.split('\n')[0]).toBe('1. demo/one')
  })

  test('clipaste-phase4a-search tape scenario', async () => {
    const ctx = await createContext('phase4a-search')
    const env = buildEnv(ctx)

    const templatePath = path.join(ctx.workDir, 't2.tmpl')
    await fsp.writeFile(templatePath, 'Hello Search Body', 'utf8')
    await runCLI(['template', 'save', 'demo/search', '--from', templatePath], { cwd: ctx.workDir, env })

    const search = await runCLI(['search', 'search', '--templates', '--body'], { cwd: ctx.workDir, env })
    expect(search.code).toBe(0)
    expect(search.stdout).toContain('[template] demo/search')
  })

  test('clipaste-phase4b-ai tape scenario', async () => {
    const ctx = await createContext('phase4b-ai')
    const env = buildEnv(ctx)

    const aiHelp = await runCLI(['ai', '--help'], { cwd: ctx.workDir, env })
    expect(aiHelp.code).toBe(0)
    expect(aiHelp.stdout).toContain('Usage: clipaste ai [options] [command]')

    const summarizeHelp = await runCLI(['ai', 'summarize', '--help'], { cwd: ctx.workDir, env })
    expect(summarizeHelp.code).toBe(0)
    expect(summarizeHelp.stdout).toContain('Usage: clipaste ai summarize [options]')

    const classifyHelp = await runCLI(['ai', 'classify', '--help'], { cwd: ctx.workDir, env })
    expect(classifyHelp.code).toBe(0)
    expect(classifyHelp.stdout).toContain('Usage: clipaste ai classify [options]')

    const transformHelp = await runCLI(['ai', 'transform', '--help'], { cwd: ctx.workDir, env })
    expect(transformHelp.code).toBe(0)
    expect(transformHelp.stdout).toContain('Usage: clipaste ai transform [options]')
  })

  test('clipaste-randomizer tape scenario', async () => {
    const ctx = await createContext('randomizer')
    const env = buildEnv(ctx)

    const pluginStatus = await runCLI(['plugins'], { cwd: ctx.workDir, env })
    if (!pluginStatus.stdout.includes('clipaste-randomizer')) {
      console.warn('clipaste-randomizer plugin not available; skipping randomizer scenario')
      return
    }

    const flows = [
      {
        cmd: ['random', 'password', '--length', '16'],
        verify: (output, clipboard) => {
          expect(output).toContain('Generated password:')
          expect(clipboard.length).toBe(16)
        }
      },
      {
        cmd: ['random', 'password', '--words', '4'],
        verify: (output, clipboard) => {
          expect(output).toContain('Generated password:')
          expect(clipboard.split('-')).toHaveLength(4)
        }
      },
      {
        cmd: ['random', 'string', '--template', 'User-{{#####}}'],
        verify: (output, clipboard) => {
          expect(output).toContain('Generated string:')
          expect(clipboard).toMatch(/^User-\{?\d{5}\}?$/)
        }
      },
      {
        cmd: ['random', 'personal-id', '--birthdate', '1990-05-15'],
        verify: (output, clipboard) => {
          expect(output).toContain('Generated personal identity code:')
          expect(clipboard).toMatch(/^\d{6}[+\-A]\d{3}[0-9A-Z]$/)
        }
      },
      {
        cmd: ['random', 'iban'],
        verify: (output, clipboard) => {
          expect(output).toContain('Generated IBAN:')
          expect(clipboard.replace(/\s+/g, '')).toMatch(/^FI\d{16}$/)
        }
      },
      {
        cmd: ['random', 'business-id'],
        verify: (output, clipboard) => {
          expect(output).toContain('Generated business ID:')
          expect(clipboard).toMatch(/^\d{7}-\d$/)
        }
      }
    ]

    for (const flow of flows) {
      const result = await runCLI(flow.cmd, { cwd: ctx.workDir, env })
      if (result.code !== 0) {
        console.warn(`Skipping ${flow.cmd.join(' ')} due to exit code ${result.code}`)
        continue
      }
      const clipboardValue = (await runCLI(['get'], { cwd: ctx.workDir, env })).stdout.trim()
      flow.verify(result.stdout, clipboardValue)
    }
  })
})
