# Plan: Security Gap Analysis (MVP)

## Scope

This analysis compares the current MVP implementation against the intended security/privacy model documented in:

- `docs/privacy-model.md`
- `docs/rendering-pipeline.md`
- `plans/02-architecture.md`

Code reviewed:

- `src/background.ts`
- `src/content.ts`
- `src/manifest.json`
- `src/manifest.firefox.json`
- `src/styles/reader.css`
- `build.mjs`

Date: 2026-02-26

---

## Executive Summary

The MVP has a strong foundation (markdown-first negotiation, no external script dependencies in reader UI, simple architecture), but there are several meaningful security gaps between the implementation and the documented target model.

Top risks are:

1. **No explicit HTML sanitization step** before injecting rendered output (`innerHTML`), despite docs expecting DOMPurify.
2. **Overly broad URL permissions** (`<all_urls>`) with global content script injection in both Chromium and Firefox.
3. **Link prefetch behavior** introduces additional network activity and potential privacy/abuse concerns.
4. **Lack of explicit CSP hardening** in extension pages/manifests for defense-in-depth.

Overall status: **Moderate risk for MVP**, with clear remediation path.

---

## Current Security Posture (What is good)

- Markdown parser configured with `html: false` (`src/content.ts`), reducing raw HTML passthrough.
- Extension is mostly self-contained (bundled JS/CSS, no runtime external scripts).
- Header negotiation and state handling are simple and auditable.
- No telemetry/analytics logic in current code.
- Per-link markdown support checks are capped (`slice(0, 80)`), preventing unbounded probing.

---

## Gap Register

## P0 (High Priority)

### 1) Missing explicit sanitization layer before HTML injection

**Observed**
- `src/content.ts` renders markdown and injects HTML via `innerHTML`.
- No DOMPurify (or equivalent) sanitization step is present.

**Why this matters**
- Although `markdown-it` is configured with `html: false`, relying on parser configuration alone is brittle.
- Future parser/plugin/config changes can accidentally widen attack surface.
- Security model docs explicitly assume sanitization.

**Recommendation**
- Add DOMPurify sanitization immediately before assigning `innerHTML`.
- Add unit/integration test vectors for malicious markdown payloads.

**Target**
- Milestone: next sprint
- Owner: rendering pipeline

---

### 2) Permissions and host scope broader than principle of least privilege

**Observed**
- Both manifests request broad host access (`<all_urls>`).
- Content scripts run on all URLs at `document_start`.

**Why this matters**
- Increases blast radius if extension logic has a bug.
- Expands privacy footprint and review burden for store submission.

**Recommendation**
- Narrow match patterns where possible (at minimum exclude browser internal pages and non-http(s) schemes explicitly).
- Evaluate using `activeTab`-driven flow for some features rather than always-on injection.
- Keep broad scope only where strictly required and document rationale.

**Target**
- Milestone: next sprint
- Owner: platform

---

## P1 (Medium Priority)

### 3) Link prefetch checks can create privacy and abuse concerns

**Observed**
- Background performs HEAD/GET probes for many links (`PREFETCH_LINK_SUPPORT`).
- This can trigger requests to domains users did not click.

**Why this matters**
- Potentially surprising network behavior.
- Could trip anti-bot/WAF protections.
- Adds side-channel exposure (what pages/links user is reading).

**Recommendation**
- Make prefetch **opt-in** in settings (default off for privacy-conscious mode), or only prefetch on hover.
- Add stricter rate limiting and request budget per page/tab/time window.
- Cache with TTL and domain/path backoff on failures.

**Target**
- Milestone: soon after P0
- Owner: networking/privacy

---

### 4) In-memory-only control state is fragile across service worker restarts

**Observed**
- Mode/bypass/support states live in memory (`Map`, `Set`) in `background.ts`.

**Why this matters**
- In MV3, worker restarts can desync expected behavior.
- Desyncs can produce inconsistent mode indicators and policy application.

**Recommendation**
- Persist minimal tab/domain state in `storage.session` (or `storage.local` where appropriate).
- Rehydrate on startup and validate against current tab URL.

**Target**
- Milestone: next sprint
- Owner: platform

---

### 5) No explicit CSP hardening declaration for extension pages

**Observed**
- Security model docs assume strict CSP model.
- Current manifests do not explicitly encode stronger CSP posture.

**Why this matters**
- Defaults may be acceptable but explicit policy reduces ambiguity and future regressions.

**Recommendation**
- Define explicit CSP for extension pages consistent with current architecture.
- Validate no inline script dependence remains.

**Target**
- Milestone: next sprint
- Owner: platform/security

---

## P2 (Lower Priority / Hardening)

### 6) Raw markdown mode may expose sensitive content in shared environments

**Observed**
- Raw view intentionally shows full source markdown.

**Why this matters**
- Not a vulnerability by itself, but can increase accidental exposure risk in shared/screenshared contexts.

**Recommendation**
- Keep feature (valuable for power users), but consider adding optional “copy redaction mode” later.

---

### 7) Tooltip metadata can reveal internal check behavior

**Observed**
- Tooltips include check method/content-type info.

**Why this matters**
- Low risk, mostly UX detail.

**Recommendation**
- Keep for debugging, optionally add a “simple mode” in UX settings.

---

## Remediation Plan (Suggested Order)

1. **Add DOMPurify sanitization** before `innerHTML` injection.  
2. **Reduce permissions/scope** or document unavoidable broad permissions.  
3. **Gate link prefetch** behind a setting and/or switch to on-hover checks.  
4. **Persist critical state** for MV3 reliability.  
5. **Add explicit CSP** and test policy compatibility.  

---

## Acceptance Criteria for “Security Baseline v1”

- [ ] Sanitization enforced and tested with malicious markdown fixtures.
- [ ] Permission model reviewed; broad permissions justified or reduced.
- [ ] Link prefetch strategy has privacy guardrails (toggle + rate limit).
- [ ] Extension behavior remains stable across worker restarts.
- [ ] CSP explicitly configured and validated.

---

## Notes

This is a gap analysis for MVP iteration velocity. The project can continue shipping incremental UX improvements, but P0 items should be treated as blocking before wider distribution or store promotion.
