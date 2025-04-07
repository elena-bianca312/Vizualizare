import markerIconDefault from './assets/leaflets/images/marker-icon.png';
import markerShadow from './assets/leaflets/images/marker-shadow.png';
import markerIconRed from './assets/leaflets/images/marker-icon-red.png';
import markerIconBlue from './assets/leaflets/images/marker-icon-blue.png';
import markerIconGreen from './assets/leaflets/images/marker-icon-green.png';
import markerIconViolet from './assets/leaflets/images/marker-icon-violet.png';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const colorIcons = {
  red: markerIconRed,
  blue: markerIconBlue,
  green: markerIconGreen,
  violet: markerIconViolet
};

document.addEventListener("DOMContentLoaded", function() {
  var sensorColors = {
    'temperature': 'red',
    'humidity': 'blue',
    'air_quality': 'green',
    'wind_speed': 'violet'
  };

  L.Icon.Default.mergeOptions({
    iconUrl: markerIconDefault,
    shadowUrl: markerShadow
  });

  var map = L.map('map').setView([44.4349638, 26.045184], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

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
          var marker = L.marker([markerData.lat, markerData.lon], { icon: icon });
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
  }

  datePicker.addEventListener("change", updateMarkers);
  hourSlider.addEventListener("input", updateMarkers);

  resetButton.addEventListener("click", function() {
    datePicker.value = today;
    hourSlider.value = defaultHour;
    hourDisplay.textContent = "${defaultHour}:00";
    updateMarkers();
    map.setView([44.4268, 26.1025], 13);
  });

  var legendControl = L.control({ position: 'bottomright' });
  legendControl.onAdd = function(map) {
    var div = L.DomUtil.create('div', 'legend');
    div.innerHTML += "<strong>Legend</strong><br>";
    for (var sensorType in sensorColors) {
      div.innerHTML +=
        `<label>
           <input type="checkbox" class="sensor-toggle" data-sensor="${sensorType}" checked>
           <img src="${colorIcons[sensorColors[sensorType]]}" width="12" height="20">
           ${sensorType}
         </label><br>`;
    }
    return div;
  };
  legendControl.addTo(map);

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
      const x = (center.lng - 26.045184) * 100000;
      const y = (center.lat - 44.4349638) * 100000;
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

  document.getElementById("toggle-view").addEventListener("click", () => {
    const center = map.getCenter();
    const zoom = map.getZoom();

    window.currentMapCenter = center;
    window.currentMapZoom = zoom;

    const mapDiv = document.getElementById("mapContainer");
    const threeDiv = document.getElementById("threeContainer");

    if (mapDiv.style.display === "none") {
      mapDiv.style.display = "block";
      threeDiv.style.display = "none";
    } else {
      mapDiv.style.display = "none";
      threeDiv.style.display = "block";
      //if (!window.threeLoaded) {
        threeModule.initThreeScene();
        window.threeLoaded = true;
      //}
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


});
