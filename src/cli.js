const path = require('path')
const fsp = require('fs').promises
const { Command } = require('commander')
const ClipboardManager = require('./clipboard')
const FileHandler = require('./fileHandler')
const Watcher = require('./watcher')
const HistoryStore = require('./historyStore')
const LibraryStore = require('./libraryStore')
const { renderTemplate } = require('./utils/template')
const pkg = require('../package.json')
const { isHeadlessEnvironment } = require('./utils/environment')
const AIManager = require('./ai/manager')
const { makeSummarizePrompt, makeClassifyPrompt, makeTransformPrompt } = require('./ai/prompts')
const PluginManager = require('./plugins/pluginManager')

class CLI {
  constructor () {
    this.program = new Command()
    this.clipboardManager = new ClipboardManager()
    this.fileHandler = new FileHandler()
    this.library = new LibraryStore()
    this.aiManager = new AIManager()
    this.historyStore = new HistoryStore()
    this.packageInfo = pkg
    this.pluginManager = new PluginManager({
      program: this.program,
      services: this.createPluginServices(),
      config: pkg.clipaste || {},
      logger: console
    })
    this.setupCommands()
    this.setupPluginDiagnostics()
    this.pluginManager.loadConfiguredPlugins()
  }

  createPluginServices () {
    return {
      clipboard: this.clipboardManager,
      fileHandler: this.fileHandler,
      library: this.library,
      history: {
        record: async ({ content, type, meta, tags, persist } = {}) => {
          if (typeof content !== 'string' || content.length === 0) return null
          const options = {
            type,
            meta,
            tags,
            persist
          }
          return this.historyStore.addEntry(content, options)
        }
      },
      ai: this.aiManager,
      utils: {
        renderTemplate,
        isHeadlessEnvironment
      }
    }
  }

  setupPluginDiagnostics () {
    this.program
      .command('plugins')
      .description('List Clipaste plugin status and installation hints')
      .action(() => {
        const status = this.pluginManager?.getStatus?.() || { loaded: [], failed: [] }

        if (status.loaded.length === 0) {
          console.log('No plugins loaded.')
        } else {
          console.log('Loaded plugins:')
          for (const plugin of status.loaded) {
            const version = plugin.version ? ` v${plugin.version}` : ''
            console.log(`- ${plugin.name}${version}`)
          }
        }

        if (status.failed.length > 0) {
          console.log('\nPlugins not loaded:')
          for (const item of status.failed) {
            console.log(`- ${item.id}: ${item.reason}`)
          }
        }

        const configured = this.packageInfo?.clipaste?.plugins || []
        if (configured.length > 0) {
          console.log(`\nConfigured plugins: ${configured.join(', ')}`)
        }

        console.log('\nInstall plugins with `npm install clipaste-randomizer` or set CLIPASTE_PLUGINS to a comma-separated list.')
      })
  }

