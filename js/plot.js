const canvas = document.getElementById("plot");
const ctx = canvas.getContext("2d");

/* --------------------
   Internal render state
-------------------- */
let currentData = [];

const view = {
  zoomX: 1,
  offsetX: 0,
  dragging: false,
  lastX: 0
};

/* --------------------
   Resize to container
-------------------- */
function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width  = r.width;
  canvas.height = r.height;
  redraw();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* --------------------
   Public API
-------------------- */
function drawPlot(data) {
  currentData = data || [];
  redraw();
}

/* --------------------
   Redraw using cached data
-------------------- */
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!currentData.length) return;

  const PAD_L = 55;
  const PAD_T = 10;
  const PAD_B = 30;
  const PAD_R = 10;

  const W = canvas.width  - PAD_L - PAD_R;
  const H = canvas.height - PAD_T - PAD_B;

  const DAY = 86400000;

  // ---- Time bounds
  const times = currentData.map(d => new Date(d.time));
  const minDay = new Date(Math.min(...times));
  minDay.setHours(0,0,0,0);

  const maxDay = new Date(Math.max(...times));
  maxDay.setHours(24,0,0,0);

  const totalDays = (maxDay - minDay) / DAY;

  /* --------------------
     Fixed Y grid (0–24h)
  -------------------- */
  ctx.strokeStyle = "#e0e0e0";
  ctx.fillStyle = "#666";
  ctx.font = "11px sans-serif";

  for (let h = 0; h <= 24; h += 2) {
    const y = PAD_T + H - (h / 24) * H;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(canvas.width - PAD_R, y);
    ctx.stroke();
    ctx.fillText(`${h}:00`, 6, y + 4);
  }

  /* --------------------
     X grid (days)
  -------------------- */
  for (let d = 0; d <= totalDays; d++) {
    const x =
      PAD_L +
      (d / totalDays) * W * view.zoomX +
      view.offsetX;

    ctx.beginPath();
    ctx.moveTo(x, PAD_T);
    ctx.lineTo(x, canvas.height - PAD_B);
    ctx.stroke();

    if (view.zoomX > 1.3) {
      const day = new Date(minDay.getTime() + d * DAY);
      ctx.fillText(day.toLocaleDateString(), x + 4, canvas.height - 8);
    }
  }

  /* --------------------
     Blocks (CENTERED per day)
  -------------------- */
  currentData.forEach(e => {
    const t = new Date(e.time);

    const dayIdx = Math.floor((t - minDay) / DAY);
    const hour = t.getHours();

    // ---- X center at day
    const dayCenterX =
      PAD_L +
      ((dayIdx + 0.5) / totalDays) * W * view.zoomX +
      view.offsetX;

    const blockW = (W / totalDays) * view.zoomX;
    const x = dayCenterX - blockW / 2;

    // ---- Y from hour (1h height)
    const blockH = H / 24;
    const y =
      PAD_T +
      H -
      ((hour + 1) / 24) * H;

    ctx.fillStyle = colorFor(e.text);
    ctx.fillRect(x, y, blockW, blockH);

    // ---- Text when zoomed
    if (view.zoomX > 2) {
      ctx.fillStyle = "#000";
      ctx.font = "12px sans-serif";
      ctx.fillText(e.text, x + 4, y + blockH / 2 + 4);
    }
  });

  /* --------------------
     Axes
  -------------------- */
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, canvas.height - PAD_B);
  ctx.lineTo(canvas.width - PAD_R, canvas.height - PAD_B);
  ctx.stroke();
}

/* --------------------
   Colors
-------------------- */
function colorFor(text) {
  const palette = [
    "#b3cde3", "#ccebc5", "#decbe4",
    "#fed9a6", "#ffffcc", "#fbb4ae"
  ];
  let h = 0;
  for (let i = 0; i < text.length; i++)
    h = text.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

/* --------------------
   Interactivity (X only)
-------------------- */
canvas.addEventListener("mousedown", e => {
  view.dragging = true;
  view.lastX = e.clientX;
});

window.addEventListener("mouseup", () => {
  view.dragging = false;
});

canvas.addEventListener("mousemove", e => {
  if (!view.dragging) return;
  view.offsetX += e.clientX - view.lastX;
  view.lastX = e.clientX;
  redraw();
});

canvas.addEventListener(
  "wheel",
  e => {
    e.preventDefault();

    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

    const oldZoom = view.zoomX;
    const newZoom = Math.max(0.5, Math.min(20, oldZoom * zoomFactor));

    // ---- Data-space X under cursor BEFORE zoom
    const dataX =
      (mouseX - view.offsetX - 55) / oldZoom;

    // ---- Apply zoom
    view.zoomX = newZoom;

    // ---- Adjust offset so cursor stays anchored
    view.offsetX =
      mouseX - 55 - dataX * newZoom;

    redraw();
  },
  { passive: false }
);

