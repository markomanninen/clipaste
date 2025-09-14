const ClipboardManager = require('../src/clipboard')

// Use injection to avoid dynamic ESM import issues
const mockClipboardy = {
  read: jest.fn(),
  write: jest.fn()
}
ClipboardManager.__setMockClipboardy(mockClipboardy)

describe('ClipboardManager', () => {
  let clipboardManager

  beforeEach(() => {
    clipboardManager = new ClipboardManager()
    jest.clearAllMocks()
  })

  describe('hasContent', () => {
    it('should return true when clipboard has content', async () => {
      mockClipboardy.read.mockResolvedValue('test content')

      const result = await clipboardManager.hasContent()

      expect(result).toBe(true)
      expect(mockClipboardy.read).toHaveBeenCalled()
    })

    it('should return false when clipboard is empty', async () => {
      mockClipboardy.read.mockResolvedValue('')

      const result = await clipboardManager.hasContent()

      expect(result).toBe(false)
    })

    it('should throw error when clipboard read fails', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Clipboard access denied'))

      await expect(clipboardManager.hasContent()).rejects.toThrow('Failed to read clipboard: Clipboard access denied')
    })
  })

  describe('readText', () => {
    it('should return text content from clipboard', async () => {
      const testContent = 'Hello, World!'
      mockClipboardy.read.mockResolvedValue(testContent)

      const result = await clipboardManager.readText()

      expect(result).toBe(testContent)
      expect(mockClipboardy.read).toHaveBeenCalled()
    })

    it('should throw error when reading text fails', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Read failed'))

      await expect(clipboardManager.readText()).rejects.toThrow('Failed to read text from clipboard: Read failed')
    })
  })

  describe('readImage', () => {
    it('should return null for non-image content', async () => {
      mockClipboardy.read.mockResolvedValue('plain text')

      const result = await clipboardManager.readImage()

      expect(result).toBeNull()
    })

    it('should parse base64 image data', async () => {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      const dataUrl = `data:image/png;base64,${base64Data}`
      mockClipboardy.read.mockResolvedValue(dataUrl)

      const result = await clipboardManager.readImage()

      expect(result).not.toBeNull()
      expect(result.format).toBe('png')
      expect(Buffer.isBuffer(result.data)).toBe(true)
    })

    it('should throw error when reading image fails', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Read failed'))

      await expect(clipboardManager.readImage()).rejects.toThrow('Failed to read image from clipboard: Read failed')
    })
  })

  describe('isBase64Image', () => {
    it('should return true for valid base64 image data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'

      const result = clipboardManager.isBase64Image(dataUrl)

      expect(result).toBe(true)
    })

    it('should return false for plain text', () => {
      const text = 'Hello, World!'

      const result = clipboardManager.isBase64Image(text)

      expect(result).toBe(false)
    })

    it('should return false for null or undefined', () => {
      expect(clipboardManager.isBase64Image(null)).toBe(false)
      expect(clipboardManager.isBase64Image(undefined)).toBe(false)
    })
  })

  describe('parseBase64Image', () => {
    it('should parse valid base64 image data', () => {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      const dataUrl = `data:image/png;base64,${base64Data}`

      const result = clipboardManager.parseBase64Image(dataUrl)

      expect(result.format).toBe('png')
      expect(Buffer.isBuffer(result.data)).toBe(true)
    })

    it('should return null for invalid data', () => {
      const result = clipboardManager.parseBase64Image('invalid data')

      expect(result).toBeNull()
    })
  })

  describe('getContentType', () => {
    it('should return "empty" for empty clipboard', async () => {
      mockClipboardy.read.mockResolvedValue('')

      const result = await clipboardManager.getContentType()

      expect(result).toBe('empty')
    })

    it('should return "image" for base64 image data', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
      mockClipboardy.read.mockResolvedValue(dataUrl)

      const result = await clipboardManager.getContentType()

      expect(result).toBe('image')
    })

    it('should return "text" for regular text', async () => {
      mockClipboardy.read.mockResolvedValue('Hello, World!')

      const result = await clipboardManager.getContentType()

      expect(result).toBe('text')
    })

    it('should return "binary" for binary data', async () => {
      const binaryData = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F'
      mockClipboardy.read.mockResolvedValue(binaryData)

      const result = await clipboardManager.getContentType()

      expect(result).toBe('binary')
    })
  })

  describe('isBinaryData', () => {
    it('should return true for data with many null bytes', () => {
      const binaryData = 'test\x00\x00\x00\x00data\x00\x00\x00'

      const result = clipboardManager.isBinaryData(binaryData)

      expect(result).toBe(true)
    })

    it('should return false for regular text', () => {
      const textData = 'This is regular text content'

      const result = clipboardManager.isBinaryData(textData)

      expect(result).toBe(false)
    })

    it('should return false for non-string input', () => {
      const result = clipboardManager.isBinaryData(123)

      expect(result).toBe(false)
    })
  })
})
