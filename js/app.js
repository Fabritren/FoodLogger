let processedTable = [];
let editingKey = null; // global variable

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.hidden = true);
  document.getElementById('panel-' + name).hidden = false;
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
        text: t.charAt(0).toUpperCase() + t.slice(1) // lower case the reamining
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
    updateQuickButtons();
    updateTable();
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

    entries.forEach(e=>addRaw({time:e.time, text:e.text}));
    cats.forEach(c=>addCategory({name:c.name, color:c.color, items:c.items || []}));

    console.log('[importData] addRaw/addCategory called for each item');
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