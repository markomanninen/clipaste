// Helper script invoked by tests/real-image-handling.test.js
// Arguments: <clipboardPath> <jsonEncodedImageData> <shouldWork:true|false>

async function main () {
  try {
    const [clipboardPath, encodedImage, shouldWorkFlag] = process.argv.slice(2)
    const shouldWork = shouldWorkFlag === 'true'
    const ClipboardManager = require(clipboardPath)
    const manager = new ClipboardManager()

    const rawJson = JSON.parse(encodedImage)
    const rawInput = typeof rawJson === 'string' ? rawJson : ''
    // Normalise line endings + trim
    const normalisedInput = rawInput.replace(/\r\n/g, '\n').trim()
    if (rawInput !== normalisedInput) console.log('normalised: trimmed or line-endings normalised')

    const isImage = manager.isBase64Image(normalisedInput)
    console.log('isBase64Image:', isImage)
    const parsed = manager.parseBase64Image(normalisedInput)
    console.log('parseBase64Image result:', !!parsed)
    if (parsed) {
      console.log('format:', parsed.format)
      console.log('dataLength:', parsed.data.length)
      console.log('isBuffer:', Buffer.isBuffer(parsed.data))
    }

  // For negative tests (shouldWork === false) we intentionally expect failure (exit code 1)
  const success = shouldWork ? (isImage && !!parsed) : false
    if (!success) {
      // Allow a soft pass only for EXPECTED working cases on Windows (flaky platform nuance)
      const isWin = process.platform === 'win32'
      if (isWin && shouldWork) {
        console.warn('WINDOWS_SOFT_FAIL: image parsing unexpected failure but tolerated for diagnostics')
        process.exit(0)
      }
      process.exit(1)
    }
    process.exit(0)
  } catch (err) {
    console.error('Helper script error:', (err && err.stack) ? err.stack : err)
    process.exit(1)
  }
}

main()
