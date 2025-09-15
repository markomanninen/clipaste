const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')
const FileHandler = require('../src/fileHandler')

jest.mock('../src/clipboard')
jest.mock('../src/fileHandler')

describe('CLI Coverage Extensions', () => {
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
    mockProcess = {
      ...process,
      exit: jest.fn(),
      stdout: { write: jest.fn() }
    }
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

  describe('handleCopy error scenarios', () => {
    test('handles base64 decode error', async () => {
      await cli.handleCopy(null, { decodeBase64: 'invalid@base64' })
      expect(mockConsole.error).toHaveBeenCalledWith('Invalid base64 input')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })

    test('handles clipboard write error', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('clipboard error'))

      await cli.handleCopy('test', {})
      expect(mockConsole.error).toHaveBeenCalledWith('Error copying to clipboard:', 'clipboard error')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('handleGet error scenarios', () => {
    test('handles no clipboard content', async () => {
      mockClipboard.hasContent.mockResolvedValue(false)

      await cli.handleGet({})
      expect(mockProcess.exit).toHaveBeenCalledWith(0)
    })

    test('handles imageInfo option with image', async () => {
      mockClipboard.hasContent.mockResolvedValue(true)
      mockClipboard.readImage.mockResolvedValue({
        format: 'png',
        data: Buffer.from('fake image data')
      })

      await cli.handleGet({ imageInfo: true })
      expect(mockConsole.log).toHaveBeenCalled()
    })

    test('handles imageInfo option with raw output', async () => {
      mockClipboard.hasContent.mockResolvedValue(true)
      mockClipboard.readImage.mockResolvedValue({
        format: 'png',
        data: Buffer.from('fake image data')
      })

      await cli.handleGet({ imageInfo: true, raw: true })
      expect(mockProcess.stdout.write).toHaveBeenCalled()
    })

    test('handles URL decode error', async () => {
      mockClipboard.hasContent.mockResolvedValue(true)
      mockClipboard.readText.mockResolvedValue('%ZZ') // Invalid URL encoding

      await cli.handleGet({ urlDecode: true })
      expect(mockConsole.error).toHaveBeenCalledWith('Invalid URL-encoded input')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })

    test('handles clipboard read error', async () => {
      mockClipboard.hasContent.mockResolvedValue(true)
      mockClipboard.readText.mockRejectedValue(new Error('read error'))

      await cli.handleGet({})
      expect(mockConsole.error).toHaveBeenCalledWith('Error reading from clipboard:', 'read error')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })
  })
})
