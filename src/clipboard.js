// clipboardy v3+ is ESM-only. In a CommonJS project we use dynamic import() and cache the promise.
const { spawn } = require('child_process')
const { performance } = require('perf_hooks')
const path = require('path')
const fs = require('fs')
const os = require('os')

let _clipboardyPromise = null
let _injectedClipboardy = null // test injection / mocking

// Dynamic phase profiling toggle
let _phaseEnabledFlag = !!process.env.CLIPASTE_PHASE_PROF
function phaseEnabled () { return _phaseEnabledFlag }
function enablePhaseProfiling () { _phaseEnabledFlag = true }
function disablePhaseProfiling () { _phaseEnabledFlag = false }
const _phaseStats = {}
function _recordPhase (name, dur) {
  if (!phaseEnabled()) return
  const s = (_phaseStats[name] = _phaseStats[name] || { total: 0, count: 0 })
  s.total += dur
  s.count += 1
}

const { isHeadlessEnvironment } = require('./utils/environment')

async function getClipboardy () {
  if (_injectedClipboardy) return _injectedClipboardy
  const start = phaseEnabled() ? performance.now() : 0
  if (!_clipboardyPromise) {
    _clipboardyPromise = import('clipboardy')
      .then(mod => mod.default || mod)
      .catch(err => {
        throw new Error(`Failed to load clipboardy: ${err.message}`)
      })
  }
  const result = await _clipboardyPromise
  if (phaseEnabled()) _recordPhase('clipboardy.load', performance.now() - start)
  return result
}

class ClipboardManager {
  constructor () {
    this.isWindows = process.platform === 'win32'
    this._snapshot = null
    this._snapshotTime = 0
    this._snapshotTTL = parseInt(process.env.CLIPASTE_SNAPSHOT_TTL || '10', 10)
  }

  _cacheEnabled () { return !process.env.CLIPASTE_CACHE_DISABLE }
  _testMode () { return process.env.NODE_ENV === 'test' }
  _snapshotValid () {
    if (!this._cacheEnabled() || this._testMode()) return false
    if (!this._snapshot) return false
    return (performance.now() - this._snapshotTime) <= this._snapshotTTL
  }

  _invalidateSnapshot () { this._snapshot = null; this._snapshotTime = 0 }

  _updateSnapshot (raw, typeHint) {
    if (!this._cacheEnabled()) return
    const s = (typeof raw === 'string') ? raw : ''
    const trimmed = s.trim()
    const isEmpty = !trimmed
    let type = typeHint
    if (!type) {
      if (isEmpty) type = 'empty'
      else if (this.isBase64Image(s)) type = 'image'
      else if (this.isBinaryData(s)) type = 'binary'
      else type = 'text'
    }
    this._snapshot = { raw: s, isEmpty, type }
    this._snapshotTime = performance.now()
  }

  getSnapshot () { return this._snapshotValid() ? this._snapshot : null }

