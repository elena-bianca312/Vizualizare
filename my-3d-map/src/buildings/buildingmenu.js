// Core menu container for building details

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Group } from "@tweenjs/tween.js";
import {clearSelectedBuilding, selectedBuilding} from "./buildingInteraction.js";
import { createFloorTabs, createFloorSections, initializeFloorNavigation } from './floorManager.js';
import { createSensorChart, destroyCharts } from "../charts/createSensorChart.js";
import { restoreOriginalCamera } from "../views/threeview.js";
import { filterSensorDataByTimeRange } from "../assets/utils/timeUtils.js";
import { createSensorTypeDropdown } from "../sensors/sensorTypeDropdown.js";
import { createSensorRangesMenuButton, checkSensorTypeNotifications, removeSensorRangesMenu } from "../notifications/sensorRangesMenu.js";

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
  const name = feature.properties.name || 'Unnamed Building';
  const levels = feature.properties["building:levels"] || 1;
  const buildingType = feature.properties.building || 'General';
  const isOutdoor = selectedBuilding.userData.group === 'outdoor';

  destroyCharts();

  // Calculate default date range (last week from the reference date)
  const defaultEndDate = window.selectedDate ? new Date(window.selectedDate) : new Date();
  const defaultStartDate = new Date(defaultEndDate);
  defaultStartDate.setDate(defaultStartDate.getDate() - 6);
  defaultEndDate.setHours(23, 59, 59, 999);

  // Gather all unique sensor types
  let allSensors = [];
  if (selectedBuilding.userData.group === 'in') {
    allSensors = selectedBuilding.userData.indoorSensors.flatMap(entry =>
      entry.readings.map(reading => reading.sensor_type)
    );
  } else if (selectedBuilding.userData.group === 'outdoor') {
    allSensors = selectedBuilding.userData.allReadings.map(reading => reading.sensor_type);
  }
  const uniqueSensorTypes = Array.from(new Set(allSensors)).sort();

  // Create the sensor type dropdown (returns {html, init})
  const sensorDropdown = createSensorTypeDropdown(uniqueSensorTypes, (selectedTypes) => {
    window.selectedSensorTypes = selectedTypes;
    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    endDate.setHours(23, 59, 59, 999);
    window.loadAndRenderSensorData(
      window.selectedFeature,
      'custom',
      window.selectedDate,
      startDate,
      endDate
    );
  });

  // Info panel HTML
  infoPanel.innerHTML = `
    <div class="menu-header">
      <h2>${isOutdoor ? 'Sensor values' : 'Sensor Data'}</h2>
      <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
        <div>
          <label for="start-date">From:</label>
          <input type="date" id="start-date"
                 value="${defaultStartDate.toISOString().split('T')[0]}"
                 style="margin-left: 5px;">
        </div>
        <div>
          <label for="end-date">To:</label>
          <input type="date" id="end-date"
                 value="${defaultEndDate.toISOString().split('T')[0]}"
                 style="margin-left: 5px;">
        </div>
        <button id="apply-date-range" style="padding: 5px 10px;">Apply</button>
      </div>
      ${sensorDropdown.html}
    </div>
    <h2>${name}</h2>
    <div class="building-details" style="margin-bottom: 8px;">
      ${!isOutdoor ? `
      <div class="detail-row" style="margin-bottom: 8px;">
        <span class="detail-label">Type:</span>
        <span class="detail-value">${buildingType}</span>
      </div>
    ` : ""}
      ${!isOutdoor ? `
      <div class="detail-row">
        <span class="detail-label">Floors:</span>
        <span class="detail-value">${levels}</span>
      </div> `: ""}
    </div>
    <div class="floor-container">
      ${!isOutdoor ? createFloorTabs(levels) : ""}
      ${!isOutdoor ? createFloorSections(levels) : `<div class="chart-container" id="outdoor-charts"></div>`}
    </div>
  `;

  removeSensorRangesMenu();
  createSensorRangesMenuButton(feature);

  // Set up scroll container for charts (show only selected floor or outdoor)
  const scrollContainer = document.createElement('div');
  scrollContainer.id = 'charts-scroll-container';
  scrollContainer.style.flex = '1 1 0';
  scrollContainer.style.overflowY = 'auto';
  scrollContainer.style.marginTop = '16px';

  scrollContainer.innerHTML = "";
  if (!isOutdoor) {
    const floorSections = document.querySelector('.floor-sections');
    if (floorSections) scrollContainer.appendChild(floorSections);
  } else {
    const outdoorCharts = document.getElementById('outdoor-charts');
    if (outdoorCharts) scrollContainer.appendChild(outdoorCharts);
  }
  infoPanel.appendChild(scrollContainer);

  // Date range picker
  document.getElementById('apply-date-range').addEventListener('click', function() {
    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) {
      alert('Start date cannot be after end date');
      return;
    }
    if (window.selectedBuilding && window.loadAndRenderSensorData) {
      window.loadAndRenderSensorData(
        window.selectedFeature,
        'custom',
        window.selectedDate,
        startDate,
        endDate
      );
    }
  });

  // Initialize the sensor type dropdown logic
  sensorDropdown.init();

  // Watch for changes to window.selectedDate
  const checkDateChange = () => {
    if (window.selectedDate !== window.previousReferenceDate) {
      const endDateInput = document.getElementById('end-date');
      const startDateInput = document.getElementById('start-date');
      const startDate = new Date(startDateInput.value);
      const endDate = new Date(endDateInput.value);
      endDate.setHours(23, 59, 59, 999);
      window.loadAndRenderSensorData(
        window.selectedFeature,
        'custom',
        window.selectedDate,
        startDate,
        endDate
      );
      window.previousReferenceDate = window.selectedDate;
    }
  };
  const dateCheckInterval = setInterval(checkDateChange, 100);
  const originalCloseDetailView = closeDetailView;
  closeDetailView = function() {
    clearInterval(dateCheckInterval);
    originalCloseDetailView();
  };

  if (!isOutdoor) {
    initializeFloorNavigation();
  }

  loadAndRenderSensorData(
    window.selectedFeature,
    'custom',
    window.selectedDate,
    defaultStartDate,
    defaultEndDate
  );
}



