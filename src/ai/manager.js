const { ConfigStore } = require('../utils/config')
const { redactText, parseRules } = require('./redact')
const { AIProviderError } = require('./providers/base')
const OllamaProvider = require('./providers/ollama')

const DEFAULT_CONFIG = {
  ai: {
    defaultProvider: 'ollama',
    defaultModel: 'llama3.2:1b',
    networkConsent: false,
    redaction: {
      enabled: true,
      rules: ['emails', 'keys', 'jwt', 'ipv4', 'ipv6', 'paths']
    },
    providers: {
      ollama: {
        endpoint: 'http://localhost:11434',
        defaultModel: 'llama3.2:1b'
      }
    }
  }
}

class AIManager {
  constructor (opts = {}) {
    this.configStore = opts.configStore || new ConfigStore({ defaults: DEFAULT_CONFIG })
    this.providers = new Map()
    this.registerProvider('ollama', (cfg = {}) => new OllamaProvider({ config: cfg }))
  }

  registerProvider (name, factory) {
    this.providers.set(name, factory)
  }

  getProviderNames () {
    return Array.from(this.providers.keys())
  }

  async resolveProvider (requested) {
    const aiConfig = await this.configStore.get('ai', DEFAULT_CONFIG.ai)
    const name = requested || aiConfig.defaultProvider || 'ollama'
    if (!this.providers.has(name)) {
      throw new Error(`AI provider '${name}' is not available. Available: ${this.getProviderNames().join(', ')}`)
    }
    const providerConfig = (aiConfig.providers && aiConfig.providers[name]) || {}
    const factory = this.providers.get(name)
    const provider = factory(providerConfig)
    const defaultModel = providerConfig.defaultModel || aiConfig.defaultModel || provider.defaultModel
    return { provider, name, defaultModel, config: aiConfig }
  }

  async ensureConsent (provider, consentProvided, aiConfig) {
    if (provider.isLocal) return
    const storedConsent = aiConfig && aiConfig.networkConsent
    if (!consentProvided && !storedConsent) {
      throw new Error('Network provider requires explicit consent. Pass --consent or set ai.networkConsent: true in config.')
    }
  }

  async runPrompt ({ prompt, provider: requestedProvider, model, consent, maxTokens, temperature, topP, seed, timeout, raw }) {
    if (!prompt) throw new AIProviderError('Prompt is required')
    const { provider, name, defaultModel, config } = await this.resolveProvider(requestedProvider)
    await this.ensureConsent(provider, consent, config)
    const targetModel = model || defaultModel || provider.defaultModel
    const response = await provider.complete({ prompt, model: targetModel, maxTokens, temperature, topP, seed, timeout, raw })
    return {
      text: response.text,
      meta: {
        provider: name,
        model: targetModel,
        raw: response.raw,
        providerMeta: response.meta || {}
      }
    }
  }

  async applyRedaction (text, options = {}) {
    const ai = await this.configStore.get('ai', DEFAULT_CONFIG.ai)
    const configEnabled = ai.redaction ? ai.redaction.enabled !== false : true
    const rules = options.rules ? parseRules(options.rules) : (ai.redaction && ai.redaction.rules) || undefined
    const enabled = options.enabled != null ? options.enabled : configEnabled
    return redactText(text, rules, { enabled })
  }
}

module.exports = AIManager
