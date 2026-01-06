

function listener(details) {
  
  createDB();

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
    parseResponse(fullResponse, sourcePlatformUrl, sourceUrl, details.tabId);
    filter.disconnect();
    fullResponse = "";
  }

  return {};
}

browser.webRequest.onBeforeRequest.addListener(
    listener, {urls: ["https://*/*"], types: ["main_frame", "xmlhttprequest", "script"]}, ["blocking"]
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
        parseGoogle(fullResponse, host, sourceUrl, tabId);
        break;
      case "baidu": 
        parseBaidu(fullResponse, host, sourceUrl, tabId);
        break;
      case "yandex": 
        parseYandex(fullResponse, host, sourceUrl, tabId);
        break;
    case "duckduckgo": 
        parseDuckDuckGo(fullResponse, host, sourceUrl, tabId);
        break;
      default:
        console.log("Sorry, not supported yet " + sourcePlatformUrl);
    }
}

function parseGoogle (fullResponse, sourcePlatformUrl, sourceUrl, tabId) {
  if (sourceUrl.includes("complete")) {
        //remove the extra info at the beginning as it breaks json parsing.
        const parsed = JSON.parse(fullResponse.replace(")]}'", ""))
        let q = sourceUrl.replace("https://www.google.com/complete/search?q=","")
        let queryStr = q.split("&")[0];

        //run over each row and get the response and any extra information
        parsed.forEach ( function (x) {
            let suggestions = [];
            let extraInfo = [];
            if (Array.isArray(x)) {
                x.forEach(function(y){
                    suggestions.push(escapeHTML(y[0])); 
                    const info = (y.length > 3) ? y[3]['zi']: "";
                    extraInfo.push(escapeHTML(info));
                })
                const now = Date.now();
                addComplete(now, sourcePlatformUrl, queryStr, suggestions.join(';'), extraInfo.join(';'));
            }
        } );
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
                //}
            
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
            let queryStr = q.split("&")[0];
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

function escapeHTML(str){
  if (!str) return "";
  return str.replaceAll("\r","  ").replaceAll("\n","  ").replace(/(['\",])/g, "\\$1").replace(',', "\\‚");
}