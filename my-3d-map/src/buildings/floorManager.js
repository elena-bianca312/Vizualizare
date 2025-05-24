// Handle floor-specific UI
import { getTimeRangeDates } from "../assets/utils/timeUtils.js";

export function createFloorTabs(levels) {
    return `
      <div class="floor-nav">
        ${Array.from({length: levels}, (_, i) => `
          <button class="floor-tab ${i === 0 ? 'active' : ''}"
                  data-floor="${i+1}">
            Floor ${i+1}
          </button>
        `).join('')}
      </div>
    `;
  }

export function createFloorSections(levels) {
  return `
    <div class="floor-sections">
      ${Array.from({length: levels}, (_, i) => `
        <section class="floor-section" data-floor="${i+1}"
                  style="${i === 0 ? '' : 'display: none;'}">
          <h4>Floor ${i+1} Sensors</h4>
          <div class="chart-container" id="charts-floor-${i+1}"></div>
        </section>
      `).join('')}
    </div>
  `;
}

// export function initializeFloorNavigation() {
//   document.querySelectorAll('.floor-tab').forEach(tab => {
//     tab.addEventListener('click', () => {
//       const floor = tab.dataset.floor;
//       document.querySelectorAll('.floor-section').forEach(section => {
//         section.style.display = section.dataset.floor === floor ? 'block' : 'none';
//       });
//       document.querySelectorAll('.floor-tab').forEach(t => t.classList.remove('active'));
//       tab.classList.add('active');
//     });
//   });
// }

export function initializeFloorNavigation() {
document.querySelectorAll('.floor-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const floor = tab.dataset.floor;

    // Show only the selected floor section
    document.querySelectorAll('.floor-section').forEach(section => {
      section.style.display = section.dataset.floor === floor ? 'block' : 'none';
    });

    // Update active tab
    document.querySelectorAll('.floor-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // *** ADD THIS: Re-render the sensor data for the selected floor ***
    if (window.selectedBuilding && window.selectedFeature && window.loadAndRenderSensorData) {
      const { startDate, endDate } = getTimeRangeDates(
        window.selectedTimeRange || 'last_week',
        window.selectedDate
      );
      window.loadAndRenderSensorData(
        window.selectedFeature,
        window.selectedTimeRange || 'last_week',
        window.selectedDate,
        startDate,
        endDate
      );
    }
  });
});
}

