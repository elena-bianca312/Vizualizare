// Click & hover interaction for buildings

import * as THREE from "three";
import { Tween, Easing } from "@tweenjs/tween.js";
import { tweenGroup, zoomToBuilding } from "../views/threeview.js";
import { showBuildingDetailView } from "./buildingmenu.js";
import { destroyCharts } from "../charts/createSensorChart.js";

let selectedObject = null;
let scene = null;
let camera = null;
let controls = null;

export let selectedBuilding = null;
export let selectedFeature = null;

export function setupBuildingInteraction(threeScene, threeCamera, threeControls) {
  scene = threeScene;
  camera = threeCamera;
  controls = threeControls;

  const canvas = document.getElementById('three-canvas');
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  canvas.addEventListener('click', (event) => {
    // Get mouse position
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children || [], true);

    // First check for unassigned sensor clicks
    const sensorHit = intersects.find(hit => hit.object.userData?.isUnassignedSensor);
    if (sensorHit) {
      handleUnassignedSensorClick(sensorHit.object);
      return;
    }

    // Then check for building hits
    const buildingHit = intersects.find(hit => {
      const obj = hit.object;
      // Traverse up to find the root mesh
      let parent = obj;
      while (parent.parent && !(parent.userData && parent.userData.feature)) {
        parent = parent.parent;
      }
      return parent.userData && parent.userData.feature;
    });

    if (buildingHit) {
      // Get the root building mesh
      let buildingMesh = buildingHit.object;
      while (buildingMesh.parent && !(buildingMesh.userData && buildingMesh.userData.feature)) {
        buildingMesh = buildingMesh.parent;
      }

      // Clear previous selection and charts
      clearSelectedBuilding();

      // Set new selection first
      selectedBuilding = buildingMesh;
      selectedFeature = buildingMesh.userData.feature;

      // Update materials
      selectBuilding(buildingMesh);

      // Show building details
      showBuildingDetailView(buildingMesh, buildingMesh.userData.feature);
    } else {
      clearSelectedBuilding();
    }
  });
}

export function selectBuilding(building) {
  // Set new selection
  selectedObject = building;
  if (selectedObject) {
    // Store original materials
    selectedObject.userData.originalMaterials = [];
    selectedObject.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        selectedObject.userData.originalMaterials.push({
          mesh: child,
          material: child.material.clone()
        });
        // Create highlighted material
        const highlightedMaterial = child.material.clone();
        highlightedMaterial.emissive = new THREE.Color(0x666666);
        highlightedMaterial.emissiveIntensity = 0.5;
        child.material = highlightedMaterial;
      }
    });
  }
}

export function clearSelectedBuilding() {
  // Destroy any existing charts first
  destroyCharts();

  // Clear materials
  if (selectedObject) {
    // Restore original materials
    if (selectedObject.userData.originalMaterials) {
      selectedObject.userData.originalMaterials.forEach(({mesh, material}) => {
        mesh.material = material;
      });
    }
    selectedObject = null;
  }

  // Clear selection state
  selectedBuilding = null;
  selectedFeature = null;
}

// Handle unassigned sensor clicks
function handleUnassignedSensorClick(sensorSphere) {
  // Clear previous selection
  clearSelectedBuilding();

  const sensorData = sensorSphere.userData.sensorData;
  
  // Create a temporary feature object for the unassigned sensor
  const tempFeature = {
    properties: {
      name: `Unassigned Sensor ${sensorData.sensor_id}`,
      "building:levels": 1,
      building: "Sensor Location",
      addr: { street: `Lat: ${sensorData.lat}, Lon: ${sensorData.lon}` }
    }
  };

  // Set up the sensor sphere as the building object
  sensorSphere.userData.indoorSensors = [sensorData];
  sensorSphere.userData.feature = tempFeature;  // Add feature data to the sphere

  // Update selection state
  selectedBuilding = sensorSphere;
  selectedFeature = tempFeature;
  selectedObject = sensorSphere;

  // Show sensor details
  showBuildingDetailView(sensorSphere, tempFeature);
}