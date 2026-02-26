# md-browser

**A browser extension for noise-free, markdown-native web browsing.**

The web is bloated. Pages are packed with tracking scripts, pop-ups, cookie banners, auto-playing videos, and layout-shifting ads — all fighting for your attention instead of delivering content. md-browser takes a different approach: it intercepts web requests, asks for markdown, and renders clean, readable content directly in your browser.

## The Idea

Cloudflare's [Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) introduced a simple but powerful mechanism: any site behind Cloudflare can serve its content as structured markdown via HTTP content negotiation. When a client sends `Accept: text/markdown`, compliant servers return clean, readable markdown instead of bloated HTML.

md-browser is a browser extension built around this primitive:

1. **Requests markdown first** — modifies outgoing `Accept` headers to prefer `text/markdown` when the extension is active
2. **Renders markdown natively** — when a server responds with `text/markdown`, the content is rendered with beautiful, distraction-free typography in a reader view
3. **Converts HTML as fallback** — on any page, the user can activate a reader mode that strips the page to its content and renders it as markdown
4. **One click to toggle** — switch between the full website and the clean markdown view instantly

## Why an Extension?

Building a full browser means rebuilding TLS, tabs, history, bookmarks, passwords, sync, accessibility, DevTools — the list never ends. An extension **slots into the browser you already use** and adds markdown superpowers:

| Standalone Browser | Extension |
|---|---|
| Months to build basics | Weeks to a working product |
| Users must switch browsers | Users install one extension |
| No web app support | Full browser available one click away |
| Must rebuild everything | Leverages existing browser infrastructure |
| Tiny user base | Accessible to all Chrome/Firefox users |

You get noise-free reading when you want it, and the full web when you need it.

## How It Works

```
  User navigates to a page
           │
           ▼
  ┌─────────────────┐     ┌──────────────────────┐
  │ Extension adds  │────►│ Server responds with │
  │ Accept:         │     │ text/markdown?       │
  │ text/markdown   │     └──────┬───────────────┘
  └─────────────────┘            │
                          ┌──────┴──────┐
                          │ Yes         │ No
                          ▼             ▼
                   ┌────────────┐  ┌────────────────┐
                   │ Render MD  │  │ Normal page    │
                   │ reader view│  │ load + optional│
                   └────────────┘  │ reader mode    │
                                   └────────────────┘
```

## Design Principles

- **Content over chrome** — the reader view is minimal; the content is everything
- **Non-invasive** — normal browsing is unaffected when the extension is inactive
- **Speed** — markdown is small; rendering is fast; pages load instantly in reader view
- **Privacy** — reader view executes no page JavaScript, loads no third-party resources
- **Readability** — typography, spacing, and contrast are optimized for long-form reading
- **Progressive enhancement** — sites with `text/markdown` support get the best experience; everything else still works via HTML-to-markdown conversion

## Status

This project is in the planning phase. See [`plans/`](plans/) for the roadmap and [`docs/`](docs/) for technical documentation.

## Project Structure

```
md-browser/
├── README.md              # This file
├── plans/
│   ├── 01-overview.md     # Project overview and goals
│   ├── 02-architecture.md # Extension architecture
│   ├── 03-milestones.md   # Development milestones and roadmap
│   └── 04-ux.md           # User experience design
├── docs/
│   ├── content-negotiation.md  # How markdown content negotiation works
│   ├── rendering-pipeline.md   # The markdown rendering pipeline
│   ├── fallback-conversion.md  # HTML-to-markdown fallback strategy
│   └── privacy-model.md        # Privacy and security model
└── src/                   # (future) Source code
```

## License

TBD
