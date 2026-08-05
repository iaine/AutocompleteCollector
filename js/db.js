const dbName = "AutoComplete";
const dbVersion = 2;

function createDB() {

  const request = indexedDB.open(dbName, dbVersion);

  request.onupgradeneeded = function (event) {
    const db = event.target.result;
    // Create an object store named 'auto' with 'collected' as the keyPath
    if (!db.objectStoreNames.contains("auto")) {
      const objectStore = db.createObjectStore("auto", { keyPath: "collected" });
      objectStore.createIndex("siteurl", "siteurl", { unique: false });
    }
    console.log("Database setup complete");
  };

  request.onsuccess = function (event) {
    // Object store creation can only happen inside onupgradeneeded (a
    // versionchange transaction) -- doing it here as before would throw
    // if it were ever reached. By the time onsuccess fires, the store
    // is guaranteed to already exist, so there's nothing left to do.
    const db = event.target.result;
    db.close();
    console.log("Database opened successfully");
  };

  request.onerror = function (event) {
    console.error("Error opening database:", event.target.errorCode);
  };
}

/**
 * Add a row for the site
 * @param {Date} timestamp 
 * @param {string} url 
 * @param {string} autofill 
 * @param {string} extrainfo 
 */
function addComplete(timestamp, url, query, autofill, extrainfo) {
  const request = indexedDB.open(dbName, dbVersion);

  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction("auto", "readwrite");
    const objectStore = transaction.objectStore("auto");

    const user = {'collected': timestamp, 'siteurl': url, 'query': query, 'autofill': autofill, 'extrainfo': extrainfo};
    const addRequest = objectStore.add(user);

    addRequest.onsuccess = function () {
      console.log("Data added:", user);
    };

    addRequest.onerror = function (event) {
      console.error("Error adding user:", event.target.errorCode);
    };

    transaction.oncomplete = function () {
      db.close();
    };
  };

  request.onerror = function (event) {
    console.error("Error opening database:", event.target.errorCode);
  };
}

/**
 * Get all data by site
 * @param {string} url 
 */
function getSite(url) {
  let resultData = []; 

  const request = indexedDB.open(dbName, dbVersion);

  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction("auto", "readonly");
    const objectStore = transaction.objectStore("auto");
    const getRequest = objectStore.getAll();

    getRequest.onsuccess = function () {
      if (getRequest.result) {
        getRequest.result.forEach(x => {
          if (x.siteurl == url) { resultData.push(x); }
        });
        downloadCsv(resultData, url);
      } else {
        console.log("Platform not found: " + url);
      }
    };

    getRequest.onerror = function (event) {
      console.error("Error retrieving user:", event.target.errorCode);
    };

    // This used to be set on `request` (the IDBOpenDBRequest), which
    // has no `oncomplete` event -- only a transaction does. Because of
    // that, `db.close()` was silently never called and the connection
    // leaked. Fixed by attaching it to the transaction instead.
    transaction.oncomplete = function () {
        db.close();
    };
  };

  request.onerror = function (event) {
    console.error("Error retrieving data:", event.target.errorCode);
  }
}

/**
 *  Remove all data for site. 
 * @param {string} url 
 */
function deleteSite(url) {
  const request = indexedDB.open(dbName, dbVersion);

  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction("auto", "readwrite");
    const objectStore = transaction.objectStore("auto");

    const getRequest = objectStore.getAll();

    getRequest.onsuccess = function () {
      if (getRequest.result) {
        getRequest.result.forEach(x => {
          if (x.siteurl == url) { 
            deleteKey(objectStore, x);
          }
        });
      } else {
        console.log("Platform not found: " + url);
      }
    };

    transaction.oncomplete = function () {
      db.close();
    };
  };

  request.onerror = function (event) {
    console.error("Error opening database:", event.target.errorCode);
  };
}

/**
 *  Remove all data for every site.
 */
function deleteAll() {
  const request = indexedDB.open(dbName, dbVersion);

  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction("auto", "readwrite");
    const objectStore = transaction.objectStore("auto");

    const getRequest = objectStore.getAll();

    getRequest.onsuccess = function () {
      if (getRequest.result) {
        getRequest.result.forEach(x => {
          deleteKey(objectStore, x);
        });
      } else {
        console.log("No data found");
      }
    };

    transaction.oncomplete = function () {
      db.close();
    };
  };

  request.onerror = function (event) {
    console.error("Error opening database:", event.target.errorCode);
  };
}

function deleteKey (objectStore, d) {

    try {
      const deleteRequest = objectStore.delete(d.collected);

      deleteRequest.onsuccess = function () {
        console.log("User deleted with ID:", d.siteurl);
      };

      deleteRequest.onerror = function (event) {
        console.error("Error deleting user:", event.target.error);
      };
    } catch (e) {
      console.error(e);
    }
}

/**
 * Convert an array of row objects into a properly quoted CSV Blob.
 *
 * The previous implementation just did `Object.values(row).join(',')`
 * with no quoting at all, so any suggestion or extra-info value that
 * happened to contain a comma, quote character, or newline (very
 * possible -- this data comes from live search engines) would silently
 * corrupt the CSV and misalign columns. Every field is now wrapped in
 * quotes per RFC 4180, with internal quotes doubled.
 *
 * Fields are also guarded against CSV/formula injection: a value
 * starting with =, +, -, or @ gets a leading apostrophe so Excel/Sheets
 * won't try to evaluate it as a formula when the file is opened later.
 * @param {Object} jsonData 
 */
function csvField(value) {
  let str = (value === undefined || value === null) ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function convertToCsv(jsonData) {
    console.log(jsonData);
    try {
      if (!jsonData || jsonData.length === 0) {
        return new Blob([""], {type: 'text/csv'});
      }
      const header = Object.keys(jsonData[0]);
      const lines = jsonData.map(row => header.map(key => csvField(row[key])).join(','));

      const csv = [
          header.map(csvField).join(','), // header row first
          ...lines
      ].join('\r\n');
      console.log(csv);

      return new Blob([csv], {type: 'text/csv'});
    } catch (e) {
      console.error(e);
    }
}

function downloadCsv(data, platform) {
  console.log(data);
  console.log(typeof(data));
  const csv = convertToCsv(data);

  var hiddenElement = document.createElement('a'); 
  hiddenElement.href = window.URL.createObjectURL(csv);  
  hiddenElement.target = '_blank';  
  hiddenElement.download = nameFile(platform);  
  hiddenElement.click();
}

function nameFile (platform) {
  const d = new Date().toISOString();
  return [platform, d, ".csv"].join("-");
}
