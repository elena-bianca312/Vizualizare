import { Chart, TimeScale, LinearScale, LineController, LineElement, PointElement } from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register required components
Chart.register(
  TimeScale,        // For time axis
  LinearScale,      // For Y-axis
  LineController,   // For line charts
  LineElement,      // For line elements
  PointElement      // For data points
);

const chartCache = new Map();

export function createSensorChart(container, sensor) {
  if (chartCache.has(sensor.sensor_id)) {
    return chartCache.get(sensor.sensor_id);
  }

  const canvas = document.createElement('canvas');
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
          time: {
            unit: 'hour',
            tooltipFormat: 'HH:mm',
            displayFormats: { hour: 'HH:mm' }
          }
        }
      }
    }
  });

  chartCache.set(sensor.sensor_id, chart);
  return chart;
}


function buildChartData(sensor) {
  return {
    labels: sensor.timestamps,
    datasets: [{
      label: `${sensor.sensor_type} (${sensor.unit})`,
      data: sensor.values,
      borderColor: getSensorColor(sensor.sensor_type),
      tension: 0.1
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