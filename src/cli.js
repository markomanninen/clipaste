const { Command } = require('commander')
const ClipboardManager = require('./clipboard')
const FileHandler = require('./fileHandler')
const { version } = require('../package.json')

class CLI {
  constructor () {
    this.program = new Command()
    this.clipboardManager = new ClipboardManager()
    this.fileHandler = new FileHandler()
    this.setupCommands()
  }

  setupCommands () {
    this.program
      .name('clipaste')
      .description('CLI tool to paste clipboard content to files')
      .version(version)

    // Main paste command
    this.program
      .command('paste')
      .description('Paste clipboard content to a file')
      .option('-o, --output <path>', 'Output directory path', process.cwd())
      .option('-f, --filename <name>', 'Output filename (without extension)')
      .option('-t, --type <type>', 'Force content type (text|image)', null)
      .option('--format <format>', 'Image format (png|jpg|webp)', 'png')
      .option('--quality <number>', 'Image quality (1-100)', '90')
      .option('--ext <extension>', 'File extension override')
      .option('--dry-run', 'Show what would be done without saving')
      .action(async (options) => {
        await this.handlePaste(options)
      })

    // Status command
    this.program
      .command('status')
      .description('Check clipboard status and content type')
      .action(async () => {
        await this.handleStatus()
      })

    // Clear command
    this.program
      .command('clear')
      .description('Clear clipboard content')
      .option('--confirm', 'Prompt before clearing')
      .option('--backup', 'Save to file before clearing')
      .action(async (options) => {
        await this.handleClear(options)
      })

    // Copy command
    this.program
      .command('copy')
      .description('Copy content to clipboard')
      .argument('[text]', 'Text to copy to clipboard')
      .option('--file <path>', 'Copy file contents to clipboard')
      .action(async (text, options) => {
        await this.handleCopy(text, options)
      })

    // Get command
    this.program
      .command('get')
      .description('Output clipboard content to stdout')
      .option('--raw', 'Output raw content without processing')
      .action(async (options) => {
        await this.handleGet(options)
      })
  }

  async handlePaste (options) {
    try {
      const hasContent = await this.clipboardManager.hasContent()
      if (!hasContent) {
        console.log('Clipboard is empty')
        process.exit(1)
      }

      const contentType = options.type || await this.clipboardManager.getContentType()

      if (options.dryRun) {
        console.log(`Would paste ${contentType} content to:`,
          this.fileHandler.generateFilePath(
            options.output,
            options.filename,
            options.ext || (contentType === 'image' ? '.png' : '.txt')
          )
        )
        return
      }

      let filePath

      if (contentType === 'image') {
        const imageData = await this.clipboardManager.readImage()
        if (!imageData) {
          console.log('No image data found in clipboard')
          process.exit(1)
        }

        filePath = await this.fileHandler.saveImage(imageData.data, {
          outputPath: options.output,
          filename: options.filename,
          extension: options.ext,
          format: options.format,
          quality: parseInt(options.quality)
        })
      } else {
        const textContent = await this.clipboardManager.readText()
        filePath = await this.fileHandler.saveText(textContent, {
          outputPath: options.output,
          filename: options.filename,
          extension: options.ext
        })
      }

      const stats = await this.fileHandler.getFileStats(filePath)
      console.log(`Saved ${contentType} content to: ${filePath}`)
      console.log(`File size: ${this.formatFileSize(stats.size)}`)
    } catch (error) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  }

  async handleStatus () {
    try {
      const hasContent = await this.clipboardManager.hasContent()

      if (!hasContent) {
        console.log('Clipboard is empty')
        return
      }

      const contentType = await this.clipboardManager.getContentType()
      console.log(`Clipboard contains: ${contentType} content`)

      if (contentType === 'text') {
        const content = await this.clipboardManager.readText()
        const preview = content.length > 100
          ? content.substring(0, 100) + '...'
          : content
        console.log(`Preview: ${preview}`)
        console.log(`Length: ${content.length} characters`)
      } else if (contentType === 'image') {
        const imageData = await this.clipboardManager.readImage()
        if (imageData) {
          console.log(`Image format: ${imageData.format}`)
          console.log(`Image size: ${this.formatFileSize(imageData.data.length)}`)
        }
      }
    } catch (error) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  }

  async handleClear (options = {}) {
    try {
      // Check if clipboard has content first
      const hasContent = await this.clipboardManager.hasContent()
      if (!hasContent) {
        console.log('Clipboard is already empty')
        return
      }

      // Backup if requested
      if (options.backup) {
        const content = await this.clipboardManager.readText()
        const filePath = await this.fileHandler.saveText(content, {
          outputPath: process.cwd(),
          filename: `clipboard-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
        })
        console.log(`Backed up clipboard content to: ${filePath}`)
      }

      // Confirm if requested
      if (options.confirm) {
        const readline = require('readline')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        })

        const answer = await new Promise((resolve) => {
          rl.question('Are you sure you want to clear the clipboard? (y/N): ', resolve)
        })
        rl.close()

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Clear cancelled')
          return
        }
      }

      await this.clipboardManager.clear()
      console.log('Clipboard cleared')
    } catch (error) {
      console.error('Error clearing clipboard:', error.message)
      process.exit(1)
    }
  }

  async handleCopy (text, options) {
    try {
      if (options.file) {
        // Copy file contents
        const fs = require('fs').promises
        const path = require('path')

        try {
          const content = await fs.readFile(options.file, 'utf8')
          await this.clipboardManager.writeText(content)
          console.log(`Copied contents of ${path.basename(options.file)} to clipboard`)
        } catch (error) {
          console.error(`Error reading file ${options.file}:`, error.message)
          process.exit(1)
        }
      } else if (text) {
        // Copy provided text
        await this.clipboardManager.writeText(text)
        console.log(`Copied text to clipboard (${text.length} characters)`)
      } else {
        // Check if stdin has data
        if (process.stdin.isTTY) {
          console.log('No content provided to copy')
          return
        }

        // Read from stdin
        const chunks = []
        process.stdin.setEncoding('utf8')

        return new Promise((resolve) => {
          process.stdin.on('data', (chunk) => {
            chunks.push(chunk)
          })

          process.stdin.on('end', async () => {
            const content = chunks.join('')
            if (content.trim()) {
              await this.clipboardManager.writeText(content)
              console.log(`Copied piped content to clipboard (${content.length} characters)`)
            } else {
              console.log('No content provided to copy')
            }
            resolve()
          })
        })
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error.message)
      process.exit(1)
    }
  }

  async handleGet (options) {
    try {
      const hasContent = await this.clipboardManager.hasContent()
      if (!hasContent) {
        // Don't output anything if clipboard is empty, just like pbpaste
        return
      }

      const content = await this.clipboardManager.readText()

      if (options.raw) {
        process.stdout.write(content)
      } else {
        console.log(content)
      }
    } catch (error) {
      console.error('Error reading from clipboard:', error.message)
      process.exit(1)
    }
  }

  formatFileSize (bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  async run (argv = process.argv) {
    await this.program.parseAsync(argv)
  }
}

module.exports = CLI
