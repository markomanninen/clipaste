Output docs/demos/clipaste-phase4b-ai.gif
Set FontSize 14
Set Width 900
Set Height 520
Set Theme "Dracula"

# Explore the AI plugin commands (Phase 4B)

Type "clipaste ai --help"
Enter
Sleep 1200ms

Type "clipaste ai summarize --help"
Enter
Sleep 1200ms

Type "clipaste ai classify --help"
Enter
Sleep 1200ms

Type "clipaste ai transform --help"
Enter
Sleep 1200ms

Type "# Example: summarize clipboard text with local Ollama"
Enter
Sleep 400ms
Type "# clipaste ai summarize --copy --consent"
Enter
Sleep 800ms

Type "# Example: classify a file with custom labels"
Enter
Sleep 400ms
Type "# clipaste ai classify --source file --file notes.txt --labels 'bug,feature,question' --json"
Enter
Sleep 800ms

Type "# Example: transform stdin using an instruction"
Enter
Sleep 400ms
Type "# cat draft.txt | clipaste ai transform --source stdin --instruction 'rewrite as bullet list' --out output.txt"
Enter
Sleep 1200ms
