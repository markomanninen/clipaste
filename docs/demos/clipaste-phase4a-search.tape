Output docs/demos/clipaste-phase4a-search.gif
Set FontSize 14
Set Width 800
Set Height 480
Set Theme "Dracula"

Type "echo 'Hello Search Body' > /tmp/t2.tmpl"
Enter
Sleep 500ms
Type "clipaste template save demo/search --from /tmp/t2.tmpl"
Enter
Sleep 1000ms

Type "clipaste search 'search' --templates --body"
Enter
Sleep 1500ms

