# Plan: Development Milestones

## Milestone 0: Proof of Concept (1 week)

**Goal:** Validate the core idea — modify `Accept` headers, detect markdown responses, and display raw markdown in the browser.

**Deliverables:**
- [ ] Minimal Manifest V3 Chrome extension
- [ ] Background service worker that adds `Accept: text/markdown` to navigational requests
- [ ] Detect `text/markdown` responses via `declarativeNetRequest` or `webRequest`
- [ ] When markdown is detected, open a basic reader page showing the raw markdown rendered to HTML
- [ ] Use `marked` or `markdown-it` for rendering
- [ ] Test against Cloudflare Blog and Developer Docs

**Validates:**
- Content negotiation works from an extension
- Cloudflare's markdown quality is sufficient for direct rendering
- The extension can intercept and redirect markdown responses

---

## Milestone 1: Reader View MVP (2 weeks)

**Goal:** A polished reader view with good typography for markdown-served pages.

**Deliverables:**
- [ ] Clean reader page (`reader.html`) with optimized CSS typography
- [ ] YAML frontmatter parsing — extract title, description for the page
- [ ] Syntax-highlighted code blocks (Prism.js or Highlight.js)
- [ ] GFM support: tables, task lists, strikethrough
- [ ] Dark/light theme toggle (respects system preference by default)
- [ ] Extension icon badge shows "MD" when page is served as markdown
- [ ] Popup with basic info: source type, token count from `x-markdown-tokens`
- [ ] Keyboard shortcut to toggle reader mode (e.g., `Ctrl+Shift+R`)
- [ ] "View original page" button to exit reader mode
- [ ] Smooth scrolling, readable line width (~65-75 chars)

**Out of scope:** HTML fallback, settings page, Firefox support

---

## Milestone 2: HTML-to-Markdown Reader Mode (2 weeks)

**Goal:** Make the extension useful on every page, not just markdown-enabled ones.

**Deliverables:**
- [ ] Integrate `@mozilla/readability` for content extraction from any HTML page
- [ ] Integrate `turndown` for HTML-to-markdown conversion
- [ ] "Reader mode" button in popup and via keyboard shortcut for any HTML page
- [ ] Visual indicator distinguishing native markdown (`MD ✓`) vs. converted (`HTML →`)
- [ ] Handle edge cases:
  - Pages with no extractable content (show message + link to original)
  - Very short pages (skip readability, convert directly)
  - Pages with multiple articles (e.g., index pages)
- [ ] Auto-activate reader mode option for markdown-served pages
- [ ] Preserve internal links (clicking a link in reader mode navigates normally)

---

## Milestone 3: Settings & Polish (2 weeks)

**Goal:** Make the extension configurable and ready for daily use.

**Deliverables:**
- [ ] Options page with:
  - Mode selection: Auto (always request markdown) / Manual (button only)
  - Theme: Light / Dark / Sepia / System
  - Typography: font family, size, line width, line height
  - Image loading toggle
  - Domain allowlist (always activate) / blocklist (never activate)
- [ ] Sepia theme
- [ ] Image handling: show alt text by default, click to load individual images
- [ ] Table of contents sidebar (auto-generated from headings)
- [ ] Find in page works within reader view (Ctrl+F)
- [ ] Print-friendly styling
- [ ] Export as markdown file (download `.md`)
- [ ] Settings sync via `chrome.storage.sync`

---

## Milestone 4: Firefox Support (1 week)

**Goal:** Ship on Firefox Add-ons (AMO).

**Deliverables:**
- [ ] Manifest V2 / V3 compatibility layer for Firefox
- [ ] Use `browser.webRequest` for header modification on Firefox
- [ ] Test full functionality on Firefox
- [ ] Firefox-specific popup and options page adjustments
- [ ] Publish to Firefox Add-ons

---

## Milestone 5: Advanced Features (ongoing)

**Goal:** Features that make md-browser a compelling daily driver.

**Deliverables:**
- [ ] **Auto-detect markdown support** — remember which domains serve markdown, show indicator
- [ ] **Reading progress** — progress bar and position memory per URL
- [ ] **Save for later** — cache markdown locally for offline reading
- [ ] **Keyboard navigation** — Vimium-style link hints within reader view
- [ ] **Math rendering** — KaTeX for LaTeX in markdown
- [ ] **Footnotes** — proper footnote rendering with back-references
- [ ] **Page outline / TOC** — collapsible sidebar with heading navigation
- [ ] **Estimated reading time** — based on word count, shown at top
- [ ] **Share as markdown** — copy the page's markdown to clipboard
- [ ] **Context menu integration** — right-click "Open in reader mode" / "Copy as markdown"
- [ ] **Side panel mode** (Chrome) — render reader view in Chrome's side panel alongside the original page
- [ ] **Per-site theme memory** — remember theme preference per domain
- [ ] **Annotation / highlighting** — highlight passages, save notes (local only)

---

## Timeline Summary

| Milestone | Duration | Cumulative |
|---|---|---|
| M0: Proof of Concept | 1 week | Week 1 |
| M1: Reader View MVP | 2 weeks | Week 3 |
| M2: HTML Fallback Reader Mode | 2 weeks | Week 5 |
| M3: Settings & Polish | 2 weeks | Week 7 |
| M4: Firefox Support | 1 week | Week 8 |
| M5: Advanced Features | Ongoing | — |

A functional, daily-usable Chrome extension in **5 weeks**. Firefox support by **week 8**. Compared to the standalone browser approach (~18 weeks to GUI), the extension ships 3-4x faster.
