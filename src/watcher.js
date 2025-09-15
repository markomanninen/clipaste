const crypto = require('crypto')
const { spawn } = require('child_process')
const ClipboardManager = require('./clipboard')

function sha256 (text) {
  return crypto.createHash('sha256').update(text || '').digest('hex')
}

class Watcher {
  constructor ({ interval = 1000, verbose = false } = {}) {
    this.interval = Math.max(200, Number(interval) || 1000)
    this.verbose = !!verbose
    this._timer = null
    this._stopped = false
    this._lastHash = null
    this._eventsHandled = 0
    this._idleSince = Date.now()
    this._clipboard = new ClipboardManager()
  }

  async start (opts = {}) {
    const {
      filter,
      exec: execCmd,
      save = false,
      history,
      timeout,
      once = false,
      maxEvents,
      idleTimeout,
      noEcho = false
    } = opts

    const filterRegex = this._buildRegex(filter)

    const stopOnTimeout = typeof timeout === 'number' && timeout > 0
    const stopAt = stopOnTimeout ? (Date.now() + timeout) : null

    if (this.verbose) {
      console.error(`[watch] interval=${this.interval}ms save=${!!save} exec=${execCmd ? 'yes' : 'no'} filter=${filter || 'none'}`)
    }

    const onTick = async () => {
      if (this._stopped) return

      try {
        const content = await this._clipboard.readText()
        const hash = sha256(content)

        if (hash && hash !== this._lastHash && content.length > 0) {
          // Possible change detected
          if (!filterRegex || filterRegex.test(content)) {
            this._idleSince = Date.now()
            this._lastHash = hash

            if (this.verbose && !noEcho) {
              const preview = content.length > 80 ? content.slice(0, 80) + '…' : content
              console.error(`[watch] change len=${content.length} sha=${hash.slice(0, 8)} preview=${JSON.stringify(preview)}`)
            } else if (this.verbose) {
              console.error(`[watch] change len=${content.length} sha=${hash.slice(0, 8)}`)
            }

            // Save to history if enabled
            if (save && history && typeof history.addEntry === 'function') {
              try { await history.addEntry(content) } catch (e) { if (this.verbose) console.error('[watch] history error:', e.message) }
            }

            // Execute command if requested
            if (execCmd) {
              await this._runExec(execCmd, content, hash)
            }

            this._eventsHandled += 1

            if (once || (typeof maxEvents === 'number' && this._eventsHandled >= maxEvents)) {
              await this.stop()
              return
            }
          }
        }

        // Idle timeout
        if (typeof idleTimeout === 'number' && idleTimeout > 0) {
          const idleFor = Date.now() - this._idleSince
          if (idleFor >= idleTimeout) {
            if (this.verbose) console.error('[watch] idle timeout reached')
            await this.stop()
            return
          }
        }

        // Absolute timeout
        if (stopAt && Date.now() >= stopAt) {
          if (this.verbose) console.error('[watch] timeout reached')
          await this.stop()
        }
      } catch (err) {
        if (this.verbose) console.error('[watch] error:', err.message)
      }
    }

    this._timer = setInterval(onTick, this.interval)
    // Immediate first tick
    onTick()
  }

  async stop () {
    if (this._stopped) return
    this._stopped = true
    if (this._timer) clearInterval(this._timer)
  }

  _buildRegex (pattern) {
    if (!pattern) return null
    try {
      // If the user provides /foo/i style, keep flags; otherwise, treat as plain pattern
      const m = String(pattern).match(/^\/(.*)\/([a-z]*)$/i)
      if (m) return new RegExp(m[1], m[2])
      return new RegExp(String(pattern))
    } catch {
      if (this.verbose) console.error('[watch] invalid regex; ignoring')
      return null
    }
  }

  _runExec (cmd, content, hash) {
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32'
      const shell = isWindows ? 'cmd' : 'sh'
      const shellFlag = isWindows ? '/c' : '-c'
      const child = spawn(shell, [shellFlag, cmd], {
        env: {
          ...process.env,
          CLIPASTE_TEXT: content,
          CLIPASTE_SHA256: hash
        },
        stdio: ['pipe', 'inherit', 'inherit']
      })
      // pipe content to stdin
      child.stdin.write(content)
      child.stdin.end()

      child.on('close', () => resolve())
      child.on('error', () => resolve())
    })
  }
}

module.exports = Watcher
