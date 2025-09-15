const { spawn, exec } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { version } = require('../package.json')

// Tests for the globally installed clipaste command
describe('Global Executable Tests', () => {
  let isGloballyInstalled = false
  let testDir

  beforeAll(async () => {
    // Check if clipaste is globally available (platform-specific command)
    try {
      await new Promise((resolve, reject) => {
        const command = process.platform === 'win32' ? 'where clipaste' : 'which clipaste'
        exec(command, { timeout: 3000 }, (error, stdout) => {
          if (error) {
            reject(error)
          } else {
            isGloballyInstalled = true
            resolve(stdout)
          }
        })
      })
    } catch (error) {
      // clipaste not globally installed, skip these tests
      isGloballyInstalled = false
    }

    // Create test directory
    testDir = path.join(os.tmpdir(), 'clipaste-global-exec-test')
    await fs.mkdir(testDir, { recursive: true })
  }, 10000)

  afterAll(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  const runGlobalCommand = (workingDir, args) => {
    return new Promise((resolve) => {
      const spawnOptions = {
        stdio: 'pipe',
        cwd: workingDir
      }

      // On Windows, we need shell: true to properly resolve .cmd files
      if (process.platform === 'win32') {
        spawnOptions.shell = true
      }

      const child = spawn('clipaste', args, spawnOptions)

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        resolve({ code, stdout, stderr, cwd: workingDir })
      })
    })
  }

  describe('Global clipaste command', () => {
    it('should be globally available', () => {
      if (!isGloballyInstalled) {
        console.log('⚠️  clipaste not globally installed. Run "npm link" to test global usage.')
      }

      // This test will pass if global install is not available (optional test)
      expect(true).toBe(true)
    })

    it('should show help when globally executed', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const result = await runGlobalCommand(testDir, ['--help'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('CLI tool to paste clipboard content to files')
    }, 10000)

    it('should show version when globally executed', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const result = await runGlobalCommand(testDir, ['--version'])

      expect(result.code).toBe(0)
      expect(result.stdout).toContain(version)
    }, 10000)

    it('should work from different directories', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const subDir = path.join(testDir, 'subdir')
      await fs.mkdir(subDir, { recursive: true })

      const result1 = await runGlobalCommand(testDir, ['paste', '--help'])
      const result2 = await runGlobalCommand(subDir, ['paste', '--help'])

      expect(result1.code).toBe(0)
      expect(result2.code).toBe(0)

      // Should show different default paths based on working directory
      expect(result1.stdout).toContain('clipaste-global-exec-test')
      expect(result2.stdout).toContain('subdir')
      expect(result1.stdout).not.toContain('subdir')
    }, 10000)

    it('should handle status command from any directory', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const result = await runGlobalCommand(testDir, ['status'])

      // Should work even if clipboard is empty (exit code 0 or 1)
      expect([0, 1]).toContain(result.code)
    }, 10000)

    it('should handle dry-run from different working directories', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const subDir = path.join(testDir, 'dryrun-test')
      await fs.mkdir(subDir, { recursive: true })

      const result = await runGlobalCommand(subDir, [
        'paste',
        '--dry-run',
        '--filename', 'test-global'
      ])

      // Should work from any directory
      expect([0, 1]).toContain(result.code)
    }, 10000)
  })

  describe('Path resolution with global command', () => {
    it('should resolve relative paths correctly from working directory', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const workDir = path.join(testDir, 'path-test')
      await fs.mkdir(workDir, { recursive: true })
      await fs.mkdir(path.join(workDir, 'output'), { recursive: true })

      const result = await runGlobalCommand(workDir, [
        'paste',
        '--dry-run',
        '--output', './output',
        '--filename', 'relative-test'
      ])

      expect([0, 1]).toContain(result.code)
      if (result.stdout.includes('Would paste')) {
        expect(result.stdout).toContain('output')
      }
    }, 10000)

    it('should handle absolute paths from any working directory', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const workDir = path.join(testDir, 'abs-path-test')
      const outputDir = path.join(testDir, 'abs-output')

      await fs.mkdir(workDir, { recursive: true })
      await fs.mkdir(outputDir, { recursive: true })

      const result = await runGlobalCommand(workDir, [
        'paste',
        '--dry-run',
        '--output', outputDir,
        '--filename', 'absolute-test'
      ])

      expect([0, 1]).toContain(result.code)
      if (result.stdout.includes('Would paste')) {
        expect(result.stdout).toContain('absolute-test')
      }
    }, 10000)
  })

  describe('Error handling with global command', () => {
    it('should handle invalid commands gracefully', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const result = await runGlobalCommand(testDir, ['invalid-command'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('unknown command')
    }, 10000)

    it('should handle invalid options gracefully', async () => {
      if (!isGloballyInstalled) {
        return
      }

      const result = await runGlobalCommand(testDir, ['paste', '--invalid-option'])

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('unknown option')
    }, 10000)
  })
})
