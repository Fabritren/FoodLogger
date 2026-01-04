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

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}