// Cross-browser compatibility shim. `browser` is the Promise-based
// namespace Firefox provides natively; Chrome only ships `chrome`
// (callback-based, or Promise-based in newer versions). This lets the
// storage/settings code below run unmodified if this is ever ported.
// NOTE: this does NOT make webRequest.filterResponseData work on Chrome
// -- that API is Firefox-only. See README for details.
const ext = typeof browser !== "undefined" ? browser : chrome;

// ---------------------------------------------------------------------
// Per-engine "collect data" toggle
// ---------------------------------------------------------------------
// Settings are kept in browser.storage.local under the "engineSettings"
// key, and mirrored into this in-memory object so every network event
// can check it synchronously without an async storage read per request.
// storage.onChanged keeps it live: flipping a toggle in the popup takes
// effect immediately for any tab that's already open, because every
// subsequent autocomplete response checks this object before storing
// anything.
const DEFAULT_ENGINE_SETTINGS = { google: true, baidu: true, yandex: true, duckduckgo: true };
let engineSettings = { ...DEFAULT_ENGINE_SETTINGS };

async function loadEngineSettings() {
  try {
    const stored = await ext.storage.local.get("engineSettings");
    engineSettings = { ...DEFAULT_ENGINE_SETTINGS, ...(stored.engineSettings || {}) };
  } catch (e) {
    console.error("Failed to load engine settings, using defaults", e);
  }
}
loadEngineSettings();

ext.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.engineSettings) {
    engineSettings = { ...DEFAULT_ENGINE_SETTINGS, ...changes.engineSettings.newValue };
  }
});

createDB();

function listener(details) {

  let fullResponse = ""
  const sourceUrl = details.url;
  const sourcePlatformUrl = details.hasOwnProperty("originUrl") ? details.originUrl : sourceUrl;

  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();

  filter.ondata = (event) => {
      let str = decoder.decode(event.data, { stream: true });
      fullResponse += str
      filter.write(encoder.encode(str));

  };

  filter.onstop = async (event) => {
    // Flush any bytes buffered by the streaming decoder (e.g. a
    // multi-byte UTF-8 character split across the final two chunks).
    // Without this the last character or two of some responses could
    // come out corrupted.
    fullResponse += decoder.decode();
    parseResponse(fullResponse, sourcePlatformUrl, sourceUrl, details.tabId);
    filter.disconnect();
    fullResponse = "";
  }

  filter.onerror = () => {
    console.error("StreamFilter error for", sourceUrl, filter.error);
  };

  return {};
}

// Only intercept xmlhttprequest/script traffic (i.e. the actual
// autocomplete calls). "main_frame" was previously included here too,
// which meant the extension was buffering, decoding, and re-encoding
// the full HTML body of *every* HTTPS page load in the browser -- a
// significant, unnecessary memory/performance cost, and pure risk
// (large or non-text main_frame responses have no business going
// through a TextDecoder). It served no purpose: which "host" a request
// belongs to is resolved via browser.tabs.get() in parseResponse, not
// from the main_frame body.
browser.webRequest.onBeforeRequest.addListener(
    listener, {urls: ["https://*/*"], types: ["xmlhttprequest", "script"]}, ["blocking"]
);

async function parseResponse(fullResponse, sourcePlatformUrl, sourceUrl, tabId) {
    if (!sourcePlatformUrl) {
        sourcePlatformUrl = sourceUrl;
    }

    try {
        // get the *actual url* of the tab, not the url that the request
        // reports, which may be wrong
        let tab = await browser.tabs.get(tabId);
        sourcePlatformUrl = tab.url;
    } catch (e) {
        tabId = -1;
        // invalid tab id, use provided originUrl
    }

    //test for hostname
    const url = new URL(sourcePlatformUrl);
    const host = url.hostname.replace('www.','').split(".")[0]
    switch (host) {
      case "google":
        if (engineSettings.google) parseGoogle(fullResponse, host, sourceUrl, tabId);
        break;
      case "baidu":
        if (engineSettings.baidu) parseBaidu(fullResponse, host, sourceUrl, tabId);
        break;
      case "yandex":
        if (engineSettings.yandex) parseYandex(fullResponse, host, sourceUrl, tabId);
        break;
      case "duckduckgo":
        if (engineSettings.duckduckgo) parseDuckDuckGo(fullResponse, host, sourceUrl, tabId);
        break;
      default:
        console.log("Sorry, not supported yet " + sourcePlatformUrl);
    }
}

