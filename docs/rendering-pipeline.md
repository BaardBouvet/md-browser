# Markdown Rendering Pipeline

## Overview

The rendering pipeline transforms raw markdown text into a styled, readable page within the extension's reader view. Instead of relying on the browser's full HTML/CSS/JS rendering of the original page, md-browser renders markdown to clean, semantic HTML with purpose-built CSS optimized for readability.

## Pipeline Stages

```
Raw Markdown (text)
       │
       ▼
┌──────────────┐
│  Frontmatter │──► Page metadata (title, description, date)
│  Extraction  │
└──────┬───────┘
       │ Markdown body
       ▼
┌──────────────┐
│   Markdown   │──► HTML fragment
│    Parser    │
└──────┬───────┘
       │ HTML
       ▼
┌──────────────┐
│  Sanitizer   │──► Clean HTML (no XSS vectors)
│  (DOMPurify) │
└──────┬───────┘
       │ Safe HTML
       ▼
┌──────────────┐
│  Post-       │──► Syntax highlighting, TOC, link targets
│  Processing  │
└──────┬───────┘
       │ Enhanced HTML
       ▼
┌──────────────┐
│  Reader View │──► Themed, styled page in extension reader.html
│  Injection   │
└──────────────┘
```

## Stage 1: Frontmatter Extraction

Many markdown documents, especially those served by Cloudflare's Markdown for Agents, include YAML frontmatter:

```markdown
---
title: Introducing Markdown for Agents
description: Cloudflare now serves markdown via content negotiation.
image: https://blog.cloudflare.com/images/markdown-for-agents.png
---

# Introducing Markdown for Agents
...
```

The frontmatter is parsed (using a lightweight YAML parser like `js-yaml`) and used for:
- **Page/tab title** — `title` field, falling back to first `# heading`
- **Page description** — displayed in the reader view header  
- **Metadata display** — optionally shown at the top of the reader view

The frontmatter is stripped from the markdown body before parsing.

## Stage 2: Markdown Parsing

The markdown body is parsed and converted to an HTML fragment using a JavaScript markdown library (`marked`, `markdown-it`, or similar) bundled with the extension.

### Library Choice: `markdown-it`

`markdown-it` is recommended for its plugin ecosystem and spec compliance:

```js
import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";

const md = new MarkdownIt({
  html: false,         // Disable raw HTML passthrough (security)
  linkify: true,       // Auto-detect URLs
  typographer: true,   // Smart quotes
})
  .use(markdownItFootnote)
  .use(markdownItTaskLists);

const html = md.render(markdownBody);
```

### Supported Elements

| Markdown | Rendered As | Notes |
|---|---|---|
| `# Heading` | `<h1>` - `<h6>` | Hierarchical sizing, anchor IDs for TOC |
| `Paragraph text` | `<p>` | Standard paragraphs |
| `- list item` | `<ul><li>` | Unordered list |
| `1. item` | `<ol><li>` | Ordered list |
| `[text](url)` | `<a href>` | Links open normally in the browser |
| `**bold**` | `<strong>` | Bold text |
| `*italic*` | `<em>` | Italic text |
| `` `code` `` | `<code>` | Inline code |
| ```` ```lang ```` | `<pre><code>` | Code block with language class |
| `> quote` | `<blockquote>` | Block quote |
| `\| table \|` | `<table>` | GFM tables |
| `![alt](url)` | Placeholder | See image handling below |
| `---` | `<hr>` | Horizontal rule |
| `[^1]` | Footnote | Linked footnote references |
| `- [x] task` | `<input type="checkbox">` | Task list (read-only) |
| `~~deleted~~` | `<del>` | Strikethrough |

### Extensions

- **GFM tables** — pipe-delimited tables with alignment
- **GFM task lists** — checkboxes (rendered as read-only)
- **GFM strikethrough** — `~~deleted~~`
- **Autolinks** — bare URLs become clickable
- **YAML frontmatter** — metadata block (parsed separately)
- **Footnotes** — `[^1]` references with back-links
- **Math** — `$inline$` and `$$block$$` LaTeX via KaTeX (optional plugin)

## Stage 3: Sanitization

The HTML output from the markdown parser is sanitized using **DOMPurify** to prevent XSS attacks from malicious markdown content:

```js
import DOMPurify from "dompurify";

