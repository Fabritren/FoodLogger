
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