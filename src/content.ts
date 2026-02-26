// ─── md-browser: Content Script ─────────────────────────────────────────────
//
// Injected into every page. Detects if the page was served as text/markdown,
// extracts the raw markdown text, and replaces the page with a beautifully
// rendered reader view.
// ────────────────────────────────────────────────────────────────────────────

import MarkdownIt from "markdown-it";
import { api } from "./browser-api";

// Reader CSS is imported as a text string (esbuild loader: text)
// @ts-expect-error - esbuild text loader
import readerCSS from "./styles/reader.css";

// ─── Markdown-it instance ───────────────────────────────────────────────────

const md = new MarkdownIt({
  html: false, // Security: no raw HTML passthrough
  linkify: true, // Auto-detect URLs
  typographer: true, // Smart quotes, dashes
});

// ─── Entry point ────────────────────────────────────────────────────────────

(async function init() {
  // Guard: don't double-initialise
  if ((window as unknown as Record<string, boolean>).__mdBrowserInit) return;
  (window as unknown as Record<string, boolean>).__mdBrowserInit = true;

  // Guard: skip if user previously chose "view original" for this page
  if (sessionStorage.getItem("md-browser-bypass") === window.location.href) {
    sessionStorage.removeItem("md-browser-bypass");
    return;
  }

  // Primary detection: the browser exposes the MIME type of the response
  const isMarkdown = document.contentType === "text/markdown";

  // Secondary detection: ask the background service worker
  let bgInfo: { isMarkdown?: boolean; tokens?: string } = {};
  try {
    bgInfo = await api.runtime.sendMessage({ type: "CHECK_MARKDOWN" });
  } catch {
    // Background may not be ready (e.g., service worker still starting)
  }

  if (!isMarkdown && !bgInfo?.isMarkdown) return;

  // ─── Extract raw markdown ───────────────────────────────────────────────

  const rawMarkdown = extractMarkdownText();
  if (!rawMarkdown.trim()) return;

  // ─── Parse and render ───────────────────────────────────────────────────

  const { frontmatter, body } = parseFrontmatter(rawMarkdown);
  const renderedHTML = md.render(body);
  const title =
    frontmatter?.title || extractFirstHeading(body) || document.title || "Untitled";
  const tokens = bgInfo?.tokens;

  renderReaderView({ title, frontmatter, renderedHTML, tokens });
})();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the raw markdown text from the page.
 * When Chrome renders text/markdown, it wraps the text in a <pre> element.
 */
function extractMarkdownText(): string {
  const pre = document.querySelector("pre");
  if (pre) return pre.textContent ?? "";
  return document.body?.innerText ?? document.body?.textContent ?? "";
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Handles simple `key: value` pairs (no nested structures).
 */
function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, string> | null;
  body: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: markdown };

  const yamlBlock = match[1];
  const body = match[2];

  const frontmatter: Record<string, string> = {};
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/** Pull the text from the first # heading line. */
function extractFirstHeading(markdown: string): string | null {
  const match = markdown.match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** Simple HTML-entity escaping for safe interpolation. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderReaderView(opts: {
  title: string;
  frontmatter: Record<string, string> | null;
  renderedHTML: string;
  tokens?: string;
}) {
  const { title, frontmatter, renderedHTML, tokens } = opts;
  const url = window.location.href;

  // Detect system dark mode for initial theme
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = prefersDark ? "dark" : "light";

  // Build the reader page
  document.documentElement.innerHTML = /* html */ `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(title)}</title>
      <style>${readerCSS}</style>
    </head>
    <body>
      <div class="md-reader-container">
        <header>
          <div class="md-reader-meta">
            <span class="md-reader-badge">MD ✓</span>
            <span class="md-reader-url">${escapeHtml(url)}</span>
          </div>
          ${
            frontmatter?.description
              ? `<p class="md-reader-description">${escapeHtml(frontmatter.description)}</p>`
              : ""
          }
        </header>
        <article class="md-reader-content">
          ${renderedHTML}
        </article>
      </div>
      <footer class="md-reader-footer">
        <div class="md-reader-footer-left">
          <span>Source: <strong>text/markdown</strong> ✓</span>
          ${tokens ? `<span>${escapeHtml(tokens)} tokens</span>` : ""}
        </div>
        <div class="md-reader-footer-right">
          <button id="md-theme-toggle" title="Toggle dark/light theme">
            ${initialTheme === "dark" ? "☀ Light" : "● Dark"}
          </button>
          <button id="md-view-original" title="View the original HTML page">
            View original
          </button>
        </div>
      </footer>
    </body>
  `;

  // Apply theme class
  document.documentElement.classList.add("md-reader-root");
  document.documentElement.setAttribute("data-theme", initialTheme);

  // Scroll to top
  window.scrollTo(0, 0);

  // ─── Interactive handlers ─────────────────────────────────────────────

  // Theme toggle
  document.getElementById("md-theme-toggle")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    const btn = document.getElementById("md-theme-toggle");
    if (btn) btn.textContent = next === "dark" ? "☀ Light" : "● Dark";
  });

  // View original (bypass markdown)
  document
    .getElementById("md-view-original")
    ?.addEventListener("click", async () => {
      try {
        // Ask background to bypass the Accept header for this tab
        await api.runtime.sendMessage({ type: "BYPASS_TAB" });
      } catch {
        // Fallback: set a session flag
        sessionStorage.setItem("md-browser-bypass", window.location.href);
      }
      window.location.reload();
    });
}
