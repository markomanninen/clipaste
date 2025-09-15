const path = require('path')
const os = require('os')
const LibraryStore = require('../src/libraryStore')
describe('LibraryStore getConfigDir platform branches', () => {
  let originalPlatform
  let homedirSpy
  let originalEnv

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
    originalEnv = process.env
    delete process.env.CLIPASTE_CONFIG_DIR
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue('/tmp/home')
  })

  afterEach(() => {
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    homedirSpy.mockRestore()
    process.env = originalEnv
  })

  function setPlatform (plat) {
    Object.defineProperty(process, 'platform', { value: plat })
  }

  it('darwin path includes Library/Application Support/clipaste', () => {
    setPlatform('darwin')
    const lib = new LibraryStore({})
    expect(lib.templatesDir).toContain(path.join('Library', 'Application Support', 'clipaste'))
  })

  it('win32 path uses APPDATA clipaste', () => {
    setPlatform('win32')
    process.env.APPDATA = '/tmp/appdata'
    const lib = new LibraryStore({})
    expect(lib.templatesDir).toContain(path.join('clipaste'))
  })

  it('linux path uses .config/clipaste', () => {
    setPlatform('linux')
    delete process.env.XDG_CONFIG_HOME
    const lib = new LibraryStore({})
    expect(lib.templatesDir).toContain(path.join('.config', 'clipaste'))
  })
})
