const { isHeadlessEnvironment } = require('../src/utils/environment')
describe('environment util coverage', () => {
  const originalEnv = process.env
  let originalArgv
  let originalPlatform

  beforeEach(() => {
    originalArgv = process.argv
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  })

  afterEach(() => {
    process.env = originalEnv
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    process.argv = originalArgv
  })

  function setPlatform (plat) {
    Object.defineProperty(process, 'platform', { value: plat })
  }

  it('returns true on win32 when HEADLESS is set', () => {
    setPlatform('win32')
    process.env = { ...originalEnv, HEADLESS: '1' }
    expect(isHeadlessEnvironment()).toBe(true)
  })

  it('returns true on linux when DISPLAY is missing', () => {
    setPlatform('linux')
    const { DISPLAY, ...rest } = originalEnv
    process.env = { ...rest }
    expect(isHeadlessEnvironment()).toBe(true)
  })
})
