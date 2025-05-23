// 3D Map

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import buildingsUrl from '../assets/data/buildings.geojson?url';
import { setupBuildingInteraction } from "../buildings/buildingInteraction.js";
import { Group } from "@tweenjs/tween.js";
import { initBuildingDetailView, showBuildingDetailView } from "../buildings/buildingmenu.js";

const CENTER_LON = 26.045184;
const CENTER_LAT = 44.4349638;
const SCALE_FACTOR = 100000; // 1 unit = 0.00001 degrees

export let camera, crosshair, controls;
export const tweenGroup = new Group();

export function initThreeScene() {
  const center = window.currentMapCenter || { lat: CENTER_LAT, lng: CENTER_LON };
  const x = (center.lng - CENTER_LON) * SCALE_FACTOR;
  const y = (center.lat - CENTER_LAT) * SCALE_FACTOR;

  const scene = new THREE.Scene();
  const buildingData = []; // store mesh + shape for spatial checks (used at indoor sensors)

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );
  
  // Position camera slightly tilted from above
  const cameraHeight = 1000;
  const tiltOffset = cameraHeight * 0.1;
  camera.position.set(x, y - tiltOffset, cameraHeight);
  camera.lookAt(x, y, 0);
  camera.up.set(0, 0, 1);

  const canvas = document.getElementById("three-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xf5f5f5);

  scene.add(new THREE.AmbientLight(0x888888));
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(100, -100, 300);
  scene.add(sun);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enablePan = true;
  
  // Set reasonable zoom limits
  controls.minDistance = 100;
  controls.maxDistance = 3000;
  
  // Restrict vertical rotation to prevent seeing underneath
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI * 0.35;
  
  // Allow full horizontal rotation
  controls.minAzimuthAngle = -Math.PI;
  controls.maxAzimuthAngle = Math.PI;

  // Make rotation smoother
  controls.rotateSpeed = 0.5;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  // Default mouse button settings
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };

  // Override the mousedown event handler
  const originalMouseDown = controls.domElement.onmousedown;
  controls.domElement.addEventListener('mousedown', function(event) {
    if (event.ctrlKey) {
      // Temporarily change the mouse button mapping
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
    if (originalMouseDown) {
      originalMouseDown.call(controls.domElement, event);
    }
  });

  // Reset mouse buttons on mouse up
  controls.domElement.addEventListener('mouseup', () => {
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  });

  // Handle window blur to reset state
  window.addEventListener('blur', () => {
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  });

  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };

  controls.target.set(x, y, 0);
  controls.update();

  // Add a ground plane to prevent z-fighting and ensure we can't see underneath
  const groundGeometry = new THREE.PlaneGeometry(20000, 20000);  // Made larger to ensure coverage
  const groundMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xf5f5f5,
    side: THREE.FrontSide  // Only render top side
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -0.1;
  scene.add(ground);

  setupBuildingInteraction(scene, camera, controls);

  // Fetch buildings
  fetch(buildingsUrl)
  .then(res => res.json())
  .then(geojson => {
    geojson.features.forEach((feature) => {
      const coords = feature.geometry.coordinates[0];
      if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
      }
      const points = coords.map(coord => {
        const [lon, lat] = coord;
        const px = (lon - CENTER_LON) * SCALE_FACTOR;
        const py = (lat - CENTER_LAT) * SCALE_FACTOR;
        return new THREE.Vector2(px, py);
      });
      const shape = new THREE.Shape(points);

      const levels = feature.properties["building:levels"];
      const height = levels ? parseFloat(levels) * 3 : 10;

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1
      });

      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: true });


      // Building mesh (walls)
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { feature };

      // Roof mesh
      const roofShape = new THREE.Shape(points);
      const roofGeometry = new THREE.ShapeGeometry(roofShape);
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: 0xffcccc,
        side: THREE.DoubleSide,
        flatShading: true
      });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);

      // Position the roof at the top of the building
      roof.position.set(0, 0, height);
      mesh.add(roof);

      // Optional wireframe
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      mesh.add(wireframe);

      // Add to scene
      scene.add(mesh);

      buildingData.push({ mesh, shape });
    });

    loadTiles(center, scene);

    fetchIndoorSensors()
    .then(indoorSensors => {
      if (indoorSensors && Array.isArray(indoorSensors)) {
        addSensorSpheres(scene, buildingData, indoorSensors);
      } else {
        console.error("Indoor sensors not available or invalid format:", indoorSensors);
      }
    })
    .catch(error => {
      console.error("Failed to fetch indoor sensors:", error);
    });

    animate();
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required for damping
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });

  initBuildingDetailView();
}

