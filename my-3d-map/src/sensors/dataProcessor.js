export function processSensorData(sensors) {
    return sensors.reduce((acc, sensor) => {
      const floor = sensor.Floor || '1';
      const key = `${floor}_${sensor.sensor_id}`;

      if (!acc[key]) {
        acc[key] = {
          ...sensor,
          timestamps: [],
          values: [],
          historyFetched: false
        };
      }

      acc[key].timestamps.push(new Date(sensor.timestamp));
      acc[key].values.push(sensor.value);

      return acc;
    }, {});
  }

  export function groupByFloor(sensorMap) {
    return Object.values(sensorMap).reduce((acc, sensor) => {
      const floor = sensor.Floor || '1';
      acc[floor] = acc[floor] || [];
      acc[floor].push(sensor);
      return acc;
    }, {});
  }