function loadAndRenderSensorData(feature, timeRange, referenceDate, startDate, endDate) {
  try {
    destroyCharts();

    if (!selectedBuilding || !selectedBuilding.userData) return;

    let sensors = [];
    if (selectedBuilding.userData.group === 'in') {
      sensors = selectedBuilding.userData.indoorSensors.flatMap(entry =>
        entry.readings.map(reading => ({
          ...reading,
          device_id: entry.device_id
        }))
      );
    } else if (selectedBuilding.userData.group === 'outdoor') {
      sensors = selectedBuilding.userData.allReadings.map(reading => ({
        ...reading,
        device_id: selectedBuilding.userData.device_id
      }));
    }

    sensors = filterSensorDataByTimeRange(sensors, timeRange, endDate);

    // Filter by selected sensor types from dropdown
    let selectedTypes = window.selectedSensorTypes;
    if (!selectedTypes || selectedTypes.length === 0) {
      sensors = [];
    }
    if (selectedTypes.length > 0) {
      sensors = sensors.filter(s => selectedTypes.includes(s.sensor_type));
    }

    window.lastSensorReadings = sensors;
    checkSensorTypeNotifications(feature, sensors);

    const isOutdoor = selectedBuilding.userData.group === 'outdoor';
    let selectedFloor = '1';
    if (!isOutdoor) {
      const activeTab = document.querySelector('.floor-tab.active');
      if (!activeTab) return;
      selectedFloor = activeTab.dataset.floor;
    }
    renderCharts(sensors, {
      isOutdoor,
      selectedFloor,
      startDate,
      endDate
    });
  } catch (error) {
    console.error("Error in loadAndRenderSensorData:", error);
    document.querySelectorAll('.chart-container').forEach(container => {
      container.innerHTML = '<div class="error-message">Error loading data</div>';
    });
  }
}

function renderCharts(sensors, { isOutdoor, selectedFloor, startDate, endDate }) {
  let container;
  if (isOutdoor) {
    container = document.getElementById('outdoor-charts');
  } else {
    container = document.getElementById(`charts-floor-${selectedFloor}`);
  }
  if (!container) return;
  container.innerHTML = '';

  // For indoor, filter to only the selected floor
  let sensorsToChart = sensors;
  if (!isOutdoor) {
    sensorsToChart = sensors.filter(sensor => {
      let floor = sensor.floor;
      if (floor === undefined || floor === null || floor === '') floor = 'unknown';
      else floor = parseInt(floor, 10).toString();
      return floor === selectedFloor;
    });
  }

  if (sensorsToChart.length === 0) {
    createSensorChart(container, {
      sensor_type: 'No Data',
      unit: '',
      datasets: []
    }, startDate, endDate, `NoData_${isOutdoor ? 'outdoor' : selectedFloor}`);
    return;
  }

  // Group by sensor_type, then by device_id
  const sensorsByType = sensorsToChart.reduce((acc, reading) => {
    const type = reading.sensor_type;
    if (!acc[type]) acc[type] = {};
    const id = reading.device_id;
    if (!acc[type][id]) {
      acc[type][id] = {
        device_id: id,
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
      label: sensor.device_id,
      data: sensor.data.sort((a, b) => a.x - b.x),
      borderColor: colorPalette[colorIndex++ % colorPalette.length],
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6,
      unit: sensor.unit,
    }));

    createSensorChart(container, {
      sensor_type,
      unit: datasets[0]?.unit || '',
      datasets
    }, startDate, endDate, `${sensor_type}_${isOutdoor ? 'outdoor' : selectedFloor}`);
  });
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

  removeSensorRangesMenu();

  // Reset camera position for next open
  detailCamera.position.set(0, 0, 50);
  detailControls.target.set(0, 0, 0);
  detailControls.update();
  restoreOriginalCamera();
}
