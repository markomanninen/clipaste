# Phase 4A: Templates, Snippets, Search/Tags (History + Library)

This document defines scope, CLI, storage, and rollout for Templates, Snippets, and Search/Tags across two domains: (1) clipboard history (stored in `history.json`) and (2) the templates/snippets library. The aim is high utility with minimal dependencies and friction.

## Goals

- Fast access to reusable text/image content via named items.
- Simple templating with contextual auto-fill to avoid manual work.
- Lightweight organization and discovery: categories, tags, and search.
- Zero breaking changes; fully optional feature set.

## Non-Goals (4A)

- Heavy templating languages or complex logic blocks.
- Database introduction; keep flat-file + small JSON index.
- Network calls or cloud sync (covered in 4C).

## CLI Surface

- `clipaste snippet add <name> [--text "..."] [--from <file>]` — Create/update a snippet.
- `clipaste snippet copy <name> [--out <file>] [--json]` — Copy snippet to clipboard or write to file.
- `clipaste snippet list [--tree] [--tag <t>] [--json]` — List snippets.
- `clipaste snippet delete <name>` — Remove snippet.

- `clipaste template save <name> [--from <file>|--from-clipboard]` — Save a template file.
- `clipaste template use <name> [--vars k=v ...] [--auto] [--no-prompt] [--copy|--out <file>]` — Render and copy/output.
- `clipaste template edit <name>` — Open in `$EDITOR`.
- `clipaste template list [--tree] [--tag <t>] [--json]` — List templates with tags/categories.
- `clipaste template delete <name>` — Remove template.

- `clipaste render [--from <file>|--stdin] [--vars k=v ...] [--auto] [--no-prompt] [--copy|--out <file>]` — One-off render without saving.

- `clipaste tag --add <name> <tag[,tag2,...]> [--type template|snippet]` — Add tags to library items.
- `clipaste tag --remove <name> <tag[,tag2,...]> [--type template|snippet]` — Remove tags from library items.

- `clipaste history search <query> [--tag <t>] [--json] [--body]` — Search clipboard history by preview/content and tags.
- `clipaste history tag --add <id> <tag[,tag2,...]>` — Tag a history item by id.
- `clipaste history tag --remove <id> <tag[,tag2,...]>` — Remove tags from a history item.

- `clipaste search <query> [--history|--templates|--snippets|--all] [--tag <t>] [--body] [--json]` — Unified search; defaults to `--history` for backward-friendly behavior.

- `clipaste search <query> [--templates|--snippets|--all] [--tag <t>] [--body] [--json]` — Search by name, tags, description; optionally scan body.
- `clipaste pick [--templates|--snippets]` — Interactive picker: uses `fzf` if available; falls back to numbered menu with preview.

Notes:

- `name` is path-like: `category/sub/name`. Hierarchy maps to directories.
- `--auto` pulls values from contextual providers (see Auto Vars).
- `--no-prompt` fails if unresolved required variables remain.

## Storage Layout

- Root config dir: see `src/historyStore.js:getConfigDir()`; add:
  - `<config>/templates/` and `<config>/snippets/` — user-editable files.
  - `<config>/templates/index.json` and `<config>/snippets/index.json` — cached index.

- History store (augmented, backward compatible):
  - Existing entries keep fields: `id`, `ts`, `sha256`, `len`, `preview`, `content`.
  - Add optional metadata fields (loader should tolerate): `tags?: string[]`, `title?: string`.
  - Tag edits update the entry in `history.json` and persist via the `HistoryStore` helper.

- File format:

  - Plain text by default. Optional YAML front matter block
    ---

    name: category/sub/name
    tags: [work, email]
    description: PR description template
    required: [ticket, title]
    ---

    Body with placeholders like {{ticket}} and {{title}}.

- Index schema (per item):
  - `name` (string, unique path-like)
  - `path` (string, absolute path)
  - `type` ("template"|"snippet")
  - `tags` (string[])
  - `category` (string, derived from parent folders)
  - `description` (string)
  - `required` (string[])
  - `mtime` (ISO string)
  - `size` (bytes)

## Placeholder Rendering

- Syntax: `{{var}}` and `{{var|default}}`.
- Resolution precedence (first defined wins):
  1) `--vars key=value` CLI overrides
  2) Auto Vars providers (below)
  3) Front matter defaults (if extended later)
  4) `default` in expression
  5) Prompt user (unless `--no-prompt`)

## Auto Vars Providers (MVP)

- `env`: `USER`, `EMAIL`, `GIT_AUTHOR_NAME`, and any `CLIPASTE_VAR_*` mapped to `var`.
- `system`: `date`, `time`, `datetime`, `hostname`, `cwd`.
- `git` (best-effort): `git_branch`, `git_remote`, `git_repo`, `git_user`. Use `git` commands if available; ignore failures.
- `clipboard` smart parse: if clipboard contains JSON/YAML, allow `{{json.key.path}}` access; for text, expose `clipboard`.

Implementation: `src/utils/autovars.js` with pure Node APIs; JSON/YAML parse is optional (only parse JSON by default; YAML can be added if we adopt `yaml`).

## Implementation Plan

1) Core plumbing

- Add config paths; create `templates/`, `snippets/` if missing.
- Implement tiny front-matter parser (regex) and placeholder renderer.
- Build indexer to scan trees and persist `index.json` with mtime checks.

2) Commands (baseline)

- `snippet add/copy/list/delete` using files under `snippets/`.
- `template save/use/edit/list/delete` with rendering and `--auto` resolution.
- `render` for one-offs.

3) Organization and discovery

- Library tags: `tag` subcommand to manage tags stored in index metadata (or front matter if present).
- Library search: across name/tags/description; `--body` scans file contents.
- History tags: extend `HistoryStore` with `addTags(id, tags[])`, `removeTags(id, tags[])` and persist.
- History search: helper that filters by `preview/content` and `tags` with simple substring matching; `--body` scans full content.
- `pick` integrates with `fzf` if present; otherwise simple menu.

4) Testing

- Unit: front-matter parse, placeholder render, autovars providers, indexer.
- Integration: CLI flows for save/use/copy, tags, search, pick.
- Snapshot tests for rendered outputs.

## Dependencies

- Required: None beyond Node stdlib.
- Optional: `yaml` (parse front matter), detection of `fzf` (no Node dep).

## Config Keys (new)

- `templatesDir`, `snippetsDir` (defaults under config dir)
- `template.auto.providers` (array: env, system, git, clipboard)
- `template.prompt` (boolean default true)
- `search.defaultTarget` ("history"|"templates"|"snippets"|"all", default "history")

## UX/Behavior Details

- Non-interactive (`CI` or `--no-prompt`): unresolved variables cause non-zero exit with names listed.
- `--copy` places rendered text into clipboard; otherwise prints to stdout or writes `--out`.
- Names map to files with extensions: `.tmpl` for templates, `.txt` for snippets (not required, but default when creating).
- History tagging works even for older entries; missing `tags` implies an empty list.

## Backward Compatibility

- No changes to existing commands.
- New commands are opt-in.

## Out of Scope (deferred)

- Image templates beyond simple image snippets (Phase 3 already covers images elsewhere; revisit later).
- Advanced templating logic, loops/conditionals.

## Milestones

- M1: Renderer + autovars + snippet add/copy.
- M2: Template save/use/edit + indexer.
- M3: Tags + search + pick (history + library).
- M4: Docs, demos, tests to 90%+ coverage of new modules.
