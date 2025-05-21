// Core menu container for building details

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Tween, Easing, Group } from "@tweenjs/tween.js";
import {clearSelectedBuilding, selectedBuilding} from "./buildinginteraction.js";
import { createFloorTabs, createFloorSections, initializeFloorNavigation } from './floorManager.js';
import { createSensorChart, destroyCharts } from '../sensors/sensorchart.js';
import { restoreOriginalCamera } from "../views/threeview.js";
import { timeRanges, filterSensorDataByTimeRange, getTimeRangeDates } from "../assets/utils/timeUtils.js";

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
    destroyCharts();

    const levels = feature.properties["building:levels"] || 1;
    let sensors = selectedBuilding.userData.indoorSensors;
    sensors = filterSensorDataByTimeRange(sensors, timeRange, referenceDate);

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

    // Process each floor
    for (let i = 1; i <= levels; i++) {
      const floor = i.toString();
      const container = document.getElementById(`charts-floor-${floor}`);
      if (container) {
        container.innerHTML = '';
        const floorSensors = sensorsByFloor[floor] || [];

        if (floorSensors.length === 0) {
          createSensorChart(container, {
            sensor_id: `empty-${floor}`,
            sensor_type: 'No Data',
            unit: '',
            data: []
          }, startDate, endDate);
        } else {
          // Group by sensor_id and prepare chart data
          const sensorsById = floorSensors.reduce((acc, reading) => {
            const id = reading.sensor_id;
            if (!acc[id]) {
              acc[id] = {
                sensor_id: id,
                sensor_type: reading.sensor_type,
                unit: reading.unit,
                data: []
              };
            }
            const timestamp = new Date(reading.timestamp);
            const value = parseFloat(reading.value);
            if (!isNaN(timestamp) && !isNaN(value)) {
              acc[id].data.push({ x: timestamp, y: value });
            }
            return acc;
          }, {});

          // Sort data and create charts
          Object.values(sensorsById).forEach(sensor => {
            sensor.data.sort((a, b) => a.x - b.x); // Ensure chronological order
            createSensorChart(container, sensor, startDate, endDate);
          });
        }
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
