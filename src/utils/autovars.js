const { execSync } = require('child_process')

function tryGit (cmd) {
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return out || undefined
  } catch {
    return undefined
  }
}

function gitVars () {
  const branch = tryGit('git rev-parse --abbrev-ref HEAD')
  const remote = tryGit('git remote get-url origin')
  const repo = tryGit('git rev-parse --show-toplevel')
  const user = tryGit('git config user.name')
  const email = tryGit('git config user.email')
  const vars = {}
  if (branch) vars.git_branch = branch
  if (remote) vars.git_remote = remote
  if (repo) vars.git_repo = repo
  if (user) vars.git_user = user
  if (email) vars.git_email = email
  return vars
}

async function clipboardVars (clipboardManager) {
  if (!clipboardManager || typeof clipboardManager.readText !== 'function') return {}
  try {
    const text = await clipboardManager.readText()
    let parsed
    try { parsed = JSON.parse(text) } catch {}
    if (parsed && typeof parsed === 'object') {
      return { clipboard: parsed }
    }
    return { clipboard: text }
  } catch {
    return {}
  }
}

async function getAutoVars (opts = {}) {
  const includeGit = opts.includeGit !== false
  const includeClipboard = opts.includeClipboard !== false
  const vars = {}
  if (includeGit) Object.assign(vars, gitVars())
  if (includeClipboard) Object.assign(vars, await clipboardVars(opts.clipboardManager))
  return vars
}

module.exports = { getAutoVars }
