import { Chart, TimeScale, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

// Register required components, including Tooltip
Chart.register(
  TimeScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  zoomPlugin
);

// Plugin to display "No data to display" message on empty charts
const noDataPlugin = {
  id: 'noDataMessage',
  afterDraw(chart) {
    // Check if ALL data points are null
    const hasRealData = chart.data.datasets.some(ds =>
      ds.data.some(point => point.y !== null)
    );

    if (!hasRealData) {
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

export function createSensorChart(container, sensorGroup, startDate, endDate, cacheKey = null) {
  const key = cacheKey || sensorGroup.sensor_type;
  if (chartCache.has(key)) {
    return chartCache.get(key);
  }

  // Create the checkbox menu container
  const menuDiv = document.createElement('div');
  menuDiv.className = 'sensor-checkbox-menu';
  menuDiv.style.margin = '8px 0';

  // Prepare the datasets array
  const hasData = sensorGroup.datasets && sensorGroup.datasets.some(ds => ds.data && ds.data.length > 0);
  const datasets = hasData
    ? sensorGroup.datasets
    : [{
        label: 'No Data',
        data: [
          { x: startDate, y: null },
          { x: endDate, y: null }
        ],
        borderColor: '#ccc',
        pointRadius: 0,
        borderWidth: 0
      }];

  // Add a checkbox for each dataset (sensor)
  datasets.forEach((ds, idx) => {
    if (ds.label === 'No Data') return; // Skip dummy dataset
    const label = document.createElement('label');
    label.style.marginRight = '12px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.idx = idx;
    checkbox.style.marginRight = '4px';
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(ds.label));
    menuDiv.appendChild(label);
  });

  // Add the menu to the container
  container.appendChild(menuDiv);

  // Create the chart canvas
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

 // Create a button row
  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '12px';
  buttonRow.style.margin = '8px 0 24px 0';

  // Create Reset Zoom button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Zoom';

  // Create Download Graph button
  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Download Graph';

  // Append in order: Reset Zoom, then Download Graph
  buttonRow.appendChild(resetBtn);
  buttonRow.appendChild(downloadBtn);
  container.appendChild(buttonRow);

  // Create zoom options
  const zoomOptions = {
    pan: {
      enabled: true,
      mode: 'xy',
      modifierKey: null,
    },
    zoom: {
      drag: {
        enabled: false,
      },
      wheel: {
        enabled: true,
      },
      pinch: {
        enabled: true,
      },
      mode: 'xy',
    }
  };

  // Create the Chart.js chart
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          min: startDate,
          max: endDate,
          bounds: 'ticks',
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
          display: true,
          beginAtZero: true,
          title: {
            display: true,
            text: sensorGroup.unit
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            title: function(context) {
              if (!context || !context[0]) return '';
              const date = context[0].parsed?.x;
              return date ? `Date: ${formatDate(date)}` : '';
            },
            label: function(context) {
              if (!context) return '';
              const value = context.parsed?.y;
              const unit = context.dataset?.unit || sensorGroup.unit || '';
              return value !== undefined ? `Value: ${value} ${unit}` : '';
            },
            afterLabel: function(context) {
              if (!context || !context.dataset) return '';
              return `Sensor: ${context.dataset.label || ''}`;
            }
          }
        },
        zoom: zoomOptions
      }
    }
  });

  // Reset zoom on button click
  resetBtn.addEventListener('click', () => {
    chart.resetZoom();
  });

  // Checkbox logic: show/hide datasets
  Array.from(menuDiv.querySelectorAll('input[type=checkbox]')).forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const idx = parseInt(this.dataset.idx, 10);
      chart.setDatasetVisibility(idx, this.checked); // [4]
      chart.update();
    });
  });

  downloadBtn.addEventListener('click', () => {
    // Get chart image as base64
    const chartImage = chart.toBase64Image();

    // Prepare details
    const buildingName = (window.selectedFeature?.properties?.name || 'Building');
    const floor = (container.dataset.floor || 'Unknown Floor');
    const timeRange = (window.selectedTimeRange || 'Unknown Range');

    // Create a temporary canvas to add details
    const tempCanvas = document.createElement('canvas');
    const width = chart.width;
    const height = chart.height + 60; // Extra space for details
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');

    // Draw details at the top
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${buildingName} | Floor: ${floor} | Time Range: ${timeRange}`, 16, 28);

    // Draw chart image below the details
    const img = new window.Image();
    img.onload = function() {
      ctx.drawImage(img, 0, 40, width, chart.height);
      // Trigger download
      const link = document.createElement('a');
      link.href = tempCanvas.toDataURL('image/png');
      link.download = `${buildingName}_floor${floor}_${timeRange}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = chartImage;
  });

  chartCache.set(key, chart);
  return chart;
}


export function destroyCharts() {
  chartCache.forEach(chart => chart.destroy());
  chartCache.clear();
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
