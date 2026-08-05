// Cross-browser compatibility shim -- see js/background.js for notes.
const ext = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_ENGINE_SETTINGS = { google: true, baidu: true, yandex: true, duckduckgo: true };

function fetchData (platform) {
    return getSite(platform);
}

function button_handler(event) {

    if (event.target.matches(".select")) {
      let platform = event.target.getAttribute("data-attribute")
      fetchData(platform);
    } else if (event.target.matches(".remove")) {
      let platform = event.target.getAttribute("data-attribute")
      if (platform == "all") {
          deleteAll();
      } else {
        try {
          deleteSite(platform);
        } catch (error) {
          console.error(error);
        }
      }

    }
}

/**
 * Read the saved per-engine settings and reflect them in the toggle
 * switches. Defaults to "on" for any engine that hasn't been set yet,
 * matching the extension's original always-collect behaviour.
 */
async function loadEngineToggles() {
    let settings = DEFAULT_ENGINE_SETTINGS;
    try {
        const stored = await ext.storage.local.get("engineSettings");
        settings = { ...DEFAULT_ENGINE_SETTINGS, ...(stored.engineSettings || {}) };
    } catch (e) {
        console.error("Failed to load engine settings", e);
    }
    document.querySelectorAll(".engine-toggle").forEach((toggle) => {
        const engine = toggle.getAttribute("data-engine");
        toggle.checked = settings[engine] !== false;
    });
}

/**
 * Persist a toggle change to storage.local. background.js listens for
 * storage.onChanged, so this takes effect for any tab that's already
 * open -- no reload needed.
 */
async function onToggleChange(event) {
    if (!event.target.matches(".engine-toggle")) return;
    const engine = event.target.getAttribute("data-engine");
    const enabled = event.target.checked;
    try {
        const stored = await ext.storage.local.get("engineSettings");
        const settings = { ...DEFAULT_ENGINE_SETTINGS, ...(stored.engineSettings || {}) };
        settings[engine] = enabled;
        await ext.storage.local.set({ engineSettings: settings });
    } catch (e) {
        console.error("Failed to save engine setting", e);
    }
}

/**
 * Init!
 */
document.addEventListener('DOMContentLoaded', async function () {
    document.addEventListener('click', button_handler);
    document.addEventListener('change', onToggleChange);
    await loadEngineToggles();
});
