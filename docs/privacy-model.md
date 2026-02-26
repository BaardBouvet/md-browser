# Privacy & Security Model

## Philosophy

md-browser's reader view is **private by reduction**. Rather than trying to block trackers (a cat-and-mouse game), the reader view simply doesn't render the parts of the page that track you. No scripts execute in the reader view, no third-party resources load, no tracking pixels fire.

This isn't a standalone browser that eliminates all tracking — the user's regular browser is still involved. But when reader mode is active, the rendered view is a clean, static markdown document with zero tracking surface.

## Threat Model

### What md-browser's reader view protects against

| Threat | How |
|---|---|
| **Page JavaScript in reader view** | Reader view is a separate extension page — original page scripts don't run |
| **Third-party resources** | Reader view loads no external CSS, JS, images (unless opted in), fonts, or iframes |
| **Tracking pixels** | Not loaded in reader view |
| **Cookie banners / GDPR modals** | Not present in extracted content |
| **Clickjacking** | Reader view has no iframes or overlays |
| **Visual noise** | Ads, sidebars, popups, and navigation are stripped by Readability |

### What md-browser does NOT change

| Aspect | Reality |
|---|---|
| **Initial page load** | The browser still loads the full HTML page (scripts, trackers, etc.) before reader mode activates |
| **Cookies** | The browser's normal cookie behavior applies to the initial request |
| **Server-side tracking** | The server sees your IP and request regardless |
| **Browser telemetry** | Chrome/Firefox telemetry is unaffected by the extension |
| **Other extensions** | Ad blockers, privacy extensions, etc. work alongside md-browser |

### Privacy in Auto Mode vs. Manual Mode

| Mode | Privacy Implication |
|---|---|
| **Auto mode** | The `Accept: text/markdown` header is added to requests. If the server responds with markdown, the page never loads HTML — **no scripts, no trackers, no third-party requests at all**. This is the strongest privacy mode. |
| **Manual mode** | The page loads normally first (full HTML, scripts, trackers). Reader mode activates after. Privacy benefit is only in the reading experience, not the initial load. |

**Auto mode with a markdown-serving site is the ideal case** — the browser receives only markdown text, and the extension renders it. The page's JavaScript, CSS, ad networks, and tracking infrastructure never touch the browser.

## Network Behavior

### Auto Mode — Markdown Response

When a site serves `text/markdown`, the browser makes **one request** and receives a plain text document:

```http
GET /article HTTP/2
Host: blog.cloudflare.com
Accept: text/markdown, text/html;q=0.9
```

Response:
```http
HTTP/2 200
Content-Type: text/markdown; charset=utf-8
Content-Length: 3150

# Article Title
...
```

No additional resource requests occur. No `<script>`, `<link>`, `<img>`, or `<iframe>` tags to trigger fetches. This is functionally equivalent to the standalone browser approach — one request, pure content.

### Manual Mode — HTML Page

The browser loads the page normally (potentially dozens of requests), then the extension strips it down in reader mode. The privacy benefit is in the **reading experience** (no distractions, no further tracking from the page's JS), but the initial load has already occurred.

## Extension Permissions

md-browser requests only the minimum permissions needed:

| Permission | Why | Privacy Impact |
|---|---|---|
| `declarativeNetRequest` | To modify `Accept` headers on requests | Low — only modifies outbound headers |
| `activeTab` | To access current tab's DOM when user activates reader mode | Low — only on explicit user action |
| `storage` | To persist settings (theme, font, domain lists) | None — local only, synced via browser account if user has sync enabled |
| `tabs` | To update extension icon/badge per tab | None — UI only |

**Not requested:**
- `<all_urls>` host permission (not needed if using `activeTab`)
- `webRequest` + `webRequestBlocking` (only needed for Firefox, scoped to header modification)
- `cookies` — extension doesn't read or modify cookies
- `history` — extension doesn't access browser history
- `bookmarks` — extension doesn't access browser bookmarks

## Data Storage

All extension data is stored locally via `chrome.storage.local` or `chrome.storage.sync`:

| Data | Storage | Synced | User-deletable |
|---|---|---|---|
| Theme preference | `chrome.storage.sync` | Yes (if browser sync active) | Yes, via settings |
| Typography settings | `chrome.storage.sync` | Yes | Yes, via settings |
| Domain allowlist/blocklist | `chrome.storage.sync` | Yes | Yes, via settings |
| Known markdown-capable domains | `chrome.storage.local` | No | Yes, via settings |
| Cached reader mode content | Not stored | — | — |

**No telemetry.** No analytics. No crash reports. No "phone home." The extension makes zero network requests of its own.

## Content Security

### Reader View Sandboxing

The reader view (`reader.html`) is an extension page with a strict Content Security Policy:

```
Content-Security-Policy: 
  default-src 'none'; 
  style-src 'self'; 
  script-src 'self'; 
  img-src https: data:;
  font-src 'self'
```

This means:
- No inline scripts (all JS is bundled)
- No external script loading
- No external stylesheet loading
- Images only from HTTPS or data URIs (when user opts in)
- No iframes, no objects, no embeds

### Markdown Sanitization

All markdown → HTML output is sanitized via **DOMPurify** before being injected into the reader view. This prevents XSS attacks from malicious markdown content (e.g., a server returning markdown with embedded `<script>` tags or `javascript:` links).

### HTML Content Sanitization

When converting HTML pages via Readability + Turndown, the intermediate HTML is the output of Readability (which already strips most dangerous elements). The final markdown is then re-rendered by the markdown parser (which doesn't interpret raw HTML by default) and sanitized again by DOMPurify.

## Image Loading

Images are **not loaded by default** in reader view. When an image is encountered:

```
┌──────────────────────────────────────────────┐
│  🖼  Diagram showing the flow                │
│  [Load image]                                │
└──────────────────────────────────────────────┘
```

When loaded:
- Only the specific image URL is fetched
- The request goes through the browser's normal network stack (cookies, cache, etc.)
- No custom headers are added by the extension
- Users can configure per-domain image loading in settings

## Comparison with Other Tools

| Feature | md-browser (auto) | md-browser (manual) | Firefox Reader View | uBlock Origin |
|---|---|---|---|---|
| Blocks ads | N/A (not loaded) | No (initial load) | No | Yes |
| Blocks trackers | N/A (not loaded) | No (initial load) | No | Yes |
| Clean reading view | ✅ | ✅ | ✅ | No |
| Native markdown from server | ✅ | ✅ | No | No |
| JS-rendered content works | N/A | ✅ | ✅ | N/A |
| One network request (MD sites) | ✅ | No | No | No |
| Works alongside other extensions | ✅ | ✅ | N/A | ✅ |

md-browser in auto mode on a markdown-serving site provides the strongest privacy: **one request, zero scripts, zero tracking, pure content**. For HTML sites, it complements existing privacy tools by providing a clean reading surface after the initial load.
