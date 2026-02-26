# Competitive Landscape Research

> **Date:** February 2026
> **Scope:** Browser extensions, APIs, CLI tools, and standalone apps that render, convert, or negotiate markdown from the web.
> **Key finding:** No existing tool combines HTTP `Accept: text/markdown` content negotiation with an in-browser reader view for human consumption.

---

## 1. Markdown Viewer / Renderer Extensions

These extensions render `.md` files in the browser. They do **not** request markdown from servers via content negotiation and do **not** convert HTML pages to markdown for reading.

| Extension | Platform | Users | Rating | What it does |
|---|---|---|---|---|
| **Markdown Reader** (Bener) | Chrome | 60,000 | 4.6★ | Preview `.md` files from `file://`, `http://`, `https://` URLs. Supports emoticons, math, flowcharts, TOC, dark/light themes, live reload. 11.3 MB. |
| **Markdown Viewer** | Chrome | — | 4.3★ | Dark mode, themes, autoreload, Mermaid diagrams, MathJax, TOC, syntax highlighting. |
| **MarkView** | Chrome | — | 5.0★ | Mermaid, Vega, DrawIO, canvas, LaTeX, code highlight, local processing. DOCX/HTML export. |
| **Local Markdown Viewer** | Chrome | — | 4.8★ | Focused on local `.md` files. |
| **Markdown Reader** (Firefox) | Firefox | 1,715 | 5.0★ | Preview markdown documents in Firefox. |

### Gap analysis
These only activate when the URL literally ends in `.md` or the response is already `text/markdown`. They have no mechanism to **request** markdown from a server that might offer it, and they don't handle HTML pages at all.

---

## 2. Web Clipper / HTML-to-Markdown Extensions

These convert a page's HTML content into markdown for download or clipboard use. The user triggers conversion manually; the result is exported, not displayed as a reader view.

| Extension | Platform | Users | Rating | What it does |
|---|---|---|---|---|
| **MarkDownload - Markdown Web Clipper** (death.au) | Chrome + Firefox | 30,000 (Chrome) / 9,271 (Firefox) | 4.7★ / 4.9★ | Click icon → popup shows rendered markdown → download `.md` file. Uses Readability.js + Turndown 7.1. Obsidian integration. Open source. Last updated Sep 2022 (Firefox), Aug 2024 (Chrome). |
| **LLMFeeder - Web to Markdown for AI** | Firefox | 239 | 5.0★ | Converts web pages to clean markdown for feeding to ChatGPT/Claude. Multi-tab, context menu, token counter (GPT-4/Claude tokenizer), include/exclude links toggle. 100% offline, MIT license. Actively maintained (v2.1.0, Feb 2026). |
| **Get Markdown** (Harish Garg) | Firefox | 11 | — | One-click download of page as `.md`. Uses Readability + Turndown. Reader mode extraction, metadata (author, date, source). Very small (33 KB). Nov 2025. |
| **HTML to Markdown** | Chrome | 5,000 | 4.6★ | Select HTML text → convert to markdown. Simple selection-based tool. Last updated Jun 2021. |
| **Webpage to Markdown** | Chrome | — | 5.0★ | Converts full current page to markdown. |
| **Copy as Markdown** (multiple) | Chrome | — | 4.0–4.3★ | Copy links, images, selected text as markdown snippets. |
| **html2md** | Chrome | — | 5.0★ | Convert selected HTML to markdown. |

### Gap analysis
These are **export tools** — they produce a file or clipboard content for use elsewhere. None of them replace the page with a clean rendered view. None of them use HTTP content negotiation to get server-native markdown. The closest tool (LLMFeeder) is clearly positioned for AI input, not human reading.

---

## 3. Reader Mode Extensions

These strip page clutter and present article content in a clean, readable layout — conceptually the closest to md-browser's reader view. However, they work entirely on HTML and have no markdown awareness.

