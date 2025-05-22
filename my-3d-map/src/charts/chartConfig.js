import { formatDate } from './chartUtils.js';

export function getChartOptions(sensorGroup, startDate, endDate, zoomOptions) {
  return {
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
  };
}
