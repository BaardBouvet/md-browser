# HTML-to-Markdown Fallback Strategy

## Purpose

Not every website supports `text/markdown` via content negotiation. When a user activates reader mode on an HTML page, the extension extracts the page's main content, converts it to markdown, and renders it in the reader view. This document describes the conversion strategy.

## Conversion Pipeline

```
Current page DOM (live in browser)
     │
     ▼
┌──────────────────┐
│   Readability    │──► Extracted article content (HTML fragment)
│   Extraction     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Turndown       │──► Markdown text
│   (HTML→MD)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Cleanup &      │──► Clean markdown
│   Normalize      │
└────────┬─────────┘
         │
         ▼
  Markdown → Rendering Pipeline (see rendering-pipeline.md)
```

## Advantage of the Extension Approach

Unlike a standalone browser that receives raw HTML and must parse it from scratch, a browser extension has access to the **live DOM** — the fully rendered page including any content injected by JavaScript. This means:

- **SPA/React/Vue pages work** — the browser has already executed JS and built the DOM
- **No HTML re-parsing needed** — the DOM is already available to the content script
- **Readability works on the rendered page** — not raw HTML source

This is a significant advantage over the standalone browser approach, which cannot handle JS-rendered pages at all.

## Stage 1: Readability Extraction

The extension uses **[@mozilla/readability](https://github.com/nickshanks/readability)** — the same library that powers Firefox's built-in reader view — to identify and extract the main content area.

```js
import { Readability } from "@nickshanks/readability";

// Clone the document to avoid modifying the live page
const docClone = document.cloneNode(true);
const reader = new Readability(docClone);
const article = reader.parse();

// article.title    — extracted title
// article.content  — HTML string of main content
// article.excerpt  — short description
// article.siteName — site name
// article.byline   — author
```

### What Readability Does

1. **Scores candidate elements** — assigns a content score based on text density, paragraph count, element type, and class/ID heuristics
2. **Selects the content root** — the highest-scoring element becomes the article
3. **Strips non-content** — removes navigation, sidebars, footers, ads, social widgets
4. **Preserves structure** — keeps headings, paragraphs, lists, links, images, tables
5. **Extracts metadata** — title, author, description from `<meta>` tags

### Content Confidence

Readability returns `null` if it can't find a suitable article. The extension handles this:

| Result | Action |
|---|---|
| Article found, good extraction | Render in reader view with `HTML →` indicator |
| Article found, short/suspicious | Render with warning: "Content may be incomplete" |
| No article found (`null`) | Show message: "Couldn't extract content from this page" + link to try anyway |

## Stage 2: HTML-to-Markdown Conversion

The extracted HTML fragment is converted to markdown using **[Turndown](https://github.com/domchristie/turndown)** with custom rules:

```js
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndown = new TurndownService({
  headingStyle: "atx",           // # style headings
  codeBlockStyle: "fenced",      // ``` style code blocks
  bulletListMarker: "-",         // - for unordered lists
  emDelimiter: "*",              // *italic*
  strongDelimiter: "**",         // **bold**
  linkStyle: "inlined",          // [text](url)
});

// Add GFM support (tables, strikethrough, task lists)
turndown.use(gfm);

const markdown = turndown.turndown(article.content);
```

### Conversion Rules

| HTML | Markdown | Notes |
|---|---|---|
| `<h1>` - `<h6>` | `#` - `######` | Heading levels preserved |
| `<p>` | Double newline | Paragraph spacing |
| `<strong>`, `<b>` | `**text**` | Bold |
| `<em>`, `<i>` | `*text*` | Italic |
| `<code>` | `` `text` `` | Inline code |
| `<pre><code>` | ```` ```lang ```` | Fenced code block, language detected from class |
| `<a href>` | `[text](url)` | Links |
| `<img>` | `![alt](src)` | Images (rendered as placeholders in reader view) |
| `<ul>`, `<li>` | `- item` | Unordered list |
| `<ol>`, `<li>` | `1. item` | Ordered list |
| `<blockquote>` | `> text` | Block quote |
| `<table>` | GFM table | Pipe-delimited via turndown-plugin-gfm |
| `<hr>` | `---` | Horizontal rule |
| `<br>` | Two spaces + newline | Line break |
| `<del>`, `<s>` | `~~text~~` | Strikethrough |
| `<details>` | Content rendered open | Collapsible sections expanded |

### Custom Rules

Additional Turndown rules for edge cases:

```js
// Remove empty links
turndown.addRule("emptyLinks", {
  filter: (node) => node.nodeName === "A" && !node.textContent.trim(),
  replacement: () => "",
});

// Convert figure/figcaption to image with caption
turndown.addRule("figure", {
  filter: "figure",
  replacement: (content, node) => {
    const img = node.querySelector("img");
    const caption = node.querySelector("figcaption");
    if (img) {
      const alt = caption?.textContent || img.alt || "";
      return `![${alt}](${img.src})\n`;
    }
    return content;
  },
});
```

## Stage 3: Cleanup & Normalize

Post-processing on the generated markdown:

1. Collapse multiple blank lines into a maximum of two
2. Trim trailing whitespace from every line
3. Ensure document ends with a single newline
4. Remove empty headings
5. Fix broken link references
6. Resolve relative URLs to absolute (using page's base URL)
7. Remove redundant escape characters

## Quality Comparison

| Scenario | Content Quality | Notes |
|---|---|---|
| Native `text/markdown` from server | ★★★★★ | Author-intended structure |
| Well-structured HTML (semantic, blog/docs) | ★★★★☆ | Readability + Turndown handles cleanly |
| Typical news site | ★★★☆☆ | Some noise may remain |
| Heavy JS framework (SSR with hydration) | ★★★★☆ | DOM is fully rendered, extraction works |
| Pure SPA (client-rendered) | ★★★☆☆ | DOM is rendered, but structure may be non-standard |
| Web application (Gmail, Figma, etc.) | ★☆☆☆☆ | Not article content — reader mode not appropriate |

## When Reader Mode Shouldn't Activate

The extension should avoid offering reader mode on pages that aren't article-like:

- **Web apps** — Gmail, Google Docs, Figma, etc. (detected by domain blocklist + heuristics)
- **Search results** — Google, Bing, DuckDuckGo (list of links, not an article)
- **Login/signup pages** — forms, not content
- **Media-heavy pages** — YouTube, Netflix, Spotify (video/audio, not text)
- **Already-minimal pages** — pages with very little content (< 500 characters of text)

The domain blocklist is user-configurable. Heuristics can also check text length and paragraph count before offering reader mode.
