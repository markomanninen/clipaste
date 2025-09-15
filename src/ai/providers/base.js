class AIProviderError extends Error {
  constructor (message, opts = {}) {
    super(message)
    this.name = 'AIProviderError'
    if (opts.cause) this.cause = opts.cause
    if (opts.code) this.code = opts.code
  }
}

class AIProvider {
  constructor (opts = {}) {
    this.name = opts.name || 'unknown'
    this.isLocal = opts.isLocal ?? true
    this.defaultModel = opts.defaultModel || null
  }

  async complete () {
    throw new AIProviderError('complete() not implemented')
  }
}

module.exports = { AIProvider, AIProviderError }
