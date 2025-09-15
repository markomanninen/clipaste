const { redactText, parseRules } = require('../src/ai/redact')

describe('AI redaction', () => {
  it('redacts emails and keys', () => {
    const input = 'Contact me at user@example.com and use key ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
    const result = redactText(input, ['emails', 'keys'])
    expect(result.text).not.toContain('user@example.com')
    expect(result.text).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')
    expect(result.text).toContain('[REDACTED_EMAIL]')
    expect(result.text).toContain('[REDACTED_KEY]')
  })

  it('parses comma separated rules', () => {
    const rules = parseRules('emails, jwt ,ipv4')
    expect(rules).toEqual(['emails', 'jwt', 'ipv4'])
  })

  it('returns original text when disabled', () => {
    const input = 'Nothing to redact here'
    const result = redactText(input, ['emails'], { enabled: false })
    expect(result.text).toBe(input)
    expect(result.redactions).toEqual([])
  })
})
