const DAY_MS = 24 * 60 * 60 * 1000;

function getOriginDate(data) {
  const minTime = Math.min(...data.map(d => new Date(d.time).getTime()));
  const origin = new Date(minTime);
  origin.setHours(0, 0, 0, 0);
  return origin;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  words.forEach(word => {
    const testLine = line ? `${line} ${word}` : word;
    const { width } = ctx.measureText(testLine);

    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function getDateX(date, originDate) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d - originDate) / DAY_MS);
}

function getHourValue(date) {
  return date.getHours() + date.getMinutes() / 60;
}

function generateColor(index, total) {
  const hue = Math.round((360 / total) * index);
  return `hsla(${hue}, 70%, 55%, 0.7)`;
}

const rectanglePlugin = {
  id: 'rectanglePlugin',

  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    if (!chart.$rects) return;

    // Group rectangles by X value
    const groups = {};
    chart.$rects.forEach(r => {
      if (r.hidden) return; // skip hidden
      groups[r.x] ??= [];
      groups[r.x].push(r);
    });

    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';

    Object.entries(groups).forEach(([x, group]) => {
      const xValue = +x;
      const centerX = xScale.getPixelForValue(xValue);

      const dayWidth =
        xScale.getPixelForValue(xValue + 1) -
        xScale.getPixelForValue(xValue);

      // Further group by overlapping Y ranges
      const yGroups = [];
      group.forEach(r => {
        let found = false;
        for (const yg of yGroups) {
          if (yg.some(other =>
            !(r.yEnd <= other.yStart || r.yStart >= other.yEnd)
          )) {
            yg.push(r);
            found = true;
            break;
          }
        }
        if (!found) yGroups.push([r]);
      });

      // Draw each Y group
      yGroups.forEach(yg => {
        const rectWidth = yg.length > 1 ? dayWidth / yg.length : dayWidth;

        yg.forEach((r, i) => {
          const left = centerX - dayWidth / 2 + i * rectWidth;
          const top = yScale.getPixelForValue(r.yEnd);
          const bottom = yScale.getPixelForValue(r.yStart);
          const height = bottom - top;

          // Draw rectangle
          ctx.fillStyle = r.color;
          ctx.fillRect(left, top, rectWidth, height);

          // Compute hitbox padding for touch devices
          const pad = Math.max(8, Math.round(8 * (window.devicePixelRatio || 1)));

          // Store pixel bounds for hit testing (expanded for touch)
          r._hitBox = {
            left: left - pad,
            right: left + rectWidth + pad,
            top: top - pad,
            bottom: top + height + pad
          };

          // Decide label drawing thresholds (larger on small screens)
          const isMobile = window.innerWidth <= 600;
          const minLabelWidth = isMobile ? 30 : 12;
          const minLabelHeight = isMobile ? 18 : 12;

          // Draw label if enough space
          if (rectWidth >= minLabelWidth && height >= minLabelHeight && r.label) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, rectWidth, height);
            ctx.clip();

            const padding = 4;          // horizontal padding
            const topPadding = 2;       // small top padding
            const maxWidth = rectWidth - padding * 2;

            ctx.fillStyle = 'white';    // text color

            const lines = wrapText(ctx, r.label, maxWidth);
            const lineHeight = 14;
            const totalHeight = lines.length * lineHeight;
            let y = top + topPadding + (height - totalHeight) / 2;

            lines.forEach(line => {
              ctx.fillText(line, left + padding, y);
              y += lineHeight;
            });

            ctx.restore();
          }
        });
      });
    });

    ctx.restore();
  }
};

let myChart = null;

