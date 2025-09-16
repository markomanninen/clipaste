# Phase 5A: Randomizer Plugin

Deliver a flexible generator plugin that produces secure, locale-aware random strings (passwords, Finnish personal identity codes, IBANs, business IDs, and generic templates) and sends results straight to the clipboard or stdout. Ship it as an independent npm package (`clipaste-randomizer`) that the core Clipaste CLI consumes via the plugin API.

## Goals

- Provide a `clipaste random` command group with consistent UX for multiple generator types.
- Support secure defaults (cryptographically strong randomness, validation, masking sensitive output).
- Allow parameterized generation (lengths, charsets, format templates, locale toggles) with per-command overrides and saved presets.
- Integrate into existing clipboard pipeline: auto-copy by default with optional `--no-copy`.
- Supply helper metadata (e.g., checksum digits, formatting notes) when relevant.
- Keep the randomizer module repository-independent; Clipaste should depend on its published package without requiring repo vendoring.

## Non-Goals (5A)

- Building a full password manager or secrets vault.
- Long-term persistence of generated secrets beyond clipboard history rules.
- Supporting every global ID format; focus on Finnish IDs + IBAN + Finnish business IDs.
- Browser UI or GUI integration (CLI + plugin API only).

## CLI Surface

- `clipaste random password [--length 16] [--charset alnum|ascii|custom] [--include <chars>] [--exclude <chars>] [--words <count>] [--wordlist eff|custom] [--entropy] [--no-copy]`
- `clipaste random string --template "XXXX-XXXX" [--pool A-Z0-9] [--no-copy]`
- `clipaste random personal-id [--age-range 18-65] [--born 1990-01-01] [--gender any|female|male] [--format long|short] [--validate-only <id>] [--no-copy]`
- `clipaste random iban [--country FI] [--bank <code>] [--validate-only <iban>] [--format compact|spaced] [--no-copy]`
- `clipaste random business-id [--country FI] [--validate-only <id>] [--no-copy]`
- Shared flags: `--output json|text`, `--show-meta` (prints extra info), `--seed <hex>` (dev/testing), `--preset <name>` (loads config), `--save-preset <name>`.

Each generator returns primary value + contextual metadata (e.g., checksum digit, date of birth) when `--show-meta` or JSON output is requested.

## Generator Details

- **Password**: crypto-random bytes mapped to charset (default: 20 chars, upper/lower/digits/symbols). Word-based option using EFF diceware list. Optional entropy calculation.
- **Generic String Template**: interpret template placeholders (`X` default pool, `#` digits, `{set}` custom). Supports escaping. Useful for license keys or custom formats.
- **Finnish Personal Identity Code (HETU)**:
  - Date component derived from `--born` or randomly sampled within `--age-range`.
  - Individual number parity controls gender when requested.
  - Checksum (`+`, `-`, `A`) computed with modulo 31 mapping.
  - Validation mode returns diagnostics if provided code fails.
- **IBAN**:
  - Support generation for FI (MVP) using bank/account seeds and mod 97 checksum; structure stored in per-country schema.
  - Validation mode handles generic IBAN pattern and check digits.
  - Format option toggles spacing every 4 characters.
- **Finnish Business ID (Y-tunnus)**:
  - Generate seven-digit base with modulo 11 checksum, ensure valid remainder.
  - Validation mode surfaces reasons for failure.

## Clipboard & History Integration

- Results copy to clipboard unless `--no-copy`; history entry annotated with `type` (`random:password`, etc.) and meta payload.
- Sensitive values flagged to respect existing redaction/auto-clear configuration (e.g., exclude from plain-text logs, mark as secret where applicable).
- Optionally mask display in terminal (`••••`) when printing unless `--show` or explicit `--output json`.

## Configuration & Presets

- Add `randomizer.json` under config directory for stored presets (per generator) and custom wordlists/templates (lives in Clipaste config but schema owned by the plugin package).
- Global defaults: default password length, default charset, default country for IDs.
- Support `clipaste config random` commands for listing/removing presets.
- Allow plugin API to register additional generators later (phase 5B+) without requiring changes to Clipaste core.

## Packaging & Integration

- Host the implementation in a dedicated `clipaste-randomizer` repository with its own CI, linting, and release workflow.
- Publish as an npm package exposing plugin registration hooks plus reusable generator utilities for other consumers.
- Clipaste core imports the package as an optional dependency and loads it via the existing plugin discovery mechanism (e.g., auto-registration when installed).
- Define a thin adapter in Clipaste to expose the `clipaste random` command group only when the plugin is present, showing install guidance otherwise.
- Maintain semantic versioning with compatibility guarantees for the Clipaste plugin interface.

## Implementation Plan

1. **Scaffold External Plugin**
   - Initialize the `clipaste-randomizer` repo with plugin registry abstraction and build tooling.
   - Establish TypeScript project setup, lint rules, test harness, and CI pipeline mirroring Clipaste standards.
   - Define the public plugin contract (registration function, metadata) consumed by Clipaste core.
2. **Core Utilities**
   - Implement crypto RNG wrapper, charset builder, checksum helpers (mod 11, mod 31, mod 97).
   - Build template parser supporting placeholders and escaped literals.
   - Add validation/formatting utilities for each ID type.
3. **Password & Template Generators (M1)**
   - Implement password generator with charsets, inclusion/exclusion, wordlist support.
   - Implement template-based string generator and CLI integration.
   - Write unit tests for RNG mapping, entropy calculation, templating edge cases.
4. **Finnish IDs (M2)**
   - Implement HETU generator: date sampling, gender parity, checksum.
   - Implement Business ID generator/validator.
   - Tests covering known valid/invalid examples.
5. **IBAN Support (M3)**
   - Implement FI IBAN generator + validator, spacing formats.
   - Design schema to extend more countries later.
   - Add tests for checksum correctness and formatting.
6. **Clipboard & History Hooks (M4)**
   - Provide integration shims within the plugin so Clipaste can wire clipboard/history behavior through exported callbacks.
   - Ensure generated values pipe to clipboard/history with meta flags when invoked inside Clipaste.
   - Implement sensitive masking and `--no-copy` path, configurable via plugin options.
7. **Presets & Config (M5)**
   - Implement preset CRUD, config file schema validation (owned by plugin).
   - Support custom wordlists/templates loaded from config.
   - Expose helper functions so Clipaste CLI layer can implement `--preset` and `--save-preset` flows.
8. **Docs & Demos (M6)**
   - Maintain README/docs in both repos: plugin usage/API in `clipaste-randomizer`, integration instructions in Clipaste core docs.
   - Provide demo scripts showcasing password & ID generation in the plugin repo; reference them from Clipaste docs.

## Testing Strategy

- Unit: RNG entropy mapping, template parser, checksum calculators, validators (run in plugin CI).
- Integration: CLI invocations for each generator, including clipboard stub, JSON output, presets (plugin repo) + Clipaste end-to-end tests ensuring plugin loads correctly when installed.
- Snapshot/golden files for typical `--show-meta` JSON payloads.
- Security testing: ensure `--seed` only allowed in non-production (warn when used), verify no predictable RNG fallbacks.

## Dependencies

- Prefer Node`s`crypto.randomBytes` (native). Optional small libs (declared in plugin package):
  - `diceware` or embed EFF wordlist file (license check).
  - Lightweight schema validation (`zod` already? reuse existing stack).
- Avoid heavy or network-dependent packages.

## Risks & Mitigations

- **Regulatory accuracy**: Validate HETU/IBAN/biz ID logic against official specs and add comprehensive tests.
- **Security**: Avoid logging secrets; respect clipboard auto-clear settings; disable seeding in production builds.
- **Extensibility**: Use generator registry to allow future additions without CLI churn.

## Deliverables

- `clipaste-randomizer` repo with published npm package exposing generators, validators, and tests.
- Clipaste core integration shim enabling `clipaste random` commands when the plugin is installed, with graceful messaging otherwise.
- Documentation across both repos (plugin README, Clipaste plugin guide update, changelog entries).
- Demo assets and sample presets for quick starts.
- Automation updates ensuring lint/tests cover new modules in both repos (plugin CI + Clipaste integration tests).
