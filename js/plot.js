const canvas = document.getElementById("plot");
const ctx = canvas.getContext("2d");

/* --------------------
   Layout constants
-------------------- */
const PAD_L = 55;
const PAD_T = 10;
const PAD_B = 30;
const PAD_R = 10;

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
   Resize to SECTION
-------------------- */
function resizeCanvas() {
  const panel = canvas.parentElement;
  const h2 = panel.querySelector("h2");
  const rect = panel.getBoundingClientRect();

  const cssWidth  = rect.width;
  const cssHeight = rect.height - (h2 ? h2.offsetHeight : 0);

  const dpr = window.devicePixelRatio || 1;

  // Set CSS size
  canvas.style.width  = cssWidth + "px";
  canvas.style.height = cssHeight + "px";

  // Set actual pixel buffer
  canvas.width  = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  // Reset transform BEFORE scaling
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

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
   Redraw
-------------------- */
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!currentData.length) return;

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
     Fixed Y grid
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
     X grid
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
  }

  /* --------------------
     CLIP to plot area
  -------------------- */
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD_L, PAD_T, W, H);
  ctx.clip();

  /* --------------------
     Blocks
  -------------------- */
  currentData.forEach(e => {
    const t = new Date(e.time);
    const dayIdx = Math.floor((t - minDay) / DAY);
    const hour = t.getHours();

    const dayCenterX =
      PAD_L +
      ((dayIdx + 0.5) / totalDays) * W * view.zoomX +
      view.offsetX;

    const blockW = (W / totalDays) * view.zoomX;
    const blockH = H / 24;

    const x = dayCenterX - blockW / 2;
    const y = PAD_T + H - ((hour + 1) / 24) * H;

    ctx.fillStyle = colorFor(e.text);
    ctx.fillRect(x, y, blockW, blockH);

    if (view.zoomX > 2) {
      ctx.fillStyle = "#000";
      ctx.font = "12px sans-serif";
      wrapText(ctx, e.text, x + 4, y + 14, blockW - 8, blockH - 6);
    }
  });

  ctx.restore();

  /* --------------------
    X axis day labels (VISIBLE)
  -------------------- */
  ctx.fillStyle = "#333";
  ctx.font = "11px sans-serif";

  for (let d = 0; d <= totalDays; d++) {
    const x =
      PAD_L +
      (d / totalDays) * W * view.zoomX +
      view.offsetX;

    // Only draw labels that are inside view
    if (x < PAD_L || x > canvas.width - PAD_R) continue;

    if (view.zoomX > 1.3) {
      const day = new Date(minDay.getTime() + d * DAY);
      ctx.fillText(
        day.toLocaleDateString(),
        x + 4,
        canvas.height - 10
      );
    }
  }


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
   Text wrapping helper
-------------------- */
function wrapText(ctx, text, x, y, maxWidth, maxHeight) {
  const words = text.split(" ");
  let line = "";
  const lineHeight = 14;
  let cy = y;

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      if (cy + lineHeight > y + maxHeight) return;
      ctx.fillText(line, x, cy);
      line = words[i] + " ";
      cy += lineHeight;
    } else {
      line = test;
    }
  }

  if (cy + lineHeight <= y + maxHeight) {
    ctx.fillText(line, x, cy);
  }
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

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

    const oldZoom = view.zoomX;
    const newZoom = Math.max(0.5, Math.min(20, oldZoom * zoomFactor));

    const dataX = (mouseX - PAD_L - view.offsetX) / oldZoom;

    view.zoomX = newZoom;
    view.offsetX = mouseX - PAD_L - dataX * newZoom;

    redraw();
  },
  { passive: false }
);
