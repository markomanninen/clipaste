const DEFAULT_RULES = ['emails', 'keys', 'jwt', 'ipv4', 'ipv6', 'paths']

const RULE_DEFINITIONS = {
  emails: {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    placeholder: '[REDACTED_EMAIL]'
  },
  keys: {
    // Matches common API key formats (20-64 chars) excluding whitespace
    pattern: /(?<![A-Za-z0-9])[A-Za-z0-9_-]{20,64}(?![A-Za-z0-9])/g,
    placeholder: '[REDACTED_KEY]'
  },
  jwt: {
    pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    placeholder: '[REDACTED_JWT]'
  },
  ipv4: {
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    placeholder: '[REDACTED_IPV4]'
  },
  ipv6: {
    pattern: /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g,
    placeholder: '[REDACTED_IPV6]'
  },
  paths: {
    // Windows paths like C:\foo\bar or Unix paths /usr/local
    pattern: /(?:[A-Za-z]:\\[^\s"']+|\/(?:[^\s"']+\/)*[^\s"']+)/g,
    placeholder: '[REDACTED_PATH]'
  }
}

function parseRules (rules) {
  if (!rules) return [...DEFAULT_RULES]
  if (Array.isArray(rules)) return rules.filter(Boolean)
  if (typeof rules === 'string') {
    return rules.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [...DEFAULT_RULES]
}

function redactText (input, rules, opts = {}) {
  const enabled = opts.enabled !== false
  if (!enabled) {
    return {
      text: input,
      appliedRules: [],
      replacements: [],
      redactions: []
    }
  }
  const list = parseRules(rules)
  let output = input
  const redactions = []
  for (const rule of list) {
    const def = RULE_DEFINITIONS[rule]
    if (!def) continue
    const matches = output.match(def.pattern)
    if (!matches) continue
    output = output.replace(def.pattern, def.placeholder)
    redactions.push({ rule, matches: matches.length })
  }
  return {
    text: output,
    appliedRules: list,
    redactions
  }
}

module.exports = { DEFAULT_RULES, RULE_DEFINITIONS, parseRules, redactText }
