# Testing Guide

This document provides comprehensive instructions for running tests in the clipaste project across different environments and platforms.

## Overview

The clipaste project includes a robust testing suite with **headless environment support**, ensuring tests work reliably across:

- **Windows** (GUI environment with clipboard access)
- **macOS** (GUI environment with clipboard access)  
- **Linux Desktop** (GUI environment with clipboard access)
- **Docker/CI environments** (headless with graceful fallbacks)

## Test Types

### 1. Unit Tests

- **Clipboard Manager**: Tests clipboard operations with headless/non-headless scenarios
- **CLI Interface**: Tests command parsing and execution
- **File Handling**: Tests file I/O operations
- **Watch Functionality**: Tests file watching and history management

### 2. Integration Tests

- **Real Functionality**: End-to-end clipboard operations
- **Phase 1 Enhancements**: Command combinations and workflows
- **Cross-platform Compatibility**: Platform-specific behavior validation

### 3. Smoke Tests

- **Basic Operations**: Quick verification of core functionality
- **Global Installation**: Tests npm global package installation

## Local Development Testing

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- Platform-specific clipboard access (automatic)

### Quick Test Commands

```bash
# Run all tests
npm test

# Run pre-commit tests (excludes global installation tests)
npm run test:pre-commit

# Run specific test files
npm test -- tests/clipboard.test.js
npm test -- tests/cli.test.js
npm test -- tests/phase1-enhancements.test.js

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode (for development)
npm test -- --watch
```

### Platform-Specific Notes

#### Windows

- Full clipboard functionality available
- Tests use real clipboard operations
- All 146+ tests should pass

#### macOS  

- Full clipboard functionality available
- Tests use real clipboard operations
- May require accessibility permissions for clipboard access
- All 146+ tests should pass

#### Linux Desktop

- Requires X11 display server (`$DISPLAY` environment variable)
- Full clipboard functionality with `xclip` or similar tools
- All 146+ tests should pass

## Docker Testing

Docker testing is essential for verifying headless environment compatibility and CI/CD readiness.

### Build Docker Test Image

```bash
# Build the test environment
docker build -f scripts/Dockerfile.test -t clipaste-test-ubuntu-node16 .
```

### Run Docker Tests

```bash
# Run pre-commit tests in Docker (recommended)
docker run --rm clipaste-test-ubuntu-node16 /bin/bash -c "npm run test:pre-commit"

# Run all tests in Docker (includes global installation tests)
docker run --rm clipaste-test-ubuntu-node16 /bin/bash -c "npm test"

# Run specific test files in Docker
docker run --rm clipaste-test-ubuntu-node16 /bin/bash -c "npm test -- tests/clipboard.test.js"

# Interactive Docker session for debugging
docker run -it --rm clipaste-test-ubuntu-node16 /bin/bash
```

### Docker Test Environment Details

The Docker test environment includes:

- **Base**: Node.js 16 on Ubuntu (Debian Bullseye)
- **Display Server**: Xvfb (virtual framebuffer) on `:99`
- **Clipboard Tools**: xclip for clipboard simulation
- **Environment**: Headless mode automatically detected

### Expected Docker Behavior

In Docker (headless environment):

- Tests automatically detect headless mode
- Clipboard operations use graceful fallbacks
- Warning messages indicate headless simulation
- All tests pass with informational warnings like:

  ```
  Info: Copy command test - clipboard access unavailable in headless/CI environment
  Info: File copy test skipped - clipboard unavailable in headless environment
  ```

## Cross-Platform Testing Workflow

### For Contributors

1. **Local Development** (your platform):

   ```bash
   npm install
   npm run test:pre-commit
   ```

2. **Cross-Platform Verification**:

   ```bash
   # Build and test in Docker Ubuntu
   docker build -f scripts/Dockerfile.test -t clipaste-test .
   docker run --rm clipaste-test /bin/bash -c "npm run test:pre-commit"
   ```

3. **Before Committing**:

   ```bash
   # This runs automatically via git hooks
   npm run lint
   npm run test:pre-commit
   ```

### For Maintainers

Test on all target platforms:

```bash
# Windows
npm run test:pre-commit

# macOS  
npm run test:pre-commit

# Linux/Docker
docker build -f scripts/Dockerfile.test -t clipaste-test .
docker run --rm clipaste-test /bin/bash -c "npm run test:pre-commit"
```

## Test Configuration

### Pre-commit Tests

The `test:pre-commit` script excludes tests that require global npm installation:

```json
{
  "scripts": {
    "test:pre-commit": "jest --testPathIgnorePatterns=tests/global-executable.test.js"
  }
}
```

### Environment Detection

Tests automatically adapt based on environment:

- **GUI Environment**: Full clipboard functionality
- **Headless Environment**: Graceful fallbacks with simulation
- **CI Environment**: Detected via `CI=true` or similar flags

## Troubleshooting

### Common Issues

#### "Clipboard access denied" on Linux

```bash
# Install clipboard tools
sudo apt-get install xclip xsel

# Ensure X11 display is available
echo $DISPLAY  # Should show :0 or similar
```

#### Tests hanging on macOS

- Grant terminal app accessibility permissions in System Preferences
- Some clipboard operations may require user permissions

#### Docker build fails

```bash
# Clean Docker cache and rebuild
docker system prune -f
docker build --no-cache -f scripts/Dockerfile.test -t clipaste-test .
```

#### Tests pass locally but fail in CI

- Verify CI environment has headless detection working
- Check that `CI=true` environment variable is set
- Ensure Docker tests pass locally first

### Debug Commands

```bash
# Check environment detection
node -e "console.log('Platform:', process.platform); console.log('CI:', process.env.CI); console.log('DISPLAY:', process.env.DISPLAY);"

# Run single test with verbose output
npm test -- --verbose tests/clipboard.test.js

# Debug Docker environment
docker run -it --rm clipaste-test-ubuntu-node16 /bin/bash -c "env | grep -E '(DISPLAY|CI|XVFB)'"
```

## Continuous Integration

### GitHub Actions / CI Setup

The test suite is designed to work seamlessly in CI environments:

```yaml
# Example CI configuration
- name: Run tests
  run: npm run test:pre-commit
  env:
    CI: true
```

### Expected CI Behavior

- Headless mode automatically detected
- All tests pass with informational warnings
- No actual clipboard operations performed
- Simulated behavior validates command logic

## Performance Notes

- **Local tests**: ~20-30 seconds (full clipboard operations)
- **Docker tests**: ~8-15 seconds (simulated operations)
- **Pre-commit tests**: Excludes slower global installation tests
- **Watch mode**: Efficient for development iteration

## Test Coverage

The test suite covers:

- ✅ Clipboard operations (read, write, clear)
- ✅ File handling (save, load, format detection)
- ✅ CLI command parsing and execution
- ✅ Watch mode and history management
- ✅ Error handling and edge cases
- ✅ Cross-platform compatibility
- ✅ Headless environment support
- ✅ Integration workflows

Target coverage: **100%** for core functionality.