| Extension | Platform | Users | Rating | What it does |
|---|---|---|---|---|
| **Reader View** (rNeomy) | Chrome | 300,000 | 4.7★ | Mozilla Readability for Chromium. Strip clutter, read in fullscreen, TTS, MathJax support, bionic reading, DOI details, sticky notes, multi-column. Open source. Manifest V3. 302 KB. |
| **Clearly Reader** | Chrome | 100,000 | 4.6★ | AI reading assistant. One-click reader mode (Alt+R). TTS, cross-device sync, export to PDF/Word/Markdown. Code highlighting, LaTeX. Dark mode + custom themes. Cloud bookmarks. 6.88 MB. |
| **Reader Mode for Google Chrome™** | Chrome | — | 4.6★ | Strips clutter, changes text size and contrast. |
| **Just Read** | Chrome | — | 4.6★ | Feature-packed, customizable reader. |
| **Chrome Reader Mode** | Chrome | — | 3.9★ | Basic reader mode. |
| **Circle Reader** | Chrome | — | 4.4★ | Immersive reading on the web. |
| **Firefox Reader View** | Firefox (built-in) | — | — | Built into Firefox. Uses Readability.js. Free, no extension needed. |

### Gap analysis
Reader mode extensions solve the same **user problem** as md-browser (distraction-free reading) but take a fundamentally different approach:
- They pull the full HTML page, then strip it client-side with Readability.js
- They have no awareness of `Accept: text/markdown` content negotiation
- They cannot leverage server-side markdown where available
- Quality depends entirely on how well Readability can extract content from arbitrary HTML

md-browser would use these same fallback techniques for non-markdown sites, but its **primary path** (native markdown via content negotiation) would deliver higher-quality, lower-bandwidth results on supporting sites — and that path is unique.

---

## 4. Cloud/API-Based Conversion Services

| Service | Type | What it does |
|---|---|---|
| **Jina Reader** (`r.jina.ai`) | Cloud API | Prepend `r.jina.ai/` to any URL → get clean LLM-friendly markdown. Uses Turndown internally. Supports PDF, images (auto-caption via VLM), custom CSS selectors, streaming, 29 languages. Free tier: 20 RPM. Paid tiers from $50/1B tokens. Also offers `s.jina.ai` for SERP. **Not a browser extension.** |
| **Cloudflare Workers AI `toMarkdown`** | Cloud API | Cloudflare's own API for converting HTML to markdown using Workers AI. Server-side only. |

### Gap analysis
Jina Reader is powerful but is a **cloud proxy** — every page load goes through Jina's servers, breaking privacy and adding latency. It's designed for LLM pipelines, not human browsing. md-browser would process everything locally, and on markdown-capable sites, wouldn't even need conversion at all.

---

## 5. Tools Specifically Using Cloudflare "Markdown for Agents"

All existing tools in this space are **server-side** — they help site owners *serve* markdown, not help users *request* it:

| Project | Stars | Type | What it does |
|---|---|---|---|
| **moneo/laravel-markdown-for-agents** | 16 | Laravel package (PHP) | Server-side: unifies Markdown for Agents, Workers AI toMarkdown, and Browser Rendering under one Laravel API for site owners. |
| **aivorynet/cloudflare-ai-markdown-worker** | 5 | Cloudflare Worker (JS) | Server-side: Worker that serves pre-generated markdown to AI agents, uses Turndown for on-the-fly conversion. |
| **alvinunreal/markdownforagents** | 4 | Cloudflare Worker (HTML) | Server-side: URL-to-markdown + PageMap extraction API for LLM/agent workflows. Available at markdownforagents.com. |
| **Keith-CY/idx.md** | 4 | Registry (markdown) | Markdown registry for AI agent libraries with indexed HEAD/BODY content. |
| **magnifito/astro-markdown-for-agents** | 0 | Astro plugin (TS) | Server-side: recreates Cloudflare Markdown for Agents for static Astro sites not on Cloudflare. |
| **alanw707/markdownready** | 0 | Scanner (HTML) | Scans websites to check if they are "agent-ready" (Cloudflare markdown support, AI crawler rules, Content-Signals headers). |
| **nibzard/accept-header-test** | 0 | Cloudflare Worker (JS) | Server-side: detects AI agents via Accept header, serves Markdown vs HTML accordingly. |

