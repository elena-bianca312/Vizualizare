export function createSensorTypeDropdown(uniqueSensorTypes, onChange) {
    // Build dropdown HTML
    const dropdownHtml = `
      <div style="margin: 10px 0;">
        <label for="sensor-type-filter">Sensor Types:</label>
        <div id="sensor-type-dropdown" class="dropdown" style="display: inline-block; position: relative;">
          <button id="sensor-type-dropdown-btn" style="padding: 4px 12px; min-width: 140px;">All</button>
          <div id="sensor-type-dropdown-list" class="dropdown-list" style="display: none; position: absolute; background: #fff; border: 1px solid #ccc; z-index: 100; min-width: 140px; max-height: 220px; overflow-y: auto;">
            <label style="display: block; padding: 4px 10px;">
              <input type="checkbox" value="__all__" checked> <b>All</b>
            </label>
            ${uniqueSensorTypes.map(type => `
              <label style="display: block; padding: 4px 10px;">
                <input type="checkbox" value="${type}" checked> ${type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    return {
        html: dropdownHtml,
        init: function() {
          const dropdownBtn = document.getElementById('sensor-type-dropdown-btn');
          const dropdownList = document.getElementById('sensor-type-dropdown-list');
          const dropdownWrapper = document.getElementById('sensor-type-dropdown');

          // Open/close on button click
          dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownList.style.display = dropdownList.style.display === 'block' ? 'none' : 'block';
          });

          // Prevent closing when clicking inside the dropdown
          dropdownList.addEventListener('click', (e) => {
            e.stopPropagation();
          });

          // Close when clicking outside
          document.addEventListener('click', (e) => {
            if (!dropdownWrapper.contains(e.target)) {
              dropdownList.style.display = 'none';
            }
          });

          const allCheckbox = dropdownList.querySelector('input[value="__all__"]');
          const typeCheckboxes = Array.from(dropdownList.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.value !== '__all__');

          function updateDropdownLabel() {
            const checkedTypes = typeCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
            if (checkedTypes.length === typeCheckboxes.length) {
              dropdownBtn.textContent = 'All';
              allCheckbox.checked = true;
            } else if (checkedTypes.length === 0) {
              dropdownBtn.textContent = 'None';
              allCheckbox.checked = false;
            } else {
              dropdownBtn.textContent = checkedTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
              allCheckbox.checked = false;
            }
          }

          allCheckbox.addEventListener('change', () => {
            typeCheckboxes.forEach(cb => cb.checked = allCheckbox.checked);
            updateDropdownLabel();
            onChange(getSelectedTypes());
          });

          typeCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
              if (typeCheckboxes.every(cb => cb.checked)) {
                allCheckbox.checked = true;
              } else {
                allCheckbox.checked = false;
              }
              updateDropdownLabel();
              onChange(getSelectedTypes());
            });
          });

          function getSelectedTypes() {
            const checked = typeCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
            if (checked.length === 0) {
              return [];
            } else if (checked.length === typeCheckboxes.length) {
              return uniqueSensorTypes;
            }
            return checked;
          }

          // Initial call
          updateDropdownLabel();
          onChange(getSelectedTypes());
        }
      };
    }