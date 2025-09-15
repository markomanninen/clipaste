const fs = require('fs').promises
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const sharp = require('sharp')
const { parseResizeSpec, extensionForTextContent } = require('./utils/transform')

class FileHandler {
  constructor () {
    this.defaultTextExtension = '.txt'
    this.defaultImageExtension = '.png'
  }

  async saveText (content, options = {}) {
    const {
      outputPath,
      filename,
      extension = this.defaultTextExtension
    } = options

    const filePath = this.generateFilePath(outputPath, filename, extension)

    try {
      await this.ensureDirectoryExists(path.dirname(filePath))
      await fs.writeFile(filePath, content, 'utf8')
      return filePath
    } catch (error) {
      throw new Error(`Failed to save text file: ${error.message}`)
    }
  }

  async saveImage (imageData, options = {}) {
    const {
      outputPath,
      filename,
      extension,
      format = 'png',
      quality = 90,
      resize
    } = options

    const imageExtension = extension || `.${format}`
    const filePath = this.generateFilePath(outputPath, filename, imageExtension)

    try {
      await this.ensureDirectoryExists(path.dirname(filePath))

      let processedData = imageData

      // If it's a Buffer, process with sharp
      if (Buffer.isBuffer(imageData)) {
        let sharpInstance = sharp(imageData)

        // Apply optional resize if provided
        if (resize) {
          const resizeOpts = typeof resize === 'string' ? parseResizeSpec(resize) : resize
          if (resizeOpts && (resizeOpts.width || resizeOpts.height)) {
            sharpInstance = sharpInstance.resize({
              width: resizeOpts.width,
              height: resizeOpts.height,
              fit: 'inside',
              withoutEnlargement: true
            })
          }
        }

        switch (format.toLowerCase()) {
          case 'jpeg':
          case 'jpg':
            processedData = await sharpInstance.jpeg({ quality }).toBuffer()
            break
          case 'png':
            processedData = await sharpInstance.png().toBuffer()
            break
          case 'webp':
            processedData = await sharpInstance.webp({ quality }).toBuffer()
            break
          default:
            processedData = await sharpInstance.png().toBuffer()
        }
      }

      await fs.writeFile(filePath, processedData)
      return filePath
    } catch (error) {
      throw new Error(`Failed to save image file: ${error.message}`)
    }
  }

  chooseTextExtension (text) {
    return extensionForTextContent(text) || this.defaultTextExtension
  }

  generateFilePath (outputPath, filename, extension) {
    const dir = outputPath || process.cwd()

    if (filename) {
      const hasExtension = path.extname(filename)
      const finalFilename = hasExtension ? filename : filename + extension
      return path.join(dir, finalFilename)
    }

    // Generate unique filename with timestamp and UUID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const shortId = uuidv4().split('-')[0]
    const generatedFilename = `clipboard-${timestamp}-${shortId}${extension}`

    return path.join(dir, generatedFilename)
  }

  async ensureDirectoryExists (dirPath) {
    try {
      await fs.access(dirPath)
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true })
      } else {
        throw error
      }
    }
  }

  async fileExists (filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  getFileExtensionFromFormat (format) {
    const formatMap = {
      jpeg: '.jpg',
      jpg: '.jpg',
      png: '.png',
      gif: '.gif',
      bmp: '.bmp',
      webp: '.webp'
    }

    return formatMap[format.toLowerCase()] || '.png'
  }

  async getFileStats (filePath) {
    try {
      const stats = await fs.stat(filePath)
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      }
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error.message}`)
    }
  }
}

module.exports = FileHandler
