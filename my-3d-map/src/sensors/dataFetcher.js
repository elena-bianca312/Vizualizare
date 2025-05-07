import { processSensorData } from './dataProcessor.js';

export async function fetchBuildingSensors(lat, lon) {
  try {
    const response = await fetch(`/indoor_sensors?lat=${lat}&lon=${lon}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const rawData = await response.json();
    console.log('Fetched sensor data:', rawData); // Debug log
    return processSensorData(rawData);
  } catch (error) {
    console.error('Sensor fetch failed:', error);
    return {};
  }
}

export async function fetchSensorHistory(sensorId) {
  try {
    const response = await fetch(`/sensor_history?id=${sensorId}`);
    return await response.json();
  } catch (error) {
    console.error('History fetch failed:', error);
    return [];
  }
}
