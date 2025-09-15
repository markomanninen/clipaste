Output docs/demos/clipaste-phase4a-pick.gif
Set FontSize 14
Set Width 800
Set Height 480
Set Theme "Dracula"

Type "echo 'Template One' > /tmp/t1.tmpl"
Enter
Sleep 500ms
Type "clipaste template save demo/one --from /tmp/t1.tmpl"
Enter
Sleep 1000ms

Type "clipaste pick --templates"
Enter
Sleep 1500ms

