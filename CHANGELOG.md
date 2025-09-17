# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Windows Image Support**: Complete implementation of image-to-clipboard functionality
  - `clipaste copy --image file.png` now works on Windows using PowerShell/.NET Framework
  - Robust error handling for empty clipboard states and Windows-specific clipboard errors
  - Support for multiple image formats (PNG, JPEG, GIF, BMP, SVG)
  - Round-trip testing: file → clipboard → file verification

### Fixed

- **Test Suite Improvements**: Fixed failing tests in clipboard and global-executable test suites
  - Fixed `readImage` test by properly mocking Windows-specific clipboard methods
  - Added timeout protection to global command tests to prevent hanging
  - Enhanced error handling for completely empty clipboard states

## [1.0.0] - 2025-01-14

### Added

- **Core functionality**: Cross-platform clipboard paste operations
- **Image support**: Extract and save clipboard images as PNG, JPEG, WebP
- **Text handling**: Save clipboard text content to files
- **Content detection**: Automatically detect text, image, or binary content types
- **File organization**: Custom paths, filenames, and automatic timestamps
- **Dry-run mode**: Preview operations without creating files

### Phase 1 Enhancements

- **Copy command**: Write text and file contents to clipboard
  - `clipaste copy "text"` - Copy text directly
  - `clipaste copy --file path.txt` - Copy file contents
  - Support for piped input: `echo "data" | clipaste copy`
- **Get command**: Output clipboard content to stdout (pbpaste compatible)
  - `clipaste get` - Output clipboard to stdout
  - `clipaste get --raw` - Raw output without newline
  - Pipe-friendly for integration: `clipaste get | grep pattern`
- **Enhanced clear command**: Backup and confirmation options
  - `clipaste clear --backup` - Save content before clearing
  - `clipaste clear --confirm` - Interactive confirmation prompt

### Testing

- **140 comprehensive tests** with 100% real functionality coverage
- **Cross-platform testing**: macOS, Windows, Linux support
- **Real smoke tests**: No mocking, actual clipboard operations tested
- **Image handling tests**: Complete base64 and file creation testing
- **Integration tests**: End-to-end workflow testing

### Documentation

- **Comprehensive README** with pbcopy/pbpaste comparison
- **Enhancement roadmap** with Phase 2-4 planning
- **Installation instructions** for npm, source, and system requirements
- **Usage examples** for all commands and options

### Infrastructure

- **GitHub Actions CI/CD**: Automated testing across platforms and Node versions
- **npm publishing pipeline**: Automated releases with semantic versioning
- **Code quality**: ESLint configuration and pre-commit hooks
- **Coverage reporting**: Jest coverage with Codecov integration

## [Unreleased]

### Changed

- CI matrix updated: dropped Node 14 (EOL) tests; added Node 22; coverage now collected on Node 20
- Raised minimum supported Node version from 14 to 16 (see `engines.node`) and added `.nvmrc` (Node 20) for local consistency
- Refactored clipboard access to support ESM-only `clipboardy` via lazy dynamic import

### Fixed

- Resolved test failures caused by requiring ESM `clipboardy` from CommonJS by introducing dynamic import and injectable mock for tests

### Planned (Phase 2)

- Real-time clipboard monitoring (`clipaste watch`)
- Clipboard history management (`clipaste history`)
- Memory-only operations mode

### Planned (Phase 3)

- Advanced image transformations (resize, compress, convert)
- Content transformations (base64, JSON formatting)
- Smart content detection and syntax highlighting

### Planned (Phase 4)

- Template and snippet system
- Cloud sync and backup features  
- Search and organization capabilities

---

**Legend:**

- Added: New features
- Changed: Changes in existing functionality  
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Security improvements
