
function addEntry() {
  const time = dt.value;
  const value = textNewEntry.value.trim();
  if (!time || !value) return;

  const entry = { time, text: value };
  const wasEditing = editingKey !== null;

  if (editingKey !== null) {
    updateRaw(editingKey, entry);
    editingKey = null;
    document.querySelector('#panel-add .primary').innerText = 'Save';
    document.getElementById('discardBtn').hidden = true; // hide discard after update
  } else {
    addRaw(entry);
  }

  textNewEntry.value = '';
  autoGrow(textNewEntry);
  refresh();

  // Show feedback message
  showEntryFeedback(wasEditing ? 'Entry updated successfully!' : 'Entry added successfully!');
}

function showEntryFeedback(message) {
  const feedback = document.getElementById('entryFeedback');
  if (!feedback) return;
  
  feedback.innerText = message;
  feedback.style.display = 'block';
  
  // Auto-hide after 2 seconds
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 2000);
}

function updateQuickButtons() {
  console.log('[updateQuickButtons] called');
  quickButtons.innerHTML = '';

    const filterNorm = typeof normalizeText === 'function' ? normalizeText(quickFilter.value) : quickFilter.value;
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
        const tNorm = typeof normalizeText === 'function' ? normalizeText(t) : t;
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
    b.type = 'button'; // Prevent form submission
    b.innerText = t;
    b.onclick = () => {
      console.log('[quickButton] clicked:', t);
      const current = textNewEntry.value.trim();
      textNewEntry.value = current ? `${current}, ${t}` : t;
      textNewEntry.setSelectionRange(textNewEntry.value.length, textNewEntry.value.length);
      autoGrow(textNewEntry);
    };
    quickButtons.appendChild(b);
  });
}

function getMostUsedTimes() {
  console.log('[getMostUsedTimes] called');
  
  // Extract HH:mm from all times in processedTable
  const timeCounts = {};
  processedTable.forEach(e => {
    if (e.time) {
      const timeOnly = e.time.substring(11, 16); // Extract HH:mm from ISO datetime
      timeCounts[timeOnly] = (timeCounts[timeOnly] || 0) + 1;
    }
  });

  // If no times found, return defaults
  if (Object.keys(timeCounts).length === 0) {
    const defaults = ['08:00', '12:00', '17:00', '20:00'];
    console.log('[getMostUsedTimes] no entries found, returning defaults:', defaults);
    return defaults;
  }

  // Sort by frequency descending, then alphabetically
  const sorted = Object.keys(timeCounts)
    .sort((a, b) => {
      const diff = timeCounts[b] - timeCounts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

  console.log('[getMostUsedTimes] sorted times:', sorted.slice(0, 4));
  return sorted.slice(0, 4); // Return top 4
}

function updateQuickTimeButtons() {
  console.log('[updateQuickTimeButtons] called');
  const container = document.getElementById('quickTimeButtonsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Create "Now" button
  const nowBtn = document.createElement('button');
  nowBtn.type = 'button';
  nowBtn.innerText = 'Now';
  nowBtn.title = 'Set to current date and time';
  nowBtn.onclick = () => {
    const now = new Date();
    const isoString = now.toISOString().slice(0, 16);
    dt.value = isoString;
    console.log('[nowBtn] set to:', isoString);
  };
  container.appendChild(nowBtn);
  
  // Get most used times
  const mostUsedTimes = getMostUsedTimes();
  
  // Create buttons for most-used times
  mostUsedTimes.forEach(time => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = time;
    btn.title = `Set time to ${time}`;
    btn.onclick = () => {
      // Update time while keeping current date
      const currentDate = dt.value.substring(0, 10); // Get YYYY-MM-DD
      dt.value = currentDate + 'T' + time;
      console.log('[timeBtn] set to:', currentDate + 'T' + time);
    };
    container.appendChild(btn);
  });
}

function setDateOffset(daysOffset) {
  console.log('[setDateOffset] called with offset:', daysOffset);
  
  if (!dt.value) {
    // If no date set, use today
    const now = new Date();
    dt.value = now.toISOString().slice(0, 16);
  }
  
  // Parse current datetime
  const parts = dt.value.split('T');
  const datePart = parts[0];
  const timePart = parts[1];
  
  // Parse date components
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  // Add offset
  date.setDate(date.getDate() + daysOffset);
  
  // Format back to YYYY-MM-DD
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  const newDatePart = `${newYear}-${newMonth}-${newDay}`;
  
  // Update datetime input
  dt.value = newDatePart + 'T' + timePart;
  console.log('[setDateOffset] new datetime:', dt.value);
}

function dayBack() {
  setDateOffset(-1);
}

function dayForward() {
  setDateOffset(1);
}