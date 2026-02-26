// ─── md-browser: Browser API compatibility layer ───────────────────────────
//
// Provides a unified API surface for Chrome (MV3) and Firefox (MV2/MV3).
// Both `chrome.*` and `browser.*` namespaces are normalised here.
// ────────────────────────────────────────────────────────────────────────────

declare const browser: typeof chrome | undefined;

/** The browser extension API — `browser` on Firefox, `chrome` on Chrome. */
export const api: typeof chrome =
  typeof browser !== "undefined" ? (browser as typeof chrome) : chrome;

/** True when running on Firefox. */
export const isFirefox: boolean =
  typeof browser !== "undefined" &&
  typeof (browser as unknown as Record<string, unknown>).runtime !==
    "undefined";

/**
 * True when `declarativeNetRequest` is available (Chrome MV3).
 * Firefox MV3 supports it too, but we prefer `webRequest` there for
 * per-tab control.
 */
export const hasDeclarativeNetRequest: boolean =
  !isFirefox &&
  typeof chrome !== "undefined" &&
  typeof chrome.declarativeNetRequest !== "undefined";
