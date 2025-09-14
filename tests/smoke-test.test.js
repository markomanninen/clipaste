const { spawn } = require('child_process');
const path = require('path');

// SMOKE TESTS - Basic "does it work at all" tests
describe('Smoke Tests - Basic Functionality', () => {
  const cliScript = path.join(__dirname, '../src/index.js');

  const runCommand = (args) => {
    return new Promise((resolve) => {
      const child = spawn('node', [cliScript, ...args], {
        stdio: 'pipe',
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      // Kill if hangs
      setTimeout(() => {
        child.kill();
        resolve({ code: 124, stdout: stdout + '[TIMEOUT]', stderr: stderr + '[TIMEOUT]' });
      }, 5000);
    });
  };

  describe('Basic Command Execution', () => {
    it('should show help without crashing', async () => {
      const result = await runCommand(['--help']);
      
      // CRITICAL: Must not crash with dependency errors
      expect(result.stderr).not.toContain('is not a function');
      expect(result.stderr).not.toContain('Cannot find module');
      expect(result.stderr).not.toContain('MODULE_NOT_FOUND');
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('CLI tool to paste clipboard content to files');
    });

    it('should show version without crashing', async () => {
      const result = await runCommand(['--version']);
      
      // CRITICAL: Must not crash with dependency errors
      expect(result.stderr).not.toContain('is not a function');
      expect(result.stderr).not.toContain('Cannot find module');
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('1.0.0');
    });

    it('should handle status command without function errors', async () => {
      const result = await runCommand(['status']);
      
      // CRITICAL: The main issue - must not have function errors
      expect(result.stderr).not.toContain('clipboardy.read is not a function');
      expect(result.stderr).not.toContain('is not a function');
      expect(result.stderr).not.toContain('Cannot find module');
      
      // Should exit with 0 or 1, not crash
      expect([0, 1]).toContain(result.code);
    });

    it('should handle paste dry-run without function errors', async () => {
      const result = await runCommand(['paste', '--dry-run', '--filename', 'test']);
      
      // CRITICAL: Must not crash with function errors
      expect(result.stderr).not.toContain('clipboardy.read is not a function');
      expect(result.stderr).not.toContain('is not a function');
      expect(result.stderr).not.toContain('Cannot find module');
      
      // Should complete without crashing
      expect([0, 1]).toContain(result.code);
    });

    it('should handle clear command without function errors', async () => {
      const result = await runCommand(['clear']);
      
      // CRITICAL: Must not crash with function errors
      expect(result.stderr).not.toContain('clipboardy.write is not a function');
      expect(result.stderr).not.toContain('is not a function');
      expect(result.stderr).not.toContain('Cannot find module');
      
      // Should complete without crashing
      expect([0, 1]).toContain(result.code);
    });
  });

  describe('Dependency Loading Verification', () => {
    it('should load all modules without import errors', async () => {
      // Test each module can be loaded
      const modules = [
        '../src/clipboard.js',
        '../src/fileHandler.js', 
        '../src/cli.js'
      ];

      for (const modulePath of modules) {
        const testScript = `
          try {
            require('${path.join(__dirname, modulePath)}');
            console.log('SUCCESS');
          } catch (error) {
            console.error('ERROR:', error.message);
            process.exit(1);
          }
        `;

        const result = await new Promise((resolve) => {
          const child = spawn('node', ['-e', testScript], { 
            stdio: 'pipe',
            cwd: path.join(__dirname, '..')
          });
          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => stdout += data.toString());
          child.stderr.on('data', (data) => stderr += data.toString());
          child.on('close', (code) => resolve({ code, stdout, stderr }));
        });

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('SUCCESS');
        expect(result.stderr).not.toContain('Cannot find module');
      }
    });

    it('should be able to instantiate main classes', async () => {
      const testScript = `
        try {
          const ClipboardManager = require('./src/clipboard.js');
          const FileHandler = require('./src/fileHandler.js');
          const CLI = require('./src/cli.js');
          
          new ClipboardManager();
          new FileHandler();
          new CLI();
          
          console.log('All classes instantiated successfully');
        } catch (error) {
          console.error('Instantiation failed:', error.message);
          process.exit(1);
        }
      `;

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], { 
          stdio: 'pipe',
          cwd: path.join(__dirname, '..')
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());
        child.on('close', (code) => resolve({ code, stdout, stderr }));
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('All classes instantiated successfully');
    });
  });

  describe('Critical Dependency Tests', () => {
    it('clipboardy module must be loadable and callable', async () => {
      const testScript = `
        try {
          const clipboardy = require('clipboardy').default;
          
          console.log('Clipboardy loaded');
          console.log('read function:', typeof clipboardy.read);
          console.log('write function:', typeof clipboardy.write);
          
          if (typeof clipboardy.read === 'function' && typeof clipboardy.write === 'function') {
            console.log('SUCCESS: clipboardy functions are available');
          } else {
            console.error('FAIL: clipboardy functions are not available');
            process.exit(1);
          }
        } catch (error) {
          console.error('FAIL: Cannot load clipboardy:', error.message);
          process.exit(1);
        }
      `;

      const result = await new Promise((resolve) => {
        const child = spawn('node', ['-e', testScript], { 
          stdio: 'pipe',
          cwd: path.join(__dirname, '..')
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());
        child.on('close', (code) => resolve({ code, stdout, stderr }));
      });

      if (result.code !== 0) {
        console.log('Clipboardy test failed. Output:', result.stdout);
        console.log('Clipboardy test errors:', result.stderr);
      }

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('SUCCESS: clipboardy functions are available');
    });
  });
});