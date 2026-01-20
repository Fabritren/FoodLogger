let processedTable = [];
let editingKey = null; // global variable

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.hidden = true);
  document.getElementById('panel-' + name).hidden = false;
}

function buildProcessed(raw) {
  console.log('[buildProcessed] called; raw.length =', raw.length);
  
  // First pass: split all items
  const allItems = raw.flatMap(r =>
    r.text
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(t => ({
        time: r.time,
        text: t.charAt(0).toUpperCase() + t.slice(1) // capitalize first letter
      }))
  );

  // Group by normalized text and track frequency of each variation
  const itemsByNorm = {};
  allItems.forEach(item => {
    const norm = typeof normalizeText === 'function' ? normalizeText(item.text) : item.text.toLowerCase();
    if (!itemsByNorm[norm]) {
      itemsByNorm[norm] = { variations: {}, times: [] };
    }
    itemsByNorm[norm].variations[item.text] = (itemsByNorm[norm].variations[item.text] || 0) + 1;
    itemsByNorm[norm].times.push(item.time);
  });

  // Second pass: use most frequent variation for each normalized group
  processedTable = [];
  Object.entries(itemsByNorm).forEach(([norm, data]) => {
    // Find the most frequently used variation
    const mostFrequentVariation = Object.entries(data.variations)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Add one entry per time with the most frequent variation
    data.times.forEach(time => {
      processedTable.push({
        time: time,
        text: mostFrequentVariation
      });
    });
  });

  console.log('[buildProcessed] processedTable.length =', processedTable.length);
}

function refresh(){
  console.log('[refresh] called');
  getAllRaw(raw=>{
    console.log('[refresh] getAllRaw callback; raw.length =', raw.length);
    buildProcessed(raw);
    drawPlot(processedTable);
    console.log('[refresh] drawPlot called with processedTable.length =', processedTable.length);
    updateQuickButtons();
    updateTable();
    updateCategoriesList();
    onRefreshUpdateCorrelationSelect();
  });
}

function exportData(){
  console.log('[exportData] called');
  getAllRaw(raw=>{
    console.log('[exportData] got raw; length =', raw.length);
    getAllCategories(cats=>{
      console.log('[exportData] got categories; length =', (cats||[]).length);
      const cleanEntries = raw.map(r=>({time:r.time,text:r.text}));
      const cleanCats = (cats||[]).map(c=>({name:c.name, color:c.color, items:c.items || []}));
      const payload = { entries: cleanEntries, categories: cleanCats };
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='logger-export.json';
      a.click();
      console.log('[exportData] download triggered:', a.download);
    });
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

  // Clear both raw entries and categories before importing new data
  Promise.all([clearDB(), clearCategories()]).then(()=>{
    console.log('[importData] cleared raw and categories stores');
    return f.text();
  }).then(t=>{
    const parsed = JSON.parse(t);
    let entries = [];
    let cats = [];
    if (Array.isArray(parsed)) {
      // Legacy format: top-level array of entries
      entries = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.entries)) entries = parsed.entries;
      else if (Array.isArray(parsed.data)) entries = parsed.data;
      if (Array.isArray(parsed.categories)) cats = parsed.categories;
    } else {
      throw new Error('Unsupported import format');
    }

    console.log('[importData] parsed entries =', entries.length, 'categories =', cats.length);

    // Add all entries first
    entries.forEach(e=>addRaw({time:e.time, text:e.text}));
    
    // Add all categories and wait for them to complete
    const categoryPromises = cats.map(c => {
      return new Promise(resolve => {
        const tx = db.transaction('categories', 'readwrite');
        const store = tx.objectStore('categories');
        const req = store.add({name: c.name, color: c.color, items: c.items || []});
        
        tx.oncomplete = () => {
          console.log('[importData] category saved:', c.name);
          resolve();
        };
        tx.onerror = () => {
          console.error('[importData] error saving category:', c.name, tx.error);
          resolve();
        };
      });
    });

    console.log('[importData] waiting for categories to be saved');
    return Promise.all(categoryPromises);
  }).then(() => {
    console.log('[importData] all categories saved, updating lists');
    updateCategoriesList();
    refresh();
    console.log('[importData] updateCategoriesList and refresh triggered after import');
  }).catch(err=>{
    console.error('[importData] failed to parse or import file:', err);
  });
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

initDB();