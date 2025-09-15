# clipaste Phase 2 Plan (Refined)

This refines Phase 2 with pragmatic scope, safety limits, and clear UX.

## Goals

- Add real-time clipboard monitoring via polling with safe defaults
- Provide local clipboard history with pruning and privacy controls
- Keep implementation text-first; defer image history/monitoring to Phase 3

## Non-Goals

- No global "memory-only" mode. Instead, add targeted persistence controls (e.g., `--no-persist`).
- No OS-native event watchers; cross-platform polling is used.

## Commands

### watch

```text
clipaste watch \
  [--interval <ms>] \
  [--filter <regex>] \
  [--exec <cmd>] \
  [--save] \
  [--timeout <ms> | --once | --max-events <n> | --idle-timeout <ms>] \
  [--no-persist] \
  [--max-item-size <bytes>] \
  [--max-items <n>] \
  [--no-echo] \
  [--verbose]
```

- Polls clipboard every `--interval` ms (default 1000; min enforced 200).
- Computes SHA-256 to detect new content (dedup unchanged values).
- `--filter` applies a regex to content; only matches trigger actions.
- `--exec` runs a shell command; clipboard content is piped to stdin and provided via env `CLIPASTE_TEXT` and `CLIPASTE_SHA256`.
- `--save` appends to history (subject to size and count caps).
- Stop conditions: `--timeout`, `--once`, `--max-events`, `--idle-timeout` (no changes for duration).
- Termination: cleanly exits on Ctrl+C/SIGINT/SIGTERM, flushing pending saves.
- Privacy & safety: `--no-persist` disables on-disk history; `--no-echo` suppresses content logging; debounced polling and backoff on errors.

### history

```text
clipaste history [--list] [--restore <id>] [--clear] [--export <file>]
```

- `--list` shows recent items with id, timestamp, preview, length.
- `--restore <id>` writes selected item back to clipboard.
- `--clear` truncates history after confirmation.
- `--export <file>` writes full JSON dump.

## Safeguards & Limits

- Max item size: default 256 KB (configurable `--max-item-size`). Items above are skipped (with verbose reason) or truncated for preview.
- Max items: default 100 (configurable `--max-items`). Oldest pruned on insert.
- Max total size: default 5 MB for persisted store; prune oldest until under cap.
- Skip likely binary content when `--save` (text-first). Optionally add `--block-binary` later.
- Enforce minimum polling interval and debounce identical values.

## Storage

- JSON file at platform config dir:
  - macOS: `~/Library/Application Support/clipaste/history.json`
  - Linux: `$XDG_CONFIG_HOME/clipaste/history.json` or `~/.config/clipaste/history.json`
  - Windows: `%APPDATA%/clipaste/history.json`
- Entry fields: `id` (uuid), `ts` (ISO), `sha256`, `len`, `preview`, `content`.

## Implementation Notes

- New modules: `src/watcher.js` (polling+hashing+exec), `src/historyStore.js` (JSON store+pruning).
- Integrate into `src/cli.js` with new `watch` and `history` commands.
- Reuse `src/clipboard.js` for text I/O (already mockable).
- Keep logging minimal; add `--verbose` for diagnostics.

## Future (Phase 3)

- Image-aware watch/history once clipboard image support is implemented.
- Transformations and richer detection.
