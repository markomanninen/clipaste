# Contributing to clipaste

Thank you for your interest in contributing to clipaste! This document provides guidelines for contributing to the project.

## Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/markomanninen/clipaste.git
   cd clipaste
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Install system dependencies (Linux only)**

   ```bash
   # Ubuntu/Debian
   sudo apt-get install xclip
   ```

4. **Run tests to ensure everything works**

   ```bash
   npm test
   ```

## Development Workflow

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style and patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   npm test           # Run all tests
   npm run test:watch # Run tests in watch mode
   npm run lint       # Check code style
   npm run lint:fix   # Fix linting issues
   ```

4. **Commit and push**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**

## Testing Guidelines

- **Write real tests**: No mocking of core clipboard functionality
- **Cross-platform compatibility**: Test on macOS, Windows, Linux if possible
- **Cover edge cases**: Empty clipboard, large content, special characters
- **Integration tests**: Test command combinations and workflows

### Running Specific Tests

```bash
npm test -- tests/phase1-enhancements.test.js  # Specific test file
npm test -- --testNamePattern="copy command"   # Specific test pattern
npm run test:coverage                           # With coverage report
```

## Code Style

- Use existing ESLint configuration
- Follow current naming conventions
- Add JSDoc comments for public APIs
- Keep functions focused and testable

## Commit Message Format

Use conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes  
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

Examples:

```
feat: add clipboard history command
fix: handle empty clipboard gracefully  
docs: update installation instructions
test: add integration tests for copy command
```

## Pull Request Guidelines

1. **Clear description**: Explain what and why you're changing
2. **Link issues**: Reference any related GitHub issues
3. **Test coverage**: Ensure tests pass and add new tests
4. **Documentation**: Update README/docs if needed
5. **Small focused changes**: Keep PRs focused on single features/fixes

## Release Process

Maintainers use semantic versioning:

```bash
npm run release:patch  # Bug fixes (1.0.0 → 1.0.1)
npm run release:minor  # New features (1.0.0 → 1.1.0)  
npm run release:major  # Breaking changes (1.0.0 → 2.0.0)
```

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **Discussions**: Ask questions or propose ideas
- **Email**: Contact <marko.manninen@gmail.com>

## Enhancement Priorities

Current development focuses on:

1. **Phase 2**: Real-time monitoring and history features
2. **Cross-platform stability**: Ensuring consistent behavior
3. **Performance optimization**: Faster clipboard operations
4. **Error handling**: Better user experience on failures

See `ENHANCEMENT_PLAN.md` for detailed roadmap.

Thank you for contributing to clipaste! 🚀
