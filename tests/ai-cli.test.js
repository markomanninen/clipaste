jest.mock('../src/clipboard', () => jest.fn())
jest.mock('../src/fileHandler', () => jest.fn())
jest.mock('../src/ai/manager', () => jest.fn())

const path = require('path')
const fs = require('fs')
const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')
const FileHandler = require('../src/fileHandler')
const AIManager = require('../src/ai/manager')

describe('CLI AI commands', () => {
  let cli
  let mockClipboard
  let mockAiManager
  let stdoutSpy
  let logSpy
  let errorSpy

  beforeEach(() => {
    mockClipboard = {
      hasContent: jest.fn().mockResolvedValue(true),
      getContentType: jest.fn().mockResolvedValue('text'),
      readText: jest.fn().mockResolvedValue('input text'),
      writeText: jest.fn().mockResolvedValue()
    }
    ClipboardManager.mockImplementation(() => mockClipboard)
    FileHandler.mockImplementation(() => ({}))

    mockAiManager = {
      applyRedaction: jest.fn().mockResolvedValue({ text: 'sanitized input', appliedRules: [], redactions: [] }),
      runPrompt: jest.fn().mockResolvedValue({ text: 'ai response', meta: { provider: 'ollama', model: 'llama3.2:1b' } })
    }
    AIManager.mockImplementation(() => mockAiManager)

    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    cli = new CLI()
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    logSpy.mockRestore()
    errorSpy.mockRestore()
    jest.clearAllMocks()
  })

  it('summarize reads clipboard, redacts, and copies output when requested', async () => {
    await cli.handleAiSummarize({ source: 'clipboard', copy: true, consent: true })

    expect(mockClipboard.hasContent).toHaveBeenCalled()
    expect(mockAiManager.applyRedaction).toHaveBeenCalledWith('input text', expect.any(Object))
    expect(mockAiManager.runPrompt).toHaveBeenCalledWith(expect.objectContaining({
      provider: undefined,
      model: undefined,
      consent: true
    }))
    expect(stdoutSpy).toHaveBeenCalledWith('ai response')
    expect(mockClipboard.writeText).toHaveBeenCalledWith('ai response')
    expect(logSpy).toHaveBeenCalledWith('Copied AI output to clipboard')
  })

  it('classify outputs JSON when requested', async () => {
    stdoutSpy.mockImplementation(() => true)
    mockAiManager.runPrompt.mockResolvedValue({ text: 'label-a', meta: { provider: 'ollama', model: 'llama3.2:1b' } })

    await cli.handleAiClassify({ source: 'clipboard', labels: 'label-a,label-b', json: true, consent: true })

    const output = stdoutSpy.mock.calls.map(args => args[0]).join('')
    const parsed = JSON.parse(output)
    expect(parsed.content).toBe('label-a')
    expect(parsed.meta.provider).toBe('ollama')
    expect(parsed.redaction).toBeDefined()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('transform handles file source with disabled redaction and writes output to file', async () => {
    const filePath = path.join(process.cwd(), 'example.txt')
    const readSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue('file contents with email test@example.com')
    const mkdirSpy = jest.spyOn(fs.promises, 'mkdir').mockResolvedValue()
    const writeSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue()

    mockAiManager.applyRedaction.mockResolvedValue({ text: 'file contents with email [REDACTED_EMAIL]', appliedRules: ['emails'], redactions: [{ rule: 'emails', matches: 1 }] })
    mockAiManager.runPrompt.mockResolvedValue({ text: 'transformed text', meta: { provider: 'ollama', model: 'llama3.2:1b' } })

    await cli.handleAiTransform({
      source: 'file',
      file: filePath,
      instruction: 'rewrite nicely',
      redact: false,
      showRedacted: true,
      out: path.join(process.cwd(), 'out/result.txt'),
      copy: true,
      json: true,
      consent: true
    })

    expect(readSpy).toHaveBeenCalledWith(path.resolve(filePath), 'utf8')
    const lastApplyArgs = mockAiManager.applyRedaction.mock.calls[mockAiManager.applyRedaction.mock.calls.length - 1]
    expect(lastApplyArgs[0]).toContain('email')
    expect(lastApplyArgs[1]).toEqual({ enabled: false, rules: undefined })
    expect(mockAiManager.runPrompt).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('rewrite nicely')
    }))
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('out/result.txt'), 'transformed text', 'utf8')
    expect(mockClipboard.writeText).toHaveBeenCalledWith('transformed text')
    expect(errorSpy).toHaveBeenCalledWith('Copied AI output to clipboard')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Wrote AI output to:'))

    readSpy.mockRestore()
    mkdirSpy.mockRestore()
    writeSpy.mockRestore()
  })

  it('readAiSource throws helpful errors for unsupported sources', async () => {
    const originalStdin = process.stdin
    const originalIsTTY = process.stdin && Object.prototype.hasOwnProperty.call(process.stdin, 'isTTY') ? process.stdin.isTTY : undefined
    if (process.stdin) {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
    }
    await expect(cli.readAiSource({ source: 'stdin' })).rejects.toThrow('No stdin content available')
    if (process.stdin) {
      if (originalIsTTY === undefined) {
        delete process.stdin.isTTY
      } else {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
      }
    }
    process.stdin = originalStdin

    await expect(cli.readAiSource({ source: 'file' })).rejects.toThrow('Provide --file <path> when using file source')
    await expect(cli.readAiSource({ source: 'unknown' })).rejects.toThrow("Unknown source 'unknown'")
  })

  it('prepareRedaction forwards custom rule strings', async () => {
    await cli.prepareRedaction('content', { redact: 'emails' })
    expect(mockAiManager.applyRedaction).toHaveBeenCalledWith('content', { enabled: true, rules: 'emails' })
  })
})
