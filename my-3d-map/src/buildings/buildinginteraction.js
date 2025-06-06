// Click & hover interaction for buildings

import * as THREE from "three";
import { Tween, Easing } from "@tweenjs/tween.js";
import { tweenGroup, zoomToBuilding } from "../views/threeview.js";
import { showBuildingDetailView } from "./buildingmenu.js";


export let selectedBuilding = null;
let currentHighlight = null;
const originalMaterials = new Map();

export function setupBuildingInteraction(scene, camera, controls) {
  const canvas = document.getElementById("three-canvas");
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();


  function highlightBuilding(building) {
    if (building === selectedBuilding) return;

    const allMeshes = [building, ...building.children.filter(c => c.isMesh)];

    allMeshes.forEach(mesh => {
      originalMaterials.set(mesh, mesh.material.clone());
      mesh.material.color.set(0x00ff00); // Highlight color
      if (building.userData?.group === "outdoor") {
        mesh.scale.set(1.5, 1.5, 1.5);
      }
    });

    currentHighlight = building;
  }

  function resetHighlight() {
    if (currentHighlight && currentHighlight !== selectedBuilding) {
      const allMeshes = [currentHighlight, ...currentHighlight.children.filter(c => c.isMesh)];

      allMeshes.forEach(mesh => {
        const original = originalMaterials.get(mesh);
        mesh.scale.set(1, 1, 1);
        if (original) {
          mesh.material.copy(original);
          originalMaterials.delete(mesh);
        }
      });

      currentHighlight = null;
    }
  }

  function focusOnBuilding(building) {
    const targetPosition = building.position.clone().add(new THREE.Vector3(0, 0, 50));
    const targetLookAt = building.position.clone();

    new Tween(camera.position)
      .to(targetPosition, 1000)
      .easing(Easing.Quadratic.InOut)
      .start(tweenGroup);

    new Tween(controls.target)
      .to(targetLookAt, 1000)
      .easing(Easing.Quadratic.InOut)
      .start(tweenGroup);
  }

  function showBuildingInfo(feature) {
    const infoPanel = document.getElementById('building-info');
    infoPanel.innerHTML = `
      <h3>${feature.properties.name || 'Unnamed Building'}</h3>
      <p>Levels: ${feature.properties['building:levels'] || 'N/A'}</p>
    `;
  }

  function getAllInteractiveMeshes() {
    const meshes = [];

    scene.children.forEach(obj => {
      if (obj.userData?.feature || obj.userData?.group === "outdoor") {
        obj.traverse(child => {
          if (child.isMesh)
            meshes.push(child);
        });
      }
    });
    return meshes;
  }

    // Hover effect
    canvas.addEventListener('mousemove', (event) => {
    if (isMouseOverDetailView(event)) return;

    const rect = canvas.getBoundingClientRect();
    mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(getAllInteractiveMeshes(), false);

    if (intersects.length > 0) {
      let building = intersects[0]?.object;
      while (building && !building.userData?.feature && building.userData?.group !== "outdoor") {
        building = building.parent;
      }
      if (building && currentHighlight !== building) {
        resetHighlight();
        highlightBuilding(building);
      }
    } else {
      resetHighlight();
    }
  });

  // Click handling
  canvas.addEventListener('click', (event) => {
    if (isMouseOverDetailView(event)) return;

    if (currentHighlight) {
      if (selectedBuilding) {
        const meshes = [selectedBuilding, ...selectedBuilding.children.filter(c => c.isMesh)];
        meshes.forEach(mesh => {
          const original = originalMaterials.get(mesh);
          if (original) mesh.material.copy(original);
          mesh.scale.set(1, 1, 1);
        });
      }

      selectedBuilding = currentHighlight;

      const selectedMeshes = [selectedBuilding, ...selectedBuilding.children.filter(c => c.isMesh)];
      selectedMeshes.forEach(mesh => {
        mesh.material.color.set(0x3366ff); // Color kept after select
      });

      if (currentHighlight.userData?.group === "outdoor") {
        const sensorData = {
          device_id: currentHighlight.userData.device_id,
          readings: currentHighlight.userData.allReadings
        };

        const pseudoFeature = {
          properties: {
            name: "Outdoor Sensor",
            "building:levels": 1
          }
        };

        const allReadings = currentHighlight.userData.allReadings || [];
        const flattenedReadings = allReadings.map(r => ({
          ...r,
          floor: r.floor ?? 'unknown'
        }));

        window.selectedBuilding = {
          userData: {
            indoorSensors: flattenedReadings
          }
        };

        showBuildingInfo(pseudoFeature);
        showBuildingDetailView(currentHighlight, pseudoFeature);
        return;
      }

      focusOnBuilding(currentHighlight);
      showBuildingInfo(currentHighlight.userData.feature);
      showBuildingDetailView(currentHighlight, currentHighlight.userData.feature);
      zoomToBuilding(currentHighlight);
    }
  });

  function isMouseOverDetailView(event) {
    const menu = document.getElementById('building-detail-view');
    if (!menu || menu.style.display === 'none') return false;

    const rect = menu.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  // debug to find out coordinates
/*  canvas.addEventListener('mousemove', (event) => {
    const SCALE_FACTOR = 100000;
    const CENTER_LON = 26.050477;
    const CENTER_LAT = 44.438822;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeZ, intersect);

    if (intersect) {
      const x = intersect.x;
      const y = intersect.y;
      const latitude = y / SCALE_FACTOR + CENTER_LAT;
      const longitude = x / SCALE_FACTOR + CENTER_LON;

      console.log(`Mouse @ x: ${x.toFixed(2)}, y: ${y.toFixed(2)} => latitude: ${latitude.toFixed(6)}, longitude: ${longitude.toFixed(6)}`);
    }
  });*/
}

export function clearSelectedBuilding() {
  if (selectedBuilding) {
    const meshes = [selectedBuilding, ...selectedBuilding.children.filter(c => c.isMesh)];
    meshes.forEach(mesh => {
      const original = originalMaterials.get(mesh);
      if (original) {
        mesh.material.copy(original);
        originalMaterials.delete(mesh);
      }
      mesh.scale.set(1, 1, 1);
    });
    selectedBuilding = null;
  }
}