function loadTiles(center, scene) {
  const zoom = 17;
  const numTiles = 5;
  const centerTile = latLngToTileXY(center.lat, center.lng, zoom);
  const startX = centerTile.x - Math.floor(numTiles / 2);
  const startY = centerTile.y - Math.floor(numTiles / 2);

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  for (let i = 0; i < numTiles; i++) {
    for (let j = 0; j < numTiles; j++) {
      const tileX = startX + i;
      const tileY = startY + j;

      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

      // Calculate tile bounds
      const { west, east, north, south } = tileXYToBounds(tileX, tileY, zoom);

      // Convert to local coordinate system
      const width = (east - west) * SCALE_FACTOR;
      const height = (north - south) * SCALE_FACTOR;
      const centerX = (west + east - 2 * CENTER_LON) * SCALE_FACTOR / 2;
      const centerY = (south + north - 2 * CENTER_LAT) * SCALE_FACTOR / 2;

      loader.load(
        tileUrl,
        (texture) => {
          const geometry = new THREE.PlaneGeometry(width, height);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            depthWrite: true
          });

          const tilePlane = new THREE.Mesh(geometry, material);

          tilePlane.position.set(centerX, centerY, -0.1); // Just below buildings
          scene.add(tilePlane);
        },
        undefined,
        (error) => {
          console.error("Tile failed to load:", tileUrl, error);
        }
      );
    }
  }
}

function latLngToTileXY(lat, lng, zoom) {
  const x = ((lng + 180) / 360) * Math.pow(2, zoom);
  const y =
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
    Math.pow(2, zoom);
  return { x: Math.floor(x), y: Math.floor(y) };
}

function tileXYToBounds(x, y, zoom) {
  const west = (x / Math.pow(2, zoom)) * 360 - 180;
  const east = ((x + 1) / Math.pow(2, zoom)) * 360 - 180;
  const north = tileYToLat(y, zoom);
  const south = tileYToLat(y + 1, zoom);
  return { west, east, north, south };
}

function tileYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function addSensorSpheres(scene, buildingData, indoorSensors) {
  const SENSOR_RADIUS = 2; // Reduced size for both types of indicators
  const HOVER_SCALE = 1.5; // Scale factor when hovering

  // Create a map to track which sensors are assigned to buildings
  const assignedSensors = new Set();

  // First, process building-assigned sensors
  buildingData.forEach(({ mesh, shape }) => {
    const polygon = shape.getPoints().map(p => p.clone().add(mesh.position));

    const localSensors = indoorSensors.filter(sensor => {
      const px = (sensor.lon - CENTER_LON) * SCALE_FACTOR;
      const py = (sensor.lat - CENTER_LAT) * SCALE_FACTOR;
      const isInside = isPointInPolygon(polygon, new THREE.Vector2(px, py));
      if (isInside) {
        assignedSensors.add(sensor.sensor_id);
      }
      return isInside;
    });

    mesh.userData.indoorSensors = localSensors;

    if (localSensors.length > 0) {
      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(SENSOR_RADIUS, 12, 12),
        new THREE.MeshStandardMaterial({ 
          color: 0xff0000,
          transparent: true,
          opacity: 0.8,
          emissive: 0xff0000,
          emissiveIntensity: 0.3
        })
      );

      // Position slightly above the building
      sphere.position.set(center.x, center.y, bbox.max.z + 5);
      
      // Add hover effect
      sphere.userData.isBuilding = true;
      sphere.userData.originalScale = sphere.scale.clone();
      
      mesh.add(sphere);
    }
  });

  // Then, show unassigned sensors
  indoorSensors.forEach(sensor => {
    if (!assignedSensors.has(sensor.sensor_id)) {
      const px = (sensor.lon - CENTER_LON) * SCALE_FACTOR;
      const py = (sensor.lat - CENTER_LAT) * SCALE_FACTOR;

      const unassignedSphere = new THREE.Mesh(
        new THREE.SphereGeometry(SENSOR_RADIUS, 12, 12),
        new THREE.MeshStandardMaterial({ 
          color: 0x00ff00,
          transparent: true,
          opacity: 0.8,
          emissive: 0x00ff00,
          emissiveIntensity: 0.3
        })
      );
      
      unassignedSphere.position.set(px, py, 5); // Place slightly above ground
      unassignedSphere.userData = {
        isUnassignedSensor: true,
        sensorData: sensor,
        originalScale: unassignedSphere.scale.clone()
      };
      
      scene.add(unassignedSphere);

      // Add click event for unassigned sensors
      unassignedSphere.userData.onClick = () => {
        // Create a mock feature for the unassigned sensor
        const mockFeature = {
          properties: {
            name: `Unassigned Sensor ${sensor.sensor_id}`,
            addr: { street: `Lat: ${sensor.lat}, Lon: ${sensor.lon}` }
          }
        };

        // Create a mock building object with the sensor data
        const mockBuilding = unassignedSphere;
        mockBuilding.userData.indoorSensors = [sensor];

        // Update global state
        window.selectedBuilding = mockBuilding;
        window.selectedFeature = mockFeature;

        // Show the building menu with the sensor data
        showBuildingDetailView(mockBuilding, mockFeature);
      };
    }
  });

  // Add hover effect for all sensor spheres
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousemove', (event) => {
    const canvas = document.getElementById('three-canvas');
    const rect = canvas.getBoundingClientRect();
    
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const spheres = scene.children.filter(obj => 
      obj.userData.isUnassignedSensor || 
      (obj.children && obj.children.some(child => child.userData.isBuilding))
    );

    const intersects = raycaster.intersectObjects(spheres, true);

    // Reset all spheres to original scale
    spheres.forEach(obj => {
      if (obj.userData.isUnassignedSensor) {
        obj.scale.copy(obj.userData.originalScale);
      } else {
        obj.children.forEach(child => {
          if (child.userData.isBuilding) {
            child.scale.copy(child.userData.originalScale);
          }
        });
      }
    });

    // Scale up hovered sphere
    if (intersects.length > 0) {
      const object = intersects[0].object;
      if (object.userData.isUnassignedSensor || object.userData.isBuilding) {
        object.scale.multiplyScalar(HOVER_SCALE);
      }
    }
  });

  // Add click handler for unassigned sensors
  window.addEventListener('click', (event) => {
    const canvas = document.getElementById('three-canvas');
    const rect = canvas.getBoundingClientRect();
    
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const unassignedSpheres = scene.children.filter(obj => obj.userData.isUnassignedSensor);
    const intersects = raycaster.intersectObjects(unassignedSpheres);

    if (intersects.length > 0) {
      const sphere = intersects[0].object;
      if (sphere.userData.onClick) {
        sphere.userData.onClick();
      }
    }
  });
}

function isPointInPolygon(polygon, point) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
                     (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 0.000001) + xi);

    if (intersect) inside = !inside;
  }
  return inside;
}

function fetchIndoorSensors() {
  return fetch('/indoor_sensors')
    .then(response => {
      if (!response.ok) throw new Error("Failed to fetch sensors: " + response.status);
      return response.json();
    })
    .catch(error => {
      console.error("Fetch error:", error);
      return [];
    });
}

// Store original camera and controls state
let originalCameraState = null;

export function zoomToBuilding(mesh) {
  if (!camera || !controls || !mesh) return;

  // Save original camera/controls state if not already saved
  if (!originalCameraState) {
    originalCameraState = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
  }

  // Compute building center (in local coordinates)
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());

  // Set desired zoom distance (adjust as needed)
  const distance = Math.max(bbox.getSize(new THREE.Vector3()).length(), 100);

  // Move camera above and in front of building center
  const newCamPos = center.clone().add(new THREE.Vector3(0, -distance, distance * 0.7));

  const xOffset = 70;

  // Move BOTH camera and target by the same X offset
  camera.position.copy(newCamPos).add(new THREE.Vector3(xOffset, 0, 0));
  controls.target.copy(center).add(new THREE.Vector3(xOffset, 0, 0));
  controls.update();
}

export function restoreOriginalCamera() {
  if (originalCameraState && camera && controls) {
    camera.position.copy(originalCameraState.position);
    controls.target.copy(originalCameraState.target);
    controls.update();
    originalCameraState = null;
  }
}
