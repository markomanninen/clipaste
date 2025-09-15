const fs = require('fs').promises
const path = require('path')
const os = require('os')
const HistoryStore = require('../src/historyStore')

async function makeTmpDir () {
  const prefix = path.join(os.tmpdir(), 'clipaste-hist-')
  const dir = await fs.mkdtemp(prefix)
  return dir
}

describe('HistoryStore', () => {
  test('adds, lists, and prunes by maxItems', async () => {
    const dir = await makeTmpDir()
    const store = new HistoryStore({ dir, maxItems: 2, persist: true })

    await store.addEntry('a')
    await store.addEntry('b')
    await store.addEntry('c')

    const items = await store.list()
    expect(items).toHaveLength(2)
    // Should retain the last two: b and c (in insertion order)
    const ids = items.map(i => i.len)
    // lengths correspond to content length: 'b' => 1, 'c' => 1
    expect(ids).toEqual([1, 1])
  })

  test('skips oversize items', async () => {
    const dir = await makeTmpDir()
    const store = new HistoryStore({ dir, maxItemSize: 10, persist: true })

    const res = await store.addEntry('12345678901') // 11 bytes
    expect(res).toBeNull()
    const items = await store.list()
    expect(items).toHaveLength(0)
  })

  test('restore writes to clipboard', async () => {
    const dir = await makeTmpDir()
    const store = new HistoryStore({ dir, persist: true })

    const entry = await store.addEntry('foo')
    const mockClipboard = { writeText: jest.fn().mockResolvedValue(true) }

    await store.restore(entry.id, mockClipboard)
    expect(mockClipboard.writeText).toHaveBeenCalledWith('foo')
  })

  test('export and clear', async () => {
    const dir = await makeTmpDir()
    const store = new HistoryStore({ dir, persist: true })
    await store.addEntry('x')

    const file = path.join(dir, 'export.json')
    await store.exportTo(file)
    const json = await fs.readFile(file, 'utf8')
    expect(json).toContain('"content"')

    await store.clear()
    const items = await store.list()
    expect(items).toHaveLength(0)
  })

  test('no-persist keeps data in-memory only', async () => {
    const dir = await makeTmpDir()
    const file = path.join(dir, 'history.json')
    const store = new HistoryStore({ dir, file, persist: false })
    await store.addEntry('temp')
    const items = await store.list()
    expect(items).toHaveLength(1)
    // No file written
    await expect(fs.access(file)).rejects.toBeTruthy()
  })
})
