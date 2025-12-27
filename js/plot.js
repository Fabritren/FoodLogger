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
        }
    });

    console.log("Finished setting up graph")
}