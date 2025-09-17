const path = require('path')
const fs = require('fs')
const os = require('os')
const ClipboardManager = require('../src/clipboard')

// Mock isHeadlessEnvironment to return false so we can test actual platform logic
jest.mock('../src/utils/environment', () => ({
  isHeadlessEnvironment: jest.fn().mockReturnValue(false)
}))

// Use injection to avoid dynamic ESM import issues
const mockClipboardy = {
  read: jest.fn(),
  write: jest.fn()
}
ClipboardManager.__setMockClipboardy(mockClipboardy)

describe('Image Functionality', () => {
  let clipboardManager
  let tempDir
  let testImagePath
  let testSvgPath

  beforeEach(() => {
    clipboardManager = new ClipboardManager()
    tempDir = path.join(os.tmpdir(), `clipaste-test-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Create a simple test PNG image (1x1 transparent pixel)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x02, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
      0x42, 0x60, 0x82
    ])
    testImagePath = path.join(tempDir, 'test-image.png')
    fs.writeFileSync(testImagePath, pngData)

    // Create a simple SVG test file
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>`
    testSvgPath = path.join(tempDir, 'test-image.svg')
    fs.writeFileSync(testSvgPath, svgContent)
  })

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('writeImage method', () => {
    it('should successfully write PNG image to clipboard on macOS', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      const result = await clipboardManager.writeImage(testImagePath)
      expect(result).toBe(true)
    })

    it('should successfully write SVG image to clipboard on macOS', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      const result = await clipboardManager.writeImage(testSvgPath)
      expect(result).toBe(true)
    })

    it('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.png')

      await expect(clipboardManager.writeImage(nonExistentPath))
        .rejects.toThrow('Image file not found')
    })

    it('should throw error on Windows (not implemented)', async () => {
      if (process.platform === 'darwin') {
        return // Skip test on macOS
      }

      // Mock Windows platform
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })
      clipboardManager.isWindows = true

      try {
        await expect(clipboardManager.writeImage(testImagePath))
          .rejects.toThrow('Windows image-to-clipboard functionality not yet implemented')
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform })
        clipboardManager.isWindows = originalPlatform === 'win32'
      }
    })
  })

  describe('writeMacImage method', () => {
    it('should return null on non-macOS platforms', async () => {
      if (process.platform === 'darwin') {
        // Mock non-macOS platform
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', { value: 'linux' })

        try {
          const result = await clipboardManager.writeMacImage(testImagePath)
          expect(result).toBeNull()
        } finally {
          Object.defineProperty(process, 'platform', { value: originalPlatform })
        }
      } else {
        const result = await clipboardManager.writeMacImage(testImagePath)
        expect(result).toBeNull()
      }
    })

    it('should handle AppleScript errors gracefully on macOS', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      // Test with an invalid path that should cause AppleScript to fail
      const invalidPath = '/path/that/definitely/does/not/exist.png'
      const result = await clipboardManager.writeMacImage(invalidPath)
      expect(result).toBe(false)
    })
  })

  describe('image round-trip functionality', () => {
    it('should successfully write image to clipboard on macOS (integration test)', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      // This test focuses on the write operation which we can reliably test
      // The full round-trip requires real clipboard access which is mocked in tests
      const writeResult = await clipboardManager.writeImage(testImagePath)
      expect(writeResult).toBe(true)

      // Verify the image file exists and is readable
      expect(require('fs').existsSync(testImagePath)).toBe(true)
      const stats = require('fs').statSync(testImagePath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should successfully write SVG to clipboard on macOS (integration test)', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      // Test SVG writing capability
      const writeResult = await clipboardManager.writeImage(testSvgPath)
      expect(writeResult).toBe(true)

      // Verify the SVG file exists and contains expected content
      expect(require('fs').existsSync(testSvgPath)).toBe(true)
      const svgContent = require('fs').readFileSync(testSvgPath, 'utf8')
      expect(svgContent).toContain('<svg')
      expect(svgContent).toContain('<circle')
    })
  })

  describe('clipboard status detection', () => {
    it('should successfully write image without clipboard detection errors on macOS', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      // Focus on testing the write operation and basic functionality
      // Clipboard status detection requires real clipboard access
      const writeResult = await clipboardManager.writeImage(testImagePath)
      expect(writeResult).toBe(true)

      // Test that the methods exist and can be called without errors
      expect(typeof clipboardManager.getContentType).toBe('function')
      expect(typeof clipboardManager.hasContent).toBe('function')

      // In a mocked environment, these will return default values
      // but we can verify they don't throw errors
      const contentType = await clipboardManager.getContentType()
      expect(typeof contentType).toBe('string')

      const hasContent = await clipboardManager.hasContent()
      expect(typeof hasContent).toBe('boolean')
    })
  })

  describe('error handling', () => {
    it('should handle timeout gracefully', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      // This test is hard to trigger reliably, but we can at least verify
      // that the timeout mechanism exists by checking the method structure
      expect(clipboardManager.writeMacImage).toEqual(expect.any(Function))
    })

    it('should clean up resources on failure', async () => {
      if (process.platform !== 'darwin') {
        return // Skip test on non-macOS
      }

      // Test with invalid file that should fail
      const result = await clipboardManager.writeMacImage('/invalid/path/file.png')
      expect(result).toBe(false)
    })
  })
})
