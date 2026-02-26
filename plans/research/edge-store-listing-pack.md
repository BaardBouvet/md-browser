# Edge Add-ons Listing Pack

Use this content as a starting point for your Microsoft Edge Add-ons submission.

## Extension name

Markdown Browser

## Short description

Read the web in clean markdown with a distraction-free reader.

## Full description

Markdown Browser requests markdown from websites that support HTTP content negotiation and renders content in a clean, focused reading view.

### What it does

- Requests markdown-first responses where supported.
- Renders markdown with a readable layout and typography.
- Shows table-of-contents navigation for longer pages.
- Adds heading anchor links for quick section sharing.
- Lets users switch between markdown mode and original HTML mode.
- Supports optional link capability checks (default off for privacy).

### Why use it

- Less visual noise when reading long-form web content.
- Faster reading flow for docs and articles.
- Minimal controls with browser-native workflow.

### Browser support

- Chromium-based browsers (Microsoft Edge, Google Chrome).

## Privacy disclosure (store field / policy summary)

Markdown Browser does not include analytics or telemetry.

### Data handling

- Stores extension preferences locally (for example: link-check setting).
- Does not sell user data.
- Does not use third-party tracking SDKs.

### Network behavior

- Sends standard navigation requests with markdown preference headers.
- Optional link checks can send lightweight background requests for links on the current markdown page.
- Link checks are disabled by default for privacy and can be enabled in the popup.

## Permission justifications

### declarativeNetRequest
Used to set markdown preference request headers for top-level navigations.

### webRequest
Used to observe top-level response headers and determine markdown vs HTML mode.

### tabs
Used to read active tab context and reload tabs when switching mode.

### activeTab
Used for user-initiated actions on the current tab.

### storage
Used to persist extension settings (including link-check preference).

### Host permissions (http/https)
Used to apply markdown negotiation and content rendering behavior on regular web pages.

## Support URL content (suggested)

Recommended: publish `SUPPORT.md` and use that URL in the store.

The support page should include:

- Contact email
- Issue reporting link
- Known limitations
- Version/changelog link

## Privacy policy URL content (minimum)

Recommended: publish `PRIVACY.md` and use that URL in the store.

Include:

- What data is collected (if any)
- What data is stored locally
- Whether data is shared/sold (state no, if true)
- Optional network features and controls (link checks)
- Contact method for privacy inquiries

Current privacy contact:

- baard.johansen@bouvet.no

## Store assets checklist

- 1x extension icon: `store-assets/extension-icon-300.png`
- 1x small tile / logo: `store-assets/small-tile-440x280.png`
- Optional square logo variant: `store-assets/logo-300.png`
- 3–5 screenshots showing:
  1. Markdown reader view
  2. Popup with link-check toggle
  3. View original / request markdown mode action
  4. TOC + heading anchors in action

## Suggested release notes (v0.1.0)

- Initial public release for Chromium browsers.
- Markdown-first reader mode with clean typography.
- Optional link capability checks (default off for privacy).
- Popup mode controls and improved mode switching.
- Security hardening: HTML sanitization, scoped host permissions, explicit CSP.
