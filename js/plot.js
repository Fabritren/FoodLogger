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

    // Group by X to match rectangle layout
    const groups = {};
    chart.$rects.forEach(r => {
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
        const left =
          centerX - dayWidth / 2 + i * rectWidth;

        const top = yScale.getPixelForValue(r.yEnd);
        const bottom = yScale.getPixelForValue(r.yStart);
        const height = bottom - top;

        // Skip if rectangle is too small
        if (rectWidth < 12 || height < 12) return;

        ctx.save();

        // 🔹 clip to rectangle
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
  d.setHours(0, 0, 0, 0); // normalize per day
  value = d.getDate();
  return value;
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

    // group by X value
    const groups = {};
    chart.$rects.forEach(r => {
      groups[r.x] ??= [];
      groups[r.x].push(r);
    });

    Object.entries(groups).forEach(([x, group]) => {
      const xValue = +x;
      const centerX = xScale.getPixelForValue(xValue);

      // width of one day in pixels
      const dayWidth =
        xScale.getPixelForValue(xValue + 1) -
        xScale.getPixelForValue(xValue);

      const rectWidth = dayWidth / group.length;

      group.forEach((r, i) => {
        const left =
          centerX - dayWidth / 2 + i * rectWidth;

        const top = yScale.getPixelForValue(r.yEnd);
        const bottom = yScale.getPixelForValue(r.yStart);

        ctx.fillStyle = r.color;
        ctx.fillRect(
          left,
          top,
          rectWidth,
          bottom - top
        );
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

  // each rectangle = one visual block
  // x = day (integer)
  // yStart / yEnd = hour range
  const rects = data.map((item, i) => {
    const date = new Date(item.time);
    return {
      x: getDateX(date),
      yStart: getHourValue(date),
      yEnd: getHourValue(date) + 1,
      label: item.text,
      color: generateColor(i, data.length)
    };
  });

  console.log(rects);

  myChart = new Chart(ctx, {
    type: 'scatter', // important
    data: {
      datasets: [] // bars are NOT used
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          offset: false,
          title: {
            display: true,
            text: 'Date'
          },
          ticks: {
            stepSize: 1,
            precision: 0
          },
          afterBuildTicks(scale) {
            const min = Math.ceil(scale.min);
            const max = Math.floor(scale.max);
            const ticks = [];
            for (let v = min; v <= max; v++) {
              ticks.push({ value: v });
            }
            scale.ticks = ticks;
          }
        },
        y: {
          min: 0,
          max: 24,
          title: {
            display: true,
            text: 'Hour of day'
          },
          ticks: {
            stepSize: 2
          }
        }
      },
      plugins: {
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        },
        legend: {
          position: 'bottom'
        }
      }
    },
    plugins: [rectanglePlugin, rectangleLabelsPlugin]
  });

  // attach rectangles to chart instance
  myChart.$rects = rects;

  console.log("Finished setting up graph");
}