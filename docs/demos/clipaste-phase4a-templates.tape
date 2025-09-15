Output docs/demos/clipaste-phase4a-templates.gif
Set FontSize 14
Set Width 800
Set Height 480
Set Theme "Dracula"

Type "echo 'Hello {{name|World}} from {{date}}' > /tmp/greet.tmpl"
Enter
Sleep 800ms

Type "clipaste template save greet/hello --from /tmp/greet.tmpl"
Enter
Sleep 1200ms

Type "clipaste template list"
Enter
Sleep 800ms

Type "clipaste template use greet/hello --vars name=Clipaste --copy"
Enter
Sleep 1200ms

