const { Command } = require('commander')
const ClipboardManager = require('./clipboard')
const FileHandler = require('./fileHandler')
const Watcher = require('./watcher')
const HistoryStore = require('./historyStore')
const { version } = require('../package.json')
const { isHeadlessEnvironment } = require('./utils/environment')

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

    // Watch command
    this.program
      .command('watch')
      .description('Monitor clipboard changes and act on them')
      .option('--interval <ms>', 'Polling interval in milliseconds', '1000')
      .option('--filter <regex>', 'Only act when content matches regex')
      .option('--exec <cmd>', 'Execute a shell command on change (content on stdin)')
      .option('--save', 'Save changes to history')
      .option('--timeout <ms>', 'Stop after this many milliseconds')
      .option('--once', 'Exit after the first change')
      .option('--max-events <n>', 'Stop after N changes')
      .option('--idle-timeout <ms>', 'Stop if no changes for this long (ms)')
      .option('--no-persist', 'Do not persist history to disk (session-only)')
      .option('--max-item-size <bytes>', 'Max size per history item (bytes)', '262144')
      .option('--max-items <n>', 'Max number of history items', '100')
      .option('--no-echo', 'Do not echo content previews in logs')
      .option('--verbose', 'Verbose logs')
      .action(async (options) => {
        await this.handleWatch(options)
      })

    // History command
    this.program
      .command('history')
      .description('Manage clipboard history')
      .option('--list', 'List recent history items')
      .option('--restore <id>', 'Restore a history item to clipboard by id')
      .option('--clear', 'Clear history')
      .option('--export <file>', 'Export history to file')
      .option('--max-items <n>', 'Max number of history items', '100')
      .option('--max-item-size <bytes>', 'Max size per history item (bytes)', '262144')
      .option('--no-persist', 'Do not persist to disk (session-only)')
      .option('--verbose', 'Verbose logs')
      .action(async (options) => {
        await this.handleHistory(options)
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
      const isHeadless = isHeadlessEnvironment()
      const hasContent = await this.clipboardManager.hasContent()

      if (!hasContent) {
        if (isHeadless) {
          console.log('Clipboard is empty (headless mode - simulated)')
        } else {
          console.log('Clipboard is empty')
        }
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
      const isHeadless = isHeadlessEnvironment()

      // Check if clipboard has content first
      const hasContent = await this.clipboardManager.hasContent()
      if (!hasContent) {
        if (isHeadless) {
          console.log('Clipboard is already empty (headless mode)')
        } else {
          console.log('Clipboard is already empty')
        }
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
      if (isHeadless) {
        console.log('Clipboard cleared (headless mode - simulated)')
      } else {
        console.log('Clipboard cleared')
      }
    } catch (error) {
      console.error('Error clearing clipboard:', error.message)
      process.exit(1)
    }
  }

  async handleCopy (text, options) {
    try {
      const isHeadless = isHeadlessEnvironment()

      if (options.file) {
        // Copy file contents
        const fs = require('fs').promises
        const path = require('path')

        try {
          const content = await fs.readFile(options.file, 'utf8')
          await this.clipboardManager.writeText(content)
          if (isHeadless) {
            console.log(`Copied contents of ${path.basename(options.file)} to clipboard (headless mode - simulated)`)
          } else {
            console.log(`Copied contents of ${path.basename(options.file)} to clipboard`)
          }
        } catch (error) {
          console.error(`Error reading file ${options.file}:`, error.message)
          process.exit(1)
        }
      } else if (text) {
        // Copy provided text
        await this.clipboardManager.writeText(text)
        if (isHeadless) {
          console.log(`Copied text to clipboard (${text.length} characters) (headless mode - simulated)`)
        } else {
          console.log(`Copied text to clipboard (${text.length} characters)`)
        }
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
              if (isHeadless) {
                console.log(`Copied piped content to clipboard (${content.length} characters) (headless mode - simulated)`)
              } else {
                console.log(`Copied piped content to clipboard (${content.length} characters)`)
              }
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
        process.exit(0)
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

  async handleWatch (options) {
    const interval = parseInt(options.interval)
    const watcher = new Watcher({ interval, verbose: !!options.verbose })
    const history = new HistoryStore({
      persist: options.persist !== false,
      maxItems: parseInt(options.maxItems),
      maxItemSize: parseInt(options.maxItemSize),
      verbose: !!options.verbose
    })

    const stop = async () => { await watcher.stop() }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    await watcher.start({
      filter: options.filter,
      exec: options.exec,
      save: !!options.save,
      history,
      timeout: options.timeout ? parseInt(options.timeout) : undefined,
      once: !!options.once,
      maxEvents: options.maxEvents ? parseInt(options.maxEvents) : undefined,
      idleTimeout: options.idleTimeout ? parseInt(options.idleTimeout) : undefined,
      noEcho: options.echo === false
    })
  }

  async handleHistory (options) {
    const history = new HistoryStore({
      persist: options.persist !== false,
      maxItems: parseInt(options.maxItems),
      maxItemSize: parseInt(options.maxItemSize),
      verbose: !!options.verbose
    })

    try {
      if (options.clear) {
        await history.clear()
        console.log('History cleared')
        return
      }

      if (options.export) {
        const file = await history.exportTo(options.export)
        console.log(`Exported history to: ${file}`)
        return
      }

      if (options.restore) {
        await history.restore(options.restore, this.clipboardManager)
        console.log(`Restored item ${options.restore} to clipboard`)
        return
      }

      // Default to list
      const items = await history.list()
      if (!items.length) {
        console.log('History is empty')
        return
      }
      for (const item of items) {
        const preview = item.preview && item.preview.length > 60 ? item.preview.slice(0, 60) + '…' : item.preview
        console.log(`${item.id}  ${item.ts}  len=${item.len}  sha=${item.sha256.slice(0, 8)}  ${JSON.stringify(preview)}`)
      }
    } catch (error) {
      console.error('Error handling history:', error.message)
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
