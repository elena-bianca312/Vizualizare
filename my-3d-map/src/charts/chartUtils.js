// Helper for tooltip date formatting
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).replace(',', '');
}

// Create a button with text and optional click handler
export function createButton(text, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

// Create a flex row for buttons
export function createButtonRow(...buttons) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '12px';
  row.style.margin = '8px 0 24px 0';
  buttons.forEach(btn => row.appendChild(btn));
  return row;
}

// Create a checkbox menu for datasets
export function createCheckboxMenu(datasets, onChange) {
  const menuDiv = document.createElement('div');
  menuDiv.className = 'sensor-checkbox-menu';
  menuDiv.style.margin = '8px 0';
  datasets.forEach((ds, idx) => {
    if (ds.label === 'No Data') return;
    const label = document.createElement('label');
    label.style.marginRight = '12px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.idx = idx;
    checkbox.style.marginRight = '4px';
    checkbox.addEventListener('change', onChange);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(ds.label));
    menuDiv.appendChild(label);
  });
  return menuDiv;
}

export function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currY);
      line = words[n] + ' ';
      currY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currY);
  return currY + lineHeight;
}

export function fitToRange(chart) {
  // Only use currently visible datasets
  const visibleIndices = chart.data.datasets
    .map((_index, i) => chart.isDatasetVisible(i) ? i : null)
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

  if (typeof chart.zoomScale === 'function') {
    chart.zoomScale('x', { min: minX, max: maxX });
  } else if (chart.options.scales && chart.options.scales.x) {
    chart.options.scales.x.min = minX;
    chart.options.scales.x.max = maxX;
    chart.update();
  }
}
