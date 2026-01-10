const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');


function normalizeText(str) {
  return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function filterEntries(entries, query) {
  const normQuery = normalizeText(query);
  return entries.filter(entry => {
    const entryTextNorm = normalizeText(entry.text);
    if (normQuery && !entryTextNorm.includes(normQuery)) {
      return false;
    }
    return true;
  });
}

function updateTable() {
  const container = document.getElementById('dataTableCards');
  if (container) container.innerHTML = '';

  const query = searchInput.value;
  console.log('updateTable: filter =', query);

  getAllRaw(results => {
    console.log('updateTable: received', results.length, 'entries');

    const filteredResults = filterEntries(results, query);

    filteredResults.forEach(entry => {
      // Card style similar to category-item
      const div = document.createElement('div');
      div.className = 'entry-card';

      const d = new Date(entry.time);
      const dateStr = `${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

      div.innerHTML = `
        <div class="entry-info">
          <div class="entry-date">${dateStr}</div>
          <div class="entry-items">${entry.text}</div>
        </div>
        <div class="entry-actions">
          <button class="action-btn" title="Edit" onclick="editEntry(${entry.key})">✏️</button>
          <button class="action-btn" title="Delete" onclick="confirmDelete(${entry.key})">🗑️</button>
        </div>
      `;
      if (container) container.appendChild(div);
    });

    updateStatus(filteredResults, results.length);
    console.log('updateTable: finished rendering table');
  });
}

searchBtn.onclick = () => {
  updateTable();
};

clearBtn.onclick = () => {
  fillTableSearch('');
};

let debounceTimer = null;
searchInput.addEventListener('input', () => {
  // cancel any previous pending update
  if (debounceTimer) clearTimeout(debounceTimer);

  // schedule a new update
  debounceTimer = setTimeout(() => {
    updateTable();
  }, 250); // wait 250ms after typing stops
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
  dt.value = formatDateTimeLocal(new Date()); // reset to now (local time)
  document.querySelector('#panel-add .primary').innerText = 'Save'; // restore button text
  document.getElementById('discardBtn').hidden = true; // hide discard button
}

function updateStatus(filteredRaw, totalCount) {
  console.log('[updateStatus] called; filteredRaw.length =', filteredRaw.length, 'totalCount =', totalCount);
  if (!filteredRaw.length) {
    databaseStatus.innerText = totalCount && totalCount > 0
      ? 'No entries match filter'
      : 'No entries';
    console.log('[updateStatus] set databaseStatus to', databaseStatus.innerText);
    return;
  }
  let statusText = '';
  if (typeof totalCount === 'number' && filteredRaw.length !== totalCount) {
    statusText = `Showing ${filteredRaw.length} of ${totalCount} entries.`;
  } else {
    statusText = `Showing ${filteredRaw.length} entries.`;
  }
  databaseStatus.innerText = statusText;
  console.log('[updateStatus] databaseStatus set:', databaseStatus.innerText);
}
