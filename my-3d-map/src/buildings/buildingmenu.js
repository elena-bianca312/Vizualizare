// Core menu container for building details

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Tween, Easing, Group } from "@tweenjs/tween.js";
import {clearSelectedBuilding, selectedBuilding} from "./buildinginteraction.js";
import { createFloorTabs, createFloorSections, initializeFloorNavigation } from './floorManager.js';
import { createSensorChart, destroyCharts } from '../sensors/sensorchart.js';
import { restoreOriginalCamera } from "../views/threeview.js";

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
    infoPanel.style.maxHeight = '30%';
    infoPanel.style.overflowY = 'auto';
    detailContainer.appendChild(infoPanel);

    // 3D view container
    const viewContainer = document.createElement('div');
    viewContainer.id = 'detail-canvas-container';
    viewContainer.style.flex = '1';
    detailContainer.appendChild(viewContainer);

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

  initializeFloorNavigation();
  loadAndRenderSensorData(feature);
}



function loadAndRenderSensorData(feature, timeRange = 'last_week', referenceDate) {
  try {
    destroyCharts();
    let sensors = selectedBuilding.userData.indoorSensors;

    // Filter sensors by the selected time range and reference date
    sensors = filterSensorDataByTimeRange(sensors, timeRange, referenceDate);

    const sensorsByFloor = sensors.reduce((acc, sensor) => {
      const floor = (sensor.Floor || '').toString().trim() || 'unknown';
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(sensor);
      return acc;
    }, {});

    Object.entries(sensorsByFloor).forEach(([floor, sensors]) => {
      const container = document.getElementById(`charts-floor-${floor}`);
      if (container) {
        container.innerHTML = '';
        const sensorsById = sensors.reduce((acc, reading) => {
          const id = reading.sensor_id;
          if (!acc[id]) {
            acc[id] = {
              sensor_id: id,
              sensor_type: reading.sensor_type,
              unit: reading.unit,
              timestamps: [],
              values: []
            };
          }
          const timestamp = new Date(reading.timestamp);
          if (!isNaN(timestamp)) {
            acc[id].timestamps.push(timestamp);
          }
          const value = parseFloat(reading.value);
          if (!isNaN(value)) {
            acc[id].values.push(value);
          }
          return acc;
        }, {});

        Object.values(sensorsById).forEach(sensor => {
          const paired = sensor.timestamps
            .map((ts, i) => ({ timestamp: ts, value: sensor.values[i] }))
            .sort((a, b) => a.timestamp - b.timestamp);

          const sortedSensor = {
            ...sensor,
            timestamps: paired.map(d => d.timestamp),
            values: paired.map(d => d.value)
          };

          createSensorChart(container, sortedSensor);
        });
      }
    });
  } catch (error) {
    console.error('Failed to load sensor data:', error);
    document.querySelectorAll('.chart-container').forEach(container => {
      container.innerHTML = '<p>No sensor data available</p>';
    });
  }
}

// Make this function globally accessible for map.js
window.loadAndRenderSensorData = loadAndRenderSensorData;

const timeRanges = {
  last_week: 7 * 24 * 60 * 60 * 1000,
  last_month: 30 * 24 * 60 * 60 * 1000,
  last_3_months: 90 * 24 * 60 * 60 * 1000,
  last_year: 365 * 24 * 60 * 60 * 1000
};

function filterSensorDataByTimeRange(sensors, timeRange, referenceDate) {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  const rangeMs = timeRanges[timeRange] || 0;
  if (rangeMs === 0) return sensors;
  const startDate = new Date(now.getTime() - rangeMs);
  return sensors.filter(sensor => {
    const ts = new Date(sensor.timestamp);
    return ts >= startDate && ts <= now;
  });
}

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

  // Reset camera position for next open
  detailCamera.position.set(0, 0, 50);
  detailControls.target.set(0, 0, 0);
  detailControls.update();
  restoreOriginalCamera();
}
