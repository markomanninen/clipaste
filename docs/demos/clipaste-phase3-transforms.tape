Output docs/demos/clipaste-phase3-transforms.gif
Set FontSize 14
Set Width 900
Set Height 520
Set Theme "Dracula"

# Encode / decode URL and Base64, and JSON pretty-print

Type "# Put JSON on clipboard"
Enter
Sleep 400ms
Type "echo '"
Type '{"a":1,"b":[2,3]}'
Type "' | clipaste copy"
Enter
Sleep 800ms

Type "# Pretty print JSON"
Enter
Sleep 300ms
Type "clipaste get --json-format"
Enter
Sleep 1200ms

Type "# URL-encode clipboard text"
Enter
Sleep 300ms
Type "clipaste get --url-encode"
Enter
Sleep 800ms

Type "# URL-decode clipboard text"
Enter
Sleep 300ms
Type "clipaste get --url-decode"
Enter
Sleep 800ms

Type "# Base64-encode clipboard text"
Enter
Sleep 300ms
Type "clipaste get --base64"
Enter
Sleep 800ms

Type "# Encode input to Base64 and copy"
Enter
Sleep 300ms
Type "echo 'hello phase3' | clipaste copy --encode-base64"
Enter
Sleep 800ms

Type "# Decode Base64 argument and copy"
Enter
Sleep 300ms
Type "clipaste copy --decode-base64 aGVsbG8="
Enter
Sleep 800ms

Type "# Show decoded clipboard content"
Enter
Sleep 300ms
Type "clipaste get"
Enter
Sleep 1200ms

