// Core menu container for building details

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Group } from "@tweenjs/tween.js";
import {clearSelectedBuilding, selectedBuilding} from "./buildingInteraction.js";
import { createFloorTabs, createFloorSections, initializeFloorNavigation } from './floorManager.js';
import { createSensorChart, destroyCharts } from "../charts/createSensorChart.js";
import { restoreOriginalCamera } from "../views/threeview.js";
import { filterSensorDataByTimeRange, getTimeRangeDates } from "../assets/utils/timeUtils.js";
import { destroyChartsForOtherFloors } from "../charts/chartUtils.js";
// For animation handling
const detailTweenGroup = new Group();

// Module state
let detailContainer;
let detailScene, detailCamera, detailRenderer, detailControls;
let currentDetailBuilding = null;
let floorPlanes = [];

/**
 * Initialize the detail view container and THREE.js scene
 */
export function initBuildingDetailView() {
  if (!document.getElementById('building-detail-view')) {
    // Main container
    detailContainer = document.createElement('div');
    detailContainer.id = 'building-detail-view';
    detailContainer.style.position = 'fixed';
    detailContainer.style.top = '0';
    detailContainer.style.right = '0';
    detailContainer.style.width = '50%';
    detailContainer.style.height = '100%';
    detailContainer.style.backgroundColor = 'rgba(245, 245, 245, 0.95)';
    detailContainer.style.boxShadow = '-5px 0 15px rgba(0, 0, 0, 0.2)';
    detailContainer.style.zIndex = '1000';
    detailContainer.style.display = 'none';
    detailContainer.style.flexDirection = 'column';

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.zIndex = '1001';
    closeButton.style.padding = '8px 12px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', closeDetailView);
    detailContainer.appendChild(closeButton);

    // Building info panel
    const infoPanel = document.createElement('div');
    infoPanel.id = 'building-detail-info';
    infoPanel.style.padding = '20px';
    infoPanel.style.flex = '1 1 0';
    infoPanel.style.minHeight = '0';
    infoPanel.style.display = 'flex';
    infoPanel.style.flexDirection = 'column';
    detailContainer.appendChild(infoPanel);

    document.body.appendChild(detailContainer);

    // Create canvas for THREE.js
    const canvas = document.createElement('canvas');
    canvas.id = 'detail-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    viewContainer.appendChild(canvas);

    // Set up THREE.js scene
    setupDetailScene();
  }
}

/**
 * Set up the THREE.js scene for detailed building view
 */
function setupDetailScene() {
  detailScene = new THREE.Scene();
  detailScene.background = new THREE.Color(0xf5f5f5);

  // Camera
  detailCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / 2 / window.innerHeight,
    0.1,
    1000
  );
  detailCamera.position.set(0, 0, 50);

  // Renderer
  detailRenderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('detail-canvas'),
    antialias: true
  });
  detailRenderer.setSize(detailContainer.clientWidth, detailContainer.clientHeight);
  detailRenderer.setPixelRatio(window.devicePixelRatio);

  // Controls
  detailControls = new OrbitControls(detailCamera, detailRenderer.domElement);
  detailControls.enableDamping = true;
  detailControls.dampingFactor = 0.25;

  // Lighting
  detailScene.add(new THREE.AmbientLight(0xaaaaaa));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  detailScene.add(directionalLight);
  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(-1, 0.5, -1);
  detailScene.add(backLight);

  // Start animation loop
  animate();

  // Window resize handler
  window.addEventListener('resize', onDetailWindowResize);
}

/**
 * Animation loop for detail view
 */
function animate() {
  requestAnimationFrame(animate);

  if (detailContainer && detailContainer.style.display !== 'none') {
    detailControls.update();
    detailTweenGroup.update();
    detailRenderer.render(detailScene, detailCamera);
  }
}

/**
 * Handle window resize for detail view
 */
function onDetailWindowResize() {
  if (detailContainer && detailContainer.style.display !== 'none') {
    detailCamera.aspect = detailContainer.clientWidth / detailContainer.clientHeight;
    detailCamera.updateProjectionMatrix();
    detailRenderer.setSize(detailContainer.clientWidth, detailContainer.clientHeight);
  }
}