  setupCommands () {
    this.program
      .name('clipaste')
      .description('CLI tool to paste clipboard content to files')
      .version(this.packageInfo.version)

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
      .option('--resize <WxH|Wx|xH>', 'Resize image on paste (preserve aspect)')
      .option('--auto-extension', 'Auto-detect file extension for text/image')
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
      .option('--decode-base64 <data>', 'Decode base64 to text and copy (stdin if present)')
      .option('--encode-base64 [data]', 'Encode input to base64 and copy (stdin if present)')
      .action(async (text, options) => {
        await this.handleCopy(text, options)
      })

    // Get command
    this.program
      .command('get')
      .description('Output clipboard content to stdout')
      .option('--raw', 'Output raw content without processing')
      .option('--base64', 'Encode text content as base64')
      .option('--json-format', 'Pretty-print JSON content')
      .option('--url-decode', 'Decode URL-encoded content')
      .option('--url-encode', 'URL-encode content')
      .option('--image-info', 'Output image metadata JSON if clipboard has an image')
      .action(async (options) => {
        await this.handleGet(options)
      })

    const ai = this.program
      .command('ai')
      .description('AI-assisted clipboard utilities')

    ai
      .command('summarize')
      .description('Summarize content using an AI provider')
      .option('--source <source>', 'clipboard|stdin|file', 'clipboard')
      .option('--file <path>', 'File path when source=file')
      .option('--max-tokens <number>', 'Max tokens for the generated response')
      .option('--provider <name>', 'Provider to use (default from config)')
      .option('--model <name>', 'Model identifier to request')
      .option('--copy', 'Copy AI output back to clipboard')
      .option('--out <file>', 'Write AI output to a file')
      .option('--json', 'Emit JSON with metadata to stdout')
      .option('--consent', 'Confirm consent for network providers')
      .option('--redact <rules>', 'Override redaction rules (comma separated)')
      .option('--no-redact', 'Disable redaction pre-processing')
      .option('--show-redacted', 'Print the redacted prompt preview')
      .option('--temperature <number>', 'Provider temperature setting')
      .option('--top-p <number>', 'Provider top-p setting')
      .option('--seed <number>', 'Provider seed setting')
      .option('--timeout <ms>', 'Request timeout in milliseconds')
      .action(async (options) => {
        await this.handleAiSummarize(options)
      })

    ai
      .command('classify')
      .description('Classify content against provided labels')
      .option('--source <source>', 'clipboard|stdin|file', 'clipboard')
      .option('--file <path>', 'File path when source=file')
      .option('--labels <labels>', 'Comma separated labels to classify against')
      .option('--provider <name>', 'Provider to use (default from config)')
      .option('--model <name>', 'Model identifier to request')
      .option('--copy', 'Copy AI output back to clipboard')
      .option('--out <file>', 'Write AI output to a file')
      .option('--json', 'Emit JSON with metadata to stdout')
      .option('--consent', 'Confirm consent for network providers')
      .option('--redact <rules>', 'Override redaction rules (comma separated)')
      .option('--no-redact', 'Disable redaction pre-processing')
      .option('--show-redacted', 'Print the redacted prompt preview')
      .option('--max-tokens <number>', 'Max tokens for the generated response')
      .option('--temperature <number>', 'Provider temperature setting')
      .option('--top-p <number>', 'Provider top-p setting')
      .option('--seed <number>', 'Provider seed setting')
      .option('--timeout <ms>', 'Request timeout in milliseconds')
      .action(async (options) => {
        await this.handleAiClassify(options)
      })

    ai
      .command('transform')
      .description('Transform content with an AI instruction')
      .option('--source <source>', 'clipboard|stdin|file', 'clipboard')
      .option('--file <path>', 'File path when source=file')
      .option('--instruction <text>', 'Instruction describing the transformation')
      .option('--provider <name>', 'Provider to use (default from config)')
      .option('--model <name>', 'Model identifier to request')
      .option('--copy', 'Copy AI output back to clipboard')
      .option('--out <file>', 'Write AI output to a file')
      .option('--json', 'Emit JSON with metadata to stdout')
      .option('--consent', 'Confirm consent for network providers')
      .option('--redact <rules>', 'Override redaction rules (comma separated)')
      .option('--no-redact', 'Disable redaction pre-processing')
      .option('--show-redacted', 'Print the redacted prompt preview')
      .option('--max-tokens <number>', 'Max tokens for the generated response')
      .option('--temperature <number>', 'Provider temperature setting')
      .option('--top-p <number>', 'Provider top-p setting')
      .option('--seed <number>', 'Provider seed setting')
      .option('--timeout <ms>', 'Request timeout in milliseconds')
      .action(async (options) => {
        await this.handleAiTransform(options)
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
      .option('--search <query>', 'Search history by preview/content')
      .option('--body', 'Search includes full content')
      .option('--tag-add <id>', 'Add tags to a history item by id')
      .option('--tag-remove <id>', 'Remove tags from a history item by id')
      .option('--tags <csv>', 'Comma separated tags for tag operations')
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

    // Snippet subcommands
    const snippet = this.program.command('snippet').description('Manage snippets')
    snippet
      .command('add')
      .description('Create or update a snippet')
      .argument('<name>', 'Snippet name (e.g., code/log)')
      .option('--text <text>', 'Snippet text content')
      .option('--from <file>', 'Read content from file')
      .action(async (name, options) => { await this.handleSnippetAdd(name, options) })
    snippet
      .command('copy')
      .description('Copy snippet to clipboard')
      .argument('<name>', 'Snippet name')
      .action(async (name) => { await this.handleSnippetCopy(name) })
    snippet
      .command('list')
      .description('List snippets')
      .action(async () => { await this.handleSnippetList() })
    snippet
      .command('delete')
      .description('Delete a snippet')
      .argument('<name>', 'Snippet name')
      .action(async (name) => { await this.handleSnippetDelete(name) })

    // Template subcommands
    const template = this.program.command('template').description('Manage templates')
    template
      .command('save')
      .description('Save a template from file or clipboard')
      .argument('<name>', 'Template name (e.g., pr/desc)')
      .option('--from <file>', 'Read content from file')
      .option('--from-clipboard', 'Use current clipboard content')
      .action(async (name, options) => { await this.handleTemplateSave(name, options) })
    template
      .command('use')
      .description('Render a template and output/copy')
      .argument('<name>', 'Template name')
      .option('--vars <kvs...>', 'Variables as key=value pairs')
      .option('--auto', 'Auto-fill variables from env/system/git/clipboard')
      .option('--no-prompt', 'Do not prompt for missing required variables')
      .option('--copy', 'Copy rendered output to clipboard')
      .option('--out <file>', 'Write rendered output to file')
      .action(async (name, options) => { await this.handleTemplateUse(name, options) })
    template
      .command('list')
      .description('List templates')
      .option('--json', 'Output JSON details')
      .action(async (options) => { await this.handleTemplateList(options) })
    template
      .command('delete')
      .description('Delete a template')
      .argument('<name>', 'Template name')
      .action(async (name) => { await this.handleTemplateDelete(name) })

    // Unified search
    this.program
      .command('search')
      .description('Search history/templates/snippets')
      .argument('<query>', 'Search text')
      .option('--history', 'Search history')
      .option('--templates', 'Search templates')
      .option('--snippets', 'Search snippets')
      .option('--tag <t>', 'Filter by tag (library/history)')
      .option('--body', 'Include body (history)')
      .option('--json', 'Output JSON')
      .action(async (query, options) => { await this.handleSearch(query, options) })

    // Pick command (fzf integration with fallback)
    this.program
      .command('pick')
      .description('Interactive picker for templates/snippets')
      .option('--templates', 'Pick from templates')
      .option('--snippets', 'Pick from snippets')
      .action(async (options) => { await this.handlePick(options) })

    // Tag library items
    const tag = this.program.command('tag').description('Manage tags for templates/snippets')
    tag
      .command('add')
      .description('Add tags to a library item')
      .requiredOption('--type <type>', 'template|snippet')
      .argument('<name>', 'Item name')
      .argument('<tags>', 'Comma separated tags')
      .action(async (name, tags, opts) => { await this.handleTagAdd(opts.type, name, tags) })
    tag
      .command('remove')
      .description('Remove tags from a library item')
      .requiredOption('--type <type>', 'template|snippet')
      .argument('<name>', 'Item name')
      .argument('<tags>', 'Comma separated tags')
      .action(async (name, tags, opts) => { await this.handleTagRemove(opts.type, name, tags) })
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
        const extForDryRun = (() => {
          if (options.ext) return options.ext
          if (options.autoExtension) {
            if (contentType === 'image') {
              return this.fileHandler.getFileExtensionFromFormat(options.format || 'png')
            } else {
              return '.txt'
            }
          }
          return contentType === 'image' ? '.png' : '.txt'
        })()

        console.log(`Would paste ${contentType} content to:`,
          this.fileHandler.generateFilePath(
            options.output,
            options.filename,
            extForDryRun
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
          extension: options.ext || (options.autoExtension ? this.fileHandler.getFileExtensionFromFormat(options.format || imageData.format || 'png') : undefined),
          format: options.format,
          quality: parseInt(options.quality),
          resize: options.resize
        })
      } else {
        const textContent = await this.clipboardManager.readText()
        filePath = await this.fileHandler.saveText(textContent, {
          outputPath: options.output,
          filename: options.filename,
          extension: options.ext || (options.autoExtension ? this.fileHandler.chooseTextExtension(textContent) : undefined)
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

      if (options.decodeBase64 != null || options.encodeBase64 != null) {
        const chunks = []
        const readFromStdin = (process.stdin && process.stdin.isTTY === false)
        const getInput = async () => {
          if (readFromStdin) {
            return await new Promise((resolve) => {
              process.stdin.setEncoding('utf8')
              process.stdin.on('data', (c) => chunks.push(c))
              process.stdin.on('end', () => resolve(chunks.join('')))
            })
          }
          if (options.decodeBase64 != null) return String(options.decodeBase64)
          if (options.encodeBase64 != null) return options.encodeBase64 === true ? String(text || '') : String(options.encodeBase64)
          return ''
        }

        const input = await getInput()
        let transformed
        try {
          if (options.decodeBase64 != null) {
            const { base64Decode } = require('./utils/transform')
            transformed = base64Decode(input)
          } else {
            const { base64Encode } = require('./utils/transform')
            transformed = base64Encode(input)
          }
        } catch (e) {
          console.error(options.decodeBase64 != null ? 'Invalid base64 input' : 'Encoding error')
          process.exit(1)
        }

        await this.clipboardManager.writeText(transformed)
        if (isHeadless) {
          console.log(`Copied text to clipboard (${transformed.length} characters) (headless mode - simulated)`)
        } else {
          console.log(`Copied text to clipboard (${transformed.length} characters)`)
        }
        return
      }

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
        process.exit(0)
      }

      if (options.imageInfo) {
        const img = await this.clipboardManager.readImage()
        if (img && img.data) {
          const { imageMetadataFromBuffer } = require('./utils/transform')
          const meta = await imageMetadataFromBuffer(img.data)
          const payload = { format: img.format || meta.format, width: meta.width, height: meta.height, sizeBytes: meta.sizeBytes }
          const out = JSON.stringify(payload)
          if (options.raw) process.stdout.write(out)
          else console.log(out)
          return
        }
        // fallthrough to text if no image
      }

      const text = await this.clipboardManager.readText()
      let output = text

      if (options.jsonFormat) {
        const { jsonPretty } = require('./utils/transform')
        try {
          output = jsonPretty(text)
        } catch (e) {
          console.error('Invalid JSON input')
          process.exit(1)
        }
      } else if (options.urlDecode) {
        const { urlDecode } = require('./utils/transform')
        try {
          output = urlDecode(text)
        } catch (e) {
          console.error('Invalid URL-encoded input')
          process.exit(1)
        }
      } else if (options.urlEncode) {
        const { urlEncode } = require('./utils/transform')
        output = urlEncode(text)
      } else if (options.base64) {
        const { base64Encode } = require('./utils/transform')
        output = base64Encode(text)
      }

      if (options.raw) process.stdout.write(output)
      else console.log(output)
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
      if (options.tagAdd || options.tagRemove) {
        const tags = (options.tags || '').split(',').map(s => s.trim()).filter(Boolean)
        if (!tags.length) throw new Error('No tags provided. Use --tags tag1,tag2')
        if (options.tagAdd) {
          const updated = await history.addTags(options.tagAdd, tags)
          console.log(`Tags now on ${options.tagAdd}: ${updated.join(',')}`)
          return
        }
        if (options.tagRemove) {
          const updated = await history.removeTags(options.tagRemove, tags)
          console.log(`Tags now on ${options.tagRemove}: ${updated.join(',')}`)
          return
        }
      }

      if (options.search) {
        const items = await history.search(options.search, { tag: options.tag, body: !!options.body })
        if (!items.length) { console.log('No matches'); return }
        for (const item of items) {
          const preview = item.preview && item.preview.length > 60 ? item.preview.slice(0, 60) + '…' : item.preview
          const tagStr = Array.isArray(item.tags) && item.tags.length ? ` [${item.tags.join(',')}]` : ''
          console.log(`${item.id}  ${item.ts}  len=${item.len}  sha=${item.sha256.slice(0, 8)}  ${JSON.stringify(preview)}${tagStr}`)
        }
        return
      }

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

  async handleSnippetAdd (name, options) {
    try {
      let content = options.text
      if (options.from) {
        const fs = require('fs')
        content = fs.readFileSync(options.from, 'utf8')
      }
      if (!content) throw new Error('Provide --text or --from <file>')
      const p = await this.library.addSnippet(name, content)
      console.log(`Saved snippet to: ${p}`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleSnippetCopy (name) {
    try {
      const snip = await this.library.getSnippet(name)
      await this.clipboardManager.writeText(snip.content)
      console.log(`Copied snippet '${name}' to clipboard`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleSnippetList () {
    const list = await this.library.listSnippets()
    if (!list.length) { console.log('No snippets found'); return }
    for (const item of list) console.log(item.name)
  }

  async handleSnippetDelete (name) {
    try {
      await this.library.deleteSnippet(name)
      console.log(`Deleted snippet '${name}'`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleTemplateSave (name, options) {
    try {
      let content = ''
      if (options.from) {
        const fs = require('fs')
        content = fs.readFileSync(options.from, 'utf8')
      } else if (options.fromClipboard) {
        content = await this.clipboardManager.readText()
      } else {
        throw new Error('Provide --from <file> or --from-clipboard')
      }
      const p = await this.library.saveTemplate(name, content)
      console.log(`Saved template to: ${p}`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  parseKeyVals (arr = []) {
    const out = {}
    for (const kv of arr) {
      const idx = kv.indexOf('=')
      if (idx === -1) continue
      const k = kv.slice(0, idx)
      const v = kv.slice(idx + 1)
      out[k] = v
    }
    return out
  }

  async handleTemplateUse (name, options) {
    try {
      const { parseFrontMatter } = require('./utils/template')
      const { getAutoVars } = require('./utils/autovars')
      const t = await this.library.getTemplate(name)
      const { meta, body } = parseFrontMatter(t.content)
      const vars = this.parseKeyVals(options.vars)
      if (options.auto) {
        const auto = await getAutoVars({ clipboardManager: this.clipboardManager })
        Object.assign(vars, auto)
      }
      // Check required
      const required = Array.isArray(meta.required) ? meta.required : []
      let missing = required.filter(k => vars[k] == null || vars[k] === '')
      if (missing.length) {
        if (options.prompt === false) {
          throw new Error(`Missing required variables: ${missing.join(', ')}`)
        }
        if (!process.stdin.isTTY) {
          throw new Error(`Missing required variables (non-interactive): ${missing.join(', ')}`)
        }
        const readline = require('readline')
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        const ask = (q) => new Promise(resolve => rl.question(q, ans => resolve(ans)))
        for (const key of missing) {
          const val = await ask(`${key}: `)
          vars[key] = val
        }
        rl.close()
        missing = required.filter(k => vars[k] == null || vars[k] === '')
        if (missing.length) {
          throw new Error(`Missing required variables: ${missing.join(', ')}`)
        }
      }
      const rendered = renderTemplate(body, vars)
      if (options.out) {
        const fs = require('fs')
        require('fs').mkdirSync(require('path').dirname(options.out), { recursive: true })
        fs.writeFileSync(options.out, rendered, 'utf8')
        console.log(`Wrote rendered template to: ${options.out}`)
        return
      }
      if (options.copy) {
        await this.clipboardManager.writeText(rendered)
        console.log(`Copied rendered template '${name}' to clipboard`)
        return
      }
      process.stdout.write(rendered)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleTemplateList (options = {}) {
    const list = await this.library.listTemplates()
    if (!list.length) { console.log('No templates found'); return }
    if (options.json) {
      const out = []
      const { parseFrontMatter } = require('./utils/template')
      const fs = require('fs')
      const idx = await this.library._loadIndex('template')
      for (const item of list) {
        let meta = {}
        try { const txt = fs.readFileSync(item.path, 'utf8'); meta = parseFrontMatter(txt).meta || {} } catch {}
        const idxTags = (idx[item.name] && Array.isArray(idx[item.name].tags)) ? idx[item.name].tags : []
        const tags = Array.from(new Set([...(meta.tags || []), ...idxTags]))
        out.push({ name: item.name, tags, description: meta.description || '' })
      }
      process.stdout.write(JSON.stringify(out))
      return
    }
    const { parseFrontMatter } = require('./utils/template')
    const fs = require('fs')
    const idx = await this.library._loadIndex('template')
    for (const item of list) {
      let line = item.name
      try {
        const txt = fs.readFileSync(item.path, 'utf8')
        const { meta } = parseFrontMatter(txt)
        const desc = meta.description
        const fmTags = Array.isArray(meta.tags) ? meta.tags : []
        const idxTags = (idx[item.name] && Array.isArray(idx[item.name].tags)) ? idx[item.name].tags : []
        const tags = Array.from(new Set([...fmTags, ...idxTags]))
        if (desc) line += ` - ${desc}`
        if (tags.length) line += ` [${tags.join(',')}]`
      } catch {}
      console.log(line)
    }
  }

  async handleTemplateDelete (name) {
    try {
      await this.library.deleteTemplate(name)
      console.log(`Deleted template '${name}'`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleSearch (query, options) {
    try {
      const targets = {
        history: !!options.history,
        templates: !!options.templates,
        snippets: !!options.snippets
      }
      if (!targets.history && !targets.templates && !targets.snippets) targets.history = true

      const results = { history: [], templates: [], snippets: [] }
      if (targets.history) {
        const history = new HistoryStore({})
        const items = await history.search(query, { tag: options.tag, body: !!options.body })
        results.history = items
        if (!options.json) {
          for (const item of items) {
            const preview = item.preview && item.preview.length > 60 ? item.preview.slice(0, 60) + '…' : item.preview
            const tagStr = Array.isArray(item.tags) && item.tags.length ? ` [${item.tags.join(',')}]` : ''
            console.log(`[history] ${item.id} ${item.ts} ${JSON.stringify(preview)}${tagStr}`)
          }
        }
      }
      if (targets.templates) {
        const res = await this.library.search({ query, tag: options.tag, target: 'templates', body: !!options.body })
        results.templates = res
        if (!options.json) for (const r of res) console.log(`[template] ${r.name}${r.tags.length ? ' [' + r.tags.join(',') + ']' : ''}`)
      }
      if (targets.snippets) {
        const res = await this.library.search({ query, tag: options.tag, target: 'snippets', body: !!options.body })
        results.snippets = res
        if (!options.json) for (const r of res) console.log(`[snippet] ${r.name}${r.tags.length ? ' [' + r.tags.join(',') + ']' : ''}`)
      }
      if (options.json) {
        process.stdout.write(JSON.stringify(results))
      }
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handlePick (options) {
    const target = options.templates ? 'templates' : 'snippets'
    const list = await this.library.search({ query: '', target })
    if (!list.length) { console.log(`No ${target} found`); return }
    // Try fzf only in interactive TTY
    const { spawnSync } = require('child_process')
    try {
      if (process.stdin.isTTY && process.stdout.isTTY) {
        const isWin = process.platform === 'win32'
        let args = ['--height', '80%', '--layout=reverse', '--border']
        let input
        if (!isWin && options.preview !== false) {
          input = list.map(i => `${i.name}\t${i.path}`).join('\n')
          const preview = 'p=$(printf %s {} | cut -f2); sed -n 1,120p "$p"'
          args = args.concat(['--with-nth', '1', '--delimiter', '\t', '--preview', preview])
        } else {
          input = list.map(i => i.name).join('\n')
        }
        const res = spawnSync('fzf', args, { input, encoding: 'utf8' })
        const selLine = (res.stdout || '').trim()
        if (selLine) {
          const name = selLine.includes('\t') ? selLine.split('\t')[0] : selLine
          console.log(name)
          return
        }
      }
    } catch {}
    // Fallback simple menu
    if (!process.stdin.isTTY) {
      console.log(list.map((i, idx) => `${idx + 1}. ${i.name}`).join('\n'))
      return
    }
    console.log('Select an item:')
    list.forEach((i, idx) => console.log(`${idx + 1}. ${i.name}`))
    process.stdout.write('Enter number: ')
    await new Promise((resolve) => {
      process.stdin.once('data', (buf) => {
        const n = parseInt(String(buf).trim(), 10)
        if (Number.isInteger(n) && n >= 1 && n <= list.length) console.log(list[n - 1].name)
        if (typeof process.stdin.pause === 'function') process.stdin.pause()
        resolve()
      })
    })
  }

  async handleTagAdd (type, name, tagsCsv) {
    try {
      const tags = tagsCsv.split(',').map(s => s.trim()).filter(Boolean)
      if (!tags.length) throw new Error('Provide at least one tag')
      const updated = await this.library.addTags(type === 'template' ? 'template' : 'snippet', name, tags)
      console.log(`Tags now on ${type} '${name}': ${updated.join(',')}`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleTagRemove (type, name, tagsCsv) {
    try {
      const tags = tagsCsv.split(',').map(s => s.trim()).filter(Boolean)
      const updated = await this.library.removeTags(type === 'template' ? 'template' : 'snippet', name, tags)
      console.log(`Tags now on ${type} '${name}': ${updated.join(',')}`)
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  parseIntegerOption (value) {
    if (value === undefined || value === null || value === '') return undefined
    const num = parseInt(value, 10)
    return Number.isNaN(num) ? undefined : num
  }

  parseFloatOption (value) {
    if (value === undefined || value === null || value === '') return undefined
    const num = parseFloat(value)
    return Number.isNaN(num) ? undefined : num
  }

  async readAiSource (options = {}) {
    const source = (options.source || 'clipboard').toLowerCase()
    if (source === 'clipboard') {
      const hasContent = await this.clipboardManager.hasContent()
      if (!hasContent) throw new Error('Clipboard is empty')
      const type = await this.clipboardManager.getContentType()
      if (type !== 'text') throw new Error('Clipboard does not contain text content')
      return await this.clipboardManager.readText()
    }
    if (source === 'stdin') {
      if (process.stdin.isTTY) {
        throw new Error('No stdin content available. Pipe input or use --source clipboard|file.')
      }
      return await new Promise((resolve, reject) => {
        const chunks = []
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => chunks.push(chunk))
        process.stdin.on('end', () => resolve(chunks.join('')))
        process.stdin.on('error', reject)
      })
    }
    if (source === 'file') {
      if (!options.file) throw new Error('Provide --file <path> when using file source')
      const filePath = path.resolve(options.file)
      return await fsp.readFile(filePath, 'utf8')
    }
    throw new Error(`Unknown source '${options.source}'`)
  }

  extractProviderOptions (options = {}) {
    return {
      maxTokens: this.parseIntegerOption(options.maxTokens),
      temperature: this.parseFloatOption(options.temperature),
      topP: this.parseFloatOption(options.topP),
      seed: this.parseIntegerOption(options.seed),
      timeout: this.parseIntegerOption(options.timeout)
    }
  }

  async prepareRedaction (text, options = {}) {
    const rules = typeof options.redact === 'string' ? options.redact : undefined
    const result = await this.aiManager.applyRedaction(text, { enabled: options.redact !== false, rules })
    return result
  }

  async outputAiResult (result, options = {}, context = {}) {
    const payload = {
      content: result.text,
      meta: result.meta,
      redaction: {
        appliedRules: (context.redaction && context.redaction.appliedRules) || [],
        redactions: (context.redaction && context.redaction.redactions) || [],
        preview: options.showRedacted ? (context.redaction && context.redaction.text) : undefined
      }
    }
    if (options.json) {
      process.stdout.write(JSON.stringify(payload))
    } else {
      const text = result.text || ''
      process.stdout.write(text)
      if (!text.endsWith('\n')) process.stdout.write('\n')
    }
    const notify = options.json ? console.error : console.log
    if (options.copy) {
      await this.clipboardManager.writeText(result.text || '')
      notify('Copied AI output to clipboard')
    }
    if (options.out) {
      const outPath = path.resolve(options.out)
      await fsp.mkdir(path.dirname(outPath), { recursive: true })
      await fsp.writeFile(outPath, result.text || '', 'utf8')
      notify(`Wrote AI output to: ${outPath}`)
    }
  }

  async runAiCommand (task, options, promptFactory) {
    try {
      const input = await this.readAiSource(options)
      const redaction = await this.prepareRedaction(input, options)
      if (options.showRedacted && redaction && typeof redaction.text === 'string') {
        console.log('Redacted prompt preview:')
        console.log(redaction.text)
      }
      const providerOpts = this.extractProviderOptions(options)
      const prompt = promptFactory(redaction.text, providerOpts)
      const result = await this.aiManager.runPrompt({
        prompt,
        provider: options.provider,
        model: options.model,
        consent: !!options.consent,
        maxTokens: providerOpts.maxTokens,
        temperature: providerOpts.temperature,
        topP: providerOpts.topP,
        seed: providerOpts.seed,
        timeout: providerOpts.timeout,
        raw: !!options.json
      })
      await this.outputAiResult(result, options, { redaction, task })
    } catch (e) {
      console.error('Error:', e.message)
      process.exit(1)
    }
  }

  async handleAiSummarize (options) {
    await this.runAiCommand('summarize', options, (text, providerOpts) => makeSummarizePrompt(text, { maxTokens: providerOpts.maxTokens }))
  }

  async handleAiClassify (options) {
    const labelsCsv = options.labels || ''
    const labels = labelsCsv.split(',').map(s => s.trim()).filter(Boolean)
    await this.runAiCommand('classify', options, (text) => makeClassifyPrompt(text, labels))
  }

  async handleAiTransform (options) {
    await this.runAiCommand('transform', options, (text) => makeTransformPrompt(text, options.instruction))
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
