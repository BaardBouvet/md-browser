// ─── md-browser: Popup Script ───────────────────────────────────────────────

import { api } from "../browser-api";

async function init() {
  const sourceEl = document.getElementById("source-type")!;
  const tokensRow = document.getElementById("tokens-row")!;
  const tokensValue = document.getElementById("tokens-value")!;
  const urlRow = document.getElementById("url-row")!;
  const pageUrl = document.getElementById("page-url")!;
  const btnToggle = document.getElementById("btn-toggle") as HTMLButtonElement;
  const linkChecksToggle = document.getElementById(
    "link-checks-toggle"
  ) as HTMLInputElement;
  const linkChecksHelp = document.getElementById("link-checks-help") as HTMLElement;

  const updateLinkChecksHelpText = (enabled: boolean) => {
    linkChecksHelp.textContent = enabled
      ? "Enabled: the extension checks links in reader mode and labels likely markdown targets."
      : "Disabled: no background link checks are made, and link capability labels are hidden.";
  };

  // Get current tab
  const [tab] = await api.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) {
    sourceEl.textContent = "No active tab";
    return;
  }

  try {
    const config = await api.runtime.sendMessage({
      type: "GET_LINK_CHECKS_CONFIG",
    });
    linkChecksToggle.checked = config?.enabled !== false;
    updateLinkChecksHelpText(linkChecksToggle.checked);
  } catch {
    linkChecksToggle.checked = true;
    updateLinkChecksHelpText(true);
  }

  linkChecksToggle.addEventListener("change", async () => {
    await api.runtime.sendMessage({
      type: "SET_LINK_CHECKS_CONFIG",
      enabled: linkChecksToggle.checked,
    });
    updateLinkChecksHelpText(linkChecksToggle.checked);
  });

  // Query background for markdown status
  const info = await api.runtime.sendMessage({
    type: "GET_TAB_INFO",
    tabId: tab.id,
  });

  let isMarkdown = !!info?.isMarkdown;
  const isBypassed = !!info?.isBypassed;
  if (!isMarkdown) {
    try {
      const pageInfo = await api.tabs.sendMessage(tab.id, {
        type: "GET_PAGE_SOURCE",
      });
      isMarkdown = !!pageInfo?.isMarkdownPage;
    } catch {
      // Ignore: no content script response available for this tab.
    }
  }

  if (isMarkdown) {
    sourceEl.textContent = "text/markdown ✓";
    sourceEl.classList.add("is-markdown");

    if (info.tokens) {
      tokensRow.hidden = false;
      tokensValue.textContent = info.tokens;
    }

    if (info.url) {
      urlRow.hidden = false;
      pageUrl.textContent = new URL(info.url).hostname;
      pageUrl.title = info.url;
    }

  } else {
    sourceEl.textContent = "text/html";

    // Show page URL
    if (tab.url) {
      urlRow.hidden = false;
      try {
        pageUrl.textContent = new URL(tab.url).hostname;
        pageUrl.title = tab.url;
      } catch {
        pageUrl.textContent = tab.url;
      }
    }
  }

  const canToggle = /^https?:\/\//i.test(tab.url ?? "");
  if (canToggle) {
    btnToggle.hidden = false;

    if (isMarkdown && !isBypassed) {
      btnToggle.textContent = "View original page";
      btnToggle.addEventListener("click", async () => {
        await api.runtime.sendMessage({
          type: "BYPASS_TAB",
          tabId: tab.id,
        });
        await api.tabs.reload(tab.id!);
        window.close();
      });
    } else {
      btnToggle.textContent = "Request markdown mode";
      btnToggle.addEventListener("click", async () => {
        await api.runtime.sendMessage({
          type: "REMOVE_BYPASS",
          tabId: tab.id,
        });
        await api.tabs.reload(tab.id!);
        window.close();
      });
    }
  }
}

init();
