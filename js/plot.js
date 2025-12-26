function drawPlot(data) {
    const chartDom = document.getElementById('plot');
    const myChart = echarts.init(chartDom);

    // Transform data: day -> X (categorical), hour -> Y (numeric)
    const days = [...new Set(data.map(d => d.time.slice(0, 10)))].sort();

    const seriesData = data.map(item => {
        const date = new Date(item.time);
        const dayIndex = days.indexOf(date.toISOString().slice(0, 10));
        const hourStart = date.getHours();
        const hourEnd = hourStart + 1;

        return {
            name: item.text,
            value: [dayIndex, hourStart, hourEnd],
            label: item.text
        };
    });

    const option = {
        tooltip: {
            formatter: params => {
                const day = days[params.value[0]];
                const hourStart = params.value[1];
                const hourEnd = params.value[2];
                return `${params.name}<br>${day} ${hourStart}:00 - ${hourEnd}:00`;
            }
        },
        xAxis: {
            type: 'category',
            data: days,
            name: 'Day',
            boundaryGap: true
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 24,
            name: 'Hour'
        },
        grid: { containLabel: true, top: 50, bottom: 50, left: 50, right: 20 },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            start: 0,
            end: 100
        }],
        series: [{
            type: 'custom',
            renderItem: (params, api) => {
                const x = api.value(0);
                const yStart = api.value(1);
                const yEnd = api.value(2);
                const xCoord = api.coord([x, 0])[0];
                const yCoordStart = api.coord([0, yStart])[1];
                const yCoordEnd = api.coord([0, yEnd])[1];
                const barHeight = yCoordStart - yCoordEnd;

                return {
                    type: 'rect',
                    shape: {
                        x: xCoord - 20, // bar width
                        y: yCoordEnd,
                        width: 40,
                        height: barHeight
                    },
                    style: api.style({
                        fill: '#5470C6'
                    }),
                    children: [{
                        type: 'text',
                        style: {
                            text: api.value(2) > api.value(1) ? '' : api.value(3),
                            x: xCoord,
                            y: yCoordEnd + barHeight / 2,
                            fill: '#fff',
                            font: '12px sans-serif',
                            textAlign: 'center',
                            textVerticalAlign: 'middle'
                        }
                    }]
                };
            },
            encode: { x: 0, y: [1, 2] },
            data: seriesData
        }]
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
    setTimeout(() => myChart.resize(), 0);
}
