# Clipboard Test Utilities

This document explains the standardized approach for handling clipboard operations in tests across different environments.

## Problem

Clipboard operations work perfectly on local development machines but often fail in CI environments (especially GitHub Actions) due to:

- No display server (headless environment)
- Restricted clipboard access for security
- Different behavior across operating systems (macOS, Windows, Linux)

## Solution

The `tests/helpers/clipboardTestUtils.js` provides a centralized solution that:

1. **Detects headless/CI environments** automatically
2. **Provides graceful fallbacks** for clipboard-dependent tests
3. **Maintains full functionality** on local development machines
4. **Standardizes test assertions** across the codebase

## Usage

### Basic Import

```javascript
const { expectClipboardContent, expectBackupContent, setupClipboardTest } = require('./helpers/clipboardTestUtils')
```

### Environment-Aware Assertions

Replace manual clipboard checks:

```javascript
// ❌ Old way - manual checks everywhere
if (getResult.stdout.trim() === '') {
  console.warn('Info: Test skipped - clipboard unavailable in headless/CI environment')
  return
}
expect(getResult.stdout.trim()).toBe(expectedContent)

// ✅ New way - centralized handling
expectClipboardContent(getResult.stdout.trim(), expectedContent, 'test name')
```

### Backup File Testing

```javascript
// ✅ Environment-aware backup content testing
await expectBackupContent(backupFilePath, expectedContent, 'backup test')
```

### Test Setup

```javascript
describe('Clipboard Tests', () => {
  // ✅ Robust clipboard setup with retry logic
  beforeEach(setupClipboardTest(runCLI, 'Test content'))
  
  // ... tests
})
```

## Key Functions

### `expectClipboardContent(actual, expected, testName, options)`

- **Purpose**: Environment-aware clipboard content assertion
- **Behavior**:
  - In local environments: Normal strict assertion
  - In CI/headless: Logs warning and passes if clipboard is empty
- **Parameters**:
  - `actual`: The actual clipboard content
  - `expected`: The expected content
  - `testName`: Test name for logging
  - `options`: `{ allowEmpty: boolean, customMessage: string }`

### `expectBackupContent(filePath, expected, testName)`

- **Purpose**: Test backup file content with environment awareness
- **Behavior**: Handles missing files gracefully in CI environments

### `setupClipboardTest(runCLI, content)`

- **Purpose**: Robust clipboard setup for test beforeEach hooks
- **Features**:
  - Retry logic for platform stability
  - Graceful handling of setup failures in CI

### `isHeadlessEnvironment()`

- **Purpose**: Detect if running in CI/headless environment
- **Checks**: `CI`, `HEADLESS`, `DISPLAY` (Unix), `XVFB_RUN` environment variables

## Benefits

1. **🎯 Consistent Behavior**: All clipboard tests behave consistently across environments
2. **🔧 Easy Maintenance**: Single place to update clipboard test logic
3. **📊 Better CI Experience**: Tests pass in CI with informative warnings instead of failures
4. **🖥️ Full Local Testing**: Complete clipboard functionality on development machines
5. **📝 Clear Logging**: Informative messages explain why tests are skipped in CI

## Environment Detection

The utilities automatically detect headless/CI environments by checking:

- `process.env.CI` - GitHub Actions, Travis, etc.
- `process.env.HEADLESS` - Explicit headless flag
- `process.env.DISPLAY` - X11 display (Unix systems)
- `process.env.XVFB_RUN` - Virtual display
- `--headless` command line argument

## Migration Guide

To migrate existing clipboard tests:

1. **Import utilities**:

   ```javascript
   const { expectClipboardContent, setupClipboardTest } = require('./helpers/clipboardTestUtils')
   ```

2. **Replace manual checks**:

   ```javascript
   // Replace this pattern:
   if (result.stdout.trim() === '') {
     console.warn('Warning: ...')
     return
   }
   expect(result.stdout.trim()).toBe(expected)
   
   // With this:
   expectClipboardContent(result.stdout.trim(), expected, 'test name')
   ```

3. **Update beforeEach blocks**:

   ```javascript
   // Replace:
   beforeEach(async () => {
     await runCLI(['copy', 'test content'])
   })
   
   // With:
   beforeEach(setupClipboardTest(runCLI, 'test content'))
   ```

This approach ensures your tests run reliably across all environments while maintaining full functionality where clipboard access is available.
