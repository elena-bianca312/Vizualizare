// 2D Map

import markerIconDefault from '../assets/leaflets/images/marker-icon-grey.png';
import markerShadow from '../assets/leaflets/images/marker-shadow.png';
import markerIconRed from '../assets/leaflets/images/marker-icon-red.png';
import markerIconBlue from '../assets/leaflets/images/marker-icon-blue.png';
import markerIconGreen from '../assets/leaflets/images/marker-icon-green.png';
import markerIconViolet from '../assets/leaflets/images/marker-icon-violet.png';
import markerIconGold from '../assets/leaflets/images/marker-icon-gold.png';
import markerIconOrange from '../assets/leaflets/images/marker-icon-orange.png';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTimeRangeDates } from '../assets/utils/timeUtils.js';

const colorIcons = {
  red: markerIconRed,
  blue: markerIconBlue,
  green: markerIconGreen,
  gold: markerIconGold,
  orange: markerIconOrange,
  violet: markerIconViolet
};

document.addEventListener("DOMContentLoaded", function() {
  var sensorColors = {
    'temperature': 'red',
    'humidity': 'blue',
    'light': 'gold',
    'sound': 'violet',
    'motion': 'orange',
    'pressure': 'green'
  };

  L.Icon.Default.mergeOptions({
    iconUrl: markerIconDefault,
    shadowUrl: markerShadow
  });

  var map = L.map('map').setView([44.438822, 26.050477], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const heatmapCanvas = L.canvas({ padding: 0.5 });
  const heatmapLayer = L.layerGroup().addTo(map);

  var sensorLayerGroups = {};
  for (var sensorType in sensorColors) {
    sensorLayerGroups[sensorType] = L.layerGroup().addTo(map);
  }

  function getColoredIcon(color) {
    return new L.Icon({
      iconUrl: colorIcons[color] || markerIconDefault,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }

  function fetchMarkers(date, hour) {
    fetch(`/get_markers?date=${date}&hour=${hour}`)
      .then(response => response.json())
      .then(data => {
        // Clear all layer groups for sensor types
        for (var sensorType in sensorLayerGroups) {
          sensorLayerGroups[sensorType].clearLayers();
        }
        // Add each marker to its corresponding layer group based on sensor_type
        data.forEach(function(markerData) {
          var icon = markerData.color ? getColoredIcon(markerData.color) : undefined;
          var marker = L.marker([markerData.latitude, markerData.longitude], { icon: icon });
          marker.bindPopup(markerData.popup);
          var sensorType = markerData.sensor_type;
          if (sensorLayerGroups[sensorType]) {
            sensorLayerGroups[sensorType].addLayer(marker);
          } else {
            // If a sensor type is not defined, optionally create a generic group.
            if (!sensorLayerGroups['others']) {
              sensorLayerGroups['others'] = L.layerGroup().addTo(map);
            }
            sensorLayerGroups['others'].addLayer(marker);
          }
        });
        const mockSensors = [
  { latitude: 44.4356, longitude: 26.0472, value: 0.8 },
  { latitude: 44.4352, longitude: 26.0477, value: 0.6 },
  { latitude: 44.4350, longitude: 26.0471, value: 0.9 },
  { latitude: 44.4349, longitude: 26.0468, value: 0.7 },
  { latitude: 44.4351, longitude: 26.0473, value: 0.4 },
  { latitude: 44.4354, longitude: 26.0474, value: 0.5 },
  { latitude: 44.4355, longitude: 26.0470, value: 0.95 },
  { latitude: 44.4353, longitude: 26.0469, value: 0.3 },
  { latitude: 44.4348, longitude: 26.0476, value: 0.65 },
  { latitude: 44.4347, longitude: 26.0473, value: 0.2 },
  { latitude: 44.4358, longitude: 26.0476, value: 1.0 },
  { latitude: 44.4359, longitude: 26.0471, value: 0.85 },
  { latitude: 44.4351, longitude: 26.0479, value: 0.15 },
  { latitude: 44.4346, longitude: 26.0469, value: 0.1 },
  { latitude: 44.4345, longitude: 26.0475, value: 0.25 },
  { latitude: 44.4350, longitude: 26.0478, value: 0.55 },
  { latitude: 44.4356, longitude: 26.0468, value: 0.75 },
  { latitude: 44.4352, longitude: 26.0467, value: 0.35 },
  { latitude: 44.4353, longitude: 26.0475, value: 0.6 },
  { latitude: 44.4357, longitude: 26.0473, value: 0.45 }
];

        //renderHeatmap(mockSensors);
        renderHeatmap(data);
      })
      .catch(error => console.error('Error fetching markers:', error));
  }

  var datePicker = document.getElementById("date-picker");
  var hourSlider = document.getElementById("hour-slider");
  var hourDisplay = document.getElementById("hour-display");
  var resetButton = document.getElementById("reset-button");

  const today = new Date().toISOString().split("T")[0];
  datePicker.value = today;
  const defaultHour = hourSlider.value;
  hourDisplay.textContent = "${defaultHour}:00";

  function updateMarkers() {
    var selectedDate = datePicker.value;
    var selectedHour = hourSlider.value;
    hourDisplay.textContent = selectedHour + ":00";
    fetchMarkers(selectedDate, selectedHour);

    window.selectedDate = selectedDate;
    const { startDate, endDate } = getTimeRangeDates(window.selectedTimeRange || 'last_week', window.selectedDate);
    if (window.selectedBuilding && window.loadAndRenderSensorData) {
      window.loadAndRenderSensorData(
        window.selectedFeature,
        window.selectedTimeRange || 'last_week',
        window.selectedDate,
        startDate,
        endDate
      );
    }
  }

  datePicker.addEventListener("change", () => {
    updateMarkers();

    // Reset 3D legend checkboxes
    document.getElementById("show-all-sensors").checked = false;
    document.getElementById("toggle-outdoor").checked = true;
    document.querySelectorAll(".sensor-toggle-3d").forEach(input => input.checked = true);
    document.querySelectorAll(".sensor-type-toggle-3d").forEach(input => input.checked = true);

    document.getElementById("outdoor-types").style.display = 'block';

    document.getElementById("toggle-outdoor").disabled = false;
    const toggles = document.querySelectorAll('.sensor-toggle-3d, .sensor-type-toggle-3d');
    toggles.forEach(input => {
      input.disabled = false;
    });

    if (window.refreshThreeSpheres) {
      window.refreshThreeSpheres();
    }
  });

  document.getElementById("show-all-sensors").addEventListener("change", (e) => {
    const isChecked = e.target.checked;

    const toggles = document.querySelectorAll('.sensor-toggle-3d, .sensor-type-toggle-3d');
    toggles.forEach(input => {
      input.checked = true;
      input.disabled = isChecked;
    });

    // Toggle outdoor group visibility
    const outdoorToggle = document.getElementById("toggle-outdoor");
    outdoorToggle.checked = true;
    outdoorToggle.disabled = isChecked;
    document.getElementById("outdoor-types").style.display = 'block';

    if (window.refreshThreeSpheres) window.refreshThreeSpheres();
  });

  hourSlider.addEventListener("input", updateMarkers);

  resetButton.addEventListener("click", function() {
    datePicker.value = today;
    hourSlider.value = defaultHour;
    hourDisplay.textContent = "${defaultHour}:00";
    updateMarkers();
    map.setView([44.438822, 26.050477], 13);
  });

  var legendControl = L.control({ position: 'bottomright' });
  legendControl.onAdd = function(map) {
    var div = L.DomUtil.create('div', 'legend');
    div.innerHTML += "<strong>Legend</strong><br><form id='heatmap-radio-group'>";
    div.innerHTML += `
      <label>
        <input type="radio" name="heatmap-sensor" class="heat-radio" value="none" checked>
        <span style="opacity: 0.7;">(No heatmap)</span>
      </label><br>`;
    for (var sensorType in sensorColors) {
      div.innerHTML +=
        `<label>
           <input type="checkbox" class="sensor-toggle" data-sensor="${sensorType}" checked>
           <input type="radio" name="heatmap-sensor" class="heat-radio" value="${sensorType}">
           <img src="${colorIcons[sensorColors[sensorType]]}" width="12" height="20">
           ${sensorType}
         </label><br>`;
    }
    div.innerHTML += "</form>";
    return div;
  };
  legendControl.addTo(map);

  const colorbar = L.control({ position: 'bottomleft' });

  colorbar.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'heatmap-colorbar');
    div.innerHTML = `
      <div style="
        width: 200px;
        height: 15px;
        background: linear-gradient(to right,
          #0000ff 0%,
          #00ff00 50%,
          #ff0000 100%);
        border: 1px solid #aaa;
        margin-bottom: 2px;
      "></div>
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>Low</span><span>High</span>
      </div>
    `;
    return div;
  };

  colorbar.addTo(map);


  document.addEventListener("change", function(e) {
    if (e.target && e.target.classList.contains("sensor-toggle")) {
      var sensorType = e.target.getAttribute("data-sensor");
      if (e.target.checked) {
        map.addLayer(sensorLayerGroups[sensorType]);
      } else {
        map.removeLayer(sensorLayerGroups[sensorType]);
      }
    }
  });

  updateMarkers();

  let threeModule = null;

  import('./threeview.js').then(module => {
    threeModule = module;

    window.addEventListener('mapMoved', (e) => {
      const { center, zoom } = e.detail;
      const x = (center.lng - 26.050477) * 100000;
      const y = (center.lat - 44.438822) * 100000;
      if (module.controls) {
        module.controls.target.set(x, y, 0);
        module.controls.update();
      }
      if (module.crosshair && module.camera) {
        module.crosshair.position.set(x, y, 0);
        const cameraDistance = 500 - (zoom * 20);
        module.camera.position.set(x, y - cameraDistance, cameraDistance);
        module.camera.lookAt(x, y, 0);
      }
    });
  });

  document.getElementById('toggle-view').addEventListener('click', () => {
    const mapContainer = document.getElementById('mapContainer');
    const threeContainer = document.getElementById('threeContainer');
    const legend3D = document.getElementById('legend3D');
    const hourContainer = document.getElementById('hour-container');
    const is3D = threeContainer.style.pointerEvents === 'auto';

    const center = map.getCenter();
      const zoom = map.getZoom();

      window.currentMapCenter = center;
      window.currentMapZoom = zoom;

    if (is3D) {
      // Switch to 2D
      threeContainer.style.pointerEvents = 'none';
      threeContainer.style.visibility = 'hidden';

      mapContainer.style.pointerEvents = 'auto';
      mapContainer.style.visibility = 'visible';

      map.invalidateSize();

      hourContainer.style.display = 'block';
      if (legend3D) legend3D.style.display = 'none';
    } else {
      // Switch to 3D
      threeContainer.style.pointerEvents = 'auto';
      threeContainer.style.visibility = 'visible';

      mapContainer.style.pointerEvents = 'none';
      mapContainer.style.visibility = 'hidden';
      threeModule.initThreeScene();
      window.threeLoaded = true;

      hourContainer.style.display = 'none';
      if (legend3D) legend3D.style.display = 'block';
    }
  });

  map.on('move', () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    window.currentMapCenter = center;
    window.currentMapZoom = zoom;

    const event = new CustomEvent('mapMoved', {
      detail: { center, zoom }
    });
    window.dispatchEvent(event);
  });

  function renderHeatmap(sensorData) {
    // Remove previous canvas if exists
    const existing = document.getElementById('heatmap-canvas');
    if (existing) existing.remove();

    const resizeAndDraw = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const seen = new Set();
      sensorData.forEach(d => {
        if (d.sensor_type !== selectedType) return;
        const key = `${d.latitude},${d.longitude},${d.sensor_type}`;
      if (seen.has(key)) return;
      seen.add(key);

      const point = map.latLngToContainerPoint([d.latitude, d.longitude]);
      drawHeatPoint(ctx, point.x, point.y, d.value);
      });
    };

    map.off('zoomend', resizeAndDraw);
    map.off('moveend', resizeAndDraw);
    map.off('resize', resizeAndDraw);

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.id = 'heatmap-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = 400; // Above tile layer
    document.getElementById('map').appendChild(canvas);

    const selectedType = document.querySelector('input[name="heatmap-sensor"]:checked')?.value;

    map.on('zoomend moveend resize', resizeAndDraw);
    resizeAndDraw();
  }




  function drawHeatPoint(ctx, x, y, intensity) {
    const rgbColor = getHeatmapColor(intensity);
    const radius = 30;
    const alpha = 0.4; // adjust transparency here
    ctx.globalCompositeOperation = "lighter";
    const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grd.addColorStop(0, `rgba(${rgbColor}, ${alpha})`);
    grd.addColorStop(1, `rgba(${rgbColor}, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    console.log('draw:', { intensity, rgbColor });
    ctx.fill();
  }

  function getHeatmapColor(intensity) {
    intensity = Math.max(0, Math.min(1, intensity));

    const stops = [
      { r: 0, g: 0, b: 255 },   // blue
      { r: 0, g: 255, b: 0 }, // green
      { r: 255, g: 0, b: 0 }    // red
    ];

    const numStops = stops.length - 1;
    const scaled = intensity * numStops;
    const i = Math.floor(scaled);
    const t = scaled - i;

    const c1 = stops[i];
    const c2 = stops[i + 1] || c1;

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `${r},${g},${b}`;
  }

  document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('heat-radio')) {
      updateMarkers();
    }
  });
});
