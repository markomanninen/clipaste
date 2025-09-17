# Clipaste Optimization Roadmap

_Last updated: 2025-09-18_

This document tracks performance-focused improvements for `ClipboardManager` and related tooling. It complements existing enhancement plans by concentrating specifically on latency, resource usage, instrumentation, and long‑term architectural opportunities.

---
## 1. Context & Motivation
Initial benchmarks showed repetitive `clipboardy.read()` calls dominating runtime (≈60–65% of operation latency). Phase-level instrumentation plus a benchmark harness allowed empirical validation. Snapshot caching was introduced to collapse multiple sequential reads into one, cutting redundant read calls by ~66% in common CLI patterns.

Key goals going forward:
- Maintain deterministic behavior in tests while enabling aggressive runtime optimizations.
- Provide transparent observability (phase stats, cache hit/miss counts, diff tooling).
- Explore higher‑leverage architectural shifts only after low‑risk optimizations are exhausted.

---
## 2. Completed Optimizations
| Area | Change | Impact |
|------|--------|--------|
| Phase Profiling | Dynamic enable/disable at runtime | Flexible instrumentation without load-order coupling |
| Benchmark Harness | Added JSON/CSV, history snapshots | Repeatable performance tracking |
| Snapshot Caching | Single read shared by hasContent/readText/getContentType | ~50% reduction in per-iteration latency sequence; read phase count -66% |
| Test Safety | Disabled caching under `NODE_ENV=test` | Preserves sequential mock expectations |
| Timestamped History | `--history` output | Longitudinal analysis |

### Representative Benchmark (50 iterations, Windows)
| Metric | Before (avg ms) | After (avg ms) | Notes |
|--------|-----------------|----------------|-------|
| hasContent | ~25–29 | ~26–27 | Becomes the sole actual read |
| readText | ~25–28 | ~0.02 | Snapshot served |
| getContentType | ~25–27 | ~0.006 | Snapshot served |
| clipboardy.read phase count | 150 | 50 | -66.7% |
| clipboardy.read total ms | ~3.7–4.2s | ~1.33s | ≈ proportional to iteration count |

> Variation due to OS scheduling; numbers are illustrative not absolute.

---
## 3. Active Optimization Backlog
Below items mirror the engineering todo list (not yet implemented unless marked):

1. Snapshot hit/miss metrics  
   - Add `_recordPhase('snapshot.hit')` / `snapshot.miss` (only when profiling enabled) to quantify effectiveness.  
   - Acceptance: Phase stats show counts; negligible overhead (<0.05 ms per call).

2. `readAll()` aggregated API  
   - Return `{ text, type, isEmpty }` using one underlying read + classification + snapshot integration.  
   - Acceptance: Existing methods can optionally delegate; no behavioral regression.

3. `--noCache` benchmark flag  
   - Shortcut to set `CLIPASTE_CACHE_DISABLE=1` without manual env export.  
   - Acceptance: Phase read counts revert to pre-caching pattern when enabled.

4. Export `invalidateSnapshot()` helper  
   - Facilitate deterministic test setups & external integration.  
   - Acceptance: Documented, stable API (or symbol) with low misuse risk.

5. Consolidate content queries  
   - Optional path: If caller pattern is `writeText` → `readText` / `getContentType`, allow deriving `hasContent` implicitly.  
   - Acceptance: Example CLI path uses fewer public calls with same semantics.

6. Caching documentation  
   - Add README + CHANGELOG sections: env vars, test-mode behavior, disabling.  
   - Acceptance: Users understand how to toggle & measure.

7. Snapshot cache tests  
   - Cases: hit reuse, TTL expiry, disable flag, test-mode bypass, invalidation post-write/image/clear.  
   - Acceptance: >90% branch coverage of caching logic.

8. Delta benchmark utility  
   - Script to diff two history JSON outputs showing per-phase deltas (absolute & %).  
   - Acceptance: Clear CLI summary with exit code 0 unless missing file/ parse error.

9. Async prefetch after write (exploratory)  
   - Microtask or `setImmediate` triggered read to warm snapshot for anticipated follow-up queries.  
   - Guarded behind env flag (e.g., `CLIPASTE_PREFETCH=1`).  
   - Acceptance: No regression in cold path; measurable improvement if next op <10 ms after write.

10. Persistent helper process (research)  
    - Investigate feasibility of keeping a lightweight helper alive to avoid repeated process or API overhead in clipboardy (depends on clipboardy internals).  
    - Produce spike doc with go/no-go criteria.

---
## 4. Design Notes
### Snapshot Caching
- TTL: `CLIPASTE_SNAPSHOT_TTL` (ms, default 10) keeps staleness window minimal.
- Disabled in test mode; override possible by unsetting `NODE_ENV` or future opt‑in flag.
- Manual disable: `CLIPASTE_CACHE_DISABLE=1`.

### Phase Profiling
- Enable: `CLIPASTE_PHASE_PROF=1` or runtime `enablePhaseProfiling()`.
- Stats aggregated via `getPhaseStats(reset?)`.
- Proposed new keys after metric enhancement: `snapshot.hit`, `snapshot.miss`, optionally `prefetch.success`.

### Failure Modes & Mitigations
| Risk | Mitigation |
|------|------------|
| Stale content served after external (non-Clipaste) clipboard change | Short TTL + disable flag + optional future change detection (hash compare) |
| Over-instrumentation overhead | Guard all metrics behind `phaseEnabled()`; coarse-grained where possible |
| Test fragility due to caching | Test mode bypass implemented |

---
## 5. Acceptance Criteria Summary
| Item | Criteria |
|------|----------|
| Metrics | Accurate counts; no >2% latency regression when enabled |
| readAll() | Single underlying read; snapshot updated; passes existing tests |
| noCache Flag | Simple usage `--noCache`; documented |
| invalidateSnapshot Export | Idempotent; safe if called when no snapshot |
| Prefetch (optional) | Neutral or positive performance; easily disabled |
| Docs | README & CHANGELOG updated coherently |

---
## 6. Testing Strategy
- Unit: Simulated mocked clipboardy to assert snapshot transitions.
- Integration: Benchmark runs pre/post flag toggles asserting read phase counts.
- Regression: Ensure headless & Windows image flows untouched by caching changes.
- Performance: Compare history JSON using future diff utility.

---
## 7. Future Exploration Ideas
- Detect clipboard external mutation via checksum or timestamp (if platform APIs expose change counters).
- Adaptive TTL based on observed access pattern (shorter when bursty, longer when sporadic).
- Multi-platform image support (Linux Wayland/X11) to unify fallback semantics.
- Aggregated batch operations for plugin pipelines.

---
## 8. Environment Variable Reference
| Variable | Purpose | Default |
|----------|---------|---------|
| CLIPASTE_PHASE_PROF | Enable phase profiling | unset (off) |
| CLIPASTE_SNAPSHOT_TTL | Snapshot cache TTL (ms) | 10 |
| CLIPASTE_CACHE_DISABLE | Force-disable caching | unset (enabled) |
| NODE_ENV | Test-mode disables cache fast-path | (varies) |
| (Proposed) CLIPASTE_PREFETCH | Enable async prefetch after writes | unset (off) |

---
## 9. Implementation Order Recommendation
1. Snapshot hit/miss metrics (low risk, adds visibility)
2. readAll() API (unlock consolidation work)
3. noCache flag + docs (usability)
4. invalidateSnapshot export + tests
5. Cache tests (solidify reliability)
6. Consolidation prototype
7. Delta diff utility
8. Prefetch experiment
9. Documentation polish / CHANGELOG update
10. Helper process research spike

---
## 10. Status Legend
- Pending (not started)
- In Progress
- Done / Validated

All backlog items currently: Pending.

---
## 11. Change Log (Local to This File)
- 2025-09-18: Initial version created after snapshot caching & phase profiling enhancements.

---
_Contributions welcome—open a PR referencing the corresponding item number above._
