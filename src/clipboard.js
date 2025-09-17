// clipboardy v3+ is ESM-only. In a CommonJS project we must use dynamic import().
// We'll lazy load it once and cache the reference.
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

let _clipboardyPromise = null
let _injectedClipboardy = null // for tests / dependency injection

const { isHeadlessEnvironment } = require('./utils/environment')

async function getClipboardy () {
  if (_injectedClipboardy) return _injectedClipboardy
  if (!_clipboardyPromise) {
    _clipboardyPromise = import('clipboardy')
      .then(mod => mod.default || mod)
      .catch(err => {
        throw new Error(`Failed to load clipboardy: ${err.message}`)
      })
  }
  return _clipboardyPromise
}

class ClipboardManager {
  constructor () {
    this.isWindows = process.platform === 'win32'
  }

  // Windows-specific method to check clipboard content using PowerShell
  async checkWindowsClipboard () {
    if (!this.isWindows) return null

    return new Promise((resolve) => {
      // Create a temporary PowerShell script file to avoid command line escaping issues
      const tempScript = path.join(os.tmpdir(), `clipaste-check-${Date.now()}.ps1`)
      const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
$clipboard = [System.Windows.Forms.Clipboard]::GetDataObject()
if ($null -eq $clipboard) {
    Write-Output "empty"
} elseif ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Bitmap)) {
    Write-Output "image"
} elseif ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Text)) {
    Write-Output "text"
} else {
    Write-Output "unknown"
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
      setTimeout(() => {
        ps.kill()
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
        } catch (e) { /* ignore */ }
        resolve(null)
      }, 5000)
    })
  }

  // macOS-specific method to check clipboard content using AppleScript
  async checkMacClipboard () {
    if (process.platform !== 'darwin') return null

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
      setTimeout(() => {
        osascript.kill()
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
      const clipboardy = await getClipboardy()
      // Retry a few times in case of transient empty clipboard on some platforms (e.g., Windows or older Node versions)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const content = await clipboardy.read()
          if (content != null && content.trim().length > 0) return true
        } catch (error) {
          // On Windows, if clipboardy fails but we detected content via PowerShell, return true
          if (this.isWindows && (error.message.includes('Element not found') || error.message.includes('Elementtiä ei löydy'))) {
            const winType = await this.checkWindowsClipboard()
            if (winType === 'image' || winType === 'text') return true
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
        if (macType === 'image') return true
        if (macType === 'text') {
          // Double-check if the text content is actually meaningful
          try {
            const content = await clipboardy.read()
            return content != null && content.trim().length > 0
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

    try {
      const clipboardy = await getClipboardy()
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const content = await clipboardy.read()
          if (content != null && content.length > 0) return content
        } catch (error) {
          // On Windows, if clipboardy fails with the specific error, check if it's actually an image
          if (this.isWindows && (error.message.includes('Element not found') || error.message.includes('Elementtiä ei löydy'))) {
            const winType = await this.checkWindowsClipboard()
            if (winType === 'image') {
              throw new Error('Clipboard contains image data, not text. Use readImage() instead.')
            }
            if (winType === 'empty') {
              return ''
            }
          }
          // Re-throw other errors on final attempt
          if (attempt === 2) throw error
        }
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 15))
      }
      // Return empty string if still empty to preserve existing semantics for empty clipboard
      return ''
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
      await clipboardy.write(content)
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
      await clipboardy.write('')
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
        if (hasErrored || code !== 0 || !output.includes('success')) {
          resolve(false)
        } else {
          resolve(true)
        }
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        osascript.kill()
        resolve(false)
      }, 5000)
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
        return await this.writeMacImage(imagePath)
      } else if (this.isWindows) {
        // TODO: Implement Windows image writing
        throw new Error('Windows image-to-clipboard functionality not yet implemented')
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
          resolve(null)
        } else {
          try {
            // Read the saved image file
            if (fs.existsSync(tempPath)) {
              const buffer = fs.readFileSync(tempPath)
              fs.unlinkSync(tempPath) // Clean up
              resolve({
                format: 'png',
                data: buffer
              })
            } else {
              resolve(null)
            }
          } catch (error) {
            resolve(null)
          }
        }
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        ps.kill()
        try {
          if (fs.existsSync(tempScript)) {
            fs.unlinkSync(tempScript)
          }
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        } catch (e) { /* ignore */ }
        resolve(null)
      }, 10000)
    })
  }

  // macOS-specific method to read image from clipboard using AppleScript
  async readMacImage () {
    if (process.platform !== 'darwin') return null

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
          resolve(null)
          return
        }

        if (trimmedOutput === 'no-image') {
          cleanupTempFile()
          resolve(null)
          return
        }

        if (!trimmedOutput.startsWith('success:')) {
          cleanupTempFile()
          resolve(null)
          return
        }

        const format = trimmedOutput.split(':')[1] || 'png'

        try {
          if (fs.existsSync(tempPath)) {
            const buffer = fs.readFileSync(tempPath)
            cleanupTempFile()
            resolve({
              format,
              data: buffer
            })
            return
          }
        } catch (error) {
          cleanupTempFile()
          resolve(null)
          return
        }

        cleanupTempFile()
        resolve(null)
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        osascript.kill()
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        } catch (e) { /* ignore */ }
        resolve(null)
      }, 10000)
    })
  }

  async readImage () {
    try {
      const clipboardy = await getClipboardy()
      let content
      try {
        content = await clipboardy.read()
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
      const clipboardy = await getClipboardy()
      let content
      try {
        content = await clipboardy.read()
      } catch (error) {
        // On Windows, if clipboardy fails but we detected image content, return image
        if (this.isWindows && (error.message.includes('Element not found') || error.message.includes('Elementtiä ei löydy'))) {
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
        return 'empty'
      }

      if (this.isBase64Image(content)) {
        return 'image'
      }

      // Check if content looks like binary data
      if (this.isBinaryData(content)) {
        return 'binary'
      }

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
