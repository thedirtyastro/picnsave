(() => {
  "use strict";

  if (window.__PICNSAVE_IMAGE_DOWNLOADER__) return;
  window.__PICNSAVE_IMAGE_DOWNLOADER__ = true;

  const HOST_ID = "__saru_image_downloader_host__";
  const DEFAULTS = {
    enabled: true,
    showFilename: true,
    includeBackgrounds: true,
    includeSvg: true,
    includeVideoPoster: true
  };

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .saru-button {
        position: fixed;
        z-index: 2147483647;
        display: none;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: min(260px, calc(100vw - 20px));
        padding: 10px 14px;
        border: 1px solid rgba(255,255,255,.42);
        border-radius: 13px;
        color: #fff;
        background: rgba(20, 22, 28, .68);
        -webkit-backdrop-filter: blur(18px) saturate(160%);
        backdrop-filter: blur(18px) saturate(160%);
        box-shadow: 0 8px 28px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.18);
        font: 600 12px/1.1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: .01em;
        cursor: pointer;
        user-select: none;
        transition: opacity .14s ease, transform .14s ease, background .14s ease;
        transform: translateY(0);
        opacity: 1;
      }
      .saru-button:hover { background: rgba(20,22,28,.86); }
      .saru-button:active { transform: scale(.97); }
      .saru-button[hidden] { display: none !important; }
      .saru-button:disabled { opacity: .72; cursor: wait; }
      .saru-icon { width: 15px; height: 15px; flex: 0 0 15px; }
      .saru-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .saru-toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        display: none;
        max-width: min(340px, calc(100vw - 36px));
        padding: 11px 14px;
        border: 1px solid rgba(255,255,255,.25);
        border-radius: 12px;
        color: white;
        background: rgba(22,24,29,.88);
        -webkit-backdrop-filter: blur(16px);
        backdrop-filter: blur(16px);
        box-shadow: 0 8px 28px rgba(0,0,0,.22);
        font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      @media (prefers-reduced-motion: reduce) {
        .saru-button { transition: none; }
      }
    </style>
    <button class="saru-button" type="button" aria-label="Download image">
      <svg class="saru-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17.5V20h16v-2.5"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="saru-label">Download</span>
    </button>
    <div class="saru-toast" role="status" aria-live="polite"></div>
  `;

  (document.documentElement || document).appendChild(host);

  const button = shadow.querySelector(".saru-button");
  const label = shadow.querySelector(".saru-label");
  const toast = shadow.querySelector(".saru-toast");

  let settings = { ...DEFAULTS };
  let activeTarget = null;
  let activeDescriptor = null;
  let hideTimer = null;
  let toastTimer = null;
  let lastPointer = { x: 0, y: 0 };

  chrome.storage.sync.get(DEFAULTS).then(value => {
    settings = { ...DEFAULTS, ...value };
    if (!settings.enabled) button.hidden = true;
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    if (!settings.enabled) hide();
  });

  function toastMessage(message) {
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = "none"; }, 2400);
  }

  function isUsableUrl(raw) {
    if (!raw || typeof raw !== "string") return false;
    const value = raw.trim();
    return /^(https?:|blob:|data:)/i.test(value);
  }

  function absoluteUrl(raw) {
    try { return new URL(raw, document.baseURI).href; }
    catch { return ""; }
  }

  function bestSrcset(img) {
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
    if (!srcset) return "";
    const candidates = srcset.split(",").map(part => {
      const bits = part.trim().split(/\s+/);
      const descriptor = bits[1] || "1x";
      const value = parseFloat(descriptor) || 1;
      return { url: bits[0], value };
    }).filter(item => item.url);
    candidates.sort((a, b) => b.value - a.value);
    return candidates[0]?.url || "";
  }

  function descriptorForElement(element) {
    if (!(element instanceof Element)) return null;

    if (element instanceof HTMLImageElement) {
      const url = element.currentSrc || element.src || bestSrcset(element);
      if (!isUsableUrl(url)) return null;
      return { url: absoluteUrl(url), kind: "image", element, mimeType: "" };
    }

    if (element instanceof HTMLVideoElement && settings.includeVideoPoster && element.poster) {
      return { url: absoluteUrl(element.poster), kind: "poster", element, mimeType: "image/*" };
    }

    if (settings.includeSvg && element instanceof SVGImageElement) {
      const url = element.href?.baseVal || element.getAttribute("xlink:href");
      if (isUsableUrl(url)) return { url: absoluteUrl(url), kind: "svg-image", element, mimeType: "" };
    }

    if (settings.includeSvg && element instanceof SVGSVGElement) {
      const serialized = new XMLSerializer().serializeToString(element);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      return { url: URL.createObjectURL(blob), kind: "inline-svg", element, mimeType: "image/svg+xml", temporary: true };
    }

    if (settings.includeBackgrounds) {
      const background = getBackgroundImage(element);
      if (background) return { url: background, kind: "background", element, mimeType: "" };
    }

    return null;
  }

  function extractUrls(cssValue) {
    if (!cssValue || cssValue === "none") return [];
    const urls = [];
    const regex = /url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g;
    let match;
    while ((match = regex.exec(cssValue))) {
      const value = (match[1] || match[2] || match[3] || "").trim();
      if (value) urls.push(value);
    }
    return urls;
  }

  function getBackgroundImage(element) {
    let current = element;
    // Walk up a few ancestors because image content is often on a wrapper.
    for (let depth = 0; current && depth < 4; depth++, current = current.parentElement) {
      const urls = extractUrls(getComputedStyle(current).backgroundImage);
      const candidate = urls.find(isUsableUrl);
      if (candidate) return absoluteUrl(candidate);
    }
    return "";
  }

  function findDescriptorFromPoint(target, x, y) {
    let element = target instanceof Element ? target : null;
    while (element && element !== document.documentElement) {
      const descriptor = descriptorForElement(element);
      if (descriptor) return descriptor;
      element = element.parentElement;
    }

    // elementFromPoint helps when pointer events originate on nested overlays.
    const underPointer = document.elementFromPoint(x, y);
    if (underPointer && underPointer !== target) {
      let node = underPointer;
      while (node && node !== document.documentElement) {
        const descriptor = descriptorForElement(node);
        if (descriptor) return descriptor;
        node = node.parentElement;
      }
    }
    return null;
  }

  function filenameFromDescriptor(descriptor) {
    const element = descriptor.element;
    const alt = element?.getAttribute?.("alt") || element?.getAttribute?.("aria-label");
    if (alt && alt.trim()) {
      return alt.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").slice(0, 100) + extensionFor(descriptor);
    }
    try {
      const url = new URL(descriptor.url);
      const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
      if (last && /\.[a-z0-9]{2,8}$/i.test(last)) return last;
    } catch {}
    return `picnsave-image${extensionFor(descriptor)}`;
  }

  function extensionFor(descriptor) {
    const mime = descriptor.mimeType || "";
    if (mime.includes("svg")) return ".svg";
    if (mime.includes("jpeg")) return ".jpg";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("avif")) return ".avif";
    if (mime.includes("gif")) return ".gif";
    if (mime.includes("png")) return ".png";
    return ".jpg";
  }

  function positionButton() {
    if (!activeTarget || button.hidden) return;
    const rect = activeTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return hide();
    const width = button.offsetWidth || 112;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width - 8));
    const top = Math.min(window.innerHeight - 48, Math.max(8, rect.top + 8));
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
  }

  function show(descriptor) {
    if (!settings.enabled || !descriptor?.url) return;
    clearTimeout(hideTimer);
    if (activeDescriptor?.temporary && activeDescriptor.url !== descriptor.url) {
      URL.revokeObjectURL(activeDescriptor.url);
    }
    activeDescriptor = descriptor;
    activeTarget = descriptor.element;
    label.textContent = settings.showFilename ? "Download image" : "Download";
    button.hidden = false;
    button.style.display = "inline-flex";
    requestAnimationFrame(positionButton);
  }

  function hide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      button.style.display = "none";
      activeTarget = null;
      if (activeDescriptor?.temporary) URL.revokeObjectURL(activeDescriptor.url);
      activeDescriptor = null;
    }, 180);
  }

  function downloadBlobInPage(url, filename) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  document.addEventListener("pointerover", event => {
    if (host.contains(event.target)) return;
    lastPointer = { x: event.clientX, y: event.clientY };
    const descriptor = findDescriptorFromPoint(event.target, event.clientX, event.clientY);
    if (descriptor) show(descriptor);
  }, true);

  document.addEventListener("pointermove", event => {
    lastPointer = { x: event.clientX, y: event.clientY };
  }, { capture: true, passive: true });

  document.addEventListener("pointerout", event => {
    if (host.contains(event.relatedTarget)) return;
    if (event.relatedTarget instanceof Node && activeTarget?.contains?.(event.relatedTarget)) return;
    hide();
  }, true);

  button.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  button.addEventListener("pointerleave", hide);

  button.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    const descriptor = activeDescriptor;
    if (!descriptor?.url) return;

    const filename = filenameFromDescriptor(descriptor);
    button.disabled = true;
    label.textContent = "Preparing…";

    try {
      if (descriptor.url.startsWith("blob:") || descriptor.url.startsWith("data:")) {
        downloadBlobInPage(descriptor.url, filename);
        toastMessage("Download started");
      } else {
        const response = await chrome.runtime.sendMessage({
          type: "PICNSAVE_DOWNLOAD",
          url: descriptor.url,
          filename,
          mimeType: descriptor.mimeType
        });
        if (!response?.ok) throw new Error(response?.error || "Download failed");
        toastMessage("Download started");
      }
      label.textContent = "Downloaded";
      setTimeout(() => { if (button.isConnected) label.textContent = "Download image"; }, 1300);
    } catch (error) {
      toastMessage(error?.message || "Could not download this image");
      label.textContent = "Try again";
    } finally {
      button.disabled = false;
    }
  });

  window.addEventListener("scroll", positionButton, { capture: true, passive: true });
  window.addEventListener("resize", positionButton, { passive: true });

  // Re-evaluate the image beneath the pointer after dynamic page updates.
  const observer = new MutationObserver(() => {
    if (!settings.enabled || !lastPointer) return;
    const element = document.elementFromPoint(lastPointer.x, lastPointer.y);
    if (!element || host.contains(element)) return;
    const descriptor = findDescriptorFromPoint(element, lastPointer.x, lastPointer.y);
    if (descriptor) show(descriptor);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "data-src", "data-srcset", "style", "poster"]
  });
})();