const cleanHtml = DOMPurify.sanitize(html, {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "a", "strong", "em", "code", "pre",
    "ul", "ol", "li", "blockquote", "hr", "br",
    "table", "thead", "tbody", "tr", "th", "td",
    "del", "sup", "sub", "img", "input",
    "details", "summary", "figure", "figcaption"
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "id", "class", "type", "checked", "colspan", "rowspan"],
  ALLOW_DATA_ATTR: false
});
```

This prevents any injected `<script>`, `<iframe>`, `onclick`, `javascript:` URLs, or other XSS vectors from being rendered.

## Stage 4: Post-Processing

After sanitization, the HTML is enhanced:

### Syntax Highlighting

Code blocks with a language class are syntax-highlighted using **Prism.js** (bundled, no external requests):

```js
import Prism from "prismjs";

document.querySelectorAll("pre code[class*='language-']").forEach((block) => {
  Prism.highlightElement(block);
});
```

### Table of Contents Generation

Headings are scanned to generate a TOC sidebar:

```js
const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
const toc = headings.map((h) => ({
  level: parseInt(h.tagName[1]),
  text: h.textContent,
  id: h.id
}));
```

### Image Placeholders

Images are replaced with clickable placeholders by default:

```js
document.querySelectorAll("img").forEach((img) => {
  const placeholder = createImagePlaceholder(img.alt, img.src);
  img.replaceWith(placeholder);
});
```

### Link Targets

External links get `target="_blank"` and `rel="noopener noreferrer"`:

```js
document.querySelectorAll("a[href^='http']").forEach((a) => {
  if (new URL(a.href).origin !== currentPageOrigin) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
});
```

## Stage 5: Reader View Injection

The processed HTML is injected into the reader page's content area:

```js
const article = document.getElementById("md-content");
article.innerHTML = cleanHtml;

// Apply theme
document.body.dataset.theme = userSettings.theme; // "light" | "dark" | "sepia"

// Set typography
document.documentElement.style.setProperty("--font-body", userSettings.fontFamily);
document.documentElement.style.setProperty("--font-size", userSettings.fontSize + "px");
document.documentElement.style.setProperty("--line-height", userSettings.lineHeight);
document.documentElement.style.setProperty("--content-width", userSettings.contentWidth + "px");
```

## CSS Architecture

The reader view uses CSS custom properties for theming:

```css
:root {
  --font-body: Georgia, "Noto Serif", serif;
  --font-heading: system-ui, -apple-system, sans-serif;
  --font-code: "JetBrains Mono", "Fira Code", monospace;
  --font-size: 18px;
  --line-height: 1.6;
  --content-width: 680px;
}

[data-theme="light"] {
  --bg: #fafafa;
  --text: #1a1a1a;
  --link: #2563eb;
  --code-bg: #f0f0f0;
  --border: #e0e0e0;
}

[data-theme="dark"] {
  --bg: #1a1a1a;
  --text: #e5e5e5;
  --link: #60a5fa;
  --code-bg: #2a2a2a;
  --border: #333;
}

[data-theme="sepia"] {
  --bg: #f4ecd8;
  --text: #433422;
  --link: #8b6914;
  --code-bg: #ede3cc;
  --border: #d4c9a8;
}

.md-content {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 2rem;
  font-family: var(--font-body);
  font-size: var(--font-size);
  line-height: var(--line-height);
  color: var(--text);
  background: var(--bg);
}
```

## Performance

| Metric | Target | Notes |
|---|---|---|
| Markdown parse (3,000 tokens) | < 10ms | `markdown-it` is fast in modern JS engines |
| Sanitization | < 5ms | DOMPurify is lightweight |
| Syntax highlighting | < 50ms | Prism.js, lazy per block |
| Full pipeline (parse → render) | < 100ms | Perceived as instant |
| Total extension bundle size | < 500KB | Tree-shaken, minified |

The entire pipeline runs in the browser's JS engine — no network requests, no external dependencies at runtime.
