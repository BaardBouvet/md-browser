# Plan: Architecture

## Runtime components

- `src/background.ts`: request negotiation, tab mode state, badge/title updates, and feature checks.
- `src/content.ts`: markdown/HTML detection, reader DOM rendering, TOC, raw markdown mode, tooltip UX.
- `src/browser-api.ts`: compatibility wrapper for Chromium and Firefox API differences.

## Build and packaging

- Build script: `build.mjs`.
- Outputs:
  - `dist/chromium` (Edge/Chromium-based browsers)
  - `dist/firefox`
- Manifests:
  - `src/manifest.json` (Chromium)
  - `src/manifest.firefox.json` (Firefox)

## Request/render flow

1. Background negotiates markdown-capable requests.
2. Page state is evaluated (native markdown vs fallback path).
3. Content script renders reader UI in page context.
4. User can switch between rendered and raw markdown view.

## Key design constraints

- Cross-browser support without separate codebases.
- In-page rendering first (minimal context switching).
- Toolbar as primary control surface.
- Keep feature logic small and composable for iterative UX changes.

## Known architecture gaps

- Security hardening items (sanitization/CSP/permission tightening).
- Some request behavior still broad and can be scoped further.

See `plans/05-security-gap-analysis.md` for remediation sequence.
