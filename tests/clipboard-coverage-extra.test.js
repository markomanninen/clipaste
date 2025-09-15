const ClipboardManager = require('../src/clipboard')
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
    const cm = new ClipboardManager()
    await expect(cm.hasContent()).resolves.toBe(false)
  })

  it('getContentType handles image, empty, binary, and error path', async () => {
    // image via data URL
    const mock = { read: jest.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=') }
    require('../src/clipboard').__setMockClipboardy(mock)
    const cm = new ClipboardManager()
    await expect(cm.getContentType()).resolves.toBe('image')

    // empty
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
})
