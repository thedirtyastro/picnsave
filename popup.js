const enabledInput = document.getElementById("enabled");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

async function refresh() {
  const { enabled = true } = await chrome.storage.sync.get({ enabled: true });
  enabledInput.checked = enabled;
  statusText.textContent = enabled ? "Extension is active" : "Extension is paused";
  statusDot.classList.toggle("off", !enabled);
}

enabledInput.addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: enabledInput.checked });
  await refresh();
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh();