Output docs/demos/clipaste-randomizer.gif
Set FontSize 14
Set Width 800
Set Height 480
Set Theme "Dracula"

Type "# Clipaste Randomizer Plugin Demo"
Enter
Sleep 800ms

Type "echo 'The randomizer plugin provides various random data generators'"
Enter
Sleep 1200ms

Type "clipaste plugins"
Enter
Sleep 1500ms

Type "clipaste random --help"
Enter
Sleep 1500ms

Type "# Generate a secure password"
Enter
Sleep 800ms

Type "clipaste random password --length 16"
Enter
Sleep 1200ms

Type "clipaste get"
Enter
Sleep 800ms

Type "# Generate a word-based password"
Enter
Sleep 800ms

Type "clipaste random password --words 4"
Enter
Sleep 1200ms

Type "clipaste get"
Enter
Sleep 800ms

Type "# Generate random string with template"
Enter
Sleep 800ms

Type "clipaste random string --template 'User-{{#####}}'"
Enter
Sleep 1200ms

Type "clipaste get"
Enter
Sleep 800ms

Type "# Generate Finnish personal ID (HETU)"
Enter
Sleep 800ms

Type "clipaste random personal-id --birthdate 1990-05-15"
Enter
Sleep 1200ms

Type "clipaste get"
Enter
Sleep 800ms

Type "# Generate Finnish IBAN"
Enter
Sleep 800ms

Type "clipaste random iban"
Enter
Sleep 1200ms

Type "clipaste get"
Enter
Sleep 800ms

Type "# Generate Finnish business ID"
Enter
Sleep 800ms

Type "clipaste random business-id"
Enter
Sleep 1200ms

Type "clipaste get"
Enter
Sleep 1000ms

Type "echo 'All random data copied to clipboard automatically!'"
Enter
Sleep 1000ms