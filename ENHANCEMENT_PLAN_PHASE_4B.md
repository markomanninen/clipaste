# Phase 4B: AI Plugin (Optional, Opt-in)

Add an optional AI plugin for summarizing, classifying, and transforming clipboard content. Local-first, privacy-safe, and provider-agnostic.

## Goals

- Offer value-add commands without coupling core flows to AI.
- Default to local/offline options when possible; explicit consent for network.
- Keep provider adapters thin and replaceable.

## Non-Goals (4B)

- Shipping large model weights or managing GPU setup.
- Building a full prompt-engineering framework; keep commands task-oriented.

## CLI Surface

- `clipaste ai summarize [--source clipboard|stdin|file <path>] [--max-tokens N] [--provider <p>] [--model <m>] [--copy] [--json] [--consent] [--redact <rules>]`
- `clipaste ai classify  [--labels "a,b,c"] [--provider <p>] [--model <m>] [--copy] [--json] [--consent] [--redact <rules>]`
- `clipaste ai transform [--instruction "rewrite as ..."] [--provider <p>] [--model <m>] [--copy] [--json] [--consent] [--redact <rules>]`

Common options:

- `--provider`: `ollama` (local HTTP), `lmstudio` (local), `openai`, `anthropic`, `bedrock`, `custom` (generic endpoint).
- `--model`: provider-specific model identifier.
- `--consent`: required when provider implies network (not local). Can be set in config.
- `--redact`: comma-separated rules like `emails,keys,secrets` to mask before sending.
- `--timeout`, `--temperature`, `--top-p`, `--seed` (as supported by provider).

## Provider Architecture

- `src/ai/providers/base.js`: minimal interface: `name`, `capabilities`, `complete({prompt, ...opts})`.
- Adapters:
  - `ollama`: POST `/api/generate` to `http://localhost:11434` (default), stream supported when feasible.
  - `lmstudio`: similar local endpoint.
  - `openai`: `chat.completions` with `OPENAI_API_KEY`.
  - `anthropic`: messages API with `ANTHROPIC_API_KEY`.
  - `custom`: configurable `endpoint`, `headers`, `payloadTemplate` via config.

Default build ships only local adapters (ollama, lmstudio) to avoid API deps. Cloud adapters load conditionally when env vars present or when installed as optional package.

## Redaction

- Pre-processing step that detects and masks patterns:
  - Emails, API keys (heuristics), JWTs, IPv4/IPv6, file paths.
  - Rule engine in `src/ai/redact.js` with unit tests.
- Provide `--show-redacted` (debug) and `--no-redact` to disable.

## Consent and Safety

- Network calls require explicit consent via `--consent` or config key `ai.networkConsent: true`.
- Display a one-time warning summarizing what data may be sent.
- Never auto-send clipboard without user action.

## Config

- `ai.defaultProvider`, `ai.defaultModel`.
- `ai.providers.ollama.endpoint`.
- `ai.providers.openai.apiKey` (or `OPENAI_API_KEY` env).
- `ai.redaction.enabled`, `ai.redaction.rules`.
- `ai.networkConsent`.

## I/O and Modes

- Sources: `clipboard` (default), `stdin`, or `file`.
- Output: stdout by default, `--copy` to clipboard, or `--out <file>`.
- `--json` prints machine-friendly responses (content + meta like tokens, latency).

## Implementation Plan

### 1. Core API and local provider

- Base interface, error types, rate limit handling.
- Implement `ollama` provider; test against a mocked endpoint in CI.

### 2. Commands and utilities

- `ai summarize/classify/transform` backed by providers.
- Redaction module and tests.
- Source/target handling (clipboard/stdin/file, copy/out).

### 3. Cloud adapters (optional)

- OpenAI and Anthropic adapters behind feature flags; load only if keys exist.
- Clear consent flow; redact by default.

### 4. Testing

- Unit: redact rules, prompt assembly, provider contract.
- Integration: mock servers for providers; golden output tests.

## Dependencies

- None required for local providers (use native `fetch`).
- Optional: `eventsource-parser` or similar for streaming, only if needed.

## Backward Compatibility

- Entirely opt-in; no impact on existing commands.

## Milestones

- M1: Base + Ollama + summarize.
- M2: classify/transform + redaction.
- M3: Cloud adapters (optional) + consent + docs.
