// ─── md-browser: Background Service Worker ─────────────────────────────────
//
// Responsibilities:
//   1. Add Accept: text/markdown to navigational request headers
//   2. Detect text/markdown responses and track which tabs received markdown
//   3. Set badge indicator on tabs that received markdown
//   4. Handle messages from content script and popup
//   5. Manage "bypass" rules for viewing original HTML
//
// Cross-browser: Chrome MV3 uses declarativeNetRequest for header rewriting
// and webRequest for response observation. Firefox MV2 uses webRequest for
// both header rewriting and response observation.
// ────────────────────────────────────────────────────────────────────────────

import { api, isFirefox, hasDeclarativeNetRequest } from "./browser-api";

const ACCEPT_MARKDOWN =
  "text/markdown, text/html;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.7";
const ACCEPT_HTML =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const LINK_CHECKS_STORAGE_KEY = "enableLinkCapabilityChecks";
const RUNTIME_STATE_STORAGE_KEY = "runtimeStateV1";

const LINK_CHECK_WINDOW_MS = 60_000;
const LINK_CHECK_MAX_PER_WINDOW = 24;
const LINK_CHECK_TTL_SUCCESS_MS = 30 * 60_000;
const LINK_CHECK_TTL_NEGATIVE_MS = 10 * 60_000;
const LINK_CHECK_BACKOFF_BASE_MS = 30_000;
const LINK_CHECK_BACKOFF_MAX_MS = 30 * 60_000;

interface LinkSupportInfo {
  supportsMarkdown: boolean;
  contentType: string;
  checkedVia: "head" | "get" | "none";
}

interface CachedLinkSupportInfo extends LinkSupportInfo {
  expiresAt: number;
  failureCount: number;
  backoffUntil: number;
}

interface MarkdownTabInfo {
  url: string;
  tokens?: string;
  contentType?: string;
}

// In-memory map of tabs that received markdown. Resets if the service worker
// restarts, but the content script also detects via document.contentType.
const markdownTabs = new Map<number, MarkdownTabInfo>();

// Set of tab IDs that are in bypass mode (view original)
const bypassedTabs = new Set<number>();
const markdownSupportCache = new Map<string, CachedLinkSupportInfo>();
const markdownSupportInFlight = new Map<string, Promise<LinkSupportInfo>>();
const linkCheckBudgetByTab = new Map<number, { windowStart: number; count: number }>();

// ─── Badge helper (browserAction on Firefox MV2, action on Chrome MV3) ─────

const badge = isFirefox
  ? (api as unknown as { browserAction: typeof chrome.action }).browserAction
  : api.action;
const action = badge;

function updateActionState(tabId: number) {
  const isMarkdown = markdownTabs.has(tabId);
  const isBypassed = bypassedTabs.has(tabId);

  if (isMarkdown) {
    action.setBadgeText({ text: "MD", tabId });
    action.setBadgeBackgroundColor({ color: "#27AE60", tabId });
    if (typeof action.setBadgeTextColor === "function") {
      action.setBadgeTextColor({ color: "#FFFFFF", tabId });
    }
    action.setTitle({ title: "Markdown mode (click to view HTML)", tabId });
    return;
  }

  if (isBypassed) {
    action.setBadgeText({ text: "H", tabId });
    action.setBadgeBackgroundColor({ color: "#6B7280", tabId });
    if (typeof action.setBadgeTextColor === "function") {
      action.setBadgeTextColor({ color: "#FFFFFF", tabId });
    }
    action.setTitle({ title: "HTML mode (click to request Markdown)", tabId });
    return;
  }

  action.setBadgeText({ text: "M", tabId });
  action.setBadgeBackgroundColor({ color: "#2563EB", tabId });
  if (typeof action.setBadgeTextColor === "function") {
    action.setBadgeTextColor({ color: "#FFFFFF", tabId });
  }
  action.setTitle({ title: "Markdown preferred (click to force HTML)", tabId });
}

async function refreshAllTabActionState() {
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (typeof tab.id === "number") {
      updateActionState(tab.id);
    }
  }
}

function runtimeStorageArea(): chrome.storage.StorageArea {
  const storageAny = api.storage as unknown as {
    session?: chrome.storage.StorageArea;
    local: chrome.storage.StorageArea;
  };
  return storageAny.session ?? storageAny.local;
}

