Output docs/demos/clipaste-phase3-auto-extension.gif
Set FontSize 14
Set Width 900
Set Height 520
Set Theme "Dracula"

# Auto extension for text based on content

Type "# Prepare a demo directory"
Enter
Sleep 300ms
Type "mkdir -p demo && cd demo && rm -f sample.*"
Enter
Sleep 700ms

Type "# Copy JSON to clipboard"
Enter
Sleep 300ms
Type "echo '"
Type '{"k":42}'
Type "' | clipaste copy"
Enter
Sleep 700ms

Type "# Paste with auto extension (expects .json)"
Enter
Sleep 300ms
Type "clipaste paste --auto-extension --filename sample"
Enter
Sleep 1200ms

Type "# Verify resulting file"
Enter
Sleep 300ms
Type "ls -1 sample.* && echo '---' && cat sample.json"
Enter
Sleep 1600ms

