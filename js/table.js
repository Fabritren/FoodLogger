const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');

function updateTable() {
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = '';

  const query = searchInput.value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  console.log('updateTable: filter =', query);

  getAllRaw(results => {
    console.log('updateTable: received', results.length, 'entries');

    results.forEach(entry => {
      const entryTextNorm = entry.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // NFD-safe substring match
      if (query && !entryTextNorm.includes(query)) {
        return;
      }

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

    updateStatus(results);
    console.log('updateTable: finished rendering table');
  });
}

searchBtn.onclick = () => {
  updateTable();
};

clearBtn.onclick = () => {
  fillTableSearch('');
};

// Optional: press Enter to search
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    updateTable();
  }
});

function fillTableSearch(text = '') {
  searchInput.value = text;
  updateTable();
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
    textNewEntry.value = entry.text;
    autoGrow(textNewEntry);

    // Change Save button text to indicate update
    document.querySelector('#panel-add .primary').innerText = 'Update';
    // show discard button
    document.getElementById('discardBtn').hidden = false;
  };

  req.onerror = e => console.error('editEntry: error fetching entry', e.target.error);
}

function discardEdit() {
  editingKey = null;                    // cancel editing mode
  textNewEntry.value = '';                       // clear input
  autoGrow(textNewEntry);
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