async function persistRuntimeState() {
  const serializedMarkdownTabs = Array.from(markdownTabs.entries());
  const serializedBypassedTabs = Array.from(bypassedTabs.values());
  await runtimeStorageArea().set({
    [RUNTIME_STATE_STORAGE_KEY]: {
      markdownTabs: serializedMarkdownTabs,
      bypassedTabs: serializedBypassedTabs,
    },
  });
}

async function restoreRuntimeState() {
  const raw = await runtimeStorageArea().get({ [RUNTIME_STATE_STORAGE_KEY]: null });
  const state = (raw as Record<string, unknown>)[RUNTIME_STATE_STORAGE_KEY] as
    | {
        markdownTabs?: Array<[number, MarkdownTabInfo]>;
        bypassedTabs?: number[];
      }
    | null;

  if (!state) return;

  markdownTabs.clear();
  bypassedTabs.clear();

  for (const entry of state.markdownTabs ?? []) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [tabId, info] = entry;
    if (typeof tabId !== "number" || typeof info !== "object" || !info) continue;
    markdownTabs.set(tabId, info);
  }

  for (const tabId of state.bypassedTabs ?? []) {
    if (typeof tabId === "number") {
      bypassedTabs.add(tabId);
    }
  }
}

async function getLinkCapabilityChecksEnabled(): Promise<boolean> {
  try {
    const raw = await (api.storage.local as typeof chrome.storage.local).get({
      [LINK_CHECKS_STORAGE_KEY]: false,
    });
    const value = (raw as Record<string, unknown>)[LINK_CHECKS_STORAGE_KEY];
    return value !== false;
  } catch {
    return false;
  }
}

// ─── 1. Modify Accept headers ──────────────────────────────────────────────

if (hasDeclarativeNetRequest) {
  // Chrome MV3: declarativeNetRequest for the global rule
  api.runtime.onInstalled.addListener(async () => {
    await api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: [
        {
          id: 1,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "Accept",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: ACCEPT_MARKDOWN,
              },
            ],
          },
          condition: {
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            ],
          },
        },
      ],
    });
    console.log("[md-browser] Accept header rule installed (declarativeNetRequest)");
    await restoreRuntimeState();
    await refreshAllTabActionState();
  });
} else {
  // Firefox MV2: webRequest.onBeforeSendHeaders for header rewriting
  api.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      if (!details.requestHeaders) return;

      const value = bypassedTabs.has(details.tabId)
        ? ACCEPT_HTML
        : ACCEPT_MARKDOWN;

      for (const header of details.requestHeaders) {
        if (header.name.toLowerCase() === "accept") {
          header.value = value;
        }
      }
      return { requestHeaders: details.requestHeaders };
    },
    { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
    ["blocking", "requestHeaders"]
  );
  console.log("[md-browser] Accept header rewriting installed (webRequest)");
}

// ─── 2. Observe response headers ───────────────────────────────────────────

api.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.responseHeaders || details.tabId < 0) return;

    let contentType: string | undefined;
    let tokens: string | undefined;

    for (const header of details.responseHeaders) {
      const name = header.name.toLowerCase();
      if (name === "content-type") contentType = header.value;
      if (name === "x-markdown-tokens") tokens = header.value;
    }

    if (contentType && contentType.includes("text/markdown")) {
      markdownTabs.set(details.tabId, {
        url: details.url,
        tokens,
        contentType,
      });
      bypassedTabs.delete(details.tabId);
      updateActionState(details.tabId);
      void persistRuntimeState();

      console.log(
        `[md-browser] Markdown detected on tab ${details.tabId}: ${details.url}`
      );
    } else {
      // If this tab previously had markdown but now navigated to HTML, clear it
      if (markdownTabs.has(details.tabId)) {
        markdownTabs.delete(details.tabId);
      }
      updateActionState(details.tabId);
      void persistRuntimeState();
    }
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
  ["responseHeaders"]
);

// ─── 3. Message handling ────────────────────────────────────────────────────

