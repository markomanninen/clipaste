jest.mock('../src/clipboard', () => jest.fn())
jest.mock('../src/fileHandler', () => jest.fn())
jest.mock('../src/ai/manager', () => jest.fn())

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
})
