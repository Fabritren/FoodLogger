let processedTable = [];

function toggleAdd(){
  console.log('[toggleAdd] called; addSection exists:', !!window.addSection);
  console.log('[toggleAdd] before hidden:', addSection ? addSection.hidden : undefined);
  addSection.hidden = !addSection.hidden;
  console.log('[toggleAdd] after hidden:', addSection.hidden);
}

function addEntry(){
  console.log('[addEntry] called');
  const dt = document.getElementById('dt').value;
  const text = document.getElementById('text').value;
  console.log('[addEntry] inputs:', { dt, text });
  if(!dt || !text) {
    console.log('[addEntry] missing input; aborting');
    return;
  }

  addRaw({time:dt, text:text});
  console.log('[addEntry] addRaw called');
  document.getElementById('text').value='';
  refresh();
  console.log('[addEntry] refresh triggered');
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
  });
}

function updateStatus(raw){
  console.log('[updateStatus] called; raw.length =', raw.length);
  if (!raw.length) {
    statusFooter.innerText = 'No entries';
    console.log('[updateStatus] set statusFooter to "No entries"');
    return;
  }
  const times = raw.map(r => new Date(r.time));
  statusFooter.innerText =
    `Count: ${raw.length} | First: ${new Date(Math.min(...times)).toLocaleString()} | Last: ${new Date(Math.max(...times)).toLocaleString()}`;
  console.log('[updateStatus] statusFooter set:', statusFooter.innerText);
}

function updateQuickButtons() {
  console.log('[updateQuickButtons] called');
  quickButtons.innerHTML = '';

  // Count occurrences
  const counts = {};
  processedTable.forEach(e => {
    counts[e.text] = (counts[e.text] || 0) + 1;
  });
  console.log('[updateQuickButtons] counts computed for', Object.keys(counts).length, 'unique items');

  // Build sorted list:
  // 1) Most frequent first
  // 2) Alphabetical for ties
  const sorted = Object.keys(counts)
    .sort((a, b) => {
      const diff = counts[b] - counts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

  console.log('[updateQuickButtons] sorted list length =', sorted.length);

  // Create buttons for all unique sorted values
  sorted.forEach(t => {
    const b = document.createElement('button');
    b.innerText = t;
    b.onclick = () => {
      console.log('[quickButton] clicked:', t);
      const current = text.value.trim();
      text.value = current ? `${current}, ${t}` : t;
      console.log('[quickButton] text field updated:', text.value);
    };
    quickButtons.appendChild(b);
  });

  console.log('[updateQuickButtons] quickButtons updated with', sorted.length, 'buttons');
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
