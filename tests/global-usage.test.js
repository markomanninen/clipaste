const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Global usage tests for the CLI tool
describe('Global Usage Tests', () => {
  const testDir = path.join(os.tmpdir(), 'clipaste-global-test');
  const cliScript = path.join(__dirname, '../src/index.js');

  beforeAll(async () => {
    // Create test output directories
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directories
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  const runCLIFromDir = (workingDir, args, options = {}) => {
    return new Promise((resolve) => {
      const child = spawn('node', [cliScript, ...args], {
        stdio: 'pipe',
        cwd: workingDir,
        ...options
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
        resolve({ code, stdout, stderr, cwd: workingDir });
      });
    });
  };

  describe('Cross-directory accessibility', () => {
    it('should work from any directory', async () => {
      const tempDir = path.join(os.tmpdir(), 'test-cwd-1');
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const result = await runCLIFromDir(tempDir, ['--help']);
        
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('CLI tool to paste clipboard content to files');
        expect(result.stdout).toContain('paste');
        expect(result.stdout).toContain('status');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it('should work from different nested directories', async () => {
      const nestedDir = path.join(testDir, 'deep', 'nested', 'path');
      await fs.mkdir(nestedDir, { recursive: true });

      const result = await runCLIFromDir(nestedDir, ['--version']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('1.0.0');
    });
  });

  describe('Default directory behavior', () => {
    it('should use current working directory as default output', async () => {
      const workDir = path.join(testDir, 'working-dir');
      await fs.mkdir(workDir, { recursive: true });

      const result = await runCLIFromDir(workDir, ['paste', '--help']);
      
      expect(result.code).toBe(0);
      // Check that the working directory path appears in the default output
      expect(result.stdout).toContain('working-dir');
      expect(result.stdout).toContain('(default:');
    });

    it('should show different default paths for different working directories', async () => {
      const workDir1 = path.join(testDir, 'work1');
      const workDir2 = path.join(testDir, 'work2');
      
      await fs.mkdir(workDir1, { recursive: true });
      await fs.mkdir(workDir2, { recursive: true });

      const result1 = await runCLIFromDir(workDir1, ['paste', '--help']);
      const result2 = await runCLIFromDir(workDir2, ['paste', '--help']);
      
      expect(result1.stdout).toContain('work1');
      expect(result2.stdout).toContain('work2');
      expect(result1.stdout).not.toContain('work2');
      expect(result2.stdout).not.toContain('work1');
    });
  });

  describe('Output path handling from different directories', () => {
    it('should handle absolute paths from any working directory', async () => {
      const workDir = path.join(testDir, 'abs-test');
      const outputDir = path.join(testDir, 'output-abs');
      
      await fs.mkdir(workDir, { recursive: true });
      await fs.mkdir(outputDir, { recursive: true });

      const result = await runCLIFromDir(workDir, [
        'paste', 
        '--dry-run', 
        '--output', outputDir, 
        '--filename', 'test-abs'
      ]);

      // Should work regardless of working directory
      expect([0, 1]).toContain(result.code); // 0 or 1 depending on clipboard content
      if (result.stdout.includes('Would paste')) {
        expect(result.stdout).toContain(path.join(outputDir, 'test-abs'));
      }
    });

    it('should handle relative paths from different working directories', async () => {
      const workDir = path.join(testDir, 'rel-test');
      await fs.mkdir(workDir, { recursive: true });
      await fs.mkdir(path.join(workDir, 'relative-output'), { recursive: true });

      const result = await runCLIFromDir(workDir, [
        'paste', 
        '--dry-run', 
        '--output', './relative-output', 
        '--filename', 'test-rel'
      ]);

      expect([0, 1]).toContain(result.code);
      if (result.stdout.includes('Would paste')) {
        const expectedPath = path.join(workDir, 'relative-output', 'test-rel');
        expect(result.stdout).toContain('relative-output');
      }
    });

    it('should handle home directory (~) expansion', async () => {
      const workDir = path.join(testDir, 'home-test');
      await fs.mkdir(workDir, { recursive: true });

      const result = await runCLIFromDir(workDir, [
        'paste', 
        '--dry-run', 
        '--output', '~', 
        '--filename', 'test-home'
      ]);

      expect([0, 1]).toContain(result.code);
      // Note: Node.js doesn't automatically expand ~ in paths, 
      // but the test verifies the command runs without error
    });
  });

  describe('Cross-platform path handling', () => {
    it('should handle platform-specific path separators', async () => {
      const workDir = path.join(testDir, 'platform-test');
      await fs.mkdir(workDir, { recursive: true });

      // Test with path.join to ensure cross-platform compatibility
      const outputPath = path.join(testDir, 'platform-output');
      await fs.mkdir(outputPath, { recursive: true });

      const result = await runCLIFromDir(workDir, [
        'paste', 
        '--dry-run', 
        '--output', outputPath, 
        '--filename', 'platform-test'
      ]);

      expect([0, 1]).toContain(result.code);
    });
  });

  describe('Directory creation behavior', () => {
    it('should handle non-existent output directories in dry-run', async () => {
      const workDir = path.join(testDir, 'create-test');
      const nonExistentDir = path.join(testDir, 'non-existent', 'deep', 'path');
      
      await fs.mkdir(workDir, { recursive: true });

      const result = await runCLIFromDir(workDir, [
        'paste', 
        '--dry-run', 
        '--output', nonExistentDir, 
        '--filename', 'test-create'
      ]);

      // Dry-run should not create directories but should show the path
      expect([0, 1]).toContain(result.code);
      
      // Verify directory was not actually created
      let dirExists = false;
      try {
        await fs.access(nonExistentDir);
        dirExists = true;
      } catch {
        dirExists = false;
      }
      expect(dirExists).toBe(false);
    });
  });

  describe('Command consistency across directories', () => {
    it('should provide same help output from different directories', async () => {
      const workDir1 = path.join(testDir, 'help1');
      const workDir2 = path.join(testDir, 'help2');
      
      await fs.mkdir(workDir1, { recursive: true });
      await fs.mkdir(workDir2, { recursive: true });

      const result1 = await runCLIFromDir(workDir1, ['status', '--help']);
      const result2 = await runCLIFromDir(workDir2, ['status', '--help']);
      
      expect(result1.code).toBe(result2.code);
      // Help content should be identical regardless of working directory
      expect(result1.stdout).toBe(result2.stdout);
    });

    it('should handle clipboard status checks from any directory', async () => {
      const workDir = path.join(testDir, 'status-test');
      await fs.mkdir(workDir, { recursive: true });

      const result = await runCLIFromDir(workDir, ['status']);
      
      // Status command should work from any directory
      expect([0, 1]).toContain(result.code);
    });
  });
});