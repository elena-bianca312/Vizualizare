// 3D Map

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import buildingsUrl from '../assets/data/buildings.geojson?url';
import { setupBuildingInteraction } from "../buildings/buildingInteraction.js";
import { Group } from "@tweenjs/tween.js";
import { initBuildingDetailView } from "../buildings/buildingmenu.js";

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
    75, window.innerWidth / window.innerHeight, 0.1, 5000
  );
  camera.position.set(x, y, 1000);
  camera.lookAt(x, y, 0);
  camera.up.set(0, 1, 0);

  const canvas = document.getElementById("three-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xf5f5f5);

  scene.add(new THREE.AmbientLight(0x888888));
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(100, 100, 300);
  scene.add(sun);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enableRotate = false;
  setTimeout(() => {
    controls.enableRotate = true;
  }, 500);
  controls.enablePan = true;
  controls.target.set(x, y, 0);
  controls.update();

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

    fetchAllSensors()
    .then(allSensors => {
      const indoorSensors = allSensors.filter(s => s.IsIndoor);
      const outdoorSensors = allSensors.filter(s => !s.IsIndoor);

      if (indoorSensors && Array.isArray(indoorSensors)) {
        addIndoorSensorSpheres(scene, buildingData, indoorSensors);
      } else {
        console.error("Indoor sensors not available or invalid format:", indoorSensors);
      }

      if (outdoorSensors && Array.isArray(outdoorSensors)) {
        addOutdoorSensorSpheres(scene, buildingData, outdoorSensors);
      } else {
        console.error("Indoor sensors not available or invalid format:", outdoorSensors);
      }

    })
    .catch(error => {
      console.error("Failed to fetch indoor sensors:", error);
    });

    animate();
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
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



  // Hide indoor sensors
  document.querySelectorAll('.sensor-toggle-3d').forEach(input => {
    input.addEventListener('change', () => {
      const group = input.dataset.group;
      const visible = input.checked;

      scene.traverse(obj => {
        if (obj.isMesh && obj.userData?.group === group) {
          obj.visible = visible;
        }
      });
    });
  });

  // Outdoor type-specific toggles
  document.querySelectorAll('.sensor-type-toggle-3d').forEach(input => {
    input.addEventListener('change', () => {
      const sensorType = input.dataset.sensor;
      const visible = input.checked;

      scene.traverse(obj => {
        if (obj.isMesh && obj.userData?.group === "outdoor" && obj.userData?.sensorType === sensorType) {
          obj.visible = visible;
        }
      });
    });
  });

  // Hide outdoor types if the whole group is unchecked
  document.getElementById('toggle-outdoor').addEventListener('change', (e) => {
    const show = e.target.checked;
    const outdoorGroup = document.getElementById('outdoor-types');
    outdoorGroup.style.display = show ? 'block' : 'none';

    scene.traverse(obj => {
      if (obj.isMesh && obj.userData?.group === "outdoor") {
        obj.visible = show;
      }
    });
  });

  window.refreshThreeSpheres = () => {
    // Remove outdoor spheres
    scene.children = scene.children.filter(obj => !obj.userData?.group || obj.userData.group !== 'outdoor');

    // Remove indoor spheres attached to buildings
    buildingData.forEach(({ mesh }) => {
      const toRemove = [];

      mesh.children.forEach(child => {
        if (child.userData?.group === "indoor") {
          toRemove.push(child);
        }
      });

      toRemove.forEach(child => mesh.remove(child));
    });

    // Use same logic from init to redraw spheres
    fetchAllSensors()
      .then(allSensors => {
        const indoorSensors = allSensors.filter(s => s.IsIndoor);
        const outdoorSensors = allSensors.filter(s => !s.IsIndoor);

        addIndoorSensorSpheres(scene, buildingData, indoorSensors);
        addOutdoorSensorSpheres(scene, buildingData, outdoorSensors);
      });
  };
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

function addIndoorSensorSpheres(scene, buildingData, indoorSensors) {
  const SENSOR_RADIUS = 2;
  const showAll = document.getElementById("show-all-sensors")?.checked;
  const selectedDate = window.selectedDate;

  const sensorMap = new Map();

  indoorSensors.forEach(sensor => {
    if (!sensor.sensor_id || !sensor.timestamp) return;

    if (!sensorMap.has(sensor.sensor_id)) {
      sensorMap.set(sensor.sensor_id, []);
    }

    sensorMap.get(sensor.sensor_id).push(sensor);
  });

  buildingData.forEach(({ mesh, shape }) => {
    const polygon = shape.getPoints().map(p => p.clone().add(mesh.position));

    const localSensors = [];

    for (const [sensorId, readings] of sensorMap.entries()) {
      const anyReadingInside = readings.some(sensor => {
        const px = (sensor.lon - CENTER_LON) * SCALE_FACTOR;
        const py = (sensor.lat - CENTER_LAT) * SCALE_FACTOR;
        return isPointInPolygon(polygon, new THREE.Vector2(px, py));
      });

      if (!anyReadingInside) continue;

      localSensors.push({
        sensor_id: sensorId,
        readings: readings
      });
    }

    mesh.userData.indoorSensors = localSensors;
    mesh.userData.group = "in";

    if (localSensors.length > 0) {
      const hasValidTimestamp = showAll || localSensors.some(entry =>
        entry.readings.some(r => r.timestamp?.startsWith(selectedDate))
      );

      if (!hasValidTimestamp) return;

      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(SENSOR_RADIUS, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );

      sphere.position.set(center.x, center.y, bbox.max.z + 2);

      sphere.userData = {
        group: "indoor",
      };

      mesh.add(sphere);
    }
  });
}

function addOutdoorSensorSpheres(scene, buildingData, outdoorSensors) {
  const SENSOR_RADIUS = 2;
  const sensorColors3D = {
    temperature: 0xff0000,
    humidity: 0x66ccff,
    air_quality: 0x66cc66,
    wind_speed: 0xcc66ff
  };
  const selectedDate = window.selectedDate;
  const showAll = document.getElementById("show-all-sensors")?.checked;

  const polygons = buildingData.map(({ shape, mesh }) =>
    shape.getPoints().map(p => p.clone().add(mesh.position))
  );

  const sensorMap = new Map();

  // Group by sensor_id
    outdoorSensors.forEach(sensor => {
    if (!sensor.sensor_id || !sensor.timestamp) return;

    if (!sensorMap.has(sensor.sensor_id)) {
      sensorMap.set(sensor.sensor_id, []);
    }

    sensorMap.get(sensor.sensor_id).push(sensor);
  });


  // Render each filtered sensor
  for (const [sensorId, readings] of sensorMap.entries()) {
    let selectedSensor = null;

    if (showAll) {
      selectedSensor = readings[0];
    } else {
      selectedSensor = readings.find(r => r.timestamp.startsWith(selectedDate));
    }

    if (!selectedSensor) continue;

    const px = (selectedSensor.lon - CENTER_LON) * SCALE_FACTOR;
    const py = (selectedSensor.lat - CENTER_LAT) * SCALE_FACTOR;
    const point = new THREE.Vector2(px, py);

    const insideAnyBuilding = polygons.some(poly => isPointInPolygon(poly, point));
    if (insideAnyBuilding) continue;

    const color = sensorColors3D[selectedSensor.sensor_type] || 0x999999;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(SENSOR_RADIUS, 8, 6),
      new THREE.MeshStandardMaterial({ color })
    );

    sphere.position.set(px, py, 2);
    sphere.userData = {
      sensorType: selectedSensor.sensor_type,
      group: "outdoor",
      sensorId: sensorId,
      allReadings: readings
    };

    scene.add(sphere);
    }
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

function fetchAllSensors() {
  return fetch('/all_sensors')
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
