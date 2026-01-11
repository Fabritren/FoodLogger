const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');

let filterByImproveableItems = false; // flag to track if filtering by improveable items

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

function findItemsToImprove() {
  console.log('[findItemsToImprove] analyzing processedTable for items that contain other items');
  
  // Get unique item texts from processedTable
  const uniqueItems = [...new Set(processedTable.map(e => e.text))];
  console.log('[findItemsToImprove] found', uniqueItems.length, 'unique items');
  
  const improveableItems = new Set();
  
  // For each item, check if it contains multiple other items as substrings
  uniqueItems.forEach(item => {
    const itemLower = item.toLowerCase();
    
    // Find all other items that are contained in this item
    const containedItems = uniqueItems.filter(otherItem => {
      if (otherItem === item) return false; // Don't compare with itself
      
      const otherLower = otherItem.toLowerCase();
      return itemLower.includes(otherLower);
    });
    
    // If item contains 2 or more other items, it's a candidate to be improved
    if (containedItems.length >= 2) {
      console.log('[findItemsToImprove] item "' + item + '" could be improved (contains items: ' + containedItems.join(', ') + ')');
      improveableItems.add(itemLower);
    }
  });
  
  console.log('[findItemsToImprove] found', improveableItems.size, 'improveable items');
  return improveableItems;
}

function filterByImproveableItemsToggle() {
  console.log('[filterByImproveableItemsToggle] called, current state:', filterByImproveableItems);
  filterByImproveableItems = !filterByImproveableItems;
  
  // Update button styling if it exists
  const improveBtn = document.getElementById('improveBtn');
  if (improveBtn) {
    improveBtn.style.backgroundColor = filterByImproveableItems ? '#FFC107' : '';
    improveBtn.style.opacity = filterByImproveableItems ? '1' : '0.7';
  }
  
  updateTable();
}

function clearImproveFilter() {
  console.log('[clearImproveFilter] called');
  filterByImproveableItems = false;
  const improveBtn = document.getElementById('improveBtn');
  if (improveBtn) {
    improveBtn.style.backgroundColor = '';
    improveBtn.style.opacity = '0.7';
  }
  updateTable();
}

function filterEntries(entries, query, applyImproveFilter = false) {
  const normQuery = normalizeText(query);
  let improveableItems = null;
  
  if (applyImproveFilter) {
    improveableItems = findItemsToImprove();
  }
  
  return entries.filter(entry => {
    const entryTextNorm = normalizeText(entry.text);
    
    // Apply search query filter
    if (normQuery && !entryTextNorm.includes(normQuery)) {
      return false;
    }
    
    // Apply improveable items filter
    if (applyImproveFilter && improveableItems) {
      // Split entry text by commas and check if any item is improveable
      const entryItems = entry.text.split(',').map(s => s.trim().toLowerCase());
      const hasImproveableItem = entryItems.some(item => improveableItems.has(item));
      if (!hasImproveableItem) {
        return false;
      }
    }
    
    return true;
  });
}

function updateTable() {
  const container = document.getElementById('dataTableCards');
  if (container) container.innerHTML = '';

  const query = searchInput.value;
  console.log('updateTable: filter =', query, 'improveFilter =', filterByImproveableItems);

  getAllRaw(results => {
    console.log('updateTable: received', results.length, 'entries');

    const filteredResults = filterEntries(results, query, filterByImproveableItems);

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
  clearImproveFilter();
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
