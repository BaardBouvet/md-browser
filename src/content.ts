// ─── md-browser: Content Script ─────────────────────────────────────────────
//
// Injected into every page. Detects if the page was served as text/markdown,
// extracts the raw markdown text, and replaces the page with a beautifully
// rendered reader view.
// ────────────────────────────────────────────────────────────────────────────

import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
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

  // Primary detection: the browser exposes the MIME type of the response
  const isMarkdown = document.contentType.includes("text/markdown");

  // Reduce raw-markdown flash by hiding the document as early as possible.
  if (isMarkdown && document.documentElement) {
    document.documentElement.style.visibility = "hidden";
  }

  // Secondary detection: ask the background service worker
  let bgInfo: { isMarkdown?: boolean; tokens?: string } = {};
  try {
    bgInfo = await api.runtime.sendMessage({ type: "CHECK_MARKDOWN" });
  } catch {
    // Background may not be ready (e.g., service worker still starting)
  }

  if (!isMarkdown && !bgInfo?.isMarkdown) {
    if (document.documentElement) {
      document.documentElement.style.visibility = "";
    }
    return;
  }

  // ─── Extract raw markdown ───────────────────────────────────────────────

  const rawMarkdown = await extractMarkdownText();
  if (!rawMarkdown.trim()) return;

  // ─── Parse and render ───────────────────────────────────────────────────

  const { frontmatter, body } = parseFrontmatter(rawMarkdown);
  const renderedHTML = sanitizeRenderedHtml(md.render(body));
  const title =
    frontmatter?.title || extractFirstHeading(body) || document.title || "Untitled";

  renderReaderView({ title, renderedHTML });

  if (document.documentElement) {
    document.documentElement.style.visibility = "";
  }
})();

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_PAGE_SOURCE") {
    sendResponse({
      isMarkdownPage: document.contentType.includes("text/markdown"),
      contentType: document.contentType,
      url: location.href,
    });
  }
  return false;
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the raw markdown text from the page.
 * When Chromium/Firefox renders text/markdown, it is often wrapped in <pre>.
 * At document_start we may need to wait for that node/text to appear.
 */
async function extractMarkdownText(): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const pre = document.querySelector("pre");
    const text = (pre?.textContent ?? document.body?.innerText ?? document.body?.textContent ?? "").trim();
    if (text) return text;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return "";
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
    ],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
  });
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderReaderView(opts: {
  title: string;
  renderedHTML: string;
}) {
  const { title, renderedHTML } = opts;

  // Build the reader page
  document.documentElement.innerHTML = /* html */ `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(title)}</title>
      <style>${readerCSS}</style>
    </head>
    <body class="md-reader-body">
      <aside id="md-toc" class="md-toc" aria-label="Table of contents">
        <div class="md-toc-head">
          <div class="md-toc-title">On this page</div>
        </div>
        <nav id="md-toc-nav"></nav>
      </aside>
      <main class="md-reader-container">
        <article id="md-reader-article" class="md-reader-content">
          ${renderedHTML}
        </article>
      </main>
    </body>
  `;

  document.documentElement.classList.add("md-reader-root");

  // Scroll to top
  window.scrollTo(0, 0);

  buildToc();
  annotateMarkdownSupportLinks();
}

function buildToc() {
  const article = document.getElementById("md-reader-article");
  const tocNav = document.getElementById("md-toc-nav");
  if (!article || !tocNav) return;

  const headings = Array.from(article.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  if (headings.length === 0) {
    document.getElementById("md-toc")?.remove();
    return;
  }

  const idCounts = new Map<string, number>();
  const fragment = document.createDocumentFragment();

  for (const heading of headings) {
    const text = heading.textContent?.trim();
    if (!text) continue;

    const baseId = slugify(text) || "section";
    const count = idCounts.get(baseId) ?? 0;
    idCounts.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count}`;
    heading.id = id;

    if (!heading.querySelector(".md-heading-anchor")) {
      const anchor = document.createElement("a");
      anchor.href = `#${id}`;
      anchor.className = "md-heading-anchor";
      anchor.textContent = "#";
      anchor.setAttribute("aria-label", `Link to section: ${text}`);
      heading.appendChild(anchor);
    }

    if (!/^H[1-3]$/.test(heading.tagName)) {
      continue;
    }

    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = text;
    link.className = `md-toc-link md-toc-level-${heading.tagName.toLowerCase()}`;
    fragment.appendChild(link);
  }

  tocNav.appendChild(fragment);
}

interface LinkSupportInfo {
  supportsMarkdown: boolean;
  contentType?: string;
  checkedVia?: "head" | "get" | "none";
}

function createTargetHoverText(info: LinkSupportInfo): string {
  const status = info.supportsMarkdown
    ? "Target likely supports markdown"
    : "Target is not a markdown URL";
  const contentType = info.contentType?.trim()
    ? `Content-Type: ${info.contentType}`
    : "Content-Type: unknown";
  const checkedVia =
    info.checkedVia === "head"
      ? "Checked: HEAD"
      : info.checkedVia === "get"
        ? "Checked: GET"
        : "Checked: unavailable";

  return `${status}\n${contentType}\n${checkedVia}`;
}

function setLinkTooltip(anchor: HTMLAnchorElement, text: string) {
  anchor.classList.add("md-link-has-tooltip");
  anchor.dataset.mdTooltip = text;
  anchor.setAttribute("aria-label", text.replace(/\n/g, ". "));
  anchor.title = text;
}

async function isLinkCapabilityCheckEnabled(): Promise<boolean> {
  try {
    const response = (await api.runtime.sendMessage({
      type: "GET_LINK_CHECKS_CONFIG",
    })) as { enabled?: boolean };
    return response?.enabled !== false;
  } catch {
    return true;
  }
}

async function annotateMarkdownSupportLinks() {
  const enabled = await isLinkCapabilityCheckEnabled();
  if (!enabled) return;

  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(".md-reader-content a[href]")
  );

  const urls = anchors
    .map((anchor) => anchor.href)
    .filter((href) => /^https?:\/\//i.test(href));

  if (urls.length === 0) return;

  let supportByUrl: Record<string, LinkSupportInfo> = {};
  try {
    const response = (await api.runtime.sendMessage({
      type: "PREFETCH_LINK_SUPPORT",
      urls,
    })) as { supportByOrigin?: Record<string, LinkSupportInfo> };
    supportByUrl = response?.supportByOrigin ?? {};
  } catch {
    return;
  }

  for (const anchor of anchors) {
    let urlKey: string;
    try {
      const parsed = new URL(anchor.href);
      parsed.hash = "";
      urlKey = parsed.toString();
    } catch {
      continue;
    }

    const info = supportByUrl[urlKey] ?? {
      supportsMarkdown: false,
      contentType: "",
      checkedVia: "none",
    };

    const hoverText = createTargetHoverText(info);
    setLinkTooltip(anchor, hoverText);

    if (info.supportsMarkdown) {
      anchor.classList.add("md-link-support");
      anchor.classList.remove("md-link-no-support");
    } else {
      anchor.classList.add("md-link-no-support");
      anchor.classList.remove("md-link-support");
    }
  }
}