api.runtime.onMessage.addListener(
  (
    message: { type: string; tabId?: number },
    sender,
    sendResponse: (response: unknown) => void
  ) => {
    const tabId = sender.tab?.id ?? message.tabId;

    switch (message.type) {
      case "CHECK_MARKDOWN": {
        const info = tabId != null ? markdownTabs.get(tabId) : undefined;
        sendResponse({
          isMarkdown: !!info,
          isBypassed: tabId != null ? bypassedTabs.has(tabId) : false,
          url: info?.url,
          tokens: info?.tokens,
          contentType: info?.contentType,
        });
        break;
      }

      case "GET_TAB_INFO": {
        if (tabId != null) {
          const info = markdownTabs.get(tabId);
          sendResponse({
            isMarkdown: !!info,
            isBypassed: bypassedTabs.has(tabId),
            url: info?.url,
            tokens: info?.tokens,
          });
        } else {
          sendResponse({ isMarkdown: false, isBypassed: false });
        }
        break;
      }

      case "BYPASS_TAB": {
        if (tabId != null) {
          bypassTab(tabId).then(() => sendResponse({ ok: true }));
          return true; // async
        }
        sendResponse({ ok: false });
        break;
      }

      case "REMOVE_BYPASS": {
        if (tabId != null) {
          removeBypass(tabId).then(() => sendResponse({ ok: true }));
          return true;
        }
        sendResponse({ ok: false });
        break;
      }

      case "PREFETCH_LINK_SUPPORT": {
        getLinkCapabilityChecksEnabled()
          .then(async (enabled) => {
            if (!enabled) {
              sendResponse({ supportByOrigin: {}, disabled: true });
              return;
            }

            const urls = Array.isArray((message as { urls?: string[] }).urls)
              ? ((message as { urls?: string[] }).urls as string[])
              : [];

            const supportByOrigin = await prefetchLinkSupport(urls, tabId);
            sendResponse({ supportByOrigin, disabled: false });
          })
          .catch(() => sendResponse({ supportByOrigin: {}, disabled: false }));
        return true;
      }

      case "GET_LINK_CHECKS_CONFIG": {
        getLinkCapabilityChecksEnabled()
          .then((enabled) => sendResponse({ enabled }))
          .catch(() => sendResponse({ enabled: false }));
        return true;
      }

      case "SET_LINK_CHECKS_CONFIG": {
        const enabled = (message as { enabled?: boolean }).enabled !== false;
        api.storage.local
          .set({ [LINK_CHECKS_STORAGE_KEY]: enabled })
          .then(() => sendResponse({ ok: true, enabled }))
          .catch(() => sendResponse({ ok: false, enabled }));
        return true;
      }

      default:
        sendResponse({ error: "unknown message type" });
    }

    return false; // synchronous unless stated otherwise
  }
);

// ─── 4. Tab-specific bypass ────────────────────────────────────────────────

function bypassRuleId(tabId: number) {
  return tabId + 10000;
}

async function bypassTab(tabId: number) {
  bypassedTabs.add(tabId);
  markdownTabs.delete(tabId);
  updateActionState(tabId);
  await persistRuntimeState();

  if (hasDeclarativeNetRequest) {
    // Chrome: session rule to override global rule for this tab
    await api.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [bypassRuleId(tabId)],
      addRules: [
        {
          id: bypassRuleId(tabId),
          priority: 2,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "Accept",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: ACCEPT_HTML,
              },
            ],
          },
          condition: {
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            ],
            tabIds: [tabId],
          },
        },
      ],
    });
  }
  // Firefox: bypassedTabs set is checked in the onBeforeSendHeaders listener
}

async function removeBypass(tabId: number) {
  bypassedTabs.delete(tabId);
  updateActionState(tabId);
  await persistRuntimeState();
  if (hasDeclarativeNetRequest) {
    await api.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [bypassRuleId(tabId)],
    });
  }
}

// ─── 5. Cleanup ─────────────────────────────────────────────────────────────

api.tabs.onRemoved.addListener((tabId) => {
  markdownTabs.delete(tabId);
  bypassedTabs.delete(tabId);
  linkCheckBudgetByTab.delete(tabId);
  void persistRuntimeState();
  if (hasDeclarativeNetRequest) {
    api.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [bypassRuleId(tabId)],
    });
  }
});

api.tabs.onActivated.addListener(({ tabId }) => {
  updateActionState(tabId);
});

api.runtime.onStartup?.addListener(() => {
  void restoreRuntimeState().then(() => refreshAllTabActionState());
});

api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" || changeInfo.status === "complete") {
    updateActionState(tabId);
  }
});

action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  if (markdownTabs.has(tab.id)) {
    await bypassTab(tab.id);
  } else {
    await removeBypass(tab.id);
  }

  await api.tabs.reload(tab.id, { bypassCache: true });
});

