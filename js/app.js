let processedTable = [];
let editingKey = null; // global variable

function toggleAdd(){
  console.log('[toggleAdd] called; addSection exists:', !!window.addSection);
  console.log('[toggleAdd] before hidden:', addSection ? addSection.hidden : undefined);
  addSection.hidden = !addSection.hidden;
  console.log('[toggleAdd] after hidden:', addSection.hidden);
}

function addEntry() {
  const time = dt.value;
  const value = text.value.trim();
  if (!time || !value) return;

  const entry = { time, text: value };

  if (editingKey !== null) {
    updateRaw(editingKey, entry);
    editingKey = null;
    document.querySelector('#panel-add .primary').innerText = 'Save';
    document.getElementById('discardBtn').hidden = true; // hide discard after update
  } else {
    addRaw(entry);
  }

  text.value = '';
  refresh();
}

function buildProcessed(raw) {
  console.log('[buildProcessed] called; raw.length =', raw.length);
  processedTable = raw.flatMap(r =>
    r.text
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(t => ({
        time: r.time,
        text: t.charAt(0).toUpperCase() + t.slice(1)
      }))
  );
  console.log('[buildProcessed] processedTable.length =', processedTable.length);
}

function refresh(){
  console.log('[refresh] called');
  getAllRaw(raw=>{
    console.log('[refresh] getAllRaw callback; raw.length =', raw.length);
    buildProcessed(raw);
    drawPlot(processedTable);
    console.log('[refresh] drawPlot called with processedTable.length =', processedTable.length);
    updateStatus(raw);
    updateQuickButtons();
    updateTable();
  });
}

function updateTable() {
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = '';

  console.log('updateTable: fetching all entries');

  getAllRaw(results => {
    console.log('updateTable: received', results.length, 'entries');

    results.forEach((entry, index) => {
      const tr = document.createElement('tr');
      const d = new Date(entry.time);

      tr.innerHTML = `
        <td>
          ${d.toLocaleDateString()} 
          ${d.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </td>
        <td>${entry.text}</td>
        <td class="actions">
          <button title="Edit" onclick="editEntry(${entry.key})">✏️</button>
          <button title="Delete" onclick="confirmDelete(${entry.key})">🗑️</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    console.log('updateTable: finished rendering table with', results.length, 'items');
  });
}

function confirmDelete(key) {
  getRaw(key, entry => {
      if (!entry) {
        console.error('confirmDelete: entry not found for key', key);
        return;
      }

      console.log(
        `confirmDelete: deleting entry - time: ${entry.time}, text: ${entry.text}`
      );

      const ok = confirm(
        `Delete this entry?\n\n` +
        `Date: ${new Date(entry.time).toLocaleString()}\n` +
        `Text: ${entry.text}\n\n` +
        `This cannot be undone.`
      );

      if (!ok) return;

      deleteEntry(key);
    });
}

function deleteEntry(index) {
  deleteRaw(index);
  refresh();
}

function editEntry(key) {
  const tx = db.transaction('raw', 'readonly');
  const store = tx.objectStore('raw');
  const req = store.get(key);

  req.onsuccess = e => {
    const entry = e.target.result;
    if (!entry) return;

    // Store the key of the entry being edited
    editingKey = key;

    // Open Add panel
    showPanel('add');

    // Populate input fields
    dt.value = entry.time.slice(0, 16); // keep format compatible with datetime-local
    text.value = entry.text;

    // Change Save button text to indicate update
    document.querySelector('#panel-add .primary').innerText = 'Update';
    // show discard button
    document.getElementById('discardBtn').hidden = false;
  };

  req.onerror = e => console.error('editEntry: error fetching entry', e.target.error);
}

function discardEdit() {
  editingKey = null;                    // cancel editing mode
  text.value = '';                       // clear input
  dt.value = new Date().toISOString().slice(0,16); // reset to now
  document.querySelector('#panel-add .primary').innerText = 'Save'; // restore button text
  document.getElementById('discardBtn').hidden = true; // hide discard button
}

function updateStatus(raw){
  console.log('[updateStatus] called; raw.length =', raw.length);
  if (!raw.length) {
    databaseStatus.innerText = 'No entries';
    console.log('[updateStatus] set databaseStatus to "No entries"');
    return;
  }
  const times = raw.map(r => new Date(r.time));
  databaseStatus.innerText =
    `Count: ${raw.length} | First: ${new Date(Math.min(...times)).toLocaleString()} | Last: ${new Date(Math.max(...times)).toLocaleString()}`;
  console.log('[updateStatus] databaseStatus set:', databaseStatus.innerText);
}

function updateQuickButtons() {
  console.log('[updateQuickButtons] called');
  quickButtons.innerHTML = '';

  const filterNorm = quickFilter.value.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  console.log('[updateQuickButtons] filter =', filterNorm);

  // Count occurrences (original text, for display)
  const counts = {};
  processedTable.forEach(e => {
    counts[e.text] = (counts[e.text] || 0) + 1;
  });

  // Build sorted list, filtering using normalized text
  const sorted = Object.keys(counts)
    .filter(t => {
      if (!filterNorm) return true;
      const tNorm = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return tNorm.includes(filterNorm);
    })
    .sort((a, b) => {
      const diff = counts[b] - counts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

  console.log('[updateQuickButtons] filtered list length =', sorted.length);

  // Create buttons with original text
  sorted.forEach(t => {
    const b = document.createElement('button');
    b.innerText = t;
    b.onclick = () => {
      console.log('[quickButton] clicked:', t);
      const current = text.value.trim();
      text.value = current ? `${current}, ${t}` : t;
      text.setSelectionRange(text.value.length, text.value.length);
    };
    quickButtons.appendChild(b);
  });
}

function exportData(){
  console.log('[exportData] called');
  getAllRaw(raw=>{
    console.log('[exportData] got raw; length =', raw.length);
    const clean = raw.map(r=>({time:r.time,text:r.text}));
    const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='logger-export.json';
    a.click();
    console.log('[exportData] download triggered:', a.download);
  });
}

function importData(input){
  console.log('[importData] called; input.files.length =', input.files ? input.files.length : 0);
  const f=input.files[0];
  if(!f) {
    console.log('[importData] no file selected; aborting');
    return;
  }
  console.log('[importData] file selected:', f.name, 'size:', f.size);
  clearDB(db);
  console.log('[importData] clearDB called');
  f.text().then(t=>{
    const parsed = JSON.parse(t);
    console.log('[importData] parsed JSON entries =', parsed.length);
    parsed.forEach(e=>addRaw(e));
    console.log('[importData] addRaw called for each entry');
    refresh();
    console.log('[importData] refresh triggered after import');
  }).catch(err=>{
    console.error('[importData] failed to parse or import file:', err);
  });
}

openDB().then(()=>{
  console.log('[openDB] resolved');
  dt.value=new Date().toISOString().slice(0,16);
  console.log('[openDB] dt set to', dt.value);
  refresh();
  console.log('[openDB] initial refresh triggered');
});
