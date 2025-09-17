# clipaste Phase 3B Plan: Image-to-Clipboard (copy --image) ✅ COMPLETED

**Status: COMPLETED** - Image-to-clipboard functionality has been successfully implemented for macOS with automatic format conversion.

Pragmatic, cross-platform plan to add image write support to the system clipboard while maintaining text-first reliability and graceful degradation.

## Implementation Status

✅ **macOS Support**: Fully implemented using AppleScript with automatic format conversion (SVG→PNG)  
✅ **Windows Support**: Fully implemented using PowerShell/.NET Framework with robust error handling  
⚠️ **Linux Support**: Planned (see [TODO-WINDOWS-LINUX-IMAGE.md])

## Completed Features

- ✅ `clipaste copy --image <path>` command implementation
- ✅ **macOS**: Automatic SVG to PNG conversion via AppleScript clipboard system  
- ✅ **Windows**: PowerShell/.NET Framework integration with System.Drawing/System.Windows.Forms
- ✅ PNG, JPEG, SVG, GIF, BMP format support across platforms
- ✅ Enhanced error handling for missing files, platform compatibility, and empty clipboard states
- ✅ Round-trip testing (file → clipboard → file) on both macOS and Windows
- ✅ CLI integration with existing copy command structure
- ✅ Comprehensive test suite for macOS and Windows functionality
- ✅ Robust clipboard state detection and error recovery for Windows

## Goals

- Add an easy way to put an image into the system clipboard.
- Keep cross-platform behavior predictable with clear fallbacks.
- Reuse existing `sharp` pipeline for optional resize/convert before writing.

## Non-Goals

- No full image history/watch yet; keep Phase 2 text-first history as-is.
- No heavy native addons. Prefer system tools (PowerShell, xclip/wl-copy, JXA).
- No multi-item/complex clipboard formats beyond a single image.

## CLI Surface

```bash
clipaste copy --image <path> \
  [--format <png|jpeg|webp>] \
  [--quality <1-100>] \
  [--resize <WxH|Wx|xH>] \
  [--max-bytes <n>] \
  [--verbose]

# Examples
clipaste copy --image screenshot.png
clipaste copy --image photo.jpg --format png --resize 1280x
clipaste copy --image logo.svg --format png --quality 90
```

Behavior:

- Reads input file, optionally resizes/converts via `sharp`, enforces size limit, then writes the image to the OS clipboard.
- On unsupported/missing system tooling, prints a concise hint (how to install) and exits non-zero, unless `HEADLESS/CI` where it soft-no-ops with an informational message.

## Platform Implementation

Common pre-processing:

- Load file → Buffer → `sharp` pipeline: optional `resize`, convert `--format`, apply `--quality` (for lossy formats). Default to PNG for compatibility.
- Validate `max-bytes` (default: 25 MB). Abort with clear error if exceeded.

macOS (primary):

- Use JXA (osascript -l JavaScript) with AppKit:
  - `ObjC.import('AppKit')`; load image (NSData/NSImage) from temp file; write via `NSPasteboard.generalPasteboard().clearContents(); pasteboard.writeObjects([nsimg])`.
- Fallback: AppleScript `set the clipboard to (read file ... as picture)` for PNG/JPEG.

Linux:

- Prefer Wayland: `wl-copy --type image/png` (detect via `WAYLAND_DISPLAY`).
- X11 fallback: `xclip -selection clipboard -t image/png -i <file>` (or `xsel --clipboard --mime-type=image/png`).
- Detection: probe tools at runtime; error with instructions if neither present.

Windows:

- PowerShell + .NET (System.Windows.Forms + System.Drawing):
  - Load image via `[System.Drawing.Image]::FromFile(path)`; call `[System.Windows.Forms.Clipboard]::SetImage($img)`.
- Use `-STA` or run with appropriate COM settings if needed; mirror patterns already used in `readImage()`.

## Safeguards & UX

- Size cap: default 25 MB (configurable by `--max-bytes`).
- Format normalization: default out-format PNG for maximal compatibility.
- Headless/CI: simulate success with an info log (consistent with other commands).
- Error messages:
  - Missing tools (Linux): crisp hint “Install wl-clipboard (wl-copy) or xclip”.
  - macOS permission issues: suggest running once via Terminal/ granting permissions.
  - Windows PowerShell execution policy: use `-ExecutionPolicy Bypass`.

## Modules & Changes

- `src/cli.js`:
  - Extend `copy` command with `--image`, `--format`, `--quality`, `--resize`, `--max-bytes`.
  - Route to new `clipboardManager.writeImage(buffer, { format, ... })`.

- `src/clipboard.js`:
  - Add `writeImage(buffer, opts)` implementing the platform-specific write paths using `spawn`/PowerShell/JXA and temp files.
  - Reuse existing Windows script management (temp `.ps1`). Add macOS JXA runner and Linux tool probes.

- `src/fileHandler.js` (reuse only):
  - Use existing `sharp` processing; expose helper to produce target buffer for clipboard.

## Testing Strategy

- Unit tests:
  - Mock `child_process.spawn` to assert platform commands and args for macOS/Linux/Windows.
  - Validate preprocessing (resize/format/quality/max-bytes) via `sharp` mocks.

- “Real” tests (guarded):
  - Skip or soft-pass under CI/headless; when available, verify no-crash + exit codes.
  - Minimal end-to-end: write → `get --image-info` returns plausible metadata in supported local environments.

- Smoke via VHS:
  - Tape: copy image from file, then `clipaste get --image-info` to show JSON metadata.

## Dependencies

- No new npm runtime deps.
- System tools (Linux): suggest installing `wl-clipboard` (Wayland) or `xclip` (X11). Detect at runtime.

## Rollout

- MVP (3B.1): `clipaste copy --image <path>` with PNG default, size cap, platform paths, clear errors.
- 3B.2: Add `--format/--quality/--resize` preprocessing (shared with paste options for parity).
- 3B.3: Docs + VHS: “Copy image to clipboard” demo; README examples.

## Documentation & Demos

- README: New section “Copy Image to Clipboard” with examples per platform and common errors.
- VHS tapes:
  - `clipaste-phase3b-copy-image.tape`: copies image file → runs `get --image-info` → prints JSON.

## Success Criteria

- Cross-platform best-effort works where tooling/APIs exist; clear guidance where missing.
- Preprocessing behaves like `paste --resize/--format/--quality` with consistent results.
- Tests pass across local, Docker (Linux headless), and CI; guarded real tests do not flake.

## Risks & Mitigations

- Platform tool availability (Linux): mitigate with detection and instructions.
- macOS privacy prompts: document; use JXA for reliability.
- Large images: default cap; recommend `--max-bytes` override, with warning about memory/latency.
