Output docs/demos/clipaste-watch-exec.gif
Set FontSize 14
Set Width 800
Set Height 480
Set Theme "Dracula"

# Clean previous artifacts
Type "rm -f out.txt"
Enter
Sleep 500ms

# Start watcher in background: save once and execute a command
Type "clipaste watch --once --save --exec 'wc -c > out.txt' &"
Enter
Sleep 800ms

# Trigger a clipboard change via copy
Type "echo 'watch demo' | clipaste copy"
Enter
Sleep 1200ms

# Show exec output and a history entry
Type "cat out.txt"
Enter
Sleep 800ms

Type "clipaste history --list | tail -n 1"
Enter
Sleep 1s
