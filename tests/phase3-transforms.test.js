const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')
const FileHandler = require('../src/fileHandler')

jest.mock('../src/clipboard')
jest.mock('../src/fileHandler')

describe('Phase 3 - transforms and options', () => {
  let cli
  let mockClipboard
  let mockFile
  let originalConsole
  let mockConsole
  let originalProcess
  let mockProcess

  beforeEach(() => {
    originalConsole = global.console
    mockConsole = { log: jest.fn(), error: jest.fn() }
    global.console = mockConsole

    originalProcess = global.process
    mockProcess = { ...process, exit: jest.fn() }
    global.process = mockProcess

    mockClipboard = {
      hasContent: jest.fn(),
      readText: jest.fn(),
      readImage: jest.fn(),
      writeText: jest.fn(),
      getContentType: jest.fn()
    }
    ClipboardManager.mockImplementation(() => mockClipboard)

    mockFile = {
      saveText: jest.fn(),
      saveImage: jest.fn(),
      generateFilePath: jest.fn((out, name, ext) => `${out}/${name}${ext}`),
      getFileStats: jest.fn(),
      getFileExtensionFromFormat: jest.fn((fmt) => ({ png: '.png', jpeg: '.jpg', jpg: '.jpg', webp: '.webp' }[String(fmt).toLowerCase()] || '.png')),
      chooseTextExtension: jest.fn()
    }
    FileHandler.mockImplementation(() => mockFile)

    cli = new CLI()
  })

  afterEach(() => {
    global.console = originalConsole
    global.process = originalProcess
    jest.resetAllMocks()
  })

  test('get --json-format pretty prints valid JSON', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.readText.mockResolvedValue('{"a":1}')

    await cli.handleGet({ jsonFormat: true })
    expect(mockConsole.log).toHaveBeenCalledWith(`{
  "a": 1
}`)
  })

  test('get --json-format errors on invalid JSON', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.readText.mockResolvedValue('{oops}')

    await cli.handleGet({ jsonFormat: true })
    expect(mockConsole.error).toHaveBeenCalledWith('Invalid JSON input')
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  test('get --url-decode decodes content', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.readText.mockResolvedValue('hello%20world')
    await cli.handleGet({ urlDecode: true })
    expect(mockConsole.log).toHaveBeenCalledWith('hello world')
  })

  test('get --url-encode encodes content', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.readText.mockResolvedValue('hello world')
    await cli.handleGet({ urlEncode: true })
    expect(mockConsole.log).toHaveBeenCalledWith('hello%20world')
  })

  test('get --base64 encodes text', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.readText.mockResolvedValue('Hi!')
    await cli.handleGet({ base64: true })
    expect(mockConsole.log).toHaveBeenCalledWith(Buffer.from('Hi!', 'utf8').toString('base64'))
  })

  test('copy --decode-base64 decodes and writes', async () => {
    mockClipboard.writeText.mockResolvedValue(true)
    await cli.handleCopy(null, { decodeBase64: Buffer.from('abc', 'utf8').toString('base64') })
    expect(mockClipboard.writeText).toHaveBeenCalledWith('abc')
  })

  test('copy --encode-base64 encodes and writes', async () => {
    mockClipboard.writeText.mockResolvedValue(true)
    await cli.handleCopy('foo', { encodeBase64: true })
    expect(mockClipboard.writeText).toHaveBeenCalledWith(Buffer.from('foo', 'utf8').toString('base64'))
  })

  test('paste --resize passes resize to file handler', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.getContentType.mockResolvedValue('image')
    mockClipboard.readImage.mockResolvedValue({ format: 'png', data: Buffer.from('img') })
    mockFile.saveImage.mockResolvedValue('/out/pic.png')
    mockFile.getFileStats.mockResolvedValue({ size: 3 })

    await cli.handlePaste({ output: '/out', filename: 'pic', format: 'png', quality: '80', resize: '800x600' })
    expect(mockFile.saveImage).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ resize: '800x600' }))
  })

  test('paste --auto-extension for text chooses via helper', async () => {
    mockClipboard.hasContent.mockResolvedValue(true)
    mockClipboard.getContentType.mockResolvedValue('text')
    mockClipboard.readText.mockResolvedValue('{"k":1}')
    mockFile.chooseTextExtension.mockReturnValue('.json')
    mockFile.saveText.mockResolvedValue('/out/file.json')
    mockFile.getFileStats.mockResolvedValue({ size: 6 })

    await cli.handlePaste({ output: '/out', filename: 'file', autoExtension: true })
    expect(mockFile.saveText).toHaveBeenCalledWith('{"k":1}', expect.objectContaining({ extension: '.json' }))
  })
})
