Output docs/demos/clipaste-phase3-image-resize.gif
Set FontSize 14
Set Width 900
Set Height 520
Set Theme "Dracula"

# Paste base64 image from clipboard with resize and format

Type "# Create a 1x1 PNG data URL into clipboard"
Enter
Sleep 300ms
Type "echo 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' | clipaste copy"
Enter
Sleep 900ms

Type "# Paste to file as webp with resize"
Enter
Sleep 300ms
Type "clipaste paste --format webp --resize 800x --filename tiny"
Enter
Sleep 1400ms

Type "# Show saved file"
Enter
Sleep 300ms
Type "ls -lh tiny.webp"
Enter
Sleep 1000ms

