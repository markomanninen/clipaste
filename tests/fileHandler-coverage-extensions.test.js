const FileHandler = require('../src/fileHandler')
const fs = require('fs').promises

// Mock fs and sharp
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn()
  }
}))

jest.mock('sharp', () => {
  const mockSharpInstance = {
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image data'))
  }

  const mockSharp = jest.fn(() => mockSharpInstance)
  mockSharp.mockSharpInstance = mockSharpInstance // Expose for tests
  return mockSharp
})

const sharp = require('sharp')

describe('FileHandler Coverage Extensions', () => {
  let fileHandler

  beforeEach(() => {
    fileHandler = new FileHandler()
    jest.clearAllMocks()
  })

  describe('chooseTextExtension', () => {
    test('returns extension from extensionForTextContent', () => {
      // Test JSON content
      const result = fileHandler.chooseTextExtension('{"key": "value"}')
      expect(result).toBe('.json')
    })

    test('returns extension for markdown content', () => {
      const result = fileHandler.chooseTextExtension('# Heading')
      expect(result).toBe('.md')
    })

    test('returns extension for JavaScript content', () => {
      const result = fileHandler.chooseTextExtension('function test() {}')
      expect(result).toBe('.js')
    })

    test('returns default extension for plain text', () => {
      const result = fileHandler.chooseTextExtension('plain text')
      expect(result).toBe('.txt')
    })

    test('falls back to default extension when extensionForTextContent returns null', () => {
      const result = fileHandler.chooseTextExtension('')
      expect(result).toBe('.txt')
    })
  })

  describe('saveImage with resize functionality', () => {
    test('applies string resize specification', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'png',
        resize: '800x600'
      })

      expect(sharp.mockSharpInstance.resize).toHaveBeenCalledWith({
        width: 800,
        height: 600,
        fit: 'inside',
        withoutEnlargement: true
      })
    })

    test('applies object resize specification with width only', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'png',
        resize: { width: 800 }
      })

      expect(sharp.mockSharpInstance.resize).toHaveBeenCalledWith({
        width: 800,
        height: undefined,
        fit: 'inside',
        withoutEnlargement: true
      })
    })

    test('applies object resize specification with height only', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'png',
        resize: { height: 600 }
      })

      expect(sharp.mockSharpInstance.resize).toHaveBeenCalledWith({
        width: undefined,
        height: 600,
        fit: 'inside',
        withoutEnlargement: true
      })
    })

    test('ignores invalid resize object with no valid dimensions', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'png',
        resize: { invalid: 'value' }
      })

      expect(sharp.mockSharpInstance.resize).not.toHaveBeenCalled()
    })

    test('ignores resize object with zero or negative dimensions', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'png',
        resize: { width: 0, height: -100 }
      })

      expect(sharp.mockSharpInstance.resize).not.toHaveBeenCalled()
    })

    test('processes webp format correctly', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'webp',
        quality: 80
      })

      expect(sharp.mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 80 })
    })

    test('defaults to png format for unknown formats', async () => {
      fs.access.mockResolvedValue() // Directory exists
      fs.writeFile.mockResolvedValue()

      const imageData = Buffer.from('image data')
      await fileHandler.saveImage(imageData, {
        filename: 'test',
        outputPath: '/tmp',
        format: 'unknown',
        quality: 80
      })

      expect(sharp.mockSharpInstance.png).toHaveBeenCalled()
    })
  })
})
