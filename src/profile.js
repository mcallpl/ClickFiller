const STORAGE_KEY = 'clickfiller_profile';
const COOKIE_KEY = 'clickfiller_profile_backup';

export function loadProfile() {
  let saved = localStorage.getItem(STORAGE_KEY);

  // If localStorage is empty, try recovering from cookie backup
  if (!saved) {
    saved = getCookie(COOKIE_KEY);
    if (saved) {
      // Restore to localStorage
      localStorage.setItem(STORAGE_KEY, saved);
    }
  }

  if (!saved) return;

  try {
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
  } catch (e) {
    console.error('Failed to load profile:', e);
  }
}

export function saveProfile() {
  const data = gatherProfileData();
  const json = JSON.stringify(data);

  // Save to localStorage
  localStorage.setItem(STORAGE_KEY, json);

  // Backup to cookie (expires in 5 years)
  setCookie(COOKIE_KEY, json, 365 * 5);
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
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { /* fall through */ }
  }

  // Last resort: cookie
  const cookie = getCookie(COOKIE_KEY);
  if (cookie) {
    try { return JSON.parse(cookie); } catch { /* fall through */ }
  }

  return null;
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

// Cookie helpers
function setCookie(name, value, days) {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    // Cookies have a ~4KB limit, so compress if needed
    let val = value;
    if (val.length > 3800) {
      // Too big for a cookie — just save what we can in localStorage
      return;
    }
    document.cookie = name + '=' + encodeURIComponent(val) + '; expires=' + expires + '; path=/; SameSite=Lax';
  } catch (e) {
    console.warn('Cookie save failed:', e);
  }
}

function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}
