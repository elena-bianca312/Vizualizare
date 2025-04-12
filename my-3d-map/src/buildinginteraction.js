import * as THREE from "three";
import { Tween, Easing } from "../node_modules/@tweenjs/tween.js/dist/tween.esm.js";
import { tweenGroup } from "./threeview.js";
import { showBuildingDetailView } from "./buildingmenu.js";

export function setupBuildingInteraction(scene, camera, controls) {
  const canvas = document.getElementById("three-canvas");
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let currentHighlight = null;
  const originalMaterials = new Map();

  // Hover effect
  window.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();

    mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);

    // Only check building meshes (ignore wireframes and tiles)
    const intersects = raycaster.intersectObjects(getAllBuildingMeshes(), false);

    if (intersects.length > 0) {
      let building = intersects[0].object;
      while (building && !building.userData?.feature) {
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
  window.addEventListener('click', () => {
    if (currentHighlight) {
      focusOnBuilding(currentHighlight);
      showBuildingInfo(currentHighlight.userData.feature);

      // Detailed view of the building
      showBuildingDetailView(currentHighlight, currentHighlight.userData.feature);
    }
  });

  function highlightBuilding(building) {
    const allMeshes = [building, ...building.children.filter(c => c.isMesh)];

    allMeshes.forEach(mesh => {
      originalMaterials.set(mesh, mesh.material.clone());
      mesh.material.color.set(0x00ff00); // Highlight color
    });

    currentHighlight = building;
  }

  function resetHighlight() {
    if (currentHighlight) {
      const allMeshes = [currentHighlight, ...currentHighlight.children.filter(c => c.isMesh)];

      allMeshes.forEach(mesh => {
        const original = originalMaterials.get(mesh);
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

  function getAllBuildingMeshes() {
    const meshes = [];

    scene.children.forEach(obj => {
      if (obj.userData?.feature) {
        obj.traverse(child => {
          if (child.isMesh) {
            meshes.push(child);
          }
        });
      }
    });

    return meshes;
  }
}
