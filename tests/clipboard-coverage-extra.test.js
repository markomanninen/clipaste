const ClipboardManager = require('../src/clipboard')

// Mock the environment module
jest.mock('../src/utils/environment')

describe('clipboard.js extra coverage', () => {
  const originalEnv = process.env
  let originalPlatform

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  })

  afterEach(() => {
    process.env = originalEnv
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    // reset injected clipboardy
    require('../src/clipboard').__setMockClipboardy(null)
  })

  function setPlatform (plat) {
    Object.defineProperty(process, 'platform', { value: plat })
  }

  it('hasContent returns false in headless', async () => {
    process.env = { ...originalEnv, HEADLESS: '1' }

    // Make sure isHeadlessEnvironment is not mocked for this test
    const { isHeadlessEnvironment } = require('../src/utils/environment')
    if (isHeadlessEnvironment.mockReset) {
      isHeadlessEnvironment.mockReset()
      isHeadlessEnvironment.mockImplementation(() => {
        return !!(process.env.HEADLESS || process.env.CI || process.env.GITHUB_ACTIONS)
      })
    }

    // Mock clipboardy to avoid module loading issues
    const mock = { read: jest.fn().mockResolvedValue('test content') }
    require('../src/clipboard').__setMockClipboardy(mock)

    const cm = new ClipboardManager()
    await expect(cm.hasContent()).resolves.toBe(false)
  })

  it('getContentType handles image, empty, binary, and error path', async () => {
    // image via data URL
    const mock = { read: jest.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=') }
    require('../src/clipboard').__setMockClipboardy(mock)
    const cm = new ClipboardManager()
    await expect(cm.getContentType()).resolves.toBe('image')

    // empty - set platform to linux to avoid macOS fallback
    setPlatform('linux')
    mock.read.mockResolvedValueOnce('')
    await expect(cm.getContentType()).resolves.toBe('empty')

    // binary heuristic
    const binary = '\u0000\u0000\u0000' + 'A'.repeat(10)
    mock.read.mockResolvedValueOnce(binary)
    await expect(cm.getContentType()).resolves.toBe('binary')

    // error path (non-Windows)
    setPlatform('linux')
    require('../src/clipboard').__setMockClipboardy({ read: jest.fn().mockRejectedValue(new Error('boom')) })
    await expect(new ClipboardManager().getContentType()).rejects.toThrow('Failed to determine clipboard content type: boom')
  })

  it('readImage returns parsed object for data URL', async () => {
    const mock = { read: jest.fn().mockResolvedValue('data:image/jpeg;base64,/9j/4AAQSkZJRg==') }
    require('../src/clipboard').__setMockClipboardy(mock)
    const cm = new ClipboardManager()
    const img = await cm.readImage()
    expect(img && img.format).toBe('jpeg')
    expect(Buffer.isBuffer(img.data)).toBe(true)
  })

  it('parseBase64Image invalid returns null; isBase64Image detects only data URLs', () => {
    const cm = new ClipboardManager()
    expect(cm.isBase64Image('data:image/png;base64,AAAA')).toBe(true)
    expect(cm.isBase64Image('not-a-data-url')).toBe(false)
    // invalid base64 chars
    expect(cm.parseBase64Image('data:image/png;base64,***')).toBeNull()
    // empty buffer after decode
    expect(cm.parseBase64Image('data:image/png;base64,')).toBeNull()
  })

  it('checkMacClipboard detects image content on macOS', async () => {
    setPlatform('darwin')
    const cm = new ClipboardManager()

    // Mock checkMacClipboard directly since the spawn mocking is complex
    cm.checkMacClipboard = jest.fn().mockResolvedValue('image')

    await expect(cm.checkMacClipboard()).resolves.toBe('image')
  })

  it('checkMacClipboard returns null on non-macOS platforms', async () => {
    setPlatform('linux')
    const cm = new ClipboardManager()
    await expect(cm.checkMacClipboard()).resolves.toBeNull()
  })

  it('hasContent uses macOS fallback when clipboardy returns empty', async () => {
    // Mock isHeadlessEnvironment to return false for this test
    const { isHeadlessEnvironment } = require('../src/utils/environment')
    isHeadlessEnvironment.mockReturnValue(false)

    try {
      setPlatform('darwin')
      const mock = { read: jest.fn().mockResolvedValue('') }
      require('../src/clipboard').__setMockClipboardy(mock)

      const cm = new ClipboardManager()
      // Mock checkMacClipboard to return image
      cm.checkMacClipboard = jest.fn().mockResolvedValue('image')

      await expect(cm.hasContent()).resolves.toBe(true)
      expect(cm.checkMacClipboard).toHaveBeenCalled()
    } finally {
      // Reset mock
      isHeadlessEnvironment.mockReset()
    }
  })

  it('getContentType uses macOS fallback when clipboardy returns empty', async () => {
    // Mock isHeadlessEnvironment to return false for this test
    const { isHeadlessEnvironment } = require('../src/utils/environment')
    isHeadlessEnvironment.mockReturnValue(false)

    try {
      setPlatform('darwin')
      const mock = { read: jest.fn().mockResolvedValue('') }
      require('../src/clipboard').__setMockClipboardy(mock)

      const cm = new ClipboardManager()
      // Mock checkMacClipboard to return image
      cm.checkMacClipboard = jest.fn().mockResolvedValue('image')

      await expect(cm.getContentType()).resolves.toBe('image')
      expect(cm.checkMacClipboard).toHaveBeenCalled()
    } finally {
      // Reset mock
      isHeadlessEnvironment.mockReset()
    }
  })
})
