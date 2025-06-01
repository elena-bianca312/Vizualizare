// Store preferred ranges per building
const buildingRanges = JSON.parse(localStorage.getItem('buildingRanges') || '{}');

export const SENSOR_TYPE_DEFAULTS = {
  temperature: { min: 15, max: 50, color: 'red', unit: 'Celsius' },
  humidity: { min: 30, max: 60, color: 'blue', unit: 'Percent' },
  light: { min: 100, max: 1000, color: 'gold', unit: 'Lux' },
  sound: { min: 20, max: 85, color: 'violet', unit: 'dB' },
  pressure: { min: 950, max: 1050, color: 'green', unit: 'hPa' }
};

const getBuildingKey = (feature) => feature?.properties?.id || 'default';

export function getPreferredRanges(feature) {
  const key = getBuildingKey(feature);
  return buildingRanges[key] || {...SENSOR_TYPE_DEFAULTS};
}

function savePreferredRanges(feature, ranges) {
  const key = getBuildingKey(feature);
  buildingRanges[key] = ranges;
  localStorage.setItem('buildingRanges', JSON.stringify(buildingRanges));
}

// --- LEFT SIDE BUTTON ---
export function createSensorRangesMenuButton(feature) {
  let btn = document.getElementById('sensor-type-ranges-btn');
  if (btn) btn.remove();

  btn = document.createElement('button');
  btn.id = 'sensor-type-ranges-btn';
  btn.textContent = 'Sensor Type Ranges';
  btn.style.position = 'fixed';
  btn.style.left = '10px';
  btn.style.top = '30px';
  btn.style.zIndex = '2100';
  btn.style.padding = '10px 16px';
  btn.style.background = '#222';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.onclick = () => showSensorTypeRangesMenu(feature);
  document.body.appendChild(btn);
}

// --- LEFT SIDE MENU ---
export function showSensorTypeRangesMenu(feature) {
  let menu = document.getElementById('sensor-type-ranges-menu');
  if (menu) menu.remove();

  menu = document.createElement('div');
  menu.id = 'sensor-type-ranges-menu';
  menu.style.position = 'fixed';
  menu.style.left = '10px';
  menu.style.top = '80px';
  menu.style.width = '340px';
  menu.style.background = '#fff';
  menu.style.border = '1px solid #aaa';
  menu.style.borderRadius = '6px';
  menu.style.boxShadow = '2px 4px 20px rgba(0,0,0,0.15)';
  menu.style.zIndex = '2101';
  menu.style.padding = '20px 18px 12px 18px';
  menu.style.fontFamily = 'sans-serif';

  const currentRanges = getPreferredRanges(feature);

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;">
    <h3 style="margin:0 0 10px 0;">Sensor Ranges for ${feature.properties?.name || 'Building'}</h3>
    <button style="border:none;background:#eee;padding:4px 10px;border-radius:3px;cursor:pointer;" onclick="document.getElementById('sensor-type-ranges-menu').remove()">Close</button>
  </div>
  <form id="sensor-type-ranges-form">
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:4px;">Type</th>
        <th style="text-align:left;padding:4px;">Min</th>
        <th style="text-align:left;padding:4px;">Max</th>
        <th style="text-align:left;padding:4px;">Unit</th>
      </tr>
    </thead>
    <tbody>`;

  Object.entries(SENSOR_TYPE_DEFAULTS).forEach(([type, defaults]) => {
    const { min, max, unit, color } = currentRanges[type] || defaults;
    html += `<tr>
      <td style="color:${color};font-weight:bold;padding:4px;">${type.charAt(0).toUpperCase() + type.slice(1)}</td>
      <td style="padding:4px;">
        <input type="number" step="any" name="min-${type}" value="${min}" style="width:60px;">
      </td>
      <td style="padding:4px;">
        <input type="number" step="any" name="max-${type}" value="${max}" style="width:60px;">
      </td>
      <td style="padding:4px;">${unit}</td>
    </tr>`;
  });

  html += `</tbody></table>
    <div style="text-align:right;margin-top:10px;">
      <button type="submit" style="padding:6px 18px;border-radius:4px;background:#222;color:#fff;border:none;cursor:pointer;">Save</button>
    </div>
  </form>`;

  menu.innerHTML = html;
  document.body.appendChild(menu);

  document.getElementById('sensor-type-ranges-form').onsubmit = function(e) {
    e.preventDefault();
    const newRanges = {...SENSOR_TYPE_DEFAULTS};
    Object.keys(SENSOR_TYPE_DEFAULTS).forEach(type => {
      newRanges[type] = {
        ...SENSOR_TYPE_DEFAULTS[type],
        min: parseFloat(menu.querySelector(`[name="min-${type}"]`).value),
        max: parseFloat(menu.querySelector(`[name="max-${type}"]`).value)
      };
    });
    savePreferredRanges(feature, newRanges);
    menu.remove();
    if (window.selectedFeature) checkSensorTypeNotifications(window.selectedFeature, window.lastSensorReadings || []);
  };
};

// --- NOTIFICATIONS ---
export function checkSensorTypeNotifications(feature, sensorReadings) {
  const ranges = getPreferredRanges(feature);
  sensorReadings.forEach(reading => {
    const cfg = ranges[reading.sensor_type];
    if (!cfg) return;
    const value = parseFloat(reading.value);
    if (value < cfg.min || value > cfg.max) {
      showSensorTypeNotification(reading, cfg);
    }
  });
}

function showSensorTypeNotification(reading, cfg) {
  const notif = document.createElement('div');
  notif.textContent = `Sensor ${reading.device_id} exceeded ${reading.value > cfg.max ? 'max' : 'min'} ${reading.sensor_type} (${cfg.min}-${cfg.max} ${cfg.unit}) at ${reading.timestamp}`;
  notif.style.position = 'fixed';
  notif.style.right = '30px';
  notif.style.bottom = '30px';
  notif.style.background = cfg.color;
  notif.style.color = '#fff';
  notif.style.padding = '12px 18px';
  notif.style.borderRadius = '6px';
  notif.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  notif.style.fontWeight = 'bold';
  notif.style.zIndex = '3000';
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 6000);
}

// --- CLEANUP ---
export function removeSensorRangesMenu() {
  const menu = document.getElementById('sensor-type-ranges-menu');
  if (menu) menu.remove();
  const btn = document.getElementById('sensor-type-ranges-btn');
  if (btn) btn.remove();
}