### Gap analysis
The entire ecosystem is focused on the **supply side** — helping websites serve markdown to AI agents. **Nobody has built the demand side for humans.** There is no browser extension, CLI tool, or standalone browser that acts as a *client* for `Accept: text/markdown` content negotiation and renders the result as a reader view.

This is the gap md-browser fills.

---

## 6. Terminal / TUI Browsers

| Browser | What it does | Markdown support |
|---|---|---|
| **Bombadillo** | TUI browser for Gopher, Gemini, Finger, local filesystem. Vi-like keybindings. Privacy-focused. | Renders Gemini (gemtext), not markdown. No HTTP `Accept: text/markdown`. |
| **Lynx / w3m / elinks** | Classic text-mode web browsers. | Render HTML as plain text. No markdown awareness. |
| **Carbonyl** | Chromium running in the terminal. | Full HTML rendering. No markdown optimization. |

### Gap analysis
No terminal browser supports `Accept: text/markdown` content negotiation.

---

## 7. Differentiation Summary

| Capability | md-browser | Markdown Viewers | Web Clippers | Reader Mode Exts | Jina Reader |
|---|---|---|---|---|---|
| `Accept: text/markdown` negotiation | ✅ **Unique** | ❌ | ❌ | ❌ | ❌ |
| Auto-detect markdown-capable sites | ✅ **Unique** | ❌ | ❌ | ❌ | ❌ |
| Render server-native markdown | ✅ | ✅ (`.md` files only) | ❌ (exports) | ❌ | ✅ (via proxy) |
| Reader view for HTML fallback | ✅ | ❌ | ❌ | ✅ | ✅ (via proxy) |
| 100% local processing | ✅ | ✅ | ✅ | ✅ | ❌ (cloud) |
| Works in existing browser | ✅ (extension) | ✅ | ✅ | ✅ | ❌ (API) |
| Bandwidth reduction | ✅ (~80% on MD sites) | N/A | N/A | ❌ (loads full page) | ❌ (loads full page via proxy) |
| No additional request | ✅ (header modification) | N/A | N/A | ❌ (page already loaded) | ❌ (separate request) |

---

## 8. Conclusions

1. **No direct competitor exists.** No browser extension or tool on any platform combines HTTP `Accept: text/markdown` content negotiation with an in-browser reader view. md-browser would be the first.

2. **The server-side ecosystem is growing.** Laravel packages, Astro plugins, Cloudflare Workers — site owners are starting to adopt Markdown for Agents. As supply grows, the value of a client-side consumer increases.

3. **Reader mode is a proven market.** Reader View (300K users), Clearly Reader (100K users), and Firefox's built-in reader view prove strong demand for distraction-free reading. md-browser's reader view would serve the same need, but with a fundamentally better source on markdown-capable sites.

4. **Web clippers validate the Readability + Turndown stack.** MarkDownload (30K Chrome users) and LLMFeeder demonstrate that Readability.js + Turndown is a mature, proven pipeline for HTML-to-markdown conversion — the same stack md-browser plans for its fallback path.

5. **Privacy is a real differentiator vs. Jina Reader.** Jina Reader is the most capable markdown conversion service, but it proxies all traffic through their servers. md-browser processes everything locally, with the markdown-native path avoiding even client-side conversion.

6. **Timing is perfect.** Cloudflare's Markdown for Agents feature is brand new (Feb 2026). The server-side tools are 0–2 weeks old. Building the first client-side consumer now means md-browser can establish the category before others notice the opportunity.

---

## Sources

- Chrome Web Store: search "markdown reader", "markdown viewer", individual extension pages
- Firefox Add-ons (AMO): search "markdown reader", individual extension pages
- GitHub API: `search/repositories?q=cloudflare+markdown+agents`
- Jina AI Reader: https://jina.ai/reader
- Cloudflare Blog: "Markdown for Agents" (Feb 2026)
- Bombadillo: https://bombadillo.colorfield.space/