/**
 * Show detailed view of a building
 * @param {THREE.Mesh} building - The building mesh to display
 * @param {Object} feature - GeoJSON feature data
 */
export function showBuildingDetailView(building, feature) {
  window.selectedBuilding = building;
  window.selectedFeature = feature;
  window.selectedTimeRange = 'last_week';
  // Display the container
  detailContainer.style.display = 'flex';

  // Update info panel
  updateDetailInfo(feature);
}


/**
 * Update information panel with building details and sensor charts
 * @param {Object} feature - GeoJSON feature data
 */
function updateDetailInfo(feature) {
  const infoPanel = document.getElementById('building-detail-info');
  // Get properties from feature
  const name = feature.properties.name || 'Unnamed Building';
  const levels = feature.properties["building:levels"] || 1;
  const buildingType = feature.properties.building || 'General';
  const address = feature.properties.addr?.street || 'No address available';

  // Clear previous charts
  destroyCharts();

  // Basic building info
  infoPanel.innerHTML = `
    <div class="menu-header">
      <h2>Sensor Data - <span id="time-range-display">Last Week</span></h2>
      <label for="time-range-select">Show:</label>
      <select id="time-range-select">
        <option value="last_week">Last Week</option>
        <option value="last_month">Last Month</option>
        <option value="last_3_months">Last 3 Months</option>
        <option value="last_year">Last Year</option>
      </select>
    </div>
    <h2>${name}</h2>
    <div class="building-details">
      <div class="detail-row">
        <span class="detail-label">Type:</span>
        <span class="detail-value">${buildingType}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Floors:</span>
        <span class="detail-value">${levels}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Address:</span>
        <span class="detail-value">${address}</span>
      </div>
    </div>
    
    <div class="floor-container">
      ${createFloorTabs(levels)}
      ${createFloorSections(levels)}
    </div>
  `;

  // After setting infoPanel.innerHTML ...
  const scrollContainer = document.createElement('div');
  scrollContainer.id = 'charts-scroll-container';
  scrollContainer.style.flex = '1 1 0';
  scrollContainer.style.overflowY = 'auto';
  scrollContainer.style.maxHeight = '60vh';
  scrollContainer.style.marginTop = '16px';

  // Move all floor chart containers into this scroll container
  for (let i = 1; i <= levels; i++) {
    const floorDiv = document.getElementById(`charts-floor-${i}`);
    if (floorDiv) {
      scrollContainer.appendChild(floorDiv);
    }
  }

  const spacer = document.createElement('div');
  spacer.style.height = '1000px';
  spacer.style.width = '100%';
  scrollContainer.appendChild(spacer);

  // Append the scroll container to the info panel
  infoPanel.appendChild(scrollContainer);

  document.getElementById('time-range-select').addEventListener('change', function() {
  window.selectedTimeRange = this.value;
  document.getElementById('time-range-display').textContent = {
    last_week: 'Last Week',
    last_month: 'Last Month',
    last_3_months: 'Last 3 Months',
    last_year: 'Last Year'
    }[window.selectedTimeRange];
    if (window.selectedBuilding && window.loadAndRenderSensorData) {
      const { startDate, endDate } = getTimeRangeDates(window.selectedTimeRange, window.selectedDate);
      window.loadAndRenderSensorData(
        window.selectedFeature,
        window.selectedTimeRange || 'last_week',
        window.selectedDate,
        startDate,
        endDate
      );
    }
  });

  initializeFloorNavigation();
  const { startDate, endDate } = getTimeRangeDates(window.selectedTimeRange || 'last_week', window.selectedDate);
  loadAndRenderSensorData(
    window.selectedFeature,
    window.selectedTimeRange || 'last_week',
    window.selectedDate,
    startDate,
    endDate
  );
}