  // Windows-specific method to check clipboard content using PowerShell
  async checkWindowsClipboard () {
    if (!this.isWindows) return null
    const outerStart = phaseEnabled() ? performance.now() : 0
    return new Promise((resolve) => {
      // Create a temporary PowerShell script file to avoid command line escaping issues
      const tempScript = path.join(os.tmpdir(), `clipaste-check-${Date.now()}.ps1`)
      const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
$clipboard = [System.Windows.Forms.Clipboard]::GetDataObject()
if ($null -eq $clipboard) {
    Write-Output "empty"
} else {
    $formats = $clipboard.GetFormats()
    if ($formats.Count -eq 0) {
        Write-Output "empty"
    } elseif ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Bitmap)) {
        Write-Output "image"
    } elseif ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Text)) {
        $text = $clipboard.GetData([System.Windows.Forms.DataFormats]::Text)
        if ([string]::IsNullOrWhiteSpace($text)) {
            Write-Output "empty"
        } else {
            Write-Output "text"
        }
    } else {
        Write-Output "unknown"
    }
}`

      try {
        fs.writeFileSync(tempScript, scriptContent)
      } catch (error) {
        resolve(null)
        return
      }

      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        tempScript
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

      let output = ''
      let hasErrored = false

      ps.stdout.on('data', (data) => {
        output += data.toString()
      })

      ps.stderr.on('data', () => {
        hasErrored = true
      })

      ps.on('close', (code) => {
        clearTimeout(timeout)
        if (phaseEnabled()) _recordPhase('windows.check', performance.now() - outerStart)
        // Clean up temp script file
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
        } catch (e) { /* ignore */ }

        if (hasErrored || code !== 0) {
          resolve(null) // Fall back to clipboardy
        } else {
          resolve(output.trim())
        }
      })

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        ps.kill()
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
        } catch (e) { /* ignore */ }
        if (phaseEnabled()) _recordPhase('windows.check.timeout', performance.now() - outerStart)
        resolve(null)
      }, 5000)
    })
  }

  // macOS-specific method to check clipboard content using AppleScript
  async checkMacClipboard () {
    if (process.platform !== 'darwin') return null
    const outerStart = phaseEnabled() ? performance.now() : 0
    return new Promise((resolve) => {
      const osascript = spawn('osascript', ['-e', 'clipboard info'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let hasErrored = false

      osascript.stdout.on('data', (data) => {
        output += data.toString()
      })

      osascript.stderr.on('data', () => {
        hasErrored = true
      })

      osascript.on('close', (code) => {
        clearTimeout(timeout)
        if (phaseEnabled()) _recordPhase('mac.check', performance.now() - outerStart)
        if (hasErrored || code !== 0) {
          resolve(null)
        } else {
          const clipboardInfo = output.trim()
          if (!clipboardInfo) {
            resolve('empty')
          } else if (clipboardInfo.includes('picture') ||
                    clipboardInfo.includes('PNGf') ||
                    clipboardInfo.includes('JPEG') ||
                    clipboardInfo.includes('TIFF') ||
                    clipboardInfo.includes('GIF') ||
                    clipboardInfo.includes('BMP')) {
            resolve('image')
          } else {
            resolve('text')
          }
        }
      })

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        osascript.kill()
        if (phaseEnabled()) _recordPhase('mac.check.timeout', performance.now() - outerStart)
        resolve(null)
      }, 5000)
    })
  }

  async hasContent () {
    // In headless environments, simulate empty clipboard
    // For unit tests with injected dependencies, don't treat as headless
    if (isHeadlessEnvironment(!_injectedClipboardy)) {
      return false
    }

    try {
      if (this._snapshotValid()) return !this._snapshot.isEmpty
      const clipboardy = await getClipboardy()
      let lastContentRead = ''
      // Retry a few times in case of transient empty clipboard on some platforms (e.g., Windows or older Node versions)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const t0 = phaseEnabled() ? performance.now() : 0
          const content = await clipboardy.read()
          if (phaseEnabled()) _recordPhase('clipboardy.read', performance.now() - t0)
          lastContentRead = content || ''
          if (content != null && content.trim().length > 0) {
            this._updateSnapshot(content, 'text')
            return true
          }
        } catch (error) {
          // On Windows, if clipboardy fails but we detected content via PowerShell, return true
          if (this.isWindows && (
            error.message.includes('Element not found') ||
            error.message.includes('Elementtiä ei löydy') ||
            error.message.includes('Could not paste from clipboard') ||
            error.message.includes('thread \'main\' panicked')
          )) {
            const winType = await this.checkWindowsClipboard()
            if (winType === 'image' || winType === 'text') {
              this._updateSnapshot(lastContentRead, winType === 'image' ? 'image' : 'text')
              return true
            }
            if (winType === 'empty' || winType === null) {
              this._updateSnapshot(lastContentRead, 'empty')
              return false
            }
          }
          // Re-throw other errors on final attempt
          if (attempt === 2) throw error
        }
        // Small delay before retry unless last attempt
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 15))
      }

      // On macOS, if clipboardy returned empty, check if there's image content
      if (process.platform === 'darwin') {
        const macType = await this.checkMacClipboard()
        if (macType === 'image') { this._updateSnapshot('', 'image'); return true }
        if (macType === 'text') {
          // Double-check if the text content is actually meaningful
          try {
            const t0 = phaseEnabled() ? performance.now() : 0
            const content = await clipboardy.read()
            if (phaseEnabled()) _recordPhase('clipboardy.read', performance.now() - t0)
            const has = content != null && content.trim().length > 0
            this._updateSnapshot(content || '', has ? 'text' : 'empty')
            return has
          } catch {
            return false
          }
        }
      }

      return false
    } catch (error) {
      // In case of clipboard access errors, simulate empty clipboard in headless environments
      if (isHeadlessEnvironment(!_injectedClipboardy)) {
        return false
      }
      throw new Error(`Failed to read clipboard: ${error.message}`)
    }
  }

  async readText () {
    // In headless environments, return empty string
    if (isHeadlessEnvironment(!_injectedClipboardy)) {
      return ''
    }

    if (this._snapshotValid()) {
      if (this._snapshot.type === 'text' || this._snapshot.type === 'empty') {
        return this._snapshot.raw
      }
    }

    try {
      const clipboardy = await getClipboardy()
      let finalContent = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const t0 = phaseEnabled() ? performance.now() : 0
          const content = await clipboardy.read()
          if (phaseEnabled()) _recordPhase('clipboardy.read', performance.now() - t0)
          if (content != null && content.length > 0) {
            this._updateSnapshot(content, 'text')
            return content
          }
          finalContent = content || ''
        } catch (error) {
          // On Windows, if clipboardy fails with the specific error, check if it's actually an image or completely empty
          if (this.isWindows && (
            error.message.includes('Element not found') ||
            error.message.includes('Elementtiä ei löydy') ||
            error.message.includes('Could not paste from clipboard') ||
            error.message.includes('thread \'main\' panicked')
          )) {
            const winType = await this.checkWindowsClipboard()
            if (winType === 'image') { this._updateSnapshot('', 'image'); throw new Error('Clipboard contains image data, not text. Use readImage() instead.') }
            if (winType === 'empty' || winType === null) { this._updateSnapshot('', 'empty'); return '' }
          }
          // Re-throw other errors on final attempt
          if (attempt === 2) throw error
        }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 15))
      }
      // Return empty string if still empty to preserve existing semantics for empty clipboard
      this._updateSnapshot(finalContent || '', (finalContent && finalContent.trim()) ? 'text' : 'empty')
      return finalContent || ''
    } catch (error) {
      // In headless environments, return empty string instead of throwing
      if (isHeadlessEnvironment(!_injectedClipboardy)) {
        return ''
      }
      throw new Error(`Failed to read text from clipboard: ${error.message}`)
    }
  }

  async writeText (content) {
    // In headless environments, simulate successful write
    if (isHeadlessEnvironment(!_injectedClipboardy)) {
      return true
    }

    try {
      const clipboardy = await getClipboardy()
      const t0 = phaseEnabled() ? performance.now() : 0
      await clipboardy.write(content)
      if (phaseEnabled()) _recordPhase('clipboardy.write', performance.now() - t0)
      this._invalidateSnapshot()
      return true
    } catch (error) {
      // In headless environments, simulate successful write instead of throwing
      if (isHeadlessEnvironment(!_injectedClipboardy)) {
        return true
      }
      throw new Error(`Failed to write text to clipboard: ${error.message}`)
    }
  }

  async clear () {
    // In headless environments, simulate successful clear
    if (isHeadlessEnvironment(!_injectedClipboardy)) {
      return true
    }

    try {
      const clipboardy = await getClipboardy()
      const t0 = phaseEnabled() ? performance.now() : 0
      await clipboardy.write('')
      if (phaseEnabled()) _recordPhase('clipboardy.write', performance.now() - t0)
      this._invalidateSnapshot()
      return true
    } catch (error) {
      // In headless environments, simulate successful clear instead of throwing
      if (isHeadlessEnvironment(!_injectedClipboardy)) {
        return true
      }
      throw new Error(`Failed to clear clipboard: ${error.message}`)
    }
  }

  // macOS-specific method to write image to clipboard using AppleScript
  async writeMacImage (imagePath) {
    if (process.platform !== 'darwin') return null

    const outerStart = phaseEnabled() ? performance.now() : 0
    return new Promise((resolve) => {
      const osascript = spawn('osascript', [
        '-e',
        `try
          set imageFile to POSIX file "${imagePath}"
          set the clipboard to (read imageFile as picture)
          return "success"
        on error
          return "error"
        end try`
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

      let output = ''
      let hasErrored = false

      osascript.stdout.on('data', (data) => {
        output += data.toString()
      })

      osascript.stderr.on('data', () => {
        hasErrored = true
      })

      osascript.on('close', (code) => {
        clearTimeout(timeout)
        if (hasErrored || code !== 0 || !output.includes('success')) {
          if (phaseEnabled()) _recordPhase('mac.writeImage.fail', performance.now() - outerStart)
          resolve(false)
        } else {
          if (phaseEnabled()) _recordPhase('mac.writeImage', performance.now() - outerStart)
          resolve(true)
        }
      })

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        osascript.kill()
        if (phaseEnabled()) _recordPhase('mac.writeImage.timeout', performance.now() - outerStart)
        resolve(false)
      }, 5000)
    })
  }

  // Windows-specific method to write image to clipboard using PowerShell
  async writeWindowsImage (imagePath) {
    if (!this.isWindows) return null

    const outerStart = phaseEnabled() ? performance.now() : 0
    return new Promise((resolve) => {
      const tempScript = path.join(os.tmpdir(), `clipaste-write-image-${Date.now()}.ps1`)

      // Escape the path for PowerShell
      const escapedPath = imagePath.replace(/\\/g, '\\\\')

      const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
    $image = [System.Drawing.Image]::FromFile('${escapedPath}')
    [System.Windows.Forms.Clipboard]::SetImage($image)
    $image.Dispose()
    Write-Output "success"
} catch {
    Write-Output "error: $($_.Exception.Message)"
}`

      try {
        fs.writeFileSync(tempScript, scriptContent)
      } catch (error) {
        resolve(false)
        return
      }

      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        tempScript
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

      let output = ''
      let hasErrored = false

      ps.stdout.on('data', (data) => {
        output += data.toString()
      })

      ps.stderr.on('data', () => {
        hasErrored = true
      })

      ps.on('close', (code) => {
        clearTimeout(timeout)
        // Clean up temp script file
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
        } catch {}

        if (hasErrored || code !== 0 || !output.includes('success')) {
          if (phaseEnabled()) _recordPhase('windows.writeImage.fail', performance.now() - outerStart)
          resolve(false)
        } else {
          if (phaseEnabled()) _recordPhase('windows.writeImage', performance.now() - outerStart)
          resolve(true)
        }
      })

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        ps.kill()
        // Clean up temp script file
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
        } catch {}
        if (phaseEnabled()) _recordPhase('windows.writeImage.timeout', performance.now() - outerStart)
        resolve(false)
      }, 10000)
    })
  }

  async writeImage (imagePath) {
    // In headless environments, simulate successful write
    if (isHeadlessEnvironment(!_injectedClipboardy)) {
      return true
    }

    try {
      // Verify the file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`)
      }

      // Platform-specific implementation
      if (process.platform === 'darwin') {
        const ok = await this.writeMacImage(imagePath)
        if (ok) this._invalidateSnapshot()
        return ok
      } else if (this.isWindows) {
        const ok = await this.writeWindowsImage(imagePath)
        if (ok) this._invalidateSnapshot()
        return ok
      } else {
        // TODO: Implement Linux image writing
        throw new Error('Linux image-to-clipboard functionality not yet implemented')
      }
    } catch (error) {
      throw new Error(`Failed to write image to clipboard: ${error.message}`)
    }
  }

  // Windows-specific method to read image from clipboard using PowerShell
  async readWindowsImage () {
    if (!this.isWindows) return null

    const outerStart = phaseEnabled() ? performance.now() : 0
    return new Promise((resolve) => {
      const tempPath = path.join(os.tmpdir(), `clipaste-temp-${Date.now()}.png`)
      const tempScript = path.join(os.tmpdir(), `clipaste-image-${Date.now()}.ps1`)

      const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$clipboard = [System.Windows.Forms.Clipboard]::GetDataObject()
if ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Bitmap)) {
    $bitmap = $clipboard.GetData([System.Windows.Forms.DataFormats]::Bitmap)
    $bitmap.Save('${tempPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "success"
} else {
    Write-Output "no-image"
}`

      try {
        fs.writeFileSync(tempScript, scriptContent)
      } catch (error) {
        resolve(null)
        return
      }

      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        tempScript
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

      let output = ''
      let hasErrored = false

      ps.stdout.on('data', (data) => {
        output += data.toString()
      })

      ps.stderr.on('data', () => {
        hasErrored = true
      })

      ps.on('close', async (code) => {
        clearTimeout(timeout)
        // Clean up temp script file
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
        } catch (e) { /* ignore */ }

        if (hasErrored || code !== 0 || !output.includes('success')) {
          // Clean up temp image file if it exists
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath)
            }
          } catch (e) { /* ignore */ }
          if (phaseEnabled()) _recordPhase('windows.readImage.fail', performance.now() - outerStart)
          resolve(null)
        } else {
          try {
            // Read the saved image file
            if (fs.existsSync(tempPath)) {
              const buffer = fs.readFileSync(tempPath)
              fs.unlinkSync(tempPath) // Clean up
              if (phaseEnabled()) _recordPhase('windows.readImage', performance.now() - outerStart)
              resolve({
                format: 'png',
                data: buffer
              })
            } else {
              if (phaseEnabled()) _recordPhase('windows.readImage.missing', performance.now() - outerStart)
              resolve(null)
            }
          } catch (error) {
            if (phaseEnabled()) _recordPhase('windows.readImage.error', performance.now() - outerStart)
            resolve(null)
          }
        }
      })

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        ps.kill()
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        } catch (e) { /* ignore */ }
        if (phaseEnabled()) _recordPhase('windows.readImage.timeout', performance.now() - outerStart)
        resolve(null)
      }, 10000)
    })
  }

  // macOS-specific method to read image from clipboard using AppleScript
  async readMacImage () {
    if (process.platform !== 'darwin') return null

    const outerStart = phaseEnabled() ? performance.now() : 0
    return new Promise((resolve) => {
      const tempPath = path.join(os.tmpdir(), `clipaste-temp-${Date.now()}.img`)
      const escapedPath = tempPath.replace(/"/g, '\\"')
      const appleScript = `set tempPath to POSIX file "${escapedPath}"
set fileRef to missing value
set imageData to missing value
set formatLabel to ""
set formatPairs to {{"png", \u00ABclass PNGf\u00BB}, {"jpeg", \u00ABclass JPEG\u00BB}, {"gif", \u00ABclass GIFf\u00BB}, {"tiff", \u00ABclass TIFF\u00BB}, {"bmp", \u00ABclass BMPf\u00BB}}

repeat with pairItem in formatPairs
  set currentLabel to item 1 of pairItem
  set currentClass to item 2 of pairItem
  try
    set imageData to the clipboard as currentClass
    set formatLabel to currentLabel
    exit repeat
  on error
    set imageData to missing value
  end try
end repeat

if imageData is missing value then
  return "no-image"
end if

try
  set fileRef to open for access tempPath with write permission
  set eof of fileRef to 0
  write imageData to fileRef
  close access fileRef
  return "success:" & formatLabel
on error errMsg number errNum
  try
    if fileRef is not missing value then close access fileRef
  end try
  return "error:" & errMsg
end try`

      const osascript = spawn('osascript', [
        '-e',
        appleScript
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

      let output = ''
      let hasErrored = false

      osascript.stdout.on('data', (data) => {
        output += data.toString()
      })

      osascript.stderr.on('data', () => {
        hasErrored = true
      })

      osascript.on('close', (code) => {
        clearTimeout(timeout)
        const cleanupTempFile = () => {
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath)
            }
          } catch (e) { /* ignore */ }
        }

        const trimmedOutput = output.trim()

        if (hasErrored || code !== 0 || !trimmedOutput || trimmedOutput.startsWith('error')) {
          cleanupTempFile()
          if (phaseEnabled()) _recordPhase('mac.readImage.fail', performance.now() - outerStart)
          resolve(null)
          return
        }

        if (trimmedOutput === 'no-image') {
          cleanupTempFile()
          if (phaseEnabled()) _recordPhase('mac.readImage.noimage', performance.now() - outerStart)
          resolve(null)
          return
        }

        if (!trimmedOutput.startsWith('success:')) {
          cleanupTempFile()
          if (phaseEnabled()) _recordPhase('mac.readImage.unexpected', performance.now() - outerStart)
          resolve(null)
          return
        }

        const format = trimmedOutput.split(':')[1] || 'png'

        try {
          if (fs.existsSync(tempPath)) {
            const buffer = fs.readFileSync(tempPath)
            cleanupTempFile()
            if (phaseEnabled()) _recordPhase('mac.readImage', performance.now() - outerStart)
            resolve({
              format,
              data: buffer
            })
            return
          }
        } catch (error) {
          cleanupTempFile()
          if (phaseEnabled()) _recordPhase('mac.readImage.error', performance.now() - outerStart)
          resolve(null)
          return
        }

        cleanupTempFile()
        if (phaseEnabled()) _recordPhase('mac.readImage.missing', performance.now() - outerStart)
        resolve(null)
      })

      // Timeout after 10 seconds (cleared on close)
      const timeout = setTimeout(() => {
        osascript.kill()
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        } catch (e) { /* ignore */ }
        if (phaseEnabled()) _recordPhase('mac.readImage.timeout', performance.now() - outerStart)
        resolve(null)
      }, 10000)
    })
  }

  async readImage () {
    try {
      const clipboardy = await getClipboardy()
      let content
      try {
        const t0 = phaseEnabled() ? performance.now() : 0
        content = await clipboardy.read()
        if (phaseEnabled()) _recordPhase('clipboardy.read', performance.now() - t0)
      } catch (error) {
        // On Windows, if clipboardy fails but we know there's an image, try Windows method
        if (this.isWindows && (error.message.includes('Element not found') || error.message.includes('Elementtiä ei löydy'))) {
          const winImage = await this.readWindowsImage()
          if (winImage) return winImage
        }
        throw error
      }

      // Check if content looks like base64 image data
      if (this.isBase64Image(content)) {
        return this.parseBase64Image(content)
      }

      // On Windows, if we didn't get base64 image data, try the PowerShell approach
      if (this.isWindows) {
        const winType = await this.checkWindowsClipboard()
        if (winType === 'image') {
          const winImage = await this.readWindowsImage()
          if (winImage) return winImage
        }
      }

      // On macOS, if we didn't get base64 image data, try the AppleScript approach
      if (process.platform === 'darwin') {
        const macType = await this.checkMacClipboard()
        if (macType === 'image') {
          const macImage = await this.readMacImage()
          if (macImage) return macImage
        }
      }

      // For now, we'll focus on text content
      // Image clipboard support varies by platform and would need native bindings
      return null
    } catch (error) {
      throw new Error(`Failed to read image from clipboard: ${error.message}`)
    }
  }

  isBase64Image (content) {
    if (!content || typeof content !== 'string') return false

    // Check for data URL format (trim whitespace first)
    const dataUrlRegex = /^data:image\/(png|jpeg|jpg|gif|bmp|webp|svg);base64,/i
    return dataUrlRegex.test(content.trim())
  }

  parseBase64Image (content) {
    const match = content.trim().match(/^data:image\/(\w+);base64,(.+)$/)
    if (!match) return null

    try {
      // Validate base64 data
      const base64Data = match[2]

      // Basic base64 validation - should only contain valid base64 characters
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        return null
      }

      const buffer = Buffer.from(base64Data, 'base64')

      // Verify the buffer is not empty and has reasonable size
      if (buffer.length === 0) {
        return null
      }

      return {
        format: match[1],
        data: buffer
      }
    } catch (error) {
      // Invalid base64 data
      return null
    }
  }

  async getContentType () {
    try {
      // In test mode skip snapshot fast-path to avoid stale mocked sequence expectations
      if (this._snapshotValid() && !this._testMode()) return this._snapshot.type
      const clipboardy = await getClipboardy()
      let content
      try {
        const t0 = phaseEnabled() ? performance.now() : 0
        content = await clipboardy.read()
        if (phaseEnabled()) _recordPhase('clipboardy.read', performance.now() - t0)
      } catch (error) {
        // On Windows, if clipboardy fails with various clipboard errors, check via PowerShell
        if (this.isWindows && (
          error.message.includes('Element not found') ||
          error.message.includes('Elementtiä ei löydy') ||
          error.message.includes('Could not paste from clipboard') ||
          error.message.includes('thread \'main\' panicked')
        )) {
          const winType = await this.checkWindowsClipboard()
          if (winType === 'image') return 'image'
          if (winType === 'text') return 'text'
          if (winType === 'empty') return 'empty'
        }
        throw error
      }

      if (!content || content.trim().length === 0) {
        // On macOS, if clipboardy returned empty, check if there's image content
        if (process.platform === 'darwin') {
          const macType = await this.checkMacClipboard()
          if (macType === 'image') return 'image'
          if (macType === 'text') return 'text'
          if (macType === 'empty') return 'empty'
        }
        this._updateSnapshot(content || '', 'empty')
        return 'empty'
      }

      if (this.isBase64Image(content)) {
        this._updateSnapshot(content, 'image')
        return 'image'
      }

      // Check if content looks like binary data
      if (this.isBinaryData(content)) {
        this._updateSnapshot(content, 'binary')
        return 'binary'
      }

      this._updateSnapshot(content, 'text')
      return 'text'
    } catch (error) {
      throw new Error(`Failed to determine clipboard content type: ${error.message}`)
    }
  }

  isBinaryData (content) {
    if (typeof content !== 'string') return false

    // Simple heuristic: count null bytes and non-printable characters via char codes (avoids control chars in regex)
    let nullBytes = 0
    let nonPrintable = 0
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i)
      if (code === 0x00) nullBytes++
      if (
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0B ||
        code === 0x0C ||
        (code >= 0x0E && code <= 0x1F) ||
        (code >= 0x7F && code <= 0x9F)
      ) {
        nonPrintable++
      }
    }

    return nullBytes > content.length * 0.1 || nonPrintable > content.length * 0.3
  }
}

module.exports = ClipboardManager
module.exports.__setMockClipboardy = (mock) => { _injectedClipboardy = mock }
module.exports.getPhaseStats = (reset = false) => {
  if (!phaseEnabled()) return {}
  const out = {}
  for (const [k, v] of Object.entries(_phaseStats)) {
    out[k] = {
      count: v.count,
      totalMs: +v.total.toFixed(3),
      avgMs: +((v.total / v.count) || 0).toFixed(3)
    }
  }
  if (reset) {
    for (const k of Object.keys(_phaseStats)) delete _phaseStats[k]
  }
  return out
}
module.exports.enablePhaseProfiling = enablePhaseProfiling
module.exports.disablePhaseProfiling = disablePhaseProfiling
