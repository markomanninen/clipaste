# Installation and Usage Guide

## How to Install Globally

### Option 1: Install from local development

```bash
# From the project directory
npm install        # Install dependencies first
npm link          # Create global symlink
```

### Option 2: Install from npm (when published)

```bash
npm install -g clipaste
```

### Option 3: Use without global install

```bash
# From project directory
npm start paste [options]
```

## Global Usage Examples

Once installed globally, you can use `clipaste` from any directory:

### Basic Usage

```bash
# Check what's in clipboard (from any directory)
clipaste status

# Paste clipboard to current directory
clipaste paste

# Paste clipboard to current directory with custom filename
clipaste paste --filename "my-clipboard-content"
```

### Directory Control Examples

```bash
# From /home/user/documents - saves to /home/user/documents/
cd /home/user/documents
clipaste paste --filename "meeting-notes"

# From any directory - saves to specific absolute path
clipaste paste --output /home/user/downloads --filename "image"

# From any directory - saves to relative path (relative to current directory)
clipaste paste --output ./subfolder --filename "data"

# From any directory - saves to home directory
clipaste paste --output ~ --filename "clipboard-backup"
```

### File Path Resolution Logic

1. **Default behavior**: Files save to current working directory (`process.cwd()`)
2. **With --output**: Files save to specified path (absolute or relative)
3. **Filename handling**:
   - With `--filename`: Uses your custom name
   - Without `--filename`: Auto-generates: `clipboard-YYYY-MM-DDTHH-mm-ss-sssZ-UUID.ext`
4. **Extension handling**:
   - Auto-detected: `.txt` for text, `.png` for images
   - Override with `--ext .jpg` or `--format jpeg`

### Cross-Platform Paths

The tool handles paths correctly on all platforms:

```bash
# Windows
clipaste paste --output "C:\\Users\\Name\\Desktop" --filename "data"

# macOS/Linux  
clipaste paste --output "/Users/Name/Desktop" --filename "data"

# Relative paths work everywhere
clipaste paste --output "./downloads" --filename "data"
```

### Real-World Examples

```bash
# Save clipboard text to current directory
clipaste paste

# Save clipboard image to Downloads folder
clipaste paste --output ~/Downloads --format png

# Save with timestamp in filename to Documents
clipaste paste --output ~/Documents --filename "meeting-$(date +%Y%m%d)"

# Preview what will happen without saving
clipaste paste --dry-run --output /tmp --filename "test"
```

## Verify Installation

```bash
# Check if globally available
which clipaste

# Test basic functionality  
clipaste --help
clipaste status
```
