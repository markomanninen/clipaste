const { spawn } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs').promises

describe('Phase 3 - smoke CLI (spawned)', () => {
  const cliScript = path.join(__dirname, '../src/index.js')
  const tmp = path.join(os.tmpdir(), 'clipaste-phase3-smoke')

  beforeAll(async () => {
    await fs.mkdir(tmp, { recursive: true })
  })

  afterAll(async () => {
    try { await fs.rm(tmp, { recursive: true, force: true }) } catch {}
  })

  function runCLI (args, opts = {}) {
    return new Promise((resolve) => {
      const child = spawn('node', [cliScript, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: opts.cwd || tmp,
        env: { ...process.env, ...(opts.env || {}) }
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => { stdout += d.toString() })
      child.stderr.on('data', (d) => { stderr += d.toString() })

      // Add timeout for hanging processes
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        resolve({ code: 124, stdout, stderr: stderr + '\nProcess timed out after 10 seconds' })
      }, 10000)

      child.on('close', (code) => {
        clearTimeout(timeout)
        resolve({ code, stdout, stderr })
      })

      if (opts.stdin) {
        child.stdin.write(opts.stdin)
        child.stdin.end()
      }
    })
  }

  it('help shows new flags for paste/get/copy', async () => {
    const paste = await runCLI(['paste', '--help'])
    expect(paste.code).toBe(0)
    expect(paste.stdout).toContain('--resize')
    expect(paste.stdout).toContain('--auto-extension')

    const get = await runCLI(['get', '--help'])
    expect(get.code).toBe(0)
    expect(get.stdout).toContain('--base64')
    expect(get.stdout).toContain('--json-format')
    expect(get.stdout).toContain('--url-decode')
    expect(get.stdout).toContain('--url-encode')
    expect(get.stdout).toContain('--image-info')

    const copy = await runCLI(['copy', '--help'])
    expect(copy.code).toBe(0)
    expect(copy.stdout).toContain('--decode-base64')
    expect(copy.stdout).toContain('--encode-base64')
  })

  it('paste accepts new flags in dry-run (no crash)', async () => {
    const res = await runCLI(['paste', '--dry-run', '--resize', '800x', '--auto-extension', '--filename', 'smoke'])
    // Exit 0 or 1 depending on clipboard availability
    expect([0, 1]).toContain(res.code)
  }, 15000)

  it('copy --encode-base64 works with stdin in headless mode', async () => {
    const res = await runCLI(['copy', '--encode-base64'], { env: { HEADLESS: '1' }, stdin: 'abc' })
    expect(res.code).toBe(0)
  })

  it('copy --decode-base64 works (arg) in headless mode', async () => {
    const payload = Buffer.from('xyz', 'utf8').toString('base64')
    const res = await runCLI(['copy', '--decode-base64', payload], { env: { HEADLESS: '1' } })
    expect([0, 1]).toContain(res.code)
  })

  it('get --image-info does not crash when no image', async () => {
    const res = await runCLI(['get', '--image-info'], { env: { HEADLESS: '1' } })
    // With empty clipboard, should exit 0 (no output)
    expect(res.code).toBe(0)
  }, 10000)
})
