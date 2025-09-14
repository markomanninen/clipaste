# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a CLI clipboard paste tool that supports both text and image content, with the ability to save clipboard data to files. The tool is designed to be a cross-platform utility for managing clipboard operations.

## Development Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Check code style
npm run lint

# Fix code style issues
npm run lint:fix

# Run the CLI tool
npm start <command> [options]
```

## Usage Examples

```bash
# Check clipboard status
npm start status

# Paste clipboard content to file
npm start paste

# Paste with custom options
npm start paste --output ./downloads --filename my-file

# Show help
npm start --help
```

## Development Setup

The project uses the following structure:

### Key Components to Implement

- **CLI Interface**: Command-line argument parsing and user interaction
- **Clipboard Manager**: Core functionality to read from system clipboard
- **File Handler**: Logic to save clipboard content to files
- **Format Detection**: Automatic detection of text vs image content
- **Image Processing**: Handle various image formats (PNG, JPG, etc.)

### Expected Architecture

```
├── src/
│   ├── cli.js/py/rs    # Main CLI entry point
│   ├── clipboard.js    # Clipboard operations
│   ├── fileHandler.js  # File saving logic
│   └── utils.js        # Utility functions
├── tests/              # Unit tests
├── package.json        # Node.js dependencies (if JS)
├── requirements.txt    # Python dependencies (if Python)
├── Cargo.toml         # Rust dependencies (if Rust)
└── README.md          # Project documentation
```

## Common Development Patterns

When implementing this tool, consider:

- Cross-platform clipboard access (different APIs for Windows, macOS, Linux)
- Handle binary data for images properly
- Implement proper error handling for clipboard access failures
- Support common image formats (PNG, JPEG, GIF, BMP)
- Provide options for output file naming and location
- Consider security implications when accessing clipboard data

## Technology Considerations

The implementation language should be chosen based on:
- **Node.js**: Good cross-platform clipboard libraries, easy file handling
- **Python**: Excellent clipboard libraries (pyperclip, PIL), cross-platform
- **Rust**: Fast, memory-safe, good for CLI tools, cross-platform compilation
- **Go**: Fast compilation, good CLI libraries, single binary distribution