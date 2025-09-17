const fs = require('fs')
const path = require('path')
const os = require('os')

const defaultTarget = path.join(os.tmpdir(), 'clipaste-test-clipboard.txt')

const resolveTarget = () => process.env.CLIPASTE_TEST_CLIPBOARD_FILE || defaultTarget

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const mockClipboardy = {
  async read () {
    const target = resolveTarget()
    try {
      return await fs.promises.readFile(target, 'utf8')
    } catch (error) {
      return ''
    }
  },
  async write (content) {
    const target = resolveTarget()
    ensureDir(target)
    await fs.promises.writeFile(target, content != null ? String(content) : '', 'utf8')
  }
}

const ClipboardManager = require('../../src/clipboard')
ClipboardManager.__setMockClipboardy(mockClipboardy)
