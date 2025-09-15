# Testing Documentation Summary

This repository includes comprehensive testing infrastructure that supports both local development and cross-platform CI/CD workflows.

## Quick Start

### For Development

**Windows:**
```powershell
# Quick development tests
.\scripts\test-runner.ps1 quick

# Full cross-platform verification  
.\scripts\test-runner.ps1 full
```

**macOS/Linux:**
```bash
# Quick development tests
./scripts/test-runner.sh quick

# Full cross-platform verification
./scripts/test-runner.sh full
```

### For CI/CD

```bash
# Pre-commit tests (excludes global installation tests)
npm run test:pre-commit

# Docker headless environment testing
docker build -f scripts/Dockerfile.test -t clipaste-test .
docker run --rm clipaste-test /bin/bash -c "npm run test:pre-commit"
```

## Documentation Structure

1. **[TESTING.md](./TESTING.md)** - Comprehensive testing guide
   - Environment setup and prerequisites
   - Cross-platform testing workflows
   - Docker testing procedures
   - Troubleshooting common issues
   - CI/CD integration guidelines

2. **[scripts/README.md](./scripts/README.md)** - Development scripts documentation
   - Test runner scripts for Windows and Unix
   - Legacy CI simulation tools
   - Docker configuration details

3. **[README.md](./README.md#development)** - Main development section
   - Quick testing commands
   - Cross-platform testing overview
   - Project structure

## Test Environment Matrix

| Platform | Environment | Clipboard Access | Test Command |
|----------|-------------|------------------|--------------|
| Windows | GUI | ✅ Full | `npm run test:pre-commit` |
| macOS | GUI | ✅ Full | `npm run test:pre-commit` |
| Linux Desktop | X11/Wayland | ✅ Full | `npm run test:pre-commit` |
| Docker Ubuntu | Headless | 🔄 Simulated | `docker run ... npm run test:pre-commit` |
| CI/CD | Headless | 🔄 Simulated | `npm run test:pre-commit` |

## Key Features

✅ **Automatic Environment Detection** - Tests adapt based on headless vs GUI environment  
✅ **Cross-Platform Compatibility** - Same commands work across Windows, macOS, Linux  
✅ **Docker Integration** - Containerized testing for consistent CI/CD results  
✅ **Graceful Degradation** - Headless environments use simulation instead of failing  
✅ **Interactive Test Runners** - User-friendly scripts for development workflows  
✅ **Comprehensive Coverage** - 146+ tests covering all functionality  

## Test Statistics

- **Total Tests**: 146+ tests across 13 test suites
- **Coverage Areas**: Clipboard operations, CLI interface, file handling, watch mode, history management
- **Execution Time**: ~15-20 seconds (local), ~8-10 seconds (Docker headless)
- **Success Rate**: 100% across all supported platforms and environments

## Support

- **Issues**: Check [TESTING.md](./TESTING.md) troubleshooting section
- **Platform-specific problems**: See platform notes in main documentation
- **CI/CD setup**: Follow Docker testing procedures for consistent results