function drawPlot(data) {
  if (myChart) {
    myChart.destroy();
  }

  // If showing categories and categories exist, transform data
  let plotData = data;
  let labelColorMap = {};
  let uniqueLabels = [...new Set(data.map(item => item.text))];

  if (showCategoriesInPlot && categories && categories.length > 0) {
    console.log('[drawPlot] drawing in CATEGORY mode');
    
    // Build a food-to-category map
    const foodToCategoryMap = {};
    categories.forEach(cat => {
      (cat.foods || []).forEach(food => {
        foodToCategoryMap[food] = { name: cat.name, color: cat.color, key: cat.key };
      });
    });

    // Transform data to use category labels and colors
    plotData = data.map(item => ({
      ...item,
      text: foodToCategoryMap[item.text]?.name || item.text, // use category name or original food name
      categoryColor: foodToCategoryMap[item.text]?.color || null
    }));

    uniqueLabels = [...new Set(plotData.map(item => item.text))];
    
    // Build color map from categories
    uniqueLabels.forEach(label => {
      const catItem = categories.find(c => c.name === label);
      labelColorMap[label] = catItem ? catItem.color : generateColor(Object.keys(labelColorMap).length, uniqueLabels.length);
    });
  } else {
    console.log('[drawPlot] drawing in FOOD mode');
    
    // Default food mode: generate colors
    uniqueLabels.forEach((label, i) => {
      labelColorMap[label] = generateColor(i, uniqueLabels.length);
    });
  }

  const originDate = getOriginDate(plotData);
  const ctx = document.getElementById('plot');

  const rects = plotData.map(item => {
    const date = new Date(item.time);
    const label = item.text;

    return {
      x: getDateX(date, originDate),
      yStart: getHourValue(date),
      yEnd: getHourValue(date) + 1,
      label: label,
      date: date,
      color: labelColorMap[label],
      hidden: false
    };
  });

  const datasets = uniqueLabels.map(label => ({
    label: label,
    data: [{ x: 0, y: 0 }],
    backgroundColor: labelColorMap[label],
    borderColor: labelColorMap[label],
    hidden: false
  }));

  // Determine min and max X for the current dataset
  const xValues = rects.map(r => r.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);

  // Detect touch-capable devices and enable wheel zoom only on non-touch devices
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const wheelEnabled = !isTouchDevice;

  myChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          offset: false,
          min: minX - 0.5, // add a little padding
          max: maxX + 0.5,
          title: { display: true, text: 'Date' },
          ticks: {
            stepSize: 0.5,
            callback: (value) => {
              if (!Number.isInteger(value)) return '';

              const d = new Date(originDate.getTime() + value * DAY_MS);
              const day = d.getDate();
              const month = d.getMonth(); // 0 = Jan

              const parts = [day];

              // First day of month → add month
              if (day === 1) {
                parts.push(
                  d.toLocaleDateString(undefined, { month: 'short' })
                );
              }

              // January 1st → add year
              if (month === 0 && day === 1) {
                parts.push(d.getFullYear());
              }

              return parts.join(' ');
            }
          },
          afterBuildTicks(scale) {
            const ticks = [];
            const minInt = Math.ceil(scale.min);
            const maxInt = Math.floor(scale.max);
            // integer ticks (for labels)
            for (let v = minInt; v <= maxInt; v++) {
              ticks.push({ value: v });
            }
            // half ticks (for grid lines)
            for (let v = minInt - 0.5; v <= maxInt + 0.5; v += 1) {
              if (v >= scale.min && v <= scale.max) {
                ticks.push({ value: v });
              }
            }
            // sort required
            ticks.sort((a, b) => a.value - b.value);
            scale.ticks = ticks;
          },
          grid: {
            drawBorder: true,
            color: (ctx) => {
              const v = ctx.tick.value;
              // no grid line at integers
              if (Number.isInteger(v)) {
                return 'rgba(0,0,0,0)';
              }
              // grid line at ±0.5
              return 'rgba(0,0,0,0.2)';
            },
            // optional: thinner grid lines
            lineWidth: (ctx) =>
              Number.isInteger(ctx.tick.value) ? 0 : 1
          },
        },
        y: {
          min: 0,
          max: 24,
          title: { display: true, text: 'Hour of day' },
          ticks: { stepSize: 2 }
        }
      },
      plugins: {
        zoom: {
          pan: { enabled: true, mode: 'x', threshold: 10 },
          zoom: { wheel: { enabled: wheelEnabled }, pinch: { enabled: true }, mode: 'x' }
        },
        legend: {display: false},
      }
    },
    plugins: [rectanglePlugin]
  });

  myChart.$rects = rects;
  console.log("Finished setting up graph");

  renderLegend(myChart);

  // Expose a small API for UI controls
  window.resetPlotZoom = function(){ if (myChart && myChart.resetZoom) { myChart.resetZoom(); } };
  window.togglePlotLegend = function(){
    const lc = document.getElementById('legend-container');
    if (!lc) return;
    const visible = lc.style.display !== 'none';
    lc.style.display = visible ? 'none' : 'block';
    // trigger a resize so chart adapts
    setTimeout(()=>myChart.resize(), 60);
  };

  // Debounced resize on window resize for smoother mobile behavior
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=>{
      if (myChart) myChart.resize();
    }, 120);
  });
}

function renderLegend(chart) {
  const container = document.getElementById('legend-container');
  container.innerHTML = '';

  chart.data.datasets.forEach((ds, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'legend-btn';
    btn.textContent = ds.label;

    const visible = chart.isDatasetVisible(i);

    // Apply dataset color
    btn.style.background = ds.backgroundColor;

    // Disabled styling
    if (!visible) {
      btn.classList.add('disabled');
    }

    btn.onclick = (e) => {
      const legendItem = {
        datasetIndex: i,
        text: ds.label
      };

      const legend = { chart };

      // Run Chart.js default legend behavior
      Chart.defaults.plugins.legend.onClick.call(
        legend,
        e,
        legendItem,
        legend
      );

      // Sync rectangles with dataset visibility
      const nowVisible = chart.isDatasetVisible(i);
      myChart.$rects.forEach(r => {
        if (r.label === ds.label) {
          r.hidden = !nowVisible;
        }
      });

      chart.update();
      renderLegend(chart);
    };

    container.appendChild(btn);
  });
}

const wrapper = document.getElementById('chart-wrapper');
const btn = document.getElementById('maximizeBtn');

btn.addEventListener('click', () => {
  wrapper.classList.toggle('maximized');

  // Resize chart after layout change
  setTimeout(() => {
    myChart.resize();
  }, 50);
});

const canvas = document.getElementById('plot');

canvas.addEventListener('click', (evt) => {
  if (!myChart || !myChart.$rects) return;

  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  for (const r of myChart.$rects) {
    if (r.hidden || !r._hitBox) continue;

    const { left, right, top, bottom } = r._hitBox;

    if (x >= left && x <= right && y >= top && y <= bottom) {
      // Rectangle clicked
      console.log('Rectangle clicked:');
      console.log('Text:', r.label);
      console.log('Date:', r.date);
      showPanel('data');
      fillTableSearch(r.label);
      break;
    }
  }
});

// Support touch taps (touchstart) for mobile devices
canvas.addEventListener('touchstart', (evt) => {
  if (!myChart || !myChart.$rects) return;
  const t = evt.touches && evt.touches[0];
  if (!t) return;
  const rect = canvas.getBoundingClientRect();
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;

  for (const r of myChart.$rects) {
    if (r.hidden || !r._hitBox) continue;
    const { left, right, top, bottom } = r._hitBox;
    if (x >= left && x <= right && y >= top && y <= bottom) {
      // Rectangle tapped
      console.log('Rectangle tapped:');
      console.log('Text:', r.label);
      console.log('Date:', r.date);
      showPanel('data');
      fillTableSearch(r.label);
      evt.preventDefault();
      break;
    }
  }
});
