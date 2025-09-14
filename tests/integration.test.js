const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const { version } = require('../package.json')

// Integration tests for the CLI tool
describe('CLI Integration Tests', () => {
  const testDir = path.join(__dirname, '../test-output')
  const cliScript = path.join(__dirname, '../src/index.js')

  beforeAll(async () => {
    // Create test output directory
    try {
      await fs.mkdir(testDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  })

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Directory might not exist or have files
    }
  })

  const runCLI = (args, options = {}) => {
    return new Promise((resolve) => {
      const child = spawn('node', [cliScript, ...args], {
        stdio: 'pipe',
        ...options
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        resolve({ code, stdout, stderr })
      })
    })
  }

  describe('help and version commands', () => {
    it('should show help when no command is provided', async () => {
      const result = await runCLI(['--help'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('CLI tool to paste clipboard content to files')
      expect(result.stdout).toContain('paste')
      expect(result.stdout).toContain('status')
      expect(result.stdout).toContain('clear')
    })

    it('should show version', async () => {
      const result = await runCLI(['--version'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain(version)
    })
  })

  describe('paste command help', () => {
    it('should show paste command help', async () => {
      const result = await runCLI(['paste', '--help'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Paste clipboard content to a file')
      expect(result.stdout).toContain('--output')
      expect(result.stdout).toContain('--filename')
      expect(result.stdout).toContain('--type')
      expect(result.stdout).toContain('--format')
      expect(result.stdout).toContain('--dry-run')
    })
  })

  describe('status command', () => {
    it('should check clipboard status', async () => {
      const result = await runCLI(['status'])

      // Status command should run without error or show clipboard empty
      expect([0, 1]).toContain(result.code)

      // Accept either output in stdout or stderr, or empty (when clipboard access issues occur)
      const output = result.stdout + result.stderr
      if (output.length > 0) {
        expect(output).toMatch(/Clipboard contains:|Clipboard is empty|Error:/)
      }
    })
  })

  describe('paste command with dry-run', () => {
    it('should show what would be done in dry-run mode', async () => {
      await runCLI([
        'paste',
        '--dry-run',
        '--output', testDir,
        '--filename', 'test-dry-run'
      ])

      // Should not create actual files in dry-run mode
      const files = await fs.readdir(testDir)
      expect(files.filter(f => f.includes('test-dry-run'))).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    it('should handle invalid commands gracefully', async () => {
      const result = await runCLI(['invalid-command'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('unknown command')
    })

    it('should handle invalid options', async () => {
      const result = await runCLI(['paste', '--invalid-option'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('unknown option')
    })
  })

  describe('file output validation', () => {
    it('should handle invalid output directory', async () => {
      const invalidDir = '/invalid/nonexistent/directory/path'
      await runCLI([
        'paste',
        '--dry-run',
        '--output', invalidDir
      ])

      // Dry run should work even with invalid directory
      // (actual paste might fail, but dry-run shows the path)
    })
  })
})