function parseGoogle (fullResponse, sourcePlatformUrl, sourceUrl, tabId) {
  try {
    if (sourceUrl.includes("complete")) {
          //remove the extra info at the beginning as it breaks json parsing.
          const parsed = JSON.parse(fullResponse.replace(")]}'", ""))
          let q = sourceUrl.replace("https://www.google.com/complete/search?q=","")
          let queryStr = decodeURIComponent(q.split("&")[0].replace(/\+/g, " "));

          //run over each row and get the response and any extra information
          parsed.forEach ( function (x) {
              let suggestions = [];
              let extraInfo = [];
              if (Array.isArray(x)) {
                  x.forEach(function(y){
                      suggestions.push(y[0] ?? "");
                      const info = (y.length > 3) ? y[3]['zi']: "";
                      extraInfo.push(info ?? "");
                  })
                  const now = Date.now();
                  addComplete(now, sourcePlatformUrl, queryStr, suggestions.join(';'), extraInfo.join(';'));
              }
          } );
      }
  } catch (e) {
      console.error(e);
  }
}

function parseBaidu (fullResponse, sourcePlatformUrl, sourceUrl, tabId) {
    try {
        if (sourceUrl.includes("sugrec") && fullResponse.length > 1) {
            const js = fullResponse.split("(")[1];
            //remove the extra info at the beginning as it breaks json parsing.
            const parsed = JSON.parse(js.slice(0, -1))

            let suggestions = []
            let extraInfo = [];
            let queryStr = parsed['q'];
            //run over each row and get the response and any extra information
            parsed['g'].forEach ( function (x) {
                suggestions.push(x['q']);
            } );
            const now = Date.now();
            addComplete(now, sourcePlatformUrl, queryStr, suggestions.join(';'), extraInfo.join(';')); 
        }
        } catch (e) {
            console.error(e);
        }
}

function parseYandex (fullResponse, sourcePlatformUrl, sourceUrl, tabId) {
    try {
        if (sourceUrl.includes("suggest-ya") && fullResponse.length > 1) {

            const parsed = JSON.parse(fullResponse)
            let suggestions = []
            let extraInfo = [];
            let queryStr = parsed[0];

            parsed[1].forEach ( function (x) {
                suggestions.push(x[1]);
            } );
            const now = Date.now();
            addComplete(now, sourcePlatformUrl, queryStr, suggestions.join(';'), extraInfo.join(';'));
        }
        } catch (e) {
            console.error(e);
        }
}

function parseDuckDuckGo (fullResponse, sourcePlatformUrl, sourceUrl, tabId) {
    try {
        if (sourceUrl.includes("ac") && fullResponse.length > 1) {
            const parsed = JSON.parse(fullResponse)
            let suggestions = []
            let extraInfo = [];
            let q = sourceUrl.replace("https://duckduckgo.com/ac/?q=","")
            let queryStr = decodeURIComponent(q.split("&")[0].replace(/\+/g, " "));
            //run over each row and get the response and any extra information
            parsed.forEach ( function (x) {
                suggestions.push(x['phrase']);
            } );
            const now = Date.now();
            addComplete(now, sourcePlatformUrl, queryStr, suggestions.join(';'), extraInfo.join(';'));
            
        }
    } catch (e) {
        console.error(e);
    }
}
