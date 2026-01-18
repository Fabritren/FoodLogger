let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('logger-db', 3);

    req.onupgradeneeded = e => {
      db = e.target.result;
      console.log('openDB: upgrade needed', 'oldVersion=', e.oldVersion, 'newVersion=', e.newVersion);
      if (!db.objectStoreNames.contains('raw')) {
        console.log("openDB: creating object store 'raw'");
        db.createObjectStore('raw', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('categories')) {
        console.log("openDB: creating object store 'categories'");
        db.createObjectStore('categories', { autoIncrement: true });
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

function updateRaw(key, entry) {
  console.log('updateRaw: updating entry', key, entry);
  const tx = db.transaction('raw', 'readwrite');
  const store = tx.objectStore('raw');
  const req = store.put(entry, key); // replaces value at key

  req.onsuccess = () => console.log('updateRaw: updated entry with key', key);
  req.onerror = () => console.error('updateRaw: error updating entry', req.error);

  tx.oncomplete = () => console.log('updateRaw: transaction complete');
  tx.onerror = e => console.error('updateRaw: transaction error', e.target && e.target.error);
}

function deleteRaw(key) {
  console.log('deleteRaw: deleting entry', key);
  const tx = db.transaction('raw', 'readwrite');
  const store = tx.objectStore('raw');
  const req = store.delete(key);

  req.onsuccess = () => console.log('deleteRaw: deleted entry with key', key);
  req.onerror = () => console.error('deleteRaw: error deleting entry', req.error);

  tx.oncomplete = () => console.log('deleteRaw: transaction complete');
  tx.onerror = e => console.error('deleteRaw: transaction error', e.target && e.target.error);
}

function getRaw(key, cb) {
  console.log('getRaw: fetching entry with key', key);
  const tx = db.transaction('raw', 'readonly');
  const store = tx.objectStore('raw');
  const req = store.get(key);

  req.onsuccess = () => {
    console.log('getRaw: fetched entry', req.result);
    if (cb) cb(req.result);
  };

  req.onerror = () => {
    console.error('getRaw: error', req.error);
    if (cb) cb(null);
  };
}


function getAllRaw(cb) {
  console.log('getAllRaw: fetching all entries');

  const tx = db.transaction('raw', 'readonly');
  const store = tx.objectStore('raw');
  const results = [];

  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      results.push({
        key: cursor.key,      // IndexedDB key
        ...cursor.value       // time, text
      });
      cursor.continue();
    } else {
      console.log('getAllRaw: fetched', results.length, 'entries');

      // Sort by date
      // oldest → newest
      // results.sort((a, b) => new Date(a.time) - new Date(b.time));
      // newest → oldest
      results.sort((a, b) => new Date(b.time) - new Date(a.time));

      cb(results);
    }
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

function clearCategories(cb) {
  console.log('clearCategories: clearing all entries in "categories"');

  if (!db) {
    const err = new Error("DB not initialized");
    console.error(err);
    if (cb) cb(err);
    return Promise.reject(err);
  }

  const tx = db.transaction('categories', 'readwrite');
  const req = tx.objectStore('categories').clear();

  const p = new Promise((resolve, reject) => {
    req.onsuccess = () => {
      console.log('clearCategories: cleared all categories');
      resolve();
    };
    req.onerror = () => {
      console.error('clearCategories: error', req.error);
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
  console.log('clearDB: clearing all entries from object store "raw"');

  if (!db) {
    const err = new Error("DB not initialized");
    console.error(err);
    if (cb) cb(err);
    return Promise.reject(err);
  }

  const tx = db.transaction('raw', 'readwrite');
  const store = tx.objectStore('raw');
  const req = store.clear();

  const p = new Promise((resolve, reject) => {
    req.onsuccess = () => {
      console.log('clearDB: all entries cleared successfully');
      resolve();
    };
    req.onerror = () => {
      console.error('clearDB: clear error', req.error);
      reject(req.error);
    };
  });

  if (typeof cb === 'function') {
    p.then(() => cb(null)).catch(err => cb(err));
  }

  return p;
}

function initDB(){
  openDB().then(()=>{
    console.log('[openDB] resolved');
    dt.value=new Date().toISOString().slice(0,16);
    console.log('[openDB] dt set to', dt.value);
    
    getAllRaw(raw => {
      refresh();
      console.log('[openDB] initial refresh triggered');
    });
    initCategories();
  });
}

// ===== CATEGORY FUNCTIONS =====

function addCategory(category) {
  console.log('addCategory: adding category', category);
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const req = store.add(category);

  req.onsuccess = () => console.log('addCategory: added category with key', req.result);
  req.onerror = () => console.error('addCategory: error', req.error);

  tx.oncomplete = () => console.log('addCategory: transaction complete');
  tx.onerror = e => console.error('addCategory: transaction error', e.target && e.target.error);
}

function updateCategory(key, category) {
  console.log('updateCategory: updating category', key, category);
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const req = store.put(category, key);

  req.onsuccess = () => console.log('updateCategory: updated category with key', key);
  req.onerror = () => console.error('updateCategory: error', req.error);

  tx.oncomplete = () => console.log('updateCategory: transaction complete');
  tx.onerror = e => console.error('updateCategory: transaction error', e.target && e.target.error);
}

function deleteCategory(key) {
  console.log('deleteCategory: deleting category', key);
  const tx = db.transaction('categories', 'readwrite');
  const store = tx.objectStore('categories');
  const req = store.delete(key);

  req.onsuccess = () => console.log('deleteCategory: deleted category with key', key);
  req.onerror = () => console.error('deleteCategory: error', req.error);

  tx.oncomplete = () => console.log('deleteCategory: transaction complete');
  tx.onerror = e => console.error('deleteCategory: transaction error', e.target && e.target.error);
}

function getAllCategories(cb) {
  console.log('getAllCategories: fetching all categories');

  const tx = db.transaction('categories', 'readonly');
  const store = tx.objectStore('categories');
  const results = [];

  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      results.push({
        key: cursor.key,
        ...cursor.value
      });
      cursor.continue();
    } else {
      console.log('getAllCategories: fetched', results.length, 'categories');
      if (cb) cb(results);
    }
  };
}

function getCategory(key, cb) {
  console.log('getCategory: fetching category with key', key);
  const tx = db.transaction('categories', 'readonly');
  const store = tx.objectStore('categories');
  const req = store.get(key);

  req.onsuccess = () => {
    console.log('getCategory: fetched category', req.result);
    if (cb) cb(req.result);
  };

  req.onerror = () => {
    console.error('getCategory: error', req.error);
    if (cb) cb(null);
  };
}
