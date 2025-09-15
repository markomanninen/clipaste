# clipaste Phase 3 Plan (Refined)

Pragmatic scope for Phase 3 focusing on integration-friendly utilities that build on existing capabilities (sharp-based image saving, text-first design), with clear platform notes and safe defaults.

## Goals

- Add useful image processing options on paste using existing `sharp`.
- Provide content transformations for common workflows (base64, JSON, URL decode).
- Improve automatic detection (file extension, basic language heuristics) without heavy deps.

## Non-Goals

- No system-native image clipboard write (platform-specific; defer to Phase 4+).
- No heavy language detection/AST parsing or HTML/ANSI file generation.
- No on-disk image history or image watch yet (keep text-first history/watch).

## Scope Overview

- Image handling: resize, convert (via existing `--format`), quality control, metadata output.
- Text transforms: base64 encode/decode, JSON pretty print, URL decode.
- Smart detection: auto file extension, lightweight code language guesser.

## Commands

### paste (image enhancements)

```text
clipaste paste \
  [--resize <WxH>|<W>x|x<H>] \
  [--format <png|jpeg|webp>] \
  [--quality <1-100>] \
  [--auto-extension]
```

- `--resize`: Uses `sharp.resize()`. Accepts:
  - `800x600` (fixed box, keep aspect with fit="inside").
  - `800x` (width only, preserve aspect).
  - `x600` (height only, preserve aspect).
- `--format`: Already supported; use for conversion instead of adding `--convert`.
- `--quality`: Already supported; treat as compression control where applicable.
- `--auto-extension`: Chooses extension from detected content:
  - image: use decoded/known format (png/jpeg/webp) via `fileHandler.getFileExtensionFromFormat`.
  - text: apply heuristics (see Detection) or default `.txt`.

Platform note: Image paste continues to rely on base64 data URLs or Windows PowerShell fallback. Where `readImage()` returns null, paste remains text-first.

### get (transformations + image info)

```text
clipaste get [--raw] [--base64] [--json-format] [--url-decode] [--image-info]
```

- `--base64`: Base64-encodes text clipboard content to stdout. No newline added in `--raw` mode.
- `--json-format`: Pretty-prints valid JSON with 2-space indent; on invalid JSON, exits non-zero with concise error to stderr.
- `--url-decode`: Decodes percent-encoded text using `decodeURIComponent` with safe fallback on malformed sequences.
- `--image-info`: If clipboard contains an image (base64 data URL or Windows path), prints metadata JSON (format, width, height, approximate size). If not image, exits 0 with no output (consistent with current `get` empty behavior when applicable).

### copy (transformations)

```text
clipaste copy [text] [--file <path>] [--decode-base64 <data>]
```

- `--decode-base64 <data>`: Decodes base64 to text and writes to the clipboard. Input may be provided as an argument or via stdin; in case of both, stdin wins. Invalid base64 yields non-zero exit with clear error.

## Detection Heuristics

- Auto extension (text):
  - JSON: `^\s*[\[{]` and parseable → `.json`.
  - Shell: shebang `^#!.*\b(sh|bash|zsh)\b` → `.sh`.
  - JavaScript/TypeScript: shebang `node`, common keywords (`module.exports`, `import`, `export`, `function`) → `.js`.
  - Markdown: headings/lists/fences (`^# `, `^[-*] `, ``` ``` fences) → `.md`.
  - Fallback `.txt`.
- Language detection (for `get --detect-language`): Return short label (`json`, `sh`, `js`, `md`, `text`). Heuristics mirror auto-extension. Keep optional in Phase 3; expose as a subcommand flag only if needed by users.

## Safeguards & UX

- Parsing safety: All transforms guarded by try/catch; invalid input prints one-line error and uses non-zero exit codes; no stack traces by default.
- Size limits: Reuse existing caps where applicable; do not load entire megabyte-scale images for `--image-info` without a size check; if over 25 MB, skip dimension probing and only print size+format.
- Dry runs: Respect existing `--dry-run` for `paste` and include computed file path after auto-extension.
- Cross-platform: Image features are best-effort; when unsupported, fail gracefully to text path or no-op with exit status indicating inability (documented behavior).

## Implementation Notes

- `src/cli.js`:
  - Add options: `--resize`, `--auto-extension` to `paste`; `--base64`, `--json-format`, `--url-decode`, `--image-info` to `get`; `--decode-base64` to `copy`.
  - Route options to `FileHandler.saveImage` and new helper utilities.
- `src/fileHandler.js`:
  - Extend `saveImage` to apply optional `resize` prior to format/quality pipeline.
  - Add utility to parse resize strings → `{ width, height, fit: 'inside' }`.
- `src/clipboard.js`:
  - No major changes; continue base64 image detection and Windows PowerShell path.
  - Add a thin helper to probe image metadata from a Buffer via `sharp(metadata)` for `--image-info`.
- New small util (optional): `src/utils/transform.js` for base64/JSON/URL decode helpers and heuristics (keeps `cli.js` lean).

## Dependencies

- Reuse `sharp` (already present) for image conversions/resizing/metadata.
- No new heavy deps. Optional: `chalk` strictly for colored CLI errors (can defer).

## Phasing

- MVP (deliver first):
  - `paste --resize` (+auto-extension for image formats via existing mapping).
  - `get --json-format`, `get --url-decode`, `get --base64` (text-only).
  - `get --image-info` (best-effort; avoid heavy loads).
- Nice-to-have (stretch, keep small):
  - `paste --auto-extension` for text using heuristics (`.json`, `.md`, `.sh`, `.js`).
  - `copy --decode-base64` (argument or stdin).
- Defer (Phase 4+):
  - Robust language detection beyond heuristics, syntax highlighting output, and image write-to-clipboard across OSes.

## Fit Assessment

- Image options: High fit and usefulness; easy to implement with `sharp`; limited only by clipboard image availability on macOS/Linux.
- Transformations: High usefulness and trivial to implement; align with CLI ethos; no extra deps.
- Smart detection: Useful for DX; heuristics are low-risk and lightweight; avoid adding heavy detection libs.

## Success Criteria

- End-to-end: Resize/convert/quality options save expected output; transforms produce correct stdout/stderr/exit codes; auto-extension chooses expected extensions for common cases.
- Reliability: Comprehensive unit tests for transforms and resize parsing; platform-guarded tests for image-info.
- UX: Clear, concise help (`--help`) updated; errors are informative without noise.

