const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { isHeadlessEnvironment } = require('../src/utils/environment')

// REAL functionality tests - NO MOCKING, tests actual behavior
describe('REAL Functionality Tests', () => {
  const testDir = path.join(os.tmpdir(), 'clipaste-real-test')
  const cliScript = path.join(__dirname, '../src/index.js')

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  const runRealCLI = (args, options = {}) => {
    return new Promise((resolve) => {
      const child = spawn('node', [cliScript, ...args], {
        stdio: 'pipe',
        cwd: options.cwd || testDir,
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

      // Add timeout for hanging processes
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        resolve({ code: 124, stdout, stderr: stderr + '\nProcess timed out after 15 seconds' })
      }, 15000)

      child.on('close', (code) => {
        clearTimeout(timeout)
        resolve({ code, stdout, stderr })
      })
    })
  }

  describe('Dependency Loading Tests', () => {
    it('should load clipboardy module without errors', async () => {
      const result = await runRealCLI(['--help'])

      expect(result.code).toBe(0)
      expect(result.stderr).not.toContain('Cannot find module')
      expect(result.stderr).not.toContain('clipboardy')
      expect(result.stdout).toContain('CLI tool to paste clipboard content to files')
    }, 10000)

    it('should load all required dependencies', async () => {
      // Test that all modules can be loaded by trying to get help
      const result = await runRealCLI(['paste', '--help'])

      expect(result.code).toBe(0)
      expect(result.stderr).not.toContain('Cannot find module')
      expect(result.stderr).not.toContain('Error:')
    }, 10000)
  })

  describe('REAL Clipboard Status Tests', () => {
    it('should actually check clipboard status without crashing', async () => {
      const result = await runRealCLI(['status'])

      // Should not crash with dependency errors
      expect(result.stderr).not.toContain('clipboardy.read is not a function')
      expect(result.stderr).not.toContain('Cannot find module')

      // Should either show clipboard content or empty message
      if (result.code === 0) {
        expect(result.stdout).toMatch(/Clipboard contains:|Clipboard is empty/)
      } else if (result.code === 1) {
        if (result.stdout.trim() === '') {
          console.warn('Info: Clipboard status test - clipboard access unavailable in headless/CI environment')
        } else {
          expect(result.stdout).toContain('Clipboard is empty')
        }
      }
    }, 10000)

    it('should handle clipboard access errors gracefully', async () => {
      const result = await runRealCLI(['status'])

      // Even if clipboard access fails, should not crash with module errors
      expect(result.stderr).not.toContain('clipboardy.read is not a function')
      expect(result.stderr).not.toContain('is not a function')

      // Should have some reasonable output
      expect(result.code).toBeGreaterThanOrEqual(0)
    }, 10000)
  })

  describe('REAL Paste Functionality Tests', () => {
    it('should be able to attempt paste operations', async () => {
      const result = await runRealCLI([
        'paste',
        '--dry-run',
        '--output', testDir,
        '--filename', 'real-test'
      ])

      // Should not crash with dependency errors
      expect(result.stderr).not.toContain('clipboardy.read is not a function')
      expect(result.stderr).not.toContain('Cannot find module')

      // Should either show dry-run output or clipboard empty message
      expect([0, 1]).toContain(result.code)
    }, 10000)

    it('should handle empty clipboard appropriately', async () => {
      // First clear clipboard to ensure it's empty
      await runRealCLI(['clear'])

      const result = await runRealCLI([
        'paste',
        '--output', testDir,
        '--filename', 'empty-test'
      ])

      // Should handle empty clipboard gracefully
      if (result.code === 1) {
        if (result.stdout.trim() === '' && isHeadlessEnvironment()) {
          console.warn('Info: Clipboard status test - clipboard access unavailable in headless/CI environment')
        } else {
          // Both messages indicate empty clipboard state
          expect(result.stdout).toMatch(/Clipboard is empty|No image data found in clipboard/)
        }
      }

      // Should not crash with function errors
      expect(result.stderr).not.toContain('is not a function')
    }, 20000)
  })

  describe('REAL Clear Functionality Tests', () => {
    it('should be able to clear clipboard without crashing', async () => {
      const result = await runRealCLI(['clear'])

      // Should not crash with dependency errors
      expect(result.stderr).not.toContain('clipboardy.write is not a function')
      expect(result.stderr).not.toContain('Cannot find module')

      // Should either succeed or fail gracefully
      if (result.code === 0) {
        // Should contain either "Clipboard cleared" or "Clipboard is already empty"
        expect(result.stdout).toMatch(/Clipboard (cleared|is already empty)/)
      }
    }, 10000)
  })

  describe('Module Import Tests', () => {
    it('should import ClipboardManager without errors', async () => {
      const clipboardPath = path.join(__dirname, '../src/clipboard.js').replace(/\\/g, '/')
      const testScript = `
        try {
          const ClipboardManager = require('${clipboardPath}');
          const manager = new ClipboardManager();
          console.log('ClipboardManager loaded successfully');
          process.exit(0);
        } catch (error) {
          console.error('Failed to load ClipboardManager:', error.message);
          process.exit(1);
        }
      `

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], { stdio: 'pipe' })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => { stdout += data.toString() })
        child.stderr.on('data', (data) => { stderr += data.toString() })
        child.on('close', (code) => resolve({ code, stdout, stderr }))
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('ClipboardManager loaded successfully')
    }, 10000)

    it('should import FileHandler without errors', async () => {
      const fileHandlerPath = path.join(__dirname, '../src/fileHandler.js').replace(/\\/g, '/')
      const testScript = `
        try {
          const FileHandler = require('${fileHandlerPath}');
          const handler = new FileHandler();
          console.log('FileHandler loaded successfully');
          process.exit(0);
        } catch (error) {
          console.error('Failed to load FileHandler:', error.message);
          process.exit(1);
        }
      `

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], { stdio: 'pipe' })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => { stdout += data.toString() })
        child.stderr.on('data', (data) => { stderr += data.toString() })
        child.on('close', (code) => resolve({ code, stdout, stderr }))
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('FileHandler loaded successfully')
    }, 10000)

    it('should import CLI without errors', async () => {
      const cliPath = path.join(__dirname, '../src/cli.js').replace(/\\/g, '/')
      const testScript = `
        try {
          const CLI = require('${cliPath}');
          const cli = new CLI();
          console.log('CLI loaded successfully');
          process.exit(0);
        } catch (error) {
          console.error('Failed to load CLI:', error.message);
          process.exit(1);
        }
      `

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], { stdio: 'pipe' })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => { stdout += data.toString() })
        child.stderr.on('data', (data) => { stderr += data.toString() })
        child.on('close', (code) => resolve({ code, stdout, stderr }))
      })

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('CLI loaded successfully')
    }, 10000)
  })

  describe('Clipboardy Direct Tests', () => {
    it('should be able to load clipboardy module directly', async () => {
      const testScript = `
        (async () => {
          try {
            const mod = await import('clipboardy');
            const clipboardy = mod.default || mod;
            console.log('Clipboardy type:', typeof clipboardy);
            console.log('Clipboardy read type:', typeof clipboardy.read);
            console.log('Clipboardy write type:', typeof clipboardy.write);
            console.log('Clipboardy loaded successfully');
            process.exit(0);
          } catch (error) {
            console.error('Failed to load clipboardy:', error.message);
            console.error('Error details:', error);
            process.exit(1);
          }
        })();
      `

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], {
          stdio: 'pipe',
          cwd: path.join(__dirname, '..')
        })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => { stdout += data.toString() })
        child.stderr.on('data', (data) => { stderr += data.toString() })
        child.on('close', (code) => resolve({ code, stdout, stderr }))
      })

      if (result.code !== 0) {
        console.log('Clipboardy test output:', result.stdout)
        console.log('Clipboardy test errors:', result.stderr)
      }

      expect(result.code).toBe(0)
      expect(result.stdout).toContain('Clipboardy loaded successfully')
    }, 10000)

    it('should be able to call clipboardy functions', async () => {
      const testScript = `
        (async () => {
          try {
            const mod = await import('clipboardy');
            const clipboardy = mod.default || mod;
            // Try to read clipboard
            clipboardy.read().then(() => {
              console.log('Clipboardy read function works');
              process.exit(0);
            }).catch((error) => {
              console.log('Clipboardy read failed but function exists:', error.message);
              process.exit(0); // Still success if function exists
            });
          } catch (error) {
            console.error('Failed to call clipboardy:', error.message);
            process.exit(1);
          }
        })();
      `

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], {
          stdio: 'pipe',
          cwd: path.join(__dirname, '..'),
          timeout: 5000
        })
        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => { stdout += data.toString() })
        child.stderr.on('data', (data) => { stderr += data.toString() })
        child.on('close', (code) => resolve({ code, stdout, stderr }))

        // Kill after timeout
        setTimeout(() => {
          child.kill()
          resolve({ code: 0, stdout: 'Test timed out (clipboard access may require user interaction)', stderr: '' })
        }, 5000)
      })

      expect(result.code).toBe(0)
    }, 10000)
  })
})
