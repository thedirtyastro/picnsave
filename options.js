const KEYS = ["includeBackgrounds", "includeSvg", "includeVideoPoster", "showFilename"];
const defaults = {
  includeBackgrounds: true,
  includeSvg: true,
  includeVideoPoster: true,
  showFilename: true
};

async function load() {
  const values = await chrome.storage.sync.get(defaults);
  for (const key of KEYS) document.getElementById(key).checked = values[key];
}

for (const key of KEYS) {
  document.getElementById(key).addEventListener("change", async event => {
    await chrome.storage.sync.set({ [key]: event.target.checked });
    const saved = document.getElementById("saved");
    saved.textContent = "Saved.";
    setTimeout(() => { saved.textContent = "Settings are saved automatically."; }, 1200);
  });
}
load();