function tabLinkCheckBudgetRemaining(tabId: number | undefined): number {
  if (typeof tabId !== "number") return LINK_CHECK_MAX_PER_WINDOW;

  const now = Date.now();
  const current = linkCheckBudgetByTab.get(tabId);
  if (!current || now - current.windowStart > LINK_CHECK_WINDOW_MS) {
    linkCheckBudgetByTab.set(tabId, { windowStart: now, count: 0 });
    return LINK_CHECK_MAX_PER_WINDOW;
  }

  return Math.max(0, LINK_CHECK_MAX_PER_WINDOW - current.count);
}

function consumeTabLinkCheckBudget(tabId: number | undefined, count: number) {
  if (typeof tabId !== "number" || count <= 0) return;
  const now = Date.now();
  const current = linkCheckBudgetByTab.get(tabId);
  if (!current || now - current.windowStart > LINK_CHECK_WINDOW_MS) {
    linkCheckBudgetByTab.set(tabId, { windowStart: now, count });
    return;
  }
  current.count += count;
}

async function prefetchLinkSupport(urls: string[], tabId?: number) {
  const uniqueUrls = Array.from(
    new Set(
      urls
        .map((url) => {
          try {
            const parsed = new URL(url);
            if (!/^https?:$/.test(parsed.protocol)) return null;
            parsed.hash = "";
            return parsed.toString();
          } catch {
            return null;
          }
        })
        .filter((candidate): candidate is string => !!candidate)
    )
  ).slice(0, 80);

  const budget = tabLinkCheckBudgetRemaining(tabId);
  const budgetedUrls = uniqueUrls.slice(0, budget);
  consumeTabLinkCheckBudget(tabId, budgetedUrls.length);

  const checks = await Promise.all(
    budgetedUrls.map(async (url) => [url, await checkUrlMarkdownSupport(url)] as const)
  );

  return Object.fromEntries(checks);
}

async function checkUrlMarkdownSupport(url: string): Promise<LinkSupportInfo> {
  const now = Date.now();
  const cached = markdownSupportCache.get(url);
  if (cached) {
    if (now < cached.backoffUntil) {
      return {
        supportsMarkdown: false,
        contentType: cached.contentType,
        checkedVia: "none",
      };
    }

    if (now < cached.expiresAt) {
      return {
        supportsMarkdown: cached.supportsMarkdown,
        contentType: cached.contentType,
        checkedVia: cached.checkedVia,
      };
    }
  }

  if (markdownSupportCache.has(url) && !cached) {
    return {
      supportsMarkdown: false,
      contentType: "",
      checkedVia: "none",
    };
  }

  const inFlight = markdownSupportInFlight.get(url);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    let result: LinkSupportInfo = {
      supportsMarkdown: false,
      contentType: "",
      checkedVia: "none",
    };
    let failed = false;

    try {
      const headResponse = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { Accept: ACCEPT_MARKDOWN },
      });

      const headContentType = headResponse.headers.get("content-type") ?? "";
      result = {
        supportsMarkdown: headContentType.includes("text/markdown"),
        contentType: headContentType,
        checkedVia: "head",
      };

      if (!result.supportsMarkdown) {
        const controller = new AbortController();
        const getResponse = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: { Accept: ACCEPT_MARKDOWN },
          signal: controller.signal,
        });
        const getContentType = getResponse.headers.get("content-type") ?? "";
        result = {
          supportsMarkdown: getContentType.includes("text/markdown"),
          contentType: getContentType,
          checkedVia: "get",
        };
        controller.abort();
      }
    } catch {
      failed = true;
      result = {
        supportsMarkdown: false,
        contentType: "",
        checkedVia: "none",
      };
    }

    const existing = markdownSupportCache.get(url);
    const failureCount = failed ? Math.min((existing?.failureCount ?? 0) + 1, 8) : 0;
    const backoffUntil = failed
      ? now + Math.min(LINK_CHECK_BACKOFF_BASE_MS * 2 ** (failureCount - 1), LINK_CHECK_BACKOFF_MAX_MS)
      : 0;
    const expiresAt =
      now + (result.supportsMarkdown ? LINK_CHECK_TTL_SUCCESS_MS : LINK_CHECK_TTL_NEGATIVE_MS);

    markdownSupportCache.set(url, {
      ...result,
      expiresAt,
      failureCount,
      backoffUntil,
    });
    markdownSupportInFlight.delete(url);
    return result;
  })();

  markdownSupportInFlight.set(url, requestPromise);
  return requestPromise;
}