function loadAndRenderSensorData(feature, timeRange, referenceDate, startDate, endDate) {
  try {
    destroyCharts(); // This should destroy all charts globally if needed

    const levels = feature.properties["building:levels"] || 1;
    let sensors = selectedBuilding.userData.indoorSensors.flatMap(entry =>
        entry.readings.map(reading => ({
          ...reading,
          sensor_id: entry.sensor_id
        }))
    );
    sensors = filterSensorDataByTimeRange(sensors, timeRange, referenceDate);

    // Get selected floor
    const activeTab = document.querySelector('.floor-tab.active');
    if (!activeTab) return;
    const selectedFloor = activeTab.dataset.floor;

    // Destroy charts for other floors and clear their containers
    destroyChartsForOtherFloors(selectedFloor, levels);

    // Now render only for the selected floor
    const sensorsByFloor = sensors.reduce((acc, sensor) => {
      let floor = sensor.Floor;
      if (floor === undefined || floor === null || floor === '') {
        floor = 'unknown';
      } else {
        floor = parseInt(floor, 10).toString();
      }
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(sensor);
      return acc;
    }, {});

    const container = document.getElementById(`charts-floor-${selectedFloor}`);
    if (container) {
      container.innerHTML = '';
      window.floorCharts[selectedFloor] = []; // Reset chart refs for this floor

      const floorSensors = sensorsByFloor[selectedFloor] || [];
      if (floorSensors.length === 0) {
        const chart = createSensorChart(container, {
          sensor_type: 'No Data',
          unit: '',
          datasets: []
        }, startDate, endDate, `NoData_${selectedFloor}`);
        window.floorCharts[selectedFloor].push(chart);
      } else {
        // Group by sensor_type, then by sensor_id
        const sensorsByType = floorSensors.reduce((acc, reading) => {
          const type = reading.sensor_type;
          if (!acc[type]) acc[type] = {};
          const id = reading.sensor_id;
          if (!acc[type][id]) {
            acc[type][id] = {
              sensor_id: id,
              sensor_type: type,
              unit: reading.unit,
              data: []
            };
          }
          const timestamp = new Date(reading.timestamp);
          const value = parseFloat(reading.value);
          if (!isNaN(timestamp) && !isNaN(value)) {
            acc[type][id].data.push({ x: timestamp, y: value });
          }
          return acc;
        }, {});

        Object.entries(sensorsByType).forEach(([sensor_type, sensorsOfType]) => {
          const colorPalette = ['#FF6384', '#36A2EB', '#4BC0C0', '#FFCE56', '#9966FF', '#888888'];
          let colorIndex = 0;
          const datasets = Object.values(sensorsOfType).map(sensor => ({
            label: sensor.sensor_id,
            data: sensor.data.sort((a, b) => a.x - b.x),
            borderColor: colorPalette[colorIndex++ % colorPalette.length],
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6,
            unit: sensor.unit,
          }));

          const chart = createSensorChart(container, {
            sensor_type,
            unit: datasets[0]?.unit || '',
            datasets
          }, startDate, endDate, `${sensor_type}_${selectedFloor}`);
          window.floorCharts[selectedFloor].push(chart);
        });
      }
    }
  } catch (error) {
    console.error('Failed to load sensor data:', error);
    document.querySelectorAll('.chart-container').forEach(container => {
      container.innerHTML = '<div class="error-message">Error loading data</div>';
    });
  }
}




// Make this function globally accessible for map.js
window.loadAndRenderSensorData = loadAndRenderSensorData;
window.floorCharts = {};

/**
 * Close the detail view
 */
function closeDetailView() {
  // Immediate hide for better UX
  detailContainer.style.display = 'none';
  clearSelectedBuilding();

  // Cleanup 3D objects
  if (currentDetailBuilding) {
    detailScene.remove(currentDetailBuilding);
    floorPlanes.forEach(plane => detailScene.remove(plane));
    floorPlanes = [];
    currentDetailBuilding = null;
  }

  // Destroy all charts
  destroyCharts();
  window.selectedTimeRange = 'last_week';

  // Reset camera position for next open
  detailCamera.position.set(0, 0, 50);
  detailControls.target.set(0, 0, 0);
  detailControls.update();
  restoreOriginalCamera();
}
