# Plan: Extension Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser (Chrome / Firefox)                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   md-browser extension                    │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │  │
│  │  │  Background  │  │   Content    │  │    Popup /    │   │  │
│  │  │  Service     │  │   Script     │  │   Settings    │   │  │
│  │  │  Worker      │  │              │  │               │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └───────────────┘   │  │
│  │         │                  │                               │  │
│  │  ┌──────▼───────┐  ┌──────▼───────┐                       │  │
│  │  │   Header     │  │  Readability │                       │  │
│  │  │  Modifier    │  │  + HTML→MD   │                       │  │
│  │  └──────┬───────┘  │  Converter   │                       │  │
│  │         │          └──────┬───────┘                       │  │
│  │  ┌──────▼───────┐  ┌──────▼───────┐                       │  │
│  │  │  Response    │  │  Markdown    │                       │  │
│  │  │  Interceptor │  │  Renderer    │                       │  │
│  │  └──────────────┘  └──────────────┘                       │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Extension Components

### 1. Background Service Worker

The service worker runs in the background and handles network-level operations using the browser's extension APIs.

**Responsibilities:**

- **Modify `Accept` headers** — uses `declarativeNetRequest` (Manifest V3) or `webRequest` (Manifest V2 / Firefox) to add `text/markdown` to outgoing `Accept` headers on navigational requests
- **Detect markdown responses** — monitors response headers; when `Content-Type: text/markdown` is returned, signals the content script or redirects to the reader view
- **Manage extension state** — track per-tab mode (auto/manual/off), persist user settings
- **Badge indicator** — update the extension icon badge to show `MD` when a page was served as markdown

**Header Modification (Manifest V3 — Chrome):**

```js
// declarativeNetRequest rule to add Accept: text/markdown
{
  id: 1,
  priority: 1,
  action: {
    type: "modifyHeaders",
    requestHeaders: [{
      header: "Accept",
      operation: "set",
      value: "text/markdown, text/html;q=0.9"
    }]
  },
  condition: {
    resourceTypes: ["main_frame"],
    // Only modify when extension is active for this tab
  }
}
```

**Header Modification (Firefox — webRequest):**

```js
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    for (const header of details.requestHeaders) {
      if (header.name.toLowerCase() === "accept") {
        header.value = "text/markdown, text/html;q=0.9";
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking", "requestHeaders"]
);
```

### 2. Content Script

Injected into pages to handle rendering and HTML-to-markdown conversion.

**Responsibilities:**

- **Reader mode activation** — when the user clicks the extension icon or presses the keyboard shortcut, the content script extracts the page content, converts it to markdown, and replaces the page with the reader view
- **Native markdown rendering** — if the background worker detects a `text/markdown` response, the content script receives the raw markdown and renders it directly
- **HTML-to-Markdown conversion** — uses Readability to extract the main content, then converts it to markdown using Turndown (or similar)
- **Theme application** — applies the selected theme (light/dark/sepia) to the reader view

### 3. Reader View Page

A locally-bundled HTML page (`reader.html`) that serves as the rendering surface for markdown content.

**Approach:**
- The extension opens `chrome-extension://[id]/reader.html?url=...` or replaces the current tab's content
- The reader page is a clean, sandboxed HTML page with:
  - CSS typography optimized for reading
  - A markdown-to-HTML renderer (marked, markdown-it, or similar)
  - Syntax highlighting for code blocks (Prism or Highlight.js)
  - Theme switching
  - Table of contents generation
- No external resources are loaded in the reader view
- The URL bar still shows the original page URL (or the extension URL with the original as a parameter)

### 4. Popup / Settings UI

A small popup and options page for configuration.

**Popup (click extension icon):**
- Toggle reader mode for current tab
- Show page source (markdown vs. converted HTML)
- Quick theme switch
- Token count (from `x-markdown-tokens` header)
- Link to settings

**Options page:**
- Default mode: Auto (always request markdown) / Manual (reader mode button only)
- Theme: Light / Dark / Sepia / System
- Typography: font family, font size, line width, line height
- Image loading: off / on / per-domain allowlist
- Domain allowlist/blocklist for auto-activation
- Keyboard shortcut configuration
- Export/import settings

