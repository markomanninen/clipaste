const CLI = require('../src/cli')
const ClipboardManager = require('../src/clipboard')
const FileHandler = require('../src/fileHandler')

// Mock dependencies
jest.mock('../src/clipboard')
jest.mock('../src/fileHandler')
jest.mock('clipboardy', () => ({
  default: {
    write: jest.fn()
  },
  write: jest.fn()
}))

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  error: jest.fn()
}

const mockProcess = {
  exit: jest.fn(),
  cwd: jest.fn(() => '/current/dir')
}

describe('CLI', () => {
  let cli
  let mockClipboardManager
  let mockFileHandler

  beforeEach(() => {
    // Reset mocks
    ClipboardManager.mockClear()
    FileHandler.mockClear()
    jest.clearAllMocks()

    // Setup mocks
    mockClipboardManager = {
      hasContent: jest.fn(),
      getContentType: jest.fn(),
      readText: jest.fn(),
      readImage: jest.fn(),
      writeText: jest.fn(),
      clear: jest.fn()
    }
    ClipboardManager.mockImplementation(() => mockClipboardManager)

    mockFileHandler = {
      saveText: jest.fn(),
      saveImage: jest.fn(),
      generateFilePath: jest.fn(),
      getFileStats: jest.fn()
    }
    FileHandler.mockImplementation(() => mockFileHandler)

    // Mock console and process
    global.console = mockConsole
    global.process = { ...process, ...mockProcess }

    cli = new CLI()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handlePaste', () => {
    it('should handle text paste successfully', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('text')
      mockClipboardManager.readText.mockResolvedValue('Hello, World!')
      mockFileHandler.saveText.mockResolvedValue('/output/test.txt')
      mockFileHandler.getFileStats.mockResolvedValue({ size: 13 })

      const options = { output: '/output', filename: 'test' }

      await cli.handlePaste(options)

      expect(mockClipboardManager.hasContent).toHaveBeenCalled()
      expect(mockClipboardManager.readText).toHaveBeenCalled()
      expect(mockFileHandler.saveText).toHaveBeenCalledWith('Hello, World!', {
        outputPath: options.output,
        filename: options.filename,
        extension: options.ext
      })
      expect(mockConsole.log).toHaveBeenCalledWith('Saved text content to: /output/test.txt')
    })

    it('should handle image paste successfully', async () => {
      const imageData = { format: 'png', data: Buffer.from('image data') }
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('image')
      mockClipboardManager.readImage.mockResolvedValue(imageData)
      mockFileHandler.saveImage.mockResolvedValue('/output/test.png')
      mockFileHandler.getFileStats.mockResolvedValue({ size: 1024 })

      const options = { output: '/output', filename: 'test', format: 'png', quality: '90' }

      await cli.handlePaste(options)

      expect(mockClipboardManager.readImage).toHaveBeenCalled()
      expect(mockFileHandler.saveImage).toHaveBeenCalledWith(imageData.data, {
        outputPath: '/output',
        filename: 'test',
        extension: undefined,
        format: 'png',
        quality: 90
      })
      expect(mockConsole.log).toHaveBeenCalledWith('Saved image content to: /output/test.png')
    })

    it('should handle empty clipboard', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(false)

      const options = {}

      await cli.handlePaste(options)

      expect(mockConsole.log).toHaveBeenCalledWith('Clipboard is empty')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })

    it('should handle dry run mode', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('text')
      mockFileHandler.generateFilePath.mockReturnValue('/output/test.txt')

      const options = { dryRun: true, output: '/output', filename: 'test' }

      await cli.handlePaste(options)

      expect(mockConsole.log).toHaveBeenCalledWith(
        'Would paste text content to:',
        '/output/test.txt'
      )
      expect(mockFileHandler.saveText).not.toHaveBeenCalled()
    })

    it('should handle missing image data', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('image')
      mockClipboardManager.readImage.mockResolvedValue(null)

      const options = {}

      await cli.handlePaste(options)

      expect(mockConsole.log).toHaveBeenCalledWith('No image data found in clipboard')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })

    it('should handle paste errors', async () => {
      mockClipboardManager.hasContent.mockRejectedValue(new Error('Clipboard error'))

      const options = {}

      await cli.handlePaste(options)

      expect(mockConsole.error).toHaveBeenCalledWith('Error:', 'Clipboard error')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('handleStatus', () => {
    it('should show empty clipboard status', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(false)

      await cli.handleStatus()

      expect(mockConsole.log).toHaveBeenCalledWith('Clipboard is empty')
    })

    it('should show text content status', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('text')
      mockClipboardManager.readText.mockResolvedValue('Hello, World!')

      await cli.handleStatus()

      expect(mockConsole.log).toHaveBeenCalledWith('Clipboard contains: text content')
      expect(mockConsole.log).toHaveBeenCalledWith('Preview: Hello, World!')
      expect(mockConsole.log).toHaveBeenCalledWith('Length: 13 characters')
    })

    it('should show truncated text preview for long content', async () => {
      const longText = 'a'.repeat(150)
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('text')
      mockClipboardManager.readText.mockResolvedValue(longText)

      await cli.handleStatus()

      expect(mockConsole.log).toHaveBeenCalledWith('Preview: ' + 'a'.repeat(100) + '...')
    })

    it('should show image content status', async () => {
      const imageData = { format: 'png', data: Buffer.from('image data') }
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.getContentType.mockResolvedValue('image')
      mockClipboardManager.readImage.mockResolvedValue(imageData)

      await cli.handleStatus()

      expect(mockConsole.log).toHaveBeenCalledWith('Clipboard contains: image content')
      expect(mockConsole.log).toHaveBeenCalledWith('Image format: png')
      expect(mockConsole.log).toHaveBeenCalledWith('Image size: 10 Bytes')
    })

    it('should handle status check errors', async () => {
      mockClipboardManager.hasContent.mockRejectedValue(new Error('Status error'))

      await cli.handleStatus()

      expect(mockConsole.error).toHaveBeenCalledWith('Error:', 'Status error')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('handleClear', () => {
    it('should clear clipboard successfully when it has content', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.clear.mockResolvedValue(true)

      await cli.handleClear()

      expect(mockClipboardManager.hasContent).toHaveBeenCalled()
      expect(mockClipboardManager.clear).toHaveBeenCalled()
      expect(mockConsole.log).toHaveBeenCalledWith('Clipboard cleared')
    })

    it('should handle already empty clipboard', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(false)

      await cli.handleClear()

      expect(mockClipboardManager.hasContent).toHaveBeenCalled()
      expect(mockConsole.log).toHaveBeenCalledWith('Clipboard is already empty')
    })

    it('should handle clear errors', async () => {
      mockClipboardManager.hasContent.mockResolvedValue(true)
      mockClipboardManager.clear.mockRejectedValue(new Error('Clear failed'))

      await cli.handleClear()

      expect(mockConsole.error).toHaveBeenCalledWith('Error clearing clipboard:', 'Clear failed')
      expect(mockProcess.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(cli.formatFileSize(0)).toBe('0 Bytes')
      expect(cli.formatFileSize(512)).toBe('512 Bytes')
      expect(cli.formatFileSize(1024)).toBe('1 KB')
      expect(cli.formatFileSize(1536)).toBe('1.5 KB')
      expect(cli.formatFileSize(1048576)).toBe('1 MB')
      expect(cli.formatFileSize(1073741824)).toBe('1 GB')
    })
  })

  describe('run', () => {
    it('should parse command line arguments', async () => {
      const argv = ['node', 'cli.js', 'status']
      const parseSpy = jest.spyOn(cli.program, 'parseAsync').mockResolvedValue()

      await cli.run(argv)

      expect(parseSpy).toHaveBeenCalledWith(argv)
    })

    it('should use process.argv by default', async () => {
      const parseSpy = jest.spyOn(cli.program, 'parseAsync').mockResolvedValue()

      await cli.run()

      expect(parseSpy).toHaveBeenCalledWith(process.argv)
    })
  })
})
