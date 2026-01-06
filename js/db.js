const dbName = "AutoComplete";
const dbVersion = 2;

function createDB() {

  const request = indexedDB.open(dbName, dbVersion);

  request.onupgradeneeded = function (event) {
    const db = event.target.result;
    // Create an object store named 'auto' with 'now' as the keyPath
    if (!db.objectStoreNames.contains("auto")) {
      const objectStore = db.createObjectStore("auto", { keyPath: "collected" });
      objectStore.createIndex("siteurl", "siteurl", { unique: false });
      /*objectStore.transaction.oncomplete = (event) => {
        // Store values in the newly created objectStore.
        const customerObjectStore = db
          .transaction("auto", "readwrite")
          .objectStore("auto");
      };*/
    }
    console.log("Database setup complete");
  };

  request.onsuccess = function (event) {
    const db = event.target.result;
    console.log(db.objectStoreNames);
    if (!db.objectStoreNames.contains("auto")) {
      const objectStore = db.createObjectStore("auto", { keyPath: "collected" });
      objectStore.createIndex("siteurl", "siteurl", { unique: false });
      objectStore.transaction.oncomplete = (event) => {
        // Store values in the newly created objectStore.
        const customerObjectStore = db
          .transaction("auto", "readwrite")
          .objectStore("auto");
      };
    }
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
      console.log("User added:", user);
    };

    addRequest.onerror = function (event) {
      console.error("Error adding user:", event.target.errorCode);
    };
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

    request.oncomplete = function () {
        db.close();
    };
  };

  request.onerror = function (event) {
    const db = event.target.result;
    console.error("Error retrieving data:", event.target.errorCode);
  }
}

/**
 *  Remove all data for site. 
 * @param {string} id 
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

function resetAll() {
  const transaction = db.transaction(['MyObjectStore'], 'readwrite');
  const objectStore = transaction.objectStore('MyObjectStore');

  // Clear all records
  const clearRequest = objectStore.clear();

  clearRequest.onsuccess = function() {
    console.log('All records deleted successfully');
  };

  clearRequest.onerror = function() {
    console.error('Failed to delete all records');
  };
}

/**
 * Convert JSON to CSV
 * @param {Object} jsonData 
 */
function convertToCsv(jsonData) {
    console.log(jsonData);
    const lines = []
    const header = Object.keys(jsonData[0])
    try {
      Array.from(jsonData).forEach(element => {
        lines.push(Object.values(element).join(','))
      });

      const csv = [
          header.join(','), // header row first
          lines.join('\n')
      ].join('\n');
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
  //hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);  
  hiddenElement.target = '_blank';  

  //provide the name for the CSV file to be downloaded  
  hiddenElement.download = nameFile(platform);  
  hiddenElement.click();
}

function nameFile (platform) {
  const d = new Date().toUTCString();
  return [platform, d, ".csv"].join("-");
}