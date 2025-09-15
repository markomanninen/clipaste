jest.mock('http', () => ({ request: jest.fn() }))
jest.mock('https', () => ({ request: jest.fn() }))

const { EventEmitter } = require('events')
const http = require('http')
const OllamaProvider = require('../src/ai/providers/ollama')
const { AIProviderError } = require('../src/ai/providers/base')

function createResponse (statusCode, body) {
  const res = new EventEmitter()
  res.statusCode = statusCode
  process.nextTick(() => {
    if (body != null) res.emit('data', Buffer.from(body))
    res.emit('end')
  })
  return res
}

describe('OllamaProvider', () => {
  let lastRequest

  beforeEach(() => {
    http.request.mockReset()
    lastRequest = null
  })

  function mockHttp ({ statusCode = 200, body = JSON.stringify({ response: 'ok', done: true }), skipResponse = false, onBeforeResponse } = {}) {
    http.request.mockImplementation((options, callback) => {
      const req = new EventEmitter()
      lastRequest = req
      req.options = options
      req.body = ''
      req.write = jest.fn((chunk) => { req.body += chunk.toString() })
      req.setTimeout = jest.fn((ms, handler) => { req.timeoutMs = ms; req.timeoutHandler = handler })
      req.destroy = jest.fn((err) => { process.nextTick(() => req.emit('error', err)) })
      req.end = jest.fn(() => {
        if (onBeforeResponse) {
          onBeforeResponse(req, callback)
          return
        }
        if (skipResponse) return
        const res = createResponse(statusCode, body)
        callback(res)
      })
      return req
    })
  }

  it('successfully posts prompts and returns response metadata', async () => {
    mockHttp({ body: JSON.stringify({ response: 'summary', done: true }) })
    const provider = new OllamaProvider({ config: { endpoint: 'http://127.0.0.1:11434' } })
    const result = await provider.complete({
      prompt: 'Summarize this',
      model: 'llama3.2:1b',
      maxTokens: 50,
      temperature: 0.2,
      topP: 0.9,
      seed: 123,
      timeout: 500,
      raw: true
    })

    expect(result.text).toBe('summary')
    expect(result.meta).toEqual({ model: 'llama3.2:1b', done: true })
    expect(result.raw).toEqual({ response: 'summary', done: true })

    const payload = JSON.parse(lastRequest.body)
    expect(payload.model).toBe('llama3.2:1b')
    expect(payload.prompt).toContain('Summarize this')
    expect(payload.options).toMatchObject({
      num_predict: 50,
      temperature: 0.2,
      top_p: 0.9,
      seed: 123
    })
    expect(lastRequest.setTimeout).toHaveBeenCalledWith(500, expect.any(Function))
  })

  it('throws when prompt is missing', async () => {
    const provider = new OllamaProvider()
    await expect(provider.complete({})).rejects.toThrow('Prompt is required')
  })

  it('throws when model cannot be determined', async () => {
    const provider = new OllamaProvider({ config: { endpoint: 'http://localhost:11434' } })
    provider.defaultModel = null
    await expect(provider.complete({ prompt: 'hi there' })).rejects.toThrow('Model is required')
  })

  it('propagates non-2xx status codes as errors', async () => {
    mockHttp({ statusCode: 503, body: JSON.stringify({ error: 'nope' }) })
    const provider = new OllamaProvider({ config: { endpoint: 'http://localhost:11434' } })
    await expect(provider.complete({ prompt: 'hello', model: 'llama3.2:1b' })).rejects.toThrow('Ollama error')
  })

  it('handles invalid JSON responses', async () => {
    mockHttp({ body: 'not-json' })
    const provider = new OllamaProvider({ config: { endpoint: 'http://localhost:11434' } })
    await expect(provider.complete({ prompt: 'hello', model: 'llama3.2:1b' })).rejects.toThrow('Invalid JSON response from Ollama')
  })

  it('rejects when the request emits an error', async () => {
    http.request.mockImplementation(() => {
      const req = new EventEmitter()
      req.write = jest.fn()
      req.end = jest.fn(() => {
        process.nextTick(() => req.emit('error', new Error('connect failure')))
      })
      req.setTimeout = jest.fn()
      req.destroy = jest.fn((err) => { process.nextTick(() => req.emit('error', err)) })
      return req
    })

    const provider = new OllamaProvider({ config: { endpoint: 'http://localhost:11434' } })
    await expect(provider.complete({ prompt: 'hello', model: 'llama3.2:1b' })).rejects.toThrow('Failed to reach Ollama endpoint')
  })

  it('honors timeouts by invoking the timeout handler', async () => {
    mockHttp({ skipResponse: true })
    const provider = new OllamaProvider({ config: { endpoint: 'http://localhost:11434' } })
    const promise = provider.complete({ prompt: 'hello', model: 'llama3.2:1b', timeout: 10 })
    await Promise.resolve()
    expect(lastRequest).toBeTruthy()
    expect(lastRequest.setTimeout).toHaveBeenCalledWith(10, expect.any(Function))
    lastRequest.timeoutHandler()
    let caught
    try {
      await promise
    } catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect(caught).toBeInstanceOf(AIProviderError)
    expect(caught.message).toBe('Failed to reach Ollama endpoint')
    expect(caught.cause).toBeInstanceOf(AIProviderError)
    expect(caught.cause.message).toBe('Ollama request timed out')
  })
})
