const { spawn } = require('child_process')
const path = require('path')

describe('Stdin Integration Tests - Real Command Execution', () => {
  const clipastePath = path.join(__dirname, '..', 'src', 'index.js')

  // Helper to run clipaste with piped input
  const runClipasteWithPipe = (args, input, timeout = 5000) => {
    return new Promise((resolve) => {
      const child = spawn('node', [clipastePath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, timeout)

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          code,
          stdout,
          stderr,
          timedOut
        })
      })

      child.on('error', (error) => {
        clearTimeout(timer)
        resolve({
          code: -1,
          stdout,
          stderr: stderr + error.message,
          timedOut
        })
      })

      // Write input to stdin and close
      if (input !== null && input !== undefined) {
        child.stdin.write(input)
      }
      child.stdin.end()
    })
  }

  test('echo "hello" | clipaste copy --encode-base64 (integration)', async () => {
    const result = await runClipasteWithPipe(['copy', '--encode-base64'], 'hello')

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Copied text to clipboard')
    expect(result.stdout).toContain('characters') // Should show character count > 0
    expect(result.stdout).not.toContain('(0 characters)') // This was the bug!
  })

  test('echo "aGVsbG8=" | clipaste copy --decode-base64 (integration)', async () => {
    const base64Hello = Buffer.from('hello', 'utf8').toString('base64')
    const result = await runClipasteWithPipe(['copy', '--decode-base64'], base64Hello)

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Copied text to clipboard')
    expect(result.stdout).toContain('(5 characters)') // "hello" is 5 chars
  })

  test('echo "invalid!" | clipaste copy --decode-base64 (integration)', async () => {
    const result = await runClipasteWithPipe(['copy', '--decode-base64'], 'invalid-base64!')

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Invalid base64 input')
  })

  test('empty input | clipaste copy --encode-base64 (integration)', async () => {
    const result = await runClipasteWithPipe(['copy', '--encode-base64'], '')

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Copied text to clipboard')
    expect(result.stdout).toContain('(0 characters)') // Empty input should give 0
  })

  test('multiline input | clipaste copy --encode-base64 (integration)', async () => {
    const multilineInput = 'line 1\nline 2\nline 3'
    const result = await runClipasteWithPipe(['copy', '--encode-base64'], multilineInput)

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Copied text to clipboard')
    expect(result.stdout).toContain('characters')
    // Should encode the entire multiline string
    const expectedLength = Buffer.from(multilineInput, 'utf8').toString('base64').length
    expect(result.stdout).toContain(`(${expectedLength} characters)`)
  })

  test('direct argument still works: clipaste copy --encode-base64 "direct"', async () => {
    // Test that our fix didn't break direct arguments
    const result = await runClipasteWithPipe(['copy', '--encode-base64', 'direct'], null)

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Copied text to clipboard')
    const expectedLength = Buffer.from('direct', 'utf8').toString('base64').length
    expect(result.stdout).toContain(`(${expectedLength} characters)`)
  })

  test('direct argument decode: clipaste copy --decode-base64 "ZGlyZWN0"', async () => {
    const base64Direct = Buffer.from('direct', 'utf8').toString('base64')
    const result = await runClipasteWithPipe(['copy', '--decode-base64', base64Direct], null)

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Copied text to clipboard')
    expect(result.stdout).toContain('(6 characters)') // "direct" is 6 chars
  })
})
