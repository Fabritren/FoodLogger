let db;

function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('logger-db', 2);
    req.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains('raw'))
        db.createObjectStore('raw', { autoIncrement: true });
    };
    req.onsuccess = e => { db = e.target.result; resolve(); };
  });
}

function addRaw(entry) {
  const tx = db.transaction('raw', 'readwrite');
  tx.objectStore('raw').add(entry);
}

function getAllRaw(cb) {
  const tx = db.transaction('raw', 'readonly');
  const req = tx.objectStore('raw').getAll();
  req.onsuccess = () => cb(req.result || []);
}

/**
 * clearRaw(cb?) -> Promise
 * - Clears all entries in the 'raw' object store.
 * - Returns a Promise that resolves on success or rejects with an error.
 * - If an optional callback `cb` is provided, it will be called as cb(err)
 *   where err is null on success or the error on failure.
 */
function clearRaw(cb) {
  const tx = db.transaction('raw', 'readwrite');
  const req = tx.objectStore('raw').clear();

  const p = new Promise((resolve, reject) => {
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
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
  if (db) {
    try { db.close(); } catch (e) { /* ignore */ }
    db = null;
  }

  const req = indexedDB.deleteDatabase('logger-db');

  const p = new Promise((resolve, reject) => {
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('delete blocked'));
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
  const tx = db.transaction('raw', 'readwrite');
  const store = tx.objectStore('raw');
  const getReq = store.get(key);

  const p = new Promise((resolve, reject) => {
    getReq.onsuccess = () => {
      const current = getReq.result;
      if (current === undefined) {
        reject(new Error('No record found for key ' + key));
        return;
      }
      const updated = (typeof updatesOrFn === 'function')
        ? updatesOrFn(current)
        : Object.assign({}, current, updatesOrFn);

      const putReq = store.put(updated, key);
      putReq.onsuccess = () => resolve(putReq.result);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });

  if (typeof cb === 'function') {
    p.then(res => cb(null, res)).catch(err => cb(err));
  }
  return p;
}
