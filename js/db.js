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
