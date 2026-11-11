# Pixora

A Manifest V3 Chrome extension that displays a glass-style download control when you hover over an image-like element.

## Features

- HTML images, including `currentSrc` and responsive `srcset`
- CSS background images on the hovered element and nearby ancestors
- Inline SVG graphics and SVG `<image>` elements
- Video poster images
- Dynamic page updates through `MutationObserver`
- Glassmorphism hover button rendered inside a closed Shadow DOM
- One-click downloads through `chrome.downloads`
- Same-page download handling for `blob:` and `data:` URLs
- Popup enable/pause toggle and settings page

## Install locally

1. Extract the ZIP.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the `pixora` folder.
6. Visit a normal website and hover over an image.

## Project files

- `manifest.json`: Manifest V3 configuration and permissions.
- `background.js`: validates and starts downloads.
- `content.js`: detects image targets and renders the hover control.
- `popup.*`: extension popup and enable/pause toggle.
- `options.*`: image detection settings.

## Notes and limitations

- Chrome restricts extensions on internal pages such as `chrome://`, the Chrome Web Store, and some browser-owned pages.
- A website can block access to content through CSP, cross-origin restrictions, sandboxing, or custom rendering.
- `blob:` URLs are temporary and are downloaded from the page context. Some sites revoke them quickly.
- CSS backgrounds with multiple layered images currently select the first usable URL.
- Inline SVG is serialized to a temporary object URL. External resources referenced from inside that SVG may not be embedded.
- For `srcset`, the browser's `currentSrc` is preferred because it is the resource actually selected for the current viewport and device pixel ratio. The largest declared `srcset` candidate is only a fallback.
- This extension does not bypass paywalls, authentication, hotlink protection, DRM, or website access controls.

## Before publishing

- Create PNG icons at `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, and `icons/icon128.png`.
- Review the permissions and privacy disclosures for the Chrome Web Store listing.
- Test on sites with regular images, lazy loading, CSS backgrounds, SVG, and responsive images.
- Consider narrowing host access or offering optional site access before public release.

## Privacy

The extension does not send image URLs or browsing activity to an external server. Downloads are initiated locally through Chrome's Downloads API.
