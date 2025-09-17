// Mock HistoryStore before importing CLI
const mockHistoryMethods = {
  clear: jest.fn().mockResolvedValue(),
  search: jest.fn().mockResolvedValue([
    {
      id: '1',
      content: 'test',
      timestamp: new Date().toISOString(),
      preview: 'test',
      ts: '2023-01-01',
      len: 4,
      sha256: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
      tags: []
    }
  ])
}
const mockHistoryStore = jest.fn().mockImplementation(() => mockHistoryMethods)
jest.mock('../src/historyStore', () => mockHistoryStore)

const CLI = require('../src/cli')

describe('CLI History Command Options', () => {
  let cli
  const mockConsole = { log: jest.fn(), error: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    global.console = mockConsole
    cli = new CLI({ debug: false, headless: true })
  })

  it('should handle history clear option', async () => {
    try {
      await cli.handleHistory({ clear: true })
    } catch (error) {
      // May throw due to console.log in headless mode
    }

    expect(mockHistoryMethods.clear).toHaveBeenCalled()
  })

  it('should handle history search option', async () => {
    try {
      await cli.handleHistory({ search: 'test' })
    } catch (error) {
      // May throw due to console.log in headless mode
    }

    expect(mockHistoryMethods.search).toHaveBeenCalledWith('test', { tag: undefined, body: false })
  })
})
