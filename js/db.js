let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('logger-db', 2);

    req.onupgradeneeded = e => {
      db = e.target.result;
      console.log('openDB: upgrade needed', 'oldVersion=', e.oldVersion, 'newVersion=', e.newVersion);
      if (!db.objectStoreNames.contains('raw')) {
        console.log("openDB: creating object store 'raw'");
        db.createObjectStore('raw', { autoIncrement: true });
      }
    };

    req.onsuccess = e => {
      db = e.target.result;
      console.log("openDB: IndexedDB opened successfully (version " + db.version + ")");
      resolve();
    };

    req.onerror = e => {
      console.error("openDB: Failed to open IndexedDB:", e.target.error);
      reject(e.target.error);
    };
  });
}

function addRaw(entry) {
  console.log('addRaw: adding entry', entry);
  const tx = db.transaction('raw', 'readwrite');
  const store = tx.objectStore('raw');
  const req = store.add(entry);

  req.onsuccess = () => console.log('addRaw: added entry with key', req.result);
  req.onerror = () => console.error('addRaw: add error', req.error);

  tx.oncomplete = () => console.log('addRaw: transaction complete');
  tx.onerror = e => console.error('addRaw: transaction error', e.target && e.target.error);
}

function getAllRaw(cb) {
  console.log('getAllRaw: fetching all entries');
  const tx = db.transaction('raw', 'readonly');
  const req = tx.objectStore('raw').getAll();

  req.onsuccess = () => {
    const results = req.result || [];
    console.log('getAllRaw: fetched', results.length, 'entries');
    cb(results);
  };

  req.onerror = () => {
    console.error('getAllRaw: error', req.error);
    cb([]);
  };
}

/**
 * clearRaw(cb?) -> Promise
 * - Clears all entries in the 'raw' object store.
 * - Returns a Promise that resolves on success or rejects with an error.
 * - If an optional callback `cb` is provided, it will be called as cb(err)
 *   where err is null on success or the error on failure.
 */
function clearRaw(cb) {
  console.log('clearRaw: clearing all entries in "raw"');
  const tx = db.transaction('raw', 'readwrite');
  const req = tx.objectStore('raw').clear();

  const p = new Promise((resolve, reject) => {
    req.onsuccess = () => {
      console.log('clearRaw: cleared all entries');
      resolve();
    };
    req.onerror = () => {
      console.error('clearRaw: error', req.error);
      reject(req.error);
    };
  });

  if (typeof cb === 'function') {
    p.then(() => cb(null)).catch(err => cb(err));
  }
  return p;
}

/**
 * clearDB(cb?) -> Promise
 * - Closes any open DB connection and deletes the entire 'logger-db' database.
 * - Resolves on success, rejects with an error on failure.
 */
function clearDB(cb) {
  console.log('clearDB: deleting entire database "logger-db"');
  if (db) {
    try {
      db.close();
      console.log('clearDB: closed existing DB connection');
    } catch (e) {
      console.warn('clearDB: error closing DB (ignored)', e);
    }
    db = null;
  }

  const req = indexedDB.deleteDatabase('logger-db');

  const p = new Promise((resolve, reject) => {
    req.onsuccess = () => {
      console.log('clearDB: database deleted successfully');
      resolve();
    };
    req.onerror = () => {
      console.error('clearDB: delete error', req.error);
      reject(req.error);
    };
    req.onblocked = () => {
      console.error('clearDB: delete blocked (open connections exist)');
      reject(new Error('delete blocked'));
    };
  });

  if (typeof cb === 'function') {
    p.then(() => cb(null)).catch(err => cb(err));
  }
  return p;
}

/**
 * updateRaw(key, updatesOrFn, cb?) -> Promise
 * - If updatesOrFn is a function, it receives the current record and should return the updated record.
 * - Otherwise, updatesOrFn is treated as a partial object that will be shallow-merged into the existing record.
 * - Resolves with the put result (key) or rejects with an error.
 */
function updateRaw(key, updatesOrFn, cb) {
  console.log('updateRaw: updating key', key);
  const tx = db.transaction('raw', 'readwrite');
  const store = tx.objectStore('raw');
  const getReq = store.get(key);

  const p = new Promise((resolve, reject) => {
    getReq.onsuccess = () => {
      const current = getReq.result;
      if (current === undefined) {
        console.warn('updateRaw: no record found for key', key);
        reject(new Error('No record found for key ' + key));
        return;
      }

      const updated = (typeof updatesOrFn === 'function')
        ? updatesOrFn(current)
        : Object.assign({}, current, updatesOrFn);

      console.log('updateRaw: putting updated record for key', key, updated);
      const putReq = store.put(updated, key);

      putReq.onsuccess = () => {
        console.log('updateRaw: update successful for key', putReq.result);
        resolve(putReq.result);
      };
      putReq.onerror = () => {
        console.error('updateRaw: put error', putReq.error);
        reject(putReq.error);
      };
    };

    getReq.onerror = () => {
      console.error('updateRaw: get error', getReq.error);
      reject(getReq.error);
    };
  });

  tx.oncomplete = () => console.log('updateRaw: transaction complete');
  tx.onerror = e => console.error('updateRaw: transaction error', e.target && e.target.error);

  if (typeof cb === 'function') {
    p.then(res => cb(null, res)).catch(err => cb(err));
  }
  return p;
}
