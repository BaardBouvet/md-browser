# Markdown Browser

Read the web in clean markdown.

Markdown Browser asks sites for `text/markdown` and renders a distraction-free reading view with typography designed for long-form content.

## Why now

Cloudflare recently announced markdown delivery for web content negotiation (often referred to as Markdown for Bots/Agents). That makes markdown-first browsing practical on real public sites today.

Try it on a Cloudflare property:

- https://blog.cloudflare.com/markdown-for-bots/

## Why use it

- Cleaner pages with less visual noise
- Faster reading flow for docs and articles
- One-click mode switching from the toolbar
- Focused on Chromium browsers (Edge/Chrome)

## Features

- Markdown-first browsing via HTTP content negotiation
- Clean reader rendering with optimized typography
- Follows your browser/system dark mode theme automatically
- Table of contents sidebar for document navigation
- GitHub-style heading anchor links on hover
- Link capability hints with optional background checks
- Toolbar + popup controls to switch between markdown and original HTML

## Quick start

Prerequisite: Docker.

```bash
./dev.sh install
./dev.sh build
```

Load the extension:

- Edge: open `edge://extensions/` → enable Developer mode → Load unpacked → `dist/chromium/`
- Chrome: open `chrome://extensions/` → enable Developer mode → Load unpacked → `dist/chromium/`

## How it behaves

- Requests markdown first with HTTP content negotiation
- Renders markdown directly when available
- Falls back to normal page behavior when markdown is unavailable
- Shows page mode in the toolbar badge (`M`, `MD`, `H`)

## Link checks

`Link checks` is a popup setting that controls link capability hints in reader mode.

Default is **off** for privacy.

- When enabled, the extension sends lightweight background checks for links on the current markdown page.
- Links are then marked as likely markdown-capable or non-markdown.
- When disabled, no background link checks are made and those link hints are not shown.

If you prefer fewer background requests while reading, turn `Link checks` off.

## Privacy note

Markdown mode reduces script-heavy page noise, but it is not a full replacement for network-level privacy blockers.

## License

Apache-2.0
