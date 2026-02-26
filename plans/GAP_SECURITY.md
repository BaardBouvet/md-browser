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

No critical or high-priority unresolved security gaps remain in the current implementation baseline.

Residual items are optimization-oriented:

- Further permission reduction toward a more `activeTab`-first model where feasible.
- Additional telemetry-free observability for local debugging of negotiation/link checks.

## Closed items (fixed)

- Missing HTML sanitization layer.
- `<all_urls>` host scope.
- Missing explicit CSP declaration.
- Link checks default-on privacy posture.
- In-memory-only runtime mode state.
- Missing link-check request budget/backoff controls.

## Host access rationale

Current host scope is `http://*/*` and `https://*/*` because core extension behavior depends on:

- request header negotiation on top-level navigation,
- markdown response detection for page mode,
- content script rendering on arbitrary markdown-capable sites.

This scope intentionally excludes non-web schemes and is the minimum practical scope for the current architecture.

## Acceptance criteria for next security checkpoint

- [x] State persistence added for mode/bypass reliability.
- [x] Link-check request budget + backoff implemented.
- [x] Host access rationale documented for store review.
