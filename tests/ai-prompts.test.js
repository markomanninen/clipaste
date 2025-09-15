const { makeSummarizePrompt, makeClassifyPrompt, makeTransformPrompt } = require('../src/ai/prompts')

describe('AI prompts', () => {
  it('creates summarize prompt respecting max tokens', () => {
    const prompt = makeSummarizePrompt('Content to summarize', { maxTokens: 42 })
    expect(prompt).toContain('42')
    expect(prompt).toContain('Content to summarize')
  })

  it('throws when classify is missing labels', () => {
    expect(() => makeClassifyPrompt('text', [])).toThrow('At least one label is required')
  })

  it('creates classify prompt with labels', () => {
    const prompt = makeClassifyPrompt('hello', ['bug', 'feature'])
    expect(prompt).toContain('- bug')
    expect(prompt).toContain('hello')
  })

  it('throws when transform instruction missing', () => {
    expect(() => makeTransformPrompt('text')).toThrow('Instruction is required')
  })

  it('creates transform prompt with instruction', () => {
    const prompt = makeTransformPrompt('alpha', 'rewrite')
    expect(prompt).toContain('rewrite')
    expect(prompt).toContain('alpha')
  })
})
