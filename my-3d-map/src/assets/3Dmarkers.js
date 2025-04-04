import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const CENTER_LON = 26.045184;
const CENTER_LAT = 44.4349638;
const SCALE_FACTOR = 100000;

export function createBuildingMarkers(geojson, scene) {
    geojson.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0];

            // Calculate centroid
            const centroid = coords.reduce((acc, coord) => {
                return [acc[0] + coord[0], acc[1] + coord[1]];
            }, [0, 0]).map(sum => sum / coords.length);

            // Convert to local coordinates
            const x = (centroid[0] - CENTER_LON) * SCALE_FACTOR;
            const y = (centroid[1] - CENTER_LAT) * SCALE_FACTOR;

            // Get building height
            const levels = feature.properties["building:levels"];
            const height = levels ? parseFloat(levels) * 3 : 10;

            // Create marker element
            const markerElement = document.createElement('img');
            markerElement.className = 'building-marker';
            markerElement.src = 'leaflet/images/marker-icon-grey.png';
            markerElement.style.width = '32px';
            markerElement.style.height = '32px';
            markerElement.dataset.buildingId = feature.id;

            // Create 2D label and position it
            const label = new CSS2DObject(markerElement);
            label.position.set(x, y, height + 5); // 5 units above building
            scene.add(label);
        }
    });
}
