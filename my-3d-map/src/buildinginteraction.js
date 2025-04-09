import * as THREE from "three";
import { Tween, Easing } from "../node_modules/@tweenjs/tween.js/dist/tween.esm.js";

export function setupBuildingInteraction(scene, camera, controls) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let currentHighlight = null;
  const originalMaterials = new Map();

  // Hover effect
  window.addEventListener('mousemove', (event) => {
    mouse.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);

    // Only check building meshes (ignore wireframes and tiles)
    const buildings = scene.children.filter(obj => obj.userData && obj.userData.feature);
    const intersects = raycaster.intersectObjects(buildings, false);

    if (intersects.length > 0) {
      const building = intersects[0].object;
      if (currentHighlight !== building) {
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
    }
  });

  function highlightBuilding(building) {
    originalMaterials.set(building, building.material.clone());
    building.material.color.set(0x00ff00); // Highlight color
    currentHighlight = building;
  }

  function resetHighlight() {
    if (currentHighlight) {
      currentHighlight.material.copy(originalMaterials.get(currentHighlight));
      originalMaterials.delete(currentHighlight);
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
    infoPanel.style.display = 'block';
  }
}
