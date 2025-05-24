export function getTimeRangeDates(timeRange, referenceDate = new Date()) {
  let startDate, endDate;
  endDate = referenceDate ? new Date(referenceDate) : new Date();
  endDate.setDate(endDate.getDate() + 1);
  switch (timeRange) {
    case 'last_week':
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_month':
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_3_months':
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'last_year':
      startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0); // All data
  }
  return { startDate, endDate };
}

export const timeRanges = {
  last_week: 7 * 24 * 60 * 60 * 1000,
  last_month: 30 * 24 * 60 * 60 * 1000,
  last_3_months: 90 * 24 * 60 * 60 * 1000,
  last_year: 365 * 24 * 60 * 60 * 1000
};

export function filterSensorDataByTimeRange(sensors, timeRange, referenceDate) {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  now.setDate(now.getDate() + 1);
  const rangeMs = timeRanges[timeRange] || 0;
  if (rangeMs === 0) return sensors;
  const startDate = new Date(now.getTime() - rangeMs);
  return sensors.filter(sensor => {
    const ts = new Date(sensor.timestamp);
    return ts >= startDate && ts <= now;
  });
}