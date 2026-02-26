# Security Gap Analysis

Date: 2026-02-26

## Scope

Code reviewed:

- `src/background.ts`
- `src/content.ts`
- `src/manifest.json`
- `src/popup/popup.ts`

## Executive summary

Security posture is improved from the initial MVP baseline.

Implemented hardening:

- HTML sanitization added before reader DOM injection (`DOMPurify`).
- Host scope reduced to `http/https` in manifest and request listeners.
- Explicit extension page CSP configured.
- Link capability checks are configurable and default **off** for privacy.

Remaining risk is now mainly operational hardening and persistence reliability.

## Current gap register

### P1: In-memory mode state can reset on service worker restart

**Observed**

- `markdownTabs` / `bypassedTabs` are in-memory structures.
- Popup and badge behavior can drift briefly after worker restart.

**Why it matters**

- Inconsistent UX/state signaling.
- Potential confusion around current mode and controls.

**Recommended action**

- Persist minimal mode state in `storage.session`.
- Rehydrate state on startup and reconcile with active tab URL.

### P1: Link capability checks still perform active network probing when enabled

**Observed**

- Enabled mode issues HEAD/GET checks for candidate links.

**Why it matters**

- Additional outbound traffic and potential anti-bot friction.
- Privacy footprint increases when enabled.

**Recommended action**

- Keep default-off (already done).
- Add stricter budget/rate limiting per tab/time window.
- Add TTL-based cache/backoff strategy.

### P2: Permission minimization still has room for refinement

**Observed**

- Extension still needs broad `http/https` host coverage for current behavior.

**Why it matters**

- Larger review surface than an `activeTab`-only model.

**Recommended action**

- Evaluate partial migration toward on-demand (`activeTab`) flows for non-core features.

## Closed items (fixed)

- Missing HTML sanitization layer.
- `<all_urls>` host scope.
- Missing explicit CSP declaration.
- Link checks default-on privacy posture.

## Acceptance criteria for next security checkpoint

- [ ] State persistence added for mode/bypass reliability.
- [ ] Link-check request budget + backoff implemented.
- [ ] Host access rationale documented for store review.
