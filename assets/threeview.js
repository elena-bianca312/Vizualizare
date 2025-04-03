import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const CENTER_LON = 26.045184;
const CENTER_LAT = 44.4349638;
const SCALE_FACTOR = 100000; // 1 unit = 0.00001 degrees

export let camera, crosshair, controls;

export function initThreeScene() {
  const center = window.currentMapCenter || { lat: CENTER_LAT, lng: CENTER_LON };
  const x = (center.lng - CENTER_LON) * SCALE_FACTOR;
  const y = (center.lat - CENTER_LAT) * SCALE_FACTOR;

  const scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );
  camera.position.set(x, y, 1000);
  camera.lookAt(x, y, 0);
  camera.up.set(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("three-canvas"),
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  // Fetch buildings
  fetch("/assets/data/buildings.geojson")
    .then((response) => response.json())
    .then((geojson) => {
      geojson.features.forEach((feature) => {
        const coords = feature.geometry.coordinates[0];
        const shape = new THREE.Shape();

        coords.forEach((coord, index) => {
          const [lon, lat] = coord;
          const px = (lon - CENTER_LON) * SCALE_FACTOR;
          const py = (lat - CENTER_LAT) * SCALE_FACTOR;
          if (index === 0) shape.moveTo(px, py);
          else shape.lineTo(px, py);
        });

        const levels = feature.properties["building:levels"];
        let height = levels ? parseFloat(levels) * 3 : 10;
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false,
        });

        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);

        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        mesh.add(wireframe);

        scene.add(mesh);
      });

      loadTiles(center, scene);
      animate();
    });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
}

function loadTiles(center, scene) {
  const zoom = 17;
  const numTiles = 5;
  const centerTile = latLngToTileXY(center.lat, center.lng, zoom);
  const startX = centerTile.x - Math.floor(numTiles / 2);
  const startY = centerTile.y - Math.floor(numTiles / 2);

  const loader = new THREE.TextureLoader();

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
            transparent: true
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
