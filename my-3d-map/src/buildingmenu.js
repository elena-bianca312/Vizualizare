// buildingDetailView.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Tween, Easing, Group } from "../node_modules/@tweenjs/tween.js/dist/tween.esm.js";
import { clearSelectedBuilding } from "./buildinginteraction.js";

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
  // Create container if it doesn't exist
  if (!document.getElementById('building-detail-view')) {
    // Create main container
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

    // Add close button
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
  // Clear existing building if any
  if (currentDetailBuilding) {
    detailScene.remove(currentDetailBuilding);
    floorPlanes.forEach(plane => detailScene.remove(plane));
    floorPlanes = [];
  }

  // Clone the building for detail view
  const geometry = building.geometry.clone();
  const material = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    side: THREE.DoubleSide,
    flatShading: false,
    transparent: true,
    opacity: 0.85
  });

  currentDetailBuilding = new THREE.Mesh(geometry, material);

  // Add wireframe
  const wireframe = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
  );
  currentDetailBuilding.add(wireframe);

  // Center building
  const bbox = new THREE.Box3().setFromObject(currentDetailBuilding);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());

  currentDetailBuilding.position.sub(center);

  // Add floor demarcation
  addFloorDemarcation(currentDetailBuilding, feature);

  // Add to scene
  detailScene.add(currentDetailBuilding);

  // Position camera based on building size
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 2;
  detailCamera.position.set(distance, distance/2, distance/2);
  detailControls.target.set(0, 0, 0);
  detailControls.update();

  // Update info panel
  updateDetailInfo(feature);

  // Display the container
  detailContainer.style.display = 'flex';

  // Animate opening
  currentDetailBuilding.rotation.y = -Math.PI / 2;
  new Tween(currentDetailBuilding.rotation)
    .to({ y: 0 }, 800)
    .easing(Easing.Quadratic.Out)
    .start(detailTweenGroup);
}

/**
 * Add floor demarcation to the building
 * @param {THREE.Mesh} building - The building mesh
 * @param {Object} feature - GeoJSON feature data
 */
function addFloorDemarcation(building, feature) {
  const bbox = new THREE.Box3().setFromObject(building);
  const size = bbox.getSize(new THREE.Vector3());
  const min = bbox.min;

  const levels = parseInt(feature.properties["building:levels"]) || 1;
  const floorHeight = size.z / levels;

  // Add horizontal planes for each floor
  for (let i = 0; i <= levels; i++) {
    const z = min.z + i * floorHeight;

    // Create a horizontal plane for each floor
    const planeGeom = new THREE.PlaneGeometry(size.x * 1.02, size.y * 1.02);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x6688cc,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });

    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.position.set(0, 0, z);
    plane.rotation.x = Math.PI / 2;

    // Create an edge outline for the floor
    const edgeGeom = new THREE.EdgesGeometry(planeGeom);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x2244aa });
    const edges = new THREE.LineSegments(edgeGeom, edgeMat);

    plane.add(edges);
    plane.userData = { floor: i };
    detailScene.add(plane);
    floorPlanes.push(plane);
  }
}

/**
 * Update information panel with building details
 * @param {Object} feature - GeoJSON feature data
 */
function updateDetailInfo(feature) {
  const infoPanel = document.getElementById('building-detail-info');

  // Get properties from feature
  const name = feature.properties.name || 'Unnamed Building';
  const levels = feature.properties["building:levels"] || 'N/A';
  const buildingType = feature.properties.building || 'General';
  const address = feature.properties.addr?.street || 'No address available';

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

    <div class="floor-controls">
      <h3>Floor Navigation</h3>
      <div class="floor-buttons">
        ${generateFloorButtons(levels)}
      </div>
    </div>
  `;

  // Add event listeners to floor buttons
  const floorButtons = infoPanel.querySelectorAll('.floor-btn');
  floorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Highlight selected button
      floorButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Focus camera on selected floor
      const floorIndex = parseInt(btn.dataset.floor);
      focusOnFloor(floorIndex, levels);
    });
  });
}

/**
 * Generate HTML for floor buttons
 * @param {number} levels - Number of floors
 * @returns {string} HTML for floor buttons
 */
function generateFloorButtons(levels) {
  if (!levels || levels === 'N/A') return '<p>Floor information not available</p>';

  let html = '';
  for (let i = 1; i <= parseInt(levels); i++) {
    html += `<button class="floor-btn" data-floor="${i}">Floor ${i}</button>`;
  }
  return html;
}

/**
 * Focus camera on specific floor
 * @param {number} floorIndex - Floor index (1-based)
 * @param {number} totalLevels - Total number of floors
 */
function focusOnFloor(floorIndex, totalLevels) {
  if (!currentDetailBuilding) return;

  const bbox = new THREE.Box3().setFromObject(currentDetailBuilding);
  const size = bbox.getSize(new THREE.Vector3());
  const min = bbox.min;

  const floorHeight = size.z / parseInt(totalLevels);
  const targetZ = min.z + (floorIndex - 0.5) * floorHeight;

  // Highlight the selected floor plane
  floorPlanes.forEach(plane => {
    if (plane.userData.floor === floorIndex) {
      plane.material.opacity = 0.4;
      plane.material.color.set(0x88aaff);
    } else {
      plane.material.opacity = 0.15;
      plane.material.color.set(0x6688cc);
    }
  });

  // Animate camera to focus on this floor
  const cameraDistance = Math.max(size.x, size.y) * 1.5;

  const targetPosition = new THREE.Vector3(
    cameraDistance,
    cameraDistance/2,
    targetZ
  );

  const targetLookAt = new THREE.Vector3(0, 0, targetZ);

  new Tween(detailCamera.position)
    .to(targetPosition, 800)
    .easing(Easing.Quadratic.InOut)
    .start(detailTweenGroup);

  new Tween(detailControls.target)
    .to(targetLookAt, 800)
    .easing(Easing.Quadratic.InOut)
    .start(detailTweenGroup);
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

    // Reset camera position for next open
    detailCamera.position.set(0, 0, 50);
    detailControls.target.set(0, 0, 0);
    detailControls.update();
}
