import { StorageManager } from './storage-manager.js';

export function loadProfile() {
  const data = StorageManager.loadProfile();
  if (!data) return;

  try {
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
  } catch (e) {
    console.error('Failed to load profile:', e);
  }
}

export function saveProfile() {
  const data = gatherProfileData();
  const result = StorageManager.saveProfile(data);

  if (!result.success) {
    console.error('Profile save failed:', result.error);
    // Show user-facing error
    if (result.error.includes('too large')) {
      showProfileError(result.error + ' Please remove signatures or custom fields.');
    } else if (result.error.includes('Validation failed')) {
      showProfileError('Some profile fields have invalid values. Please check and correct them.');
    } else {
      showProfileError('Failed to save profile: ' + result.error);
    }
    return false;
  }

  // Check for quota warning
  const usage = StorageManager.getStorageUsage();
  if (usage.percentFull > 85) {
    const suggestions = StorageManager.getCleanupSuggestions();
    const msg = `Your profile is ${Math.round(usage.percentFull)}% full. ` + suggestions.join(' ');
    showProfileWarning(msg);
  }

  return true;
}

export function getProfile() {
  // Always gather fresh from the form inputs if they exist
  const formExists = document.querySelector('#profile-form input[data-key]');
  if (formExists) {
    const data = gatherProfileData();
    // Only return form data if there's something in it
    const keys = Object.keys(data).filter(k => k !== '_custom');
    if (keys.length > 0) return data;
  }

  // Fall back to stored data
  return StorageManager.loadProfile();
}

function gatherProfileData() {
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

  return data;
}

/**
 * Auto-save: call this once after loadProfile to set up listeners
 * that save on every input change.
 */
export function setupAutoSave() {
  const form = document.getElementById('profile-form');
  if (!form) return;

  let debounceTimer;
  form.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveProfile();
    }, 500);
  });

  // Also save before page unload as a safety net
  window.addEventListener('beforeunload', () => {
    saveProfile();
  });

  // Save on visibility change (user switches tabs/apps on mobile)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveProfile();
    }
  });
}

/**
 * Show error message to user
 */
function showProfileError(message) {
  // Create and display error notification
  const errorEl = document.createElement('div');
  errorEl.className = 'profile-error-message';
  errorEl.textContent = message;
  errorEl.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #d32f2f;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000;
    font-size: 14px;
    max-width: 80%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(errorEl);
  console.error('Profile error:', message);

  setTimeout(() => errorEl.remove(), 5000);
}

/**
 * Show warning message to user
 */
function showProfileWarning(message) {
  const warningEl = document.createElement('div');
  warningEl.className = 'profile-warning-message';
  warningEl.textContent = message;
  warningEl.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff9800;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 1000;
    font-size: 14px;
    max-width: 80%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(warningEl);
  console.warn('Profile warning:', message);

  setTimeout(() => warningEl.remove(), 6000);
}

/**
 * Clear all user data (GDPR right to deletion)
 * Removes: profile data, saved results, signatures, images
 */
export function clearAllData() {
  // Confirm with user
  const confirmed = window.confirm(
    'This will permanently delete all your saved data (profile, signatures, forms). This action cannot be undone. Continue?'
  );
  if (!confirmed) return false;

  try {
    // Clear profile from localStorage
    StorageManager.clearProfile();

    // Clear any saved result image
    localStorage.removeItem('clickfiller_saved_result');

    // Clear any captured image from session
    const previewImg = document.getElementById('preview-img');
    if (previewImg) {
      previewImg.src = '';
    }

    // Clear any canvas
    const resultCanvas = document.getElementById('result-canvas');
    if (resultCanvas) {
      const ctx = resultCanvas.getContext('2d');
      ctx?.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    }

    // Clear all form inputs
    document.querySelectorAll('#profile-form input[data-key]').forEach(input => {
      input.value = '';
    });

    // Clear custom fields
    const customFields = document.getElementById('custom-fields');
    if (customFields) {
      customFields.innerHTML = '';
    }

    // Clear signatures (stored in localStorage as 'clickfiller_signatures')
    localStorage.removeItem('clickfiller_signatures');

    showProfileWarning('All your data has been deleted. You can now close this browser.');
    return true;
  } catch (e) {
    console.error('Error clearing data:', e);
    showProfileError('Failed to clear all data: ' + e.message);
    return false;
  }
}
