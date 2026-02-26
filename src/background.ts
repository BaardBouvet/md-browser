// ─── md-browser: Background Service Worker ─────────────────────────────────
//
// Responsibilities:
//   1. Add Accept: text/markdown to navigational request headers
//   2. Detect text/markdown responses and track which tabs received markdown
//   3. Set badge indicator on tabs that received markdown
//   4. Handle messages from content script and popup
//   5. Manage "bypass" rules for viewing original HTML
// ────────────────────────────────────────────────────────────────────────────

interface MarkdownTabInfo {
  url: string;
  tokens?: string;
  contentType?: string;
}

// In-memory map of tabs that received markdown. Resets if the service worker
// restarts, but the content script also detects via document.contentType.
const markdownTabs = new Map<number, MarkdownTabInfo>();

// ─── 1. Modify Accept headers via declarativeNetRequest ─────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.declarativeNetRequest.updateDynamicRules({
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
              value:
                "text/markdown, text/html;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.7",
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
  console.log("[md-browser] Accept header rule installed");
});

// ─── 2. Observe response headers ───────────────────────────────────────────

chrome.webRequest.onHeadersReceived.addListener(
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

      // Set badge
      chrome.action.setBadgeText({ text: "MD", tabId: details.tabId });
      chrome.action.setBadgeBackgroundColor({
        color: "#27AE60",
        tabId: details.tabId,
      });

      console.log(
        `[md-browser] Markdown detected on tab ${details.tabId}: ${details.url}`
      );
    } else {
      // If this tab previously had markdown but now navigated to HTML, clear it
      if (markdownTabs.has(details.tabId)) {
        markdownTabs.delete(details.tabId);
        chrome.action.setBadgeText({ text: "", tabId: details.tabId });
      }
    }
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

// ─── 3. Message handling ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
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
            url: info?.url,
            tokens: info?.tokens,
          });
        } else {
          sendResponse({ isMarkdown: false });
        }
        break;
      }

      case "BYPASS_TAB": {
        // Add a high-priority session rule that restores the default Accept
        // header for this specific tab, then reload.
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

      default:
        sendResponse({ error: "unknown message type" });
    }

    return false; // synchronous unless stated otherwise
  }
);

// ─── 4. Tab-specific bypass rules ──────────────────────────────────────────

// Rule IDs for bypass: tabId + 10000 to avoid collision with the global rule
function bypassRuleId(tabId: number) {
  return tabId + 10000;
}

async function bypassTab(tabId: number) {
  await chrome.declarativeNetRequest.updateSessionRules({
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
              value:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
  markdownTabs.delete(tabId);
  chrome.action.setBadgeText({ text: "", tabId });
}

async function removeBypass(tabId: number) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [bypassRuleId(tabId)],
  });
}

// ─── 5. Cleanup ─────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  markdownTabs.delete(tabId);
  // Clean up any session bypass rules
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [bypassRuleId(tabId)],
  });
});
