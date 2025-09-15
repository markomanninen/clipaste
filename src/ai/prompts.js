function makeSummarizePrompt (text, opts = {}) {
  const maxTokens = opts.maxTokens ? `Limit summary to approximately ${opts.maxTokens} tokens.` : 'Keep the summary concise.'
  return `${maxTokens}\nSummarize the following content preserving key facts and intent.\n\n"""\n${text}\n"""`
}

function makeClassifyPrompt (text, labels) {
  if (!Array.isArray(labels) || !labels.length) {
    throw new Error('At least one label is required for classify command')
  }
  const labelList = labels.map(l => `- ${l}`).join('\n')
  return `Classify the content into one of the provided labels. Reply with only the label text.\nLabels:\n${labelList}\n\nContent:\n"""\n${text}\n"""`
}

function makeTransformPrompt (text, instruction) {
  if (!instruction) {
    throw new Error('Instruction is required for transform command')
  }
  return `Instruction: ${instruction}\n\nContent:\n"""\n${text}\n"""\n\nReturn only the transformed content.`
}

module.exports = { makeSummarizePrompt, makeClassifyPrompt, makeTransformPrompt }
