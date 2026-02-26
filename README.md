# md-browser

A reader-first web. Browser extension that requests markdown from servers via HTTP content negotiation and renders everything with clean, distraction-free typography.

When activated, md-browser adds `Accept: text/markdown` to navigational requests. Sites that support it (e.g. Cloudflare-proxied sites with Markdown for Agents enabled) respond with clean markdown instead of HTML — no ads, no trackers, no noise. The extension renders the markdown with optimised typography directly in your tab.

## Status

**v0.1.0 — MVP / Proof of Concept**

- [x] Chrome Manifest V3 extension
- [x] Modifies `Accept` headers to request `text/markdown`
- [x] Detects `text/markdown` responses and renders them in a reader view
- [x] YAML frontmatter extraction (title, description)
- [x] Clean typography with dark/light theme (follows system preference)
- [x] Extension popup showing page source type and token count
- [x] "View original" to bypass and see the HTML version
- [x] Badge indicator (`MD`) on tabs served as markdown
- [ ] HTML-to-markdown fallback (Milestone 2)
- [ ] Settings / options page (Milestone 3)
- [ ] Firefox support (Milestone 4)

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

## Development

### Prerequisites

- Docker (no local Node.js required)

### Build

```bash
# Install dependencies
./dev.sh install

# Build the extension
./dev.sh build

# Watch mode (rebuild on changes)
./dev.sh watch

# Drop into a shell inside the container
./dev.sh shell
```

### Load in Chrome

1. Build the extension (see above)
2. Open `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `dist/` directory

### Test it

Navigate to any Cloudflare-proxied site that has Markdown for Agents enabled, for example:

- https://blog.cloudflare.com/markdown-for-bots/
- https://developers.cloudflare.com/

The page should render as clean markdown with a green `MD` badge on the extension icon.

## Project Structure

```
src/
  background.ts       — Service worker: header modification, response detection
  content.ts          — Content script: markdown rendering, reader view
  manifest.json       — Chrome MV3 extension manifest
  styles/reader.css   — Reader view typography (light/dark themes)
  popup/              — Extension popup (HTML, CSS, TS)
dist/                 — Built extension (load this in Chrome)
docs/                 — Technical documentation
plans/                — Development plan and milestones
```

## License

MIT
