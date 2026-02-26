// ─── md-browser: Popup Script ───────────────────────────────────────────────

async function init() {
  const sourceEl = document.getElementById("source-type")!;
  const tokensRow = document.getElementById("tokens-row")!;
  const tokensValue = document.getElementById("tokens-value")!;
  const urlRow = document.getElementById("url-row")!;
  const pageUrl = document.getElementById("page-url")!;
  const btnToggle = document.getElementById("btn-toggle") as HTMLButtonElement;

  // Use browser.* on Firefox, chrome.* on Chrome
  const _api: typeof chrome =
    typeof browser !== "undefined" ? (browser as unknown as typeof chrome) : chrome;

  // Get current tab
  const [tab] = await _api.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) {
    sourceEl.textContent = "No active tab";
    return;
  }

  // Query background for markdown status
  const info = await _api.runtime.sendMessage({
    type: "GET_TAB_INFO",
    tabId: tab.id,
  });

  if (info?.isMarkdown) {
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

    // Show "View original" button
    btnToggle.hidden = false;
    btnToggle.textContent = "View original page";
    btnToggle.addEventListener("click", async () => {
      await _api.runtime.sendMessage({
        type: "BYPASS_TAB",
        tabId: tab.id,
      });
      await _api.tabs.reload(tab.id!);
      window.close();
    });
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
}

init();
