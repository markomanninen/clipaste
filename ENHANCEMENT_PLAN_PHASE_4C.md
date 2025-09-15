# Phase 4C: Cloud/Backup Plugin

Deliver reliable backups and optional sync with minimal dependencies and strong privacy defaults. Start with folder-based sync and encrypted backups; add adapters later.

## Goals

- Simple, robust backups with encryption and integrity checks.
- Folder-sync MVP that works with iCloud/Dropbox/OneDrive via their clients.
- Optional lightweight remote adapters (e.g., WebDAV) with end-to-end encryption.

## Non-Goals (4C)

- Complex real-time multi-writer CRDTs.
- Shipping heavyweight cloud SDKs by default.

## CLI Surface

- Backup
  - `clipaste backup create --file <backup.tar.gz> [--encrypt] [--passphrase-env VAR] [--note "..."]`
  - `clipaste backup restore --file <backup.tar.gz> [--decrypt] [--passphrase-env VAR] [--dry-run]`
  - `clipaste backup list` (metadata from recent backups; local history)
  - `clipaste backup verify --file <backup.tar.gz>` (integrity)

- Sync (folder-first)
  - `clipaste sync enable --mode folder --dir <path> [--encrypt] [--passphrase-env VAR]`
  - `clipaste sync status` (last push/pull, items, conflicts)
  - `clipaste sync push|pull|rescan`
  - `clipaste sync disable`

- Organization
  - `clipaste organize --dedupe [--by sha256|id] [--dry-run]`
  - `clipaste migrate --store-dir <path>` (move local store safely)

## Storage and Formats

- Local store continues as JSON and content files under config dir. Add `deviceId` (random UUID) in `config.json`.
- Backup archive: `tar.gz` containing:
  - `metadata.json` (version, created, deviceId, note, hash algorithm, salt/iterations if encrypted)
  - `history.json`, `templates/`, `snippets/`, any attachments
- Encryption: AES-256-GCM; key from passphrase via PBKDF2 (salt, iterations in metadata). Store auth tag; verify on restore.

## Sync: Folder Mode (MVP)

- Users point to a folder that is already synced by their provider.
- We mirror `history.json`, `templates/`, `snippets/`, and a lightweight `manifest.json` with item hashes.
- Merge rules:
  - Item identity: `id` for history records; path for templates/snippets.
  - Dedupe by `sha256` of content when sensible.
  - Conflict resolution: last-write-wins by `mtime` or `ts`; keep conflicted copies with suffix `.conflict-<device>-<ts>` when ambiguous.
- Optional E2E encryption: store encrypted blobs (`.enc`) with local transparent decrypt if `--encrypt` is enabled.

## Optional Adapters (post-MVP)

- `webdav` adapter: minimal dependency (`webdav` npm). Config: url, username, password or app token.
- `s3`/`gcs`/`azure`: defer; if added, package as optional plugin and upload only encrypted archives/blobs.

## Integrity and Safety

- Maintain SHA-256 in `manifest.json` for each file; `verify` checksums.
- On restore: validate archive, fail safely on mismatch, support `--dry-run` to preview changes.
- Never send unencrypted sensitive content to remote by default.

## Config

- `storeDir` (overrides default config dir).
- `sync.mode` ("disabled"|"folder"|"webdav"|...)
- `sync.folder.dir`, `sync.encrypt`, `sync.passphraseEnv`.
- `backup.encryptDefault` (bool), `backup.passphraseEnv`.

## Implementation Plan

### 1. Backup

- Implement tar.gz create/restore using Node streams (`zlib`) + `tar-stream` or `archiver`.
- Add AES-256-GCM encrypt/decrypt wrapper with PBKDF2 key derivation.
- Add `verify` and `--dry-run` restore.

### 2. Folder Sync

- Implement `manifest.json` generation (paths, sizes, hashes, mtimes).
- Add `push/pull/rescan` and `status` commands.
- Implement merge with last-write-wins and conflict copies.

### 3. Optional Adapter

- Add WebDAV adapter behind a feature flag with the smallest viable client.

### 4. Testing

- Unit: crypto, tar, manifest, merge.
- Integration: folder round-trip, conflict scenarios, encrypted backup lifecycle.

## Dependencies

- Required: none (prefer stdlib + tiny libs). If needed: `tar-stream` or `archiver` (choose one, not both).
- Optional: `webdav` for WebDAV mode.

## Backward Compatibility

- Fully optional; no changes to existing commands.
- Default `sync.mode` is `disabled`.

## Milestones

- M1: Backup create/restore/verify (unencrypted) + tests.
- M2: Encryption + passphrase env support.
- M3: Folder sync push/pull/status + manifest + merge.
- M4: WebDAV adapter (optional) + docs/demos.
