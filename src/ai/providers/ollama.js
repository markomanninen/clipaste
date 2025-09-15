const http = require('http')
const https = require('https')
const { URL } = require('url')
const { AIProvider, AIProviderError } = require('./base')

async function postJson (urlString, payload, timeout) {
  const url = new URL(urlString)
  const body = JSON.stringify(payload)
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }
  const transport = url.protocol === 'https:' ? https : http
  return await new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
<<<<<<< HEAD
        if (res.statusCode >= 200 && res.statusCode < 300) {
=======
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
>>>>>>> 7bb233b (Add AI plugin commands and local provider)
          try {
            const json = JSON.parse(text || '{}')
            resolve(json)
          } catch (err) {
            reject(new AIProviderError('Invalid JSON response from Ollama', { cause: err }))
          }
        } else {
          reject(new AIProviderError(`Ollama error: ${res.statusCode || 500}`, { code: res.statusCode, cause: text }))
        }
      })
    })
    req.on('error', (err) => {
      reject(new AIProviderError('Failed to reach Ollama endpoint', { cause: err }))
    })
    if (timeout) {
      req.setTimeout(timeout, () => {
        req.destroy(new AIProviderError('Ollama request timed out'))
      })
    }
    req.write(body)
    req.end()
  })
}

class OllamaProvider extends AIProvider {
  constructor (opts = {}) {
    super({ name: 'ollama', isLocal: true, defaultModel: 'llama3.2:1b' })
    this.endpoint = (opts.config && opts.config.endpoint) || 'http://localhost:11434'
  }

  async complete ({ prompt, model, maxTokens, temperature, topP, seed, timeout, raw }) {
    if (!prompt) {
      throw new AIProviderError('Prompt is required')
    }
    const targetModel = model || this.defaultModel
    if (!targetModel) {
      throw new AIProviderError('Model is required for Ollama provider')
    }
    const body = {
      model: targetModel,
      prompt,
      stream: false,
      options: {}
    }
    if (typeof maxTokens === 'number') body.options.num_predict = maxTokens
    if (typeof temperature === 'number') body.options.temperature = temperature
    if (typeof topP === 'number') body.options.top_p = topP
    if (typeof seed === 'number') body.options.seed = seed
    const url = this.endpoint.replace(/\/$/, '') + '/api/generate'
    const json = await postJson(url, body, timeout)
    const text = typeof json.response === 'string' ? json.response : ''
    return {
      text,
      raw: raw ? json : undefined,
      meta: {
        model: targetModel,
        done: json.done === undefined ? true : json.done
      }
    }
  }
}

module.exports = OllamaProvider
