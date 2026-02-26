# Plan: Project Overview

## Problem Statement

The modern web is hostile to readers. A typical web page delivers a small amount of actual content wrapped in a massive payload of:

- Navigation chrome, sidebars, and footers
- Advertising scripts and display ads
- Analytics and tracking pixels
- Cookie consent banners and GDPR modals
- Social media widgets and share buttons
- Auto-playing media
- Newsletter signup pop-ups
- JavaScript bundles that exist solely for interactivity the reader never asked for

The result is slow, noisy, and privacy-invasive. The content-to-noise ratio on most pages is abysmal.

Reader-mode features exist in Safari and Firefox, but they work by stripping HTML after it's loaded — the browser still downloads, parses, and executes the full page before showing you the clean version. The noise is filtered, not eliminated.

## Opportunity

Cloudflare's **Markdown for Agents** feature (February 2026) introduced server-side markdown delivery via HTTP content negotiation. Any Cloudflare-proxied site with the feature enabled will respond with clean `text/markdown` when the client sends `Accept: text/markdown`.

This means the infrastructure for a markdown-first web already exists. A meaningful and growing percentage of the web is behind Cloudflare. As more sites enable this feature, a tool that requests and renders markdown has an increasingly complete, noise-free view of the web.

A **browser extension** is the natural place to put this. It lives where users already browse, adds markdown superpowers without requiring a new application, and lets users drop into the full web experience when they need to.

## Vision

md-browser is a browser extension that gives you a **reader-first web**. When activated, it requests markdown from servers that support it, and converts HTML to markdown for those that don't — then renders everything with clean, distraction-free typography.

### What md-browser IS

- A browser extension for Chrome and Firefox
- A one-click reader mode powered by native markdown from the server
- A tool for people who value content over spectacle
- An experience that gets better the more sites adopt `text/markdown`
- A way to take advantage of Cloudflare's Markdown for Agents from a human-facing tool

### What md-browser is NOT

- A standalone browser (it extends Chrome/Firefox)
- An ad blocker (in reader view, ads simply aren't part of the content)
- A scraping tool or AI agent (it's for humans reading the web)
- A replacement for web apps (toggle the extension off and you're back to normal)

## Target Users

1. **Readers** — people who consume articles, blog posts, documentation, and long-form content
2. **Researchers** — academics and professionals who need to read and reference many pages efficiently
3. **Privacy-conscious users** — people who want less JavaScript execution and tracking
4. **Low-bandwidth users** — markdown is 5-10x smaller than equivalent HTML, crucial on constrained connections
5. **Accessibility users** — structured markdown maps cleanly to screen readers and alternative displays
6. **Developers** — for reading documentation, specs, and technical writing without noise

## Success Metrics

- **Extension install → daily use**: 50%+ retention after first week
- **Reader view render time**: < 200ms for markdown-served pages
- **Content fidelity**: readable representation of 95%+ of text-focused web pages
- **Chrome Web Store / Firefox AMO rating**: 4.5+ stars
- **Adoption**: 1,000+ weekly active users within 3 months of launch
