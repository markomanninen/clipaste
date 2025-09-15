const path = require('path')
const os = require('os')
const fs = require('fs')
const LibraryStore = require('../src/libraryStore')
describe('LibraryStore coverage', () => {
  let originalEnv
  const tmpBase = path.join(os.tmpdir(), `clipaste-test-lib-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, CLIPASTE_CONFIG_DIR: tmpBase }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('lists snippets recursively and deletes template/snippet', async () => {
    const lib = new LibraryStore({})
    // Create nested snippets
    const sdir = path.join(tmpBase, 'snippets', 'a', 'b')
    fs.mkdirSync(sdir, { recursive: true })
    fs.writeFileSync(path.join(sdir, 'n1.txt'), 'one', 'utf8')
    fs.writeFileSync(path.join(tmpBase, 'snippets', 'root.txt'), 'root', 'utf8')
    const list = await lib.listSnippets()
    const names = list.map(x => x.name)
    expect(names).toEqual(expect.arrayContaining(['a/b/n1', 'root']))

    // Save/delete template
    await lib.saveTemplate('del/me', 'x')
    await lib.deleteTemplate('del/me')
    // Save/delete snippet
    await lib.addSnippet('del/sn', 'y')
    await lib.deleteSnippet('del/sn')
  })

  it('add/remove tags and search body on snippets', async () => {
    const lib = new LibraryStore({})
    // Create snippet with content
    const sp = path.join(tmpBase, 'snippets', 'searchme.txt')
    fs.mkdirSync(path.dirname(sp), { recursive: true })
    fs.writeFileSync(sp, 'Hello Body', 'utf8')
    await lib.addTags('snippet', 'searchme', ['x', 'y'])
    const afterRemove = await lib.removeTags('snippet', 'searchme', ['y'])
    expect(afterRemove).toEqual(['x'])

    const res = await lib.search({ target: 'snippets', query: 'body', body: true })
    expect(res.find(r => r.name === 'searchme')).toBeTruthy()
  })
})
