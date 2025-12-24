let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('logger-db', 1);
    req.onupgradeneeded = e => {
      db = e.target.result;
      db.createObjectStore('logs', { keyPath: 'id' });
    };
    req.onsuccess = e => { db = e.target.result; resolve(); };
    req.onerror = e => reject(e);
  });
}

async function addEntry() {
  const dt = document.getElementById('dt').value || new Date().toISOString();
  const text = document.getElementById('text').value;
  if (!text) return;

  const tx = db.transaction('logs', 'readwrite');
  tx.objectStore('logs').put({
    id: crypto.randomUUID(),
    time: dt,
    text: text
  });

  document.getElementById('text').value = '';
  drawPlot();
}

function getAll(callback) {
  const tx = db.transaction('logs', 'readonly');
  const req = tx.objectStore('logs').getAll();
  req.onsuccess = () => callback(req.result);
}

function drawPlot() {
  getAll(entries => {
    const ctx = document.getElementById('plot').getContext('2d');
    ctx.clearRect(0, 0, 300, 200);
    entries.sort((a,b)=>new Date(a.time)-new Date(b.time));
    entries.forEach((e,i) => {
      ctx.fillRect(10 + i*20, 180 - i*10, 10, i*10);
    });
  });
}

function exportData() {
  getAll(entries => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'logger-export.json';
    a.click();
  });
}

function importData() {
  const file = document.getElementById('importFile').files[0];
  if (!file) return;
  file.text().then(text => {
    const entries = JSON.parse(text);
    const tx = db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    entries.forEach(e => store.put(e));
    drawPlot();
  });
}

openDB().then(() => {
  document.getElementById('dt').value = new Date().toISOString().slice(0,16);
  drawPlot();
});
