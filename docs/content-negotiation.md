# Content Negotiation in md-browser

## How It Works

md-browser leverages [HTTP content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation) to request markdown directly from web servers. This is the same mechanism browsers use to request preferred languages or encodings — extended to content format. The extension modifies outgoing request headers to express a preference for markdown.

## The `Accept` Header

When md-browser is active (auto mode, or when the user has opted into markdown negotiation), the extension modifies the `Accept` header on navigational requests:

**Before (browser default):**
```http
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
```

**After (md-browser active):**
```http
Accept: text/markdown, text/html;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.7
```

This tells the server:

1. **Preferred:** `text/markdown` (quality 1.0, implicit)
2. **Acceptable:** `text/html` (quality 0.9)
3. **Also acceptable:** everything else at lower priority

Servers that support markdown content negotiation (e.g., sites with Cloudflare's Markdown for Agents enabled) will detect the `text/markdown` preference and respond with markdown. Servers that don't understand this preference will ignore it and serve HTML as usual — no breakage.

## How the Extension Modifies Headers

### Chrome (Manifest V3) — `declarativeNetRequest`

Chrome's Manifest V3 uses declarative rules for header modification. The extension registers a dynamic rule that modifies headers only on navigational requests:

```js
chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
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
      resourceTypes: ["main_frame"]
    }
  }]
});
```

The rule can be enabled/disabled dynamically per tab or globally, based on user settings.

### Firefox — `webRequest`

Firefox supports the `webRequest` API for synchronous header modification:

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

## Response Handling

### Markdown Response

When the server responds with `Content-Type: text/markdown`:

```http
HTTP/2 200 OK
content-type: text/markdown; charset=utf-8
vary: accept
x-markdown-tokens: 725
content-signal: ai-train=yes, search=yes, ai-input=yes

---
title: Example Page
description: An example page served as markdown
---

# Example Page

This content was delivered as markdown directly from the server.
```

The extension:
1. Detects the `text/markdown` content type in response headers
2. Reads `x-markdown-tokens` for the popup display
3. Intercepts the response body (raw markdown)
4. Redirects the tab to the bundled reader page, passing the markdown content
5. The reader page parses YAML frontmatter, renders the markdown body, and applies the theme

### HTML Response

When the server responds with `Content-Type: text/html`, the page loads normally. The user can activate reader mode manually, which triggers client-side content extraction and conversion (see [fallback-conversion.md](fallback-conversion.md)).

Alternatively, in auto mode, the extension can make a **background fetch** with `Accept: text/markdown` to check if a markdown version is available, and surface it as an option.

### The `Vary` Header

Servers that support content negotiation include `Vary: accept` in their response. This tells the browser's cache that the response varies based on the `Accept` header. This is important — it prevents the browser from serving a cached HTML version when the extension requests markdown, or vice versa.

## Cloudflare's Markdown for Agents

Cloudflare's implementation (announced February 2026) works as follows:

1. Site owner enables "Markdown for Agents" in the Cloudflare dashboard
2. Cloudflare's edge network intercepts requests with `Accept: text/markdown`
3. The original HTML is fetched from the origin server
4. Cloudflare converts the HTML to markdown at the edge
5. The markdown is served to the client with appropriate headers

This means **any Cloudflare-proxied site** can serve markdown without modifying their origin server. The conversion happens transparently at the CDN layer.

### Supported Sites

As of early 2026, Cloudflare has enabled this on:
- [Cloudflare Blog](https://blog.cloudflare.com/)
- [Cloudflare Developer Docs](https://developers.cloudflare.com/)
- Any Pro, Business, or Enterprise zone that enables the feature

The number of supported sites will grow as more site owners enable the feature.

## Detecting Markdown Support

md-browser tracks which domains respond with `text/markdown`:

1. **Response header check** — `Content-Type: text/markdown` confirms support
2. **`Vary: accept`** — indicates the server does content negotiation, a signal that markdown may be supported
3. **Domain memory** — the extension remembers which domains have served markdown and can display an indicator (green icon) on subsequent visits

This per-domain knowledge is stored locally in `chrome.storage.local` and used to show users which sites support native markdown.

## Standards & Compatibility

The `text/markdown` MIME type is standardized in [RFC 7763](https://www.rfc-editor.org/rfc/rfc7763). Using the `Accept` header for content negotiation is defined in [RFC 9110 §12.5.1](https://www.rfc-editor.org/rfc/rfc9110#section-12.5.1). md-browser's approach is fully standards-compliant and does not break any existing website functionality — the `Accept` header merely expresses a preference that servers are free to ignore.
