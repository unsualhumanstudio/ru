// Background service worker — proxies localhost fetch requests from content scripts
// (content script fetches are subject to the page CSP; background fetches are not)

const BRIDGE_ORIGIN = "http://localhost:27125";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "BRIDGE_FETCH") return false;
  if (!message.url?.startsWith(BRIDGE_ORIGIN)) {
    sendResponse({ ok: false, error: "Invalid URL" });
    return false;
  }

  fetch(message.url, message.options ?? {})
    .then(async res => {
      const text = await res.text();
      sendResponse({ ok: res.ok, status: res.status, text });
    })
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true; // keep message channel open for async response
});
