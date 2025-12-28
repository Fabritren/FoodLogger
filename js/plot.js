const wrapText = (ctx, rawText, maxWidth) => {
  if (rawText == null) return [];

  const text = String(rawText);   // ensure string
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const w of words) {
    const testLine = line + w + " ";
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(line.trim());
      line = w + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  return lines;
};

const insideBarLabels = {
  id: "insideBarLabels",
  afterDatasetsDraw(chart, args, options) {
    const { ctx } = chart;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);

      meta.data.forEach((bar, index) => {
        const labelText = dataset.label;   // <-- THIS is what you asked for

        const props = bar.getProps(["x", "y", "width", "height"], true);
        const { x, y, width, height } = props;

        ctx.save();
        ctx.fillStyle = "white";
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "middle";

        const padding = 4;
        const maxWidth = width - padding * 2;

        const lines = wrapText(ctx, labelText, maxWidth);

        const lineHeight = 14;
        const totalHeight = lines.length * lineHeight;
        let startY = y + height / 2 - totalHeight / 2;

        lines.forEach(line => {
          ctx.fillText(line, x - width / 2 + padding, startY);
          startY += lineHeight;
        });

        ctx.restore();
      });
    });
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

function buildDatasets(data) {
  const grouped = {};
  const datesSet = new Set();

  // Group by text
  data.forEach(item => {
    const date = new Date(item.time);
    const dateKey = getDateX(date);
    datesSet.add(dateKey);

    if (!grouped[item.text]) {
      grouped[item.text] = {};
    }

    const start = getHourValue(date);
    const end = start + 1;

    grouped[item.text][dateKey] = [start, end];
  });

  const labels = Array.from(datesSet).sort();
  const texts = Object.keys(grouped);

  const datasets = texts.map((text, i) => ({
    label: text,
    data: labels.map(d => grouped[text][d] ?? null),
    backgroundColor: generateColor(i, texts.length),
    //stack: 'time'
  }));

  console.log("[buildDatasets]:", labels, datasets)

  return { labels, datasets };
}


function getXRange(datasets) {
  const xs = [];

  datasets.forEach(ds => {
    ds.data.forEach(p => xs.push(p.x));
  });

  min_val = Math.min(...xs)
  max_val = Math.max(...xs)

  console.log("[getXRange]: ", min_val, max_val)

  return {
    min: min_val,
    max: max_val
  };
}

function drawPlot(data) {
    const ctx = document.getElementById('plot');

    const { labels, datasets } = buildDatasets(data);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',   // 'linear' 'category' / 'time',
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        //callback: value => new Date(value).toLocaleDateString()
                        stepSize: 1,
                        precision: 0
                    }
                },
                y: {
                    min: 0,
                    max: 24,
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Hour of day'
                    },
                    ticks: {
                      stepSize: 2
                    },
                }
            },
            plugins: {
              zoom: {
                pan: { enabled: true, mode: 'x' },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
              }
            }
        },
        plugins: [insideBarLabels]
    });

    console.log("Finished setting up graph")
}