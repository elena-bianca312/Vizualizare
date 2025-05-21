import { Chart, TimeScale, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register required components, including Tooltip
Chart.register(
  TimeScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip // Explicitly register Tooltip
);

// Plugin to display "No data to display" message on empty charts
const noDataPlugin = {
  id: 'noDataMessage',
  afterDraw(chart) {
    const hasData = chart.data.datasets.some(ds => ds.data && ds.data.length > 0);
    if (!hasData) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#888';
      ctx.fillText('No data to display', width / 2, height / 2);
      ctx.restore();
    }
  }
};

Chart.register(noDataPlugin);

const chartCache = new Map();

export function createSensorChart(container, sensor, startDate, endDate) {
  if (chartCache.has(sensor.sensor_id)) {
    return chartCache.get(sensor.sensor_id);
  }

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const chart = new Chart(canvas, {
    type: 'line',
    data: buildChartData(sensor),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          min: startDate,
          max: endDate,
          time: {
            unit: 'day',
            tooltipFormat: 'dd.MM.yyyy HH:mm',
            displayFormats: {
              day: 'dd.MM',
              hour: 'dd.MM HH:mm',
              minute: 'HH:mm'
            }
          },
          title: {
            display: true,
            text: 'Date'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: sensor.unit
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            title: function(context) {
              const date = context[0].parsed.x;
              return `Date: ${formatDate(date)}`;
            },
            label: function(context) {
              const value = context.parsed.y;
              return `Value: ${value} ${sensor.unit}`;
            },
            afterLabel: function(context) {
              return [
                `Sensor: ${sensor.sensor_type}`,
                `ID: ${sensor.sensor_id}`
              ];
            }
          }
        }
      }
    }
  });

  chartCache.set(sensor.sensor_id, chart);
  return chart;
}

function buildChartData(sensor) {
  // sensor.data should be an array of { x: Date, y: value }
  return {
    datasets: [{
      label: `${sensor.sensor_type} (${sensor.unit})`,
      data: sensor.data || [],
      borderColor: getSensorColor(sensor.sensor_type),
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };
}

export function destroyCharts() {
  chartCache.forEach(chart => chart.destroy());
  chartCache.clear();
}

function getSensorColor(type) {
  const colors = {
    'Temperature': '#FF6384',
    'Humidity': '#36A2EB',
    'Air Quality': '#4BC0C0',
    'Noise': '#FFCE56',
    'Light': '#9966FF'
  };
  return colors[type] || '#CCCCCC';
}

// Helper for tooltip date formatting
function formatDate(date) {
  const d = new Date(date);
  // Format as dd.MM.yyyy HH:mm
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
}
