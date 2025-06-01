import { Chart, TimeScale, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';
import { noDataPlugin } from './chartPlugins.js';
import { getChartOptions } from './chartConfig.js';
import { createButton, createButtonRow, createCheckboxMenu, wrapCanvasText, fitToRange } from './chartUtils.js';

Chart.register(TimeScale, LinearScale, LineController, LineElement, PointElement, Tooltip, zoomPlugin, noDataPlugin);

const chartCache = new Map();

export function createSensorChart(container, sensorGroup, startDate, endDate, cacheKey = null) {
  const key = cacheKey || sensorGroup.sensor_type;
  if (chartCache.has(key)) return chartCache.get(key);

  // Prepare datasets
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

  // Checkbox menu
  const menuDiv = createCheckboxMenu(datasets, function() {
    const idx = parseInt(this.dataset.idx, 10);
    chart.setDatasetVisibility(idx, this.checked);
    chart.update();
  });
  container.appendChild(menuDiv);

  // Chart canvas
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  // Zoom options
  const zoomOptions = {
    pan: { enabled: true, mode: 'xy', modifierKey: null },
    zoom: {
      drag: { enabled: false },
      wheel: { enabled: true },
      pinch: { enabled: true },
      mode: 'xy'
    }
  };

  // Chart.js chart
  const chart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: getChartOptions(sensorGroup, startDate, endDate, zoomOptions)
  });

  // Fit to range button
  const fitBtn = createButton('Fit to range', () => fitToRange(chart));
  container.appendChild(fitBtn);

  // Buttons
  const resetBtn = createButton('Reset Zoom', () => chart.resetZoom());
  const downloadBtn = createButton('Download Graph', () => {
    const chartImage = chart.toBase64Image();
    const buildingName = (window.selectedFeature?.properties?.name || 'Building');
    const sensorName = sensorGroup.sensor_type || 'Sensor';
    const tempCanvas = document.createElement('canvas');
    const width = chart.width;
    const height = chart.height + 60;
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#000';
    const title = `${buildingName} - ${sensorName}`;
    const yAfterTitle = wrapCanvasText(ctx, title, 16, 28, width - 2 * 16, 22);
    const img = new window.Image();
    img.onload = function() {
        ctx.drawImage(img, 0, yAfterTitle, width, chart.height);
        const link = document.createElement('a');
        link.href = tempCanvas.toDataURL('image/png');
        link.download = `${buildingName}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    img.src = chartImage;
  });

  const buttonRow = createButtonRow(resetBtn, downloadBtn);
  container.appendChild(buttonRow);

  chartCache.set(key, chart);
  return chart;
}

function onFitToRange() {
  // Get visible dataset indices
  const visibleIndices = chart.data.datasets
    .map((ds, i) => chart.isDatasetVisible(i) ? i : null)
    .filter(i => i !== null);

  let minX = null, maxX = null;
  visibleIndices.forEach(idx => {
    const data = chart.data.datasets[idx].data;
    data.forEach(point => {
      const x = (point.x instanceof Date) ? point.x : new Date(point.x);
      if (!isNaN(x)) {
        if (minX === null || x < minX) minX = x;
        if (maxX === null || x > maxX) maxX = x;
      }
    });
  });

  if (!minX || !maxX) {
    fitRangeDisplay.textContent = 'No data in selected sensors';
    return;
  }

  // Format as YYYY-MM-DD
  const minDateStr = minX.toISOString().split('T')[0];
  const maxDateStr = maxX.toISOString().split('T')[0];

  // Set the date pickers
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  if (startInput && endInput) {
    startInput.value = minDateStr;
    endInput.value = maxDateStr;
  }

  // Show the selected range
  fitRangeDisplay.textContent = `Range: ${minDateStr} to ${maxDateStr}`;

  // Reload the chart with the new range
  if (window.selectedBuilding && window.loadAndRenderSensorData) {
    const startDate = new Date(minDateStr);
    const endDate = new Date(maxDateStr);
    endDate.setHours(23, 59, 59, 999);
    window.loadAndRenderSensorData(
      window.selectedFeature,
      'custom',
      window.selectedDate,
      startDate,
      endDate
    );
  }
}

export function destroyCharts() {
  chartCache.forEach(chart => chart.destroy());
  chartCache.clear();
}
