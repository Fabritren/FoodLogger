function drawPlot(processed) {
  const c = document.getElementById('plot');
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);

  if (!processed.length) return;

  const times = processed.map(e=>new Date(e.time));
  const min = Math.min(...times);
  const max = Math.max(...times);

  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(30,10);
  ctx.lineTo(30,190);
  ctx.lineTo(330,190);
  ctx.stroke();

  processed.forEach((e)=>{
    const t = new Date(e.time).getTime();
    const x = 30 + (t-min)/(max-min||1)*280;
    ctx.fillRect(x-2,185,4,5);

    ctx.save();
    ctx.translate(x,180);
    ctx.rotate(-Math.PI/4);
    ctx.fillText(e.text,0,0);
    ctx.restore();
  });

  ctx.fillText(new Date(min).toLocaleString(),30,205);
  ctx.fillText(new Date(max).toLocaleString(),200,205);
}