## Content Negotiation Strategy

The extension can operate in two modes:

### Auto Mode (default)

Every navigational request gets `Accept: text/markdown` added. If the server responds with markdown, the reader view activates automatically. If the server responds with HTML, the page loads normally and the user can optionally activate reader mode.

```
Request ──► Accept: text/markdown, text/html;q=0.9
                │
                ▼
          Content-Type?
                │
    ┌───────────┴───────────┐
    │ text/markdown         │ text/html
    ▼                       ▼
Auto reader view     Normal page load
                     (reader mode available via icon)
```

### Manual Mode

Requests are not modified. The user clicks the extension icon (or presses a shortcut) to activate reader mode on any page. The content script extracts and converts the current page's HTML to markdown.

In manual mode, the extension can also make a **secondary fetch** with `Accept: text/markdown` to check if a markdown version is available from the server, preferring it over client-side conversion.

## Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Extension framework | WebExtension API (Manifest V3) | Cross-browser (Chrome + Firefox) |
| Markdown parser | `marked` or `markdown-it` | Fast, extensible, browser-ready |
| HTML-to-markdown | `turndown` | Battle-tested, configurable rules |
| Readability | `@mozilla/readability` | Same engine as Firefox reader view |
| Syntax highlighting | `Prism.js` (lightweight) | Client-side, no external requests |
| Math rendering | `KaTeX` (optional) | LaTeX in markdown |
| CSS | Custom stylesheet | Typography optimized for reading |
| Build tool | `vite` or `esbuild` | Fast builds, tree-shaking |
| Language | TypeScript | Type safety, better tooling |

## Browser Compatibility

| Feature | Chrome (MV3) | Firefox (MV2/MV3) |
|---|---|---|
| Header modification | `declarativeNetRequest` | `webRequest.onBeforeSendHeaders` |
| Response interception | `declarativeNetRequest` | `webRequest.onHeadersReceived` |
| Content scripts | ✅ | ✅ |
| Extension pages | ✅ | ✅ |
| Storage | `chrome.storage.sync` | `browser.storage.sync` |
| Keyboard shortcuts | `chrome.commands` | `browser.commands` |
| Side panel | `chrome.sidePanel` | Not available (use tab) |

A thin compatibility layer (`browser-polyfill` or manual) normalizes the API differences.

## Data Flow: Markdown-Native Page

```
1. User navigates to https://blog.cloudflare.com/some-post/
2. Background worker adds Accept: text/markdown to request headers
3. Cloudflare responds with Content-Type: text/markdown
4. Background worker detects markdown response, stores markdown body
5. Extension redirects tab to reader.html?url=https://blog.cloudflare.com/some-post/
6. Reader page retrieves markdown from background worker
7. Reader page parses markdown → HTML, applies theme CSS
8. User sees clean, styled article with no ads/trackers/noise
```

## Data Flow: HTML Page with Reader Mode

```
1. User navigates to https://example.com/article
2. Page loads normally (Accept header may or may not be modified)
3. User clicks extension icon or presses Ctrl+Shift+R
4. Content script runs Readability on current DOM
5. Extracted content is converted to markdown via Turndown
6. Content script replaces page body with reader view
   OR extension opens reader.html with the converted markdown
7. User sees clean, styled article
8. User can click "Exit reader mode" to return to original page
```

## Security Considerations

- **No remote code execution** — all rendering libraries are bundled with the extension
- **Content Security Policy** — reader page has strict CSP, no inline scripts, no external resources
- **Sanitization** — markdown-to-HTML output is sanitized (DOMPurify) before rendering to prevent XSS from malicious markdown
- **No data exfiltration** — extension makes no requests beyond what the user navigates to
- **Minimal permissions** — request only the permissions needed:
  - `declarativeNetRequest` or `webRequest` — for header modification
  - `activeTab` — to access current tab content when user activates reader mode
  - `storage` — for settings persistence
  - `tabs` — for badge/icon updates
