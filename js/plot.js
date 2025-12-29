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

const rectangleLabelsPlugin = {
  id: 'rectangleLabels',

  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    if (!chart.$rects) return;

    const groups = {};
    chart.$rects.forEach(r => {
      if (r.hidden) return; // skip hidden rectangles
      groups[r.x] ??= [];
      groups[r.x].push(r);
    });

    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';

    Object.entries(groups).forEach(([x, group]) => {
      const xValue = +x;
      const centerX = xScale.getPixelForValue(xValue);
      const dayWidth =
        xScale.getPixelForValue(xValue + 1) -
        xScale.getPixelForValue(xValue);

      const rectWidth = dayWidth / group.length;

      group.forEach((r, i) => {
        const left = centerX - dayWidth / 2 + i * rectWidth;
        const top = yScale.getPixelForValue(r.yEnd);
        const bottom = yScale.getPixelForValue(r.yStart);
        const height = bottom - top;

        if (rectWidth < 12 || height < 12) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, rectWidth, height);
        ctx.clip();

        const padding = 4;
        const maxWidth = rectWidth - padding * 2;

        const lines = wrapText(ctx, r.label, maxWidth);

        const lineHeight = 14;
        const totalHeight = lines.length * lineHeight;
        let y = top + height / 2 - totalHeight / 2;

        lines.forEach(line => {
          ctx.fillText(line, left + padding, y);
          y += lineHeight;
        });

        ctx.restore();
      });
    });

    ctx.restore();
  }
};

function getDateX(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getDate();
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

    const groups = {};
    chart.$rects.forEach(r => {
      if (r.hidden) return; // skip hidden
      groups[r.x] ??= [];
      groups[r.x].push(r);
    });

    Object.entries(groups).forEach(([x, group]) => {
      const xValue = +x;
      const centerX = xScale.getPixelForValue(xValue);

      const dayWidth =
        xScale.getPixelForValue(xValue + 1) -
        xScale.getPixelForValue(xValue);

      const rectWidth = dayWidth / group.length;

      group.forEach((r, i) => {
        const left = centerX - dayWidth / 2 + i * rectWidth;
        const top = yScale.getPixelForValue(r.yEnd);
        const bottom = yScale.getPixelForValue(r.yStart);

        ctx.fillStyle = r.color;
        ctx.fillRect(left, top, rectWidth, bottom - top);
      });
    });
  }
};

let myChart = null;

function drawPlot(data) {
  if (myChart) {
    myChart.destroy();
  }

  const ctx = document.getElementById('plot');

  // Count unique labels
  const uniqueLabels = [...new Set(data.map(item => item.text))];
  const labelColorMap = {};
  uniqueLabels.forEach((label, i) => {
    labelColorMap[label] = generateColor(i, uniqueLabels.length);
  });

  const rects = data.map(item => {
    const date = new Date(item.time);
    const label = item.text;
    return {
      x: getDateX(date),
      yStart: getHourValue(date),
      yEnd: getHourValue(date) + 1,
      label: label,
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
              // show labels only at integers
              return Number.isInteger(value) ? value : '';
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
          pan: { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        },
        legend: {
          position: 'bottom',
          onClick: (e, legendItem) => {
            const label = legendItem.text;
            myChart.$rects.forEach(r => {
              if (r.label === label) r.hidden = !r.hidden;
            });
            myChart.update();
          }
        }
      }
    },
    plugins: [rectanglePlugin, rectangleLabelsPlugin]
  });

  myChart.$rects = rects;
  console.log("Finished setting up graph");
}
