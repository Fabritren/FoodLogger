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

function drawPlot(data) {
    const ctx = document.getElementById('plot');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [1, 3],
            datasets: [
            {
                label: 'Dataset 1',
                data: [[10, 20], [15, 25]],
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                stack: 'stack1'
            },
            {
                label: 'Dataset 2',
                data: [[20, 30], [25, 35]],
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                stack: 'stack1'
            },
            {
                label: 'Dataset 3',
                data: [[5, 15], [10, 20]],
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                stack: 'stack2'
            }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',   // 'linear' 'category' / 'time'
                },
                y: {
                    min: 0,
                    max: 100,
                    stacked: true,
                    beginAtZero: false
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