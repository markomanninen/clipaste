const { AIProvider, AIProviderError } = require('../src/ai/providers/base')

describe('AIProvider base class', () => {
  class DummyProvider extends AIProvider {}

  it('applies default metadata and respects overrides', () => {
    const provider = new DummyProvider({ name: 'dummy', isLocal: false, defaultModel: 'test-model' })
    expect(provider.name).toBe('dummy')
    expect(provider.isLocal).toBe(false)
    expect(provider.defaultModel).toBe('test-model')

    const fallback = new DummyProvider()
    expect(fallback.name).toBe('unknown')
    expect(fallback.isLocal).toBe(true)
    expect(fallback.defaultModel).toBeNull()
  })

  it('throws AIProviderError when complete() is not implemented', async () => {
    const provider = new DummyProvider()
    await expect(provider.complete({ prompt: 'hi' })).rejects.toThrow(AIProviderError)
    await expect(provider.complete({ prompt: 'hi' })).rejects.toThrow('complete() not implemented')
  })

  it('preserves AIProviderError metadata', () => {
    const cause = new Error('network')
    const err = new AIProviderError('boom', { code: 'EFAIL', cause })
    expect(err.message).toBe('boom')
    expect(err.code).toBe('EFAIL')
    expect(err.cause).toBe(cause)
  })
})
