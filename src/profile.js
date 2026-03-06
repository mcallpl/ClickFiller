const STORAGE_KEY = 'clickfiller_profile';

export function loadProfile() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  const data = JSON.parse(saved);

  // Fill standard fields
  document.querySelectorAll('#profile-form input[data-key]').forEach(input => {
    if (data[input.dataset.key] !== undefined) {
      input.value = data[input.dataset.key];
    }
  });

  // Fill custom fields
  if (data._custom) {
    data._custom.forEach(({ label, value }) => {
      window.addCustomFieldRow(label, value);
    });
  }
}

export function saveProfile() {
  const data = {};

  document.querySelectorAll('#profile-form input[data-key]').forEach(input => {
    if (input.value.trim()) {
      data[input.dataset.key] = input.value.trim();
    }
  });

  // Gather custom fields
  const customRows = document.querySelectorAll('.custom-field-row');
  if (customRows.length > 0) {
    data._custom = [];
    customRows.forEach(row => {
      const label = row.querySelector('.custom-label').value.trim();
      const value = row.querySelector('.custom-value').value.trim();
      if (label && value) {
        data._custom.push({ label, value });
        data[label] = value;
      }
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProfile() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
}
