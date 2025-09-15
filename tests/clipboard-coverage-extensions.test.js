const ClipboardManager = require('../src/clipboard')
const fs = require('fs')

// Use injection to avoid dynamic ESM import issues
const mockClipboardy = {
  read: jest.fn(),
  write: jest.fn()
}
ClipboardManager.__setMockClipboardy(mockClipboardy)

// Mock child_process for Windows PowerShell tests
jest.mock('child_process', () => ({
  spawn: jest.fn()
}))

// Mock fs for Windows temp file operations
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
  readFileSync: jest.fn()
}))

const { spawn } = require('child_process')

describe('ClipboardManager Coverage Extensions', () => {
  let clipboardManager
  const originalPlatform = process.platform

  beforeEach(() => {
    clipboardManager = new ClipboardManager()
    jest.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  describe('Windows-specific functionality', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      clipboardManager = new ClipboardManager() // Recreate with Windows platform
    })

    describe('checkWindowsClipboard', () => {
      test('returns null on non-Windows platforms', async () => {
        Object.defineProperty(process, 'platform', { value: 'darwin' })
        clipboardManager = new ClipboardManager()

        const result = await clipboardManager.checkWindowsClipboard()
        expect(result).toBeNull()
      })

      test('handles successful PowerShell execution returning image', async () => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)
        fs.existsSync.mockReturnValue(true)
        fs.unlinkSync.mockReturnValue(undefined)

        const promise = clipboardManager.checkWindowsClipboard()

        // Simulate successful stdout data
        const stdoutCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1]
        stdoutCallback(Buffer.from('image'))

        // Simulate process close with success
        const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1]
        closeCallback(0)

        const result = await promise
        expect(result).toBe('image')
      })

      test('handles successful PowerShell execution returning text', async () => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)
        fs.existsSync.mockReturnValue(true)

        const promise = clipboardManager.checkWindowsClipboard()

        // Simulate successful stdout data
        const stdoutCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1]
        stdoutCallback(Buffer.from('text'))

        // Simulate process close with success
        const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1]
        closeCallback(0)

        const result = await promise
        expect(result).toBe('text')
      })

      test('handles PowerShell execution error', async () => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)

        const promise = clipboardManager.checkWindowsClipboard()

        // Simulate stderr error
        const stderrCallback = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data')[1]
        stderrCallback(Buffer.from('error'))

        // Simulate process close with error
        const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1]
        closeCallback(1)

        const result = await promise
        expect(result).toBeNull()
      })

      test('handles timeout', async () => {
        jest.useFakeTimers()

        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)
        fs.existsSync.mockReturnValue(true)

        const promise = clipboardManager.checkWindowsClipboard()

        // Fast-forward time to trigger timeout
        jest.advanceTimersByTime(5001)

        const result = await promise
        expect(result).toBeNull()
        expect(mockProcess.kill).toHaveBeenCalled()

        jest.useRealTimers()
      })

      test('handles temp script write error', async () => {
        fs.writeFileSync.mockImplementation(() => { throw new Error('write error') })

        const result = await clipboardManager.checkWindowsClipboard()
        expect(result).toBeNull()
      })
    })

    describe('readWindowsImage', () => {
      test('returns null on non-Windows platforms', async () => {
        Object.defineProperty(process, 'platform', { value: 'darwin' })
        clipboardManager = new ClipboardManager()

        const result = await clipboardManager.readWindowsImage()
        expect(result).toBeNull()
      })

      test('handles successful image read', async () => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)
        fs.existsSync.mockReturnValue(true)
        fs.readFileSync.mockReturnValue(Buffer.from('fake image data'))

        const promise = clipboardManager.readWindowsImage()

        // Simulate successful stdout data
        const stdoutCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1]
        stdoutCallback(Buffer.from('success'))

        // Simulate process close with success
        const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1]
        closeCallback(0)

        const result = await promise
        expect(result).toEqual({
          format: 'png',
          data: Buffer.from('fake image data')
        })
      })

      test('handles PowerShell error during image read', async () => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)

        const promise = clipboardManager.readWindowsImage()

        // Simulate stderr error
        const stderrCallback = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data')[1]
        stderrCallback(Buffer.from('error'))

        // Simulate process close with error
        const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1]
        closeCallback(1)

        const result = await promise
        expect(result).toBeNull()
      })

      test('handles no-image response', async () => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn()
        }

        spawn.mockReturnValue(mockProcess)
        fs.writeFileSync.mockReturnValue(undefined)

        const promise = clipboardManager.readWindowsImage()

        // Simulate no-image response
        const stdoutCallback = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1]
        stdoutCallback(Buffer.from('no-image'))

        // Simulate process close with success
        const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1]
        closeCallback(0)

        const result = await promise
        expect(result).toBeNull()
      })
    })
  })

  describe('parseBase64Image edge cases', () => {
    test('handles invalid base64 characters', () => {
      const result = clipboardManager.parseBase64Image('data:image/png;base64,invalid@characters!')
      expect(result).toBeNull()
    })

    test('handles empty base64 data', () => {
      const result = clipboardManager.parseBase64Image('data:image/png;base64,')
      expect(result).toBeNull()
    })

    test('handles base64 decode error', () => {
      // Mock Buffer.from to throw an error
      const originalFrom = Buffer.from
      Buffer.from = jest.fn().mockImplementation(() => { throw new Error('decode error') })

      const result = clipboardManager.parseBase64Image('data:image/png;base64,dGVzdA==')
      expect(result).toBeNull()

      // Restore original Buffer.from
      Buffer.from = originalFrom
    })
  })

  describe('getContentType with Windows fallback', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      clipboardManager = new ClipboardManager()
    })

    test('handles Windows Element not found error with image fallback', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Element not found'))

      // Mock checkWindowsClipboard to return image
      jest.spyOn(clipboardManager, 'checkWindowsClipboard').mockResolvedValue('image')

      const result = await clipboardManager.getContentType()
      expect(result).toBe('image')
    })

    test('handles Windows Finnish error message with text fallback', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Elementtiä ei löydy'))

      // Mock checkWindowsClipboard to return text
      jest.spyOn(clipboardManager, 'checkWindowsClipboard').mockResolvedValue('text')

      const result = await clipboardManager.getContentType()
      expect(result).toBe('text')
    })

    test('handles Windows error with empty fallback', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Element not found'))

      // Mock checkWindowsClipboard to return empty
      jest.spyOn(clipboardManager, 'checkWindowsClipboard').mockResolvedValue('empty')

      const result = await clipboardManager.getContentType()
      expect(result).toBe('empty')
    })

    test('re-throws non-Windows specific errors', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('Some other error'))

      await expect(clipboardManager.getContentType()).rejects.toThrow('Some other error')
    })
  })

  describe('getContentType binary detection', () => {
    test('detects binary content', async () => {
      // Create binary-like content with null bytes
      const binaryContent = 'text\x00with\x00null\x00bytes'
      mockClipboardy.read.mockResolvedValue(binaryContent)

      const result = await clipboardManager.getContentType()
      expect(result).toBe('binary')
    })

    test('detects empty content', async () => {
      mockClipboardy.read.mockResolvedValue('')

      const result = await clipboardManager.getContentType()
      expect(result).toBe('empty')
    })

    test('handles getContentType error', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('read error'))

      await expect(clipboardManager.getContentType()).rejects.toThrow('Failed to determine clipboard content type: read error')
    })
  })

  describe('readImage with Windows fallback', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      clipboardManager = new ClipboardManager()
    })

    test('uses Windows image read when base64 fails', async () => {
      mockClipboardy.read.mockResolvedValue('not base64 image')

      // Mock Windows methods
      jest.spyOn(clipboardManager, 'checkWindowsClipboard').mockResolvedValue('image')
      jest.spyOn(clipboardManager, 'readWindowsImage').mockResolvedValue({
        format: 'png',
        data: Buffer.from('windows image data')
      })

      const result = await clipboardManager.readImage()
      expect(result).toEqual({
        format: 'png',
        data: Buffer.from('windows image data')
      })
    })

    test('returns null when Windows methods fail', async () => {
      mockClipboardy.read.mockResolvedValue('not base64 image')

      // Mock Windows methods to fail
      jest.spyOn(clipboardManager, 'checkWindowsClipboard').mockResolvedValue('text')

      const result = await clipboardManager.readImage()
      expect(result).toBeNull()
    })

    test('handles readImage error', async () => {
      mockClipboardy.read.mockRejectedValue(new Error('read error'))

      await expect(clipboardManager.readImage()).rejects.toThrow('Failed to read image from clipboard: read error')
    })
  })
})
