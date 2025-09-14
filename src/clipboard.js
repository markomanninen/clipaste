const clipboardy = require('clipboardy').default

class ClipboardManager {
  async hasContent () {
    try {
      const content = await clipboardy.read()
      return content != null && content.length > 0
    } catch (error) {
      throw new Error(`Failed to read clipboard: ${error.message}`)
    }
  }

  async readText () {
    try {
      const content = await clipboardy.read()
      return content
    } catch (error) {
      throw new Error(`Failed to read text from clipboard: ${error.message}`)
    }
  }

  async writeText (content) {
    try {
      await clipboardy.write(content)
      return true
    } catch (error) {
      throw new Error(`Failed to write text to clipboard: ${error.message}`)
    }
  }

  async clear () {
    try {
      await clipboardy.write('')
      return true
    } catch (error) {
      throw new Error(`Failed to clear clipboard: ${error.message}`)
    }
  }

  async readImage () {
    try {
      const content = await clipboardy.read()

      // Check if content looks like base64 image data
      if (this.isBase64Image(content)) {
        return this.parseBase64Image(content)
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
      const content = await clipboardy.read()

      if (!content || content.length === 0) {
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
