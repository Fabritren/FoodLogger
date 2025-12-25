let processedTable = [];

function toggleAdd(){
  addSection.hidden = !addSection.hidden;
}

function addEntry(){
  const dt = document.getElementById('dt').value;
  const text = document.getElementById('text').value;
  if(!dt || !text) return;

  addRaw({time:dt, text:text});
  document.getElementById('text').value='';
  refresh();
}

function buildProcessed(raw) {
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
}

function refresh(){
  getAllRaw(raw=>{
    buildProcessed(raw);
    drawPlot(processedTable);
    updateStatus(raw);
    updateQuickButtons();
  });
}

function updateStatus(raw){
  if(!raw.length){
    status.innerText='No entries';
    return;
  }
  const times = raw.map(r=>new Date(r.time));
  status.innerText = 
    `Count: ${raw.length} | First: ${new Date(Math.min(...times)).toLocaleString()} | Last: ${new Date(Math.max(...times)).toLocaleString()}`;
}

function updateQuickButtons(){
  quickButtons.innerHTML='';
  [...new Set(processedTable.map(e=>e.text))].slice(0,6).forEach(t=>{
    const b=document.createElement('button');
    b.innerText=t;
    b.onclick = () => {
      const current = text.value.trim();
      text.value = current ? `${current}, ${t}` : t;
    };
    quickButtons.appendChild(b);
  });
}

function exportData(){
  getAllRaw(raw=>{
    const clean = raw.map(r=>({time:r.time,text:r.text}));
    const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='logger-export.json';
    a.click();
  });
}

function importData(input){
  const f=input.files[0];
  if(!f) return;
  clearDB(db)
  f.text().then(t=>{
    JSON.parse(t).forEach(e=>addRaw(e));
    refresh();
  });
}

openDB().then(()=>{
  dt.value=new Date().toISOString().slice(0,16);
  refresh();
});
