const fs = require('fs').promises
const os = require('os')
const path = require('path')

const { ConfigStore, resolveConfigDir, mergeDeep } = require('../src/utils/config')

describe('Config utilities', () => {
  let originalEnv
  let tempDir

  beforeEach(async () => {
    originalEnv = { ...process.env }
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipaste-config-'))
  })

  afterEach(async () => {
    process.env = originalEnv
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('mergeDeep merges nested objects without mutating originals', () => {
    const target = { ai: { defaultProvider: 'ollama', redaction: { enabled: true } } }
    const source = { ai: { defaultModel: 'llama', redaction: { rules: ['emails'] } } }
    const merged = mergeDeep(target, source)
    expect(merged).toEqual({ ai: { defaultProvider: 'ollama', defaultModel: 'llama', redaction: { enabled: true, rules: ['emails'] } } })
    expect(target).toEqual({ ai: { defaultProvider: 'ollama', redaction: { enabled: true } } })
  })

  it('load falls back to defaults when config file is missing', async () => {
    const defaults = { ai: { defaultProvider: 'ollama' } }
    const store = new ConfigStore({ baseDir: tempDir, defaults })
    const cfg = await store.load()
    expect(cfg).toEqual(defaults)
    // second call should hit cache
    const cached = await store.load()
    expect(cached).toBe(cfg)
  })

  it('load merges file contents and reload busts cache', async () => {
    const file = path.join(tempDir, 'config.json')
    await fs.writeFile(file, JSON.stringify({ ai: { defaultModel: 'custom', providers: { ollama: { endpoint: 'http://host' } } } }), 'utf8')
    const store = new ConfigStore({ baseDir: tempDir, defaults: { ai: { defaultProvider: 'ollama', providers: { ollama: { endpoint: 'http://localhost' } } } } })
    const cfg = await store.load()
    expect(cfg.ai.defaultProvider).toBe('ollama')
    expect(cfg.ai.defaultModel).toBe('custom')
    expect(cfg.ai.providers.ollama.endpoint).toBe('http://host')

    await fs.writeFile(file, JSON.stringify({ ai: { defaultModel: 'changed' } }), 'utf8')
    const reloaded = await store.reload()
    expect(reloaded.ai.defaultModel).toBe('changed')
  })

  it('get returns nested values with fallback when missing', async () => {
    const store = new ConfigStore({ baseDir: tempDir, defaults: { ai: { networkConsent: true } } })
    expect(await store.get('ai.networkConsent')).toBe(true)
    expect(await store.get('ai.providers.ollama.endpoint', 'fallback')).toBe('fallback')
  })

  it('resolveConfigDir respects override environment variable', () => {
    process.env.CLIPASTE_CONFIG_DIR = '/custom/path'
    expect(resolveConfigDir()).toBe('/custom/path')
  })
})
