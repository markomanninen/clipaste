jest.mock('../src/ai/providers/ollama', () => jest.fn())

const AIManager = require('../src/ai/manager')
const { ConfigStore } = require('../src/utils/config')
const { AIProvider } = require('../src/ai/providers/base')
const OllamaProvider = require('../src/ai/providers/ollama')

describe('AIManager', () => {
  beforeEach(() => {
    OllamaProvider.mockReset()
  })

  it('runs prompt using configured provider and model', async () => {
    const mockComplete = jest.fn().mockResolvedValue({ text: 'mock-response', meta: { info: 'ok' } })
    OllamaProvider.mockImplementation(() => ({
      isLocal: true,
      defaultModel: 'llama3.2:1b',
      complete: mockComplete
    }))

    const configStore = new ConfigStore({
      defaults: {
        ai: {
          defaultProvider: 'ollama',
          defaultModel: 'custom-model',
          providers: {
            ollama: {
              endpoint: 'http://unused',
              defaultModel: 'custom-model'
            }
          }
        }
      }
    })
    const manager = new AIManager({ configStore })

    const result = await manager.runPrompt({ prompt: 'Hello world', maxTokens: 42 })

    expect(mockComplete).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Hello world'),
      model: 'custom-model',
      maxTokens: 42
    }))
    expect(result.text).toBe('mock-response')
    expect(result.meta.provider).toBe('ollama')
    expect(result.meta.model).toBe('custom-model')
    expect(result.meta.providerMeta).toEqual({ info: 'ok' })
  })

  it('requires consent for network providers', async () => {
    const configStore = new ConfigStore({ defaults: { ai: { defaultProvider: 'ollama' } } })
    const manager = new AIManager({ configStore })
    class CloudProvider extends AIProvider {
      constructor () {
        super({ name: 'cloud', isLocal: false, defaultModel: 'cloud-model' })
      }

      async complete () {
        return { text: 'cloud-ok', meta: {} }
      }
    }
    manager.registerProvider('cloud', () => new CloudProvider())

    await expect(manager.runPrompt({ prompt: 'data', provider: 'cloud' })).rejects.toThrow('Network provider requires explicit consent')
    const res = await manager.runPrompt({ prompt: 'data', provider: 'cloud', consent: true })
    expect(res.text).toBe('cloud-ok')
    expect(res.meta.model).toBe('cloud-model')
  })

  it('throws when provider is unknown', async () => {
    const configStore = new ConfigStore({ defaults: { ai: { defaultProvider: 'ollama' } } })
    const manager = new AIManager({ configStore })
    await expect(manager.runPrompt({ prompt: 'test', provider: 'missing' })).rejects.toThrow(/AI provider 'missing' is not available/)
  })

  it('requires prompt input', async () => {
    const configStore = new ConfigStore({ defaults: { ai: { defaultProvider: 'ollama' } } })
    const manager = new AIManager({ configStore })
    await expect(manager.runPrompt({ prompt: '' })).rejects.toThrow('Prompt is required')
  })

  it('applyRedaction honors config defaults and overrides', async () => {
    const configStore = new ConfigStore({
      defaults: {
        ai: {
          redaction: {
            enabled: false,
            rules: ['keys']
          }
        }
      }
    })
    const manager = new AIManager({ configStore })
    const disabled = await manager.applyRedaction('secret', {})
    expect(disabled.text).toBe('secret')

    const overridden = await manager.applyRedaction('user@example.com key', { rules: 'emails', enabled: true })
    expect(overridden.text).toContain('[REDACTED_EMAIL]')
  })
})
