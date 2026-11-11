const DEFAULTS = {
  enabled: true,
  showFilename: true,
  includeBackgrounds: true,
  includeSvg: true,
  includeVideoPoster: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const missing = Object.fromEntries(
    Object.entries(DEFAULTS).filter(([key]) => current[key] === undefined)
  );
  if (Object.keys(missing).length) {
    await chrome.storage.sync.set(missing);
  }
});

function safeFilename(input, fallback = "pixora-image") {
  const cleaned = String(input || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

function filenameFromUrl(rawUrl, mimeType) {
  try {
    const url = new URL(rawUrl);
    const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    if (last && /\.[a-z0-9]{2,8}$/i.test(last)) return safeFilename(last);
  } catch {}
  const extensionByMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff"
  };
  return safeFilename("pixora-image" + (extensionByMime[mimeType] || ".png"));
}

function isAllowedDownloadUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return ["http:", "https:", "data:", "blob:"].includes(url.protocol);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "PIXORA_DOWNLOAD") return;

  (async () => {
    try {
      if (!sender.tab?.id) throw new Error("Download request did not come from a browser tab.");
      if (typeof message.url !== "string" || !isAllowedDownloadUrl(message.url)) {
        throw new Error("This image URL cannot be downloaded.");
      }

      // Blob URLs are scoped to their creating document. The content script handles
      // those with a same-page anchor because the service worker cannot resolve them.
      if (message.url.startsWith("blob:")) {
        throw new Error("This temporary image must be downloaded from the page context.");
      }

      const settings = await chrome.storage.sync.get(DEFAULTS);
      if (!settings.enabled) throw new Error("Pixora is paused.");

      const filename = safeFilename(
        message.filename || filenameFromUrl(message.url, message.mimeType)
      );

      const downloadId = await chrome.downloads.download({
        url: message.url,
        filename,
        conflictAction: "uniquify",
        saveAs: false
      });

      sendResponse({ ok: true, downloadId });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "Download failed." });
    }
  })();

  return true;
});