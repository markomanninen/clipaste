# Automated CLI Recordings (for README demos)

You can create automated, reproducible terminal recordings and embed them in the README.

## Three solid options

### 1. Asciinema + svg-term (SVG output for crisp embeds)

- Record: `asciinema rec demo.cast` (run your commands, then exit with Ctrl+D)
- Render SVG: `npx svg-term --in demo.cast --out docs/demo.svg --window --width 80 --height 24 --term iterm2`
- Embed in README: `![clipaste demo](docs/demo.svg)`

Pros: tiny, scalable SVG; good for GitHub. Cons: non-animated GIF fallback may be needed for some viewers.

### 2. Terminalizer (scriptable YAML + GIF)

- Init: `npx terminalizer init demo`
- Edit `demo.yml` to script commands/delays (repeatable)
- Record: `npx terminalizer record demo`
- Render GIF: `npx terminalizer render demo` → creates `demo.gif`
- Embed: `![clipaste demo](docs/demo.gif)`

Pros: full-control GIF, easily hosted in repo. Cons: larger files.

### 3. VHS by Charm (Tape files → GIF/MP4/SVG)

- Create `docs/demos/clipaste.tape` with scripted keystrokes and commands, e.g.:

  ```tape
  Output docs/demos/clipaste.gif
  Set FontSize 14
  Type "clipaste watch --once --save"\n
  # Simulate copying something from stdin in another shell
  Sleep 500ms
  Type "echo hello | clipaste copy"\n
  Sleep 2s
  ```

- Render: `vhs docs/demos/clipaste-basics.tape` → `docs/demos/clipaste-basics.gif`
- Or via npm: `npm run demo:render`
- Embed: `![clipaste demo](docs/demos/clipaste-basics.gif)`

Pros: fully scripted and deterministic; great for CI. Cons: requires `vhs` binary.

Tips for great recordings:

- Use a temporary workspace (`/tmp/clipaste-demo`) to keep outputs clean.
- Set deterministic prompts and timestamps when possible, or use `--dry-run` for file previews.
- Keep terminal width to 80 columns to avoid wrapping in embeds.
- Prefer short, focused demos per feature (copy/get, paste to file, watch/exec).
  
## Selected: VHS

This repo includes starter tapes:

```text
docs/demos/clipaste-basics.tape     # basics: status/copy/get/paste (dry-run)
docs/demos/clipaste-watch-exec.tape # watch --save/--exec with background run
```

To render:

```bash
# Install VHS (https://github.com/charmbracelet/vhs) then run
npm run demo:render:all
```

Embed examples in README:

```markdown
![clipaste basics](docs/demos/clipaste-basics.gif)
![clipaste watch exec](docs/demos/clipaste-watch-exec.gif)
```
