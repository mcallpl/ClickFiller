/**
 * Profile Module - Handles profile form UI wiring and custom fields
 */

import { config } from '../config.js';
import { eventBus } from '../event-bus.js';
import {
  loadProfile,
  saveProfile,
  clearAllData,
  setupAutoSave,
} from '../profile.js';
import { addSignature, renderSignatureList } from '../signatures.js';
import { showToast, showErrorNotification, showLoadingOverlay, dismissLoadingOverlay } from './ui-utils.js';
import { showConfirm } from '../components/error-modal.js';

let saveProfileBtn = null;
let clearAllDataBtn = null;
let addCustomFieldBtn = null;
let customFieldsContainer = null;
let sigUpload = null;

/**
 * Initialize profile module
 */
export function initProfile() {
  // Cache DOM elements
  saveProfileBtn = document.getElementById('save-profile');
  clearAllDataBtn = document.getElementById('clear-all-data');
  addCustomFieldBtn = document.getElementById('add-custom-field');
  customFieldsContainer = document.getElementById('custom-fields');
  sigUpload = document.getElementById('sig-upload');

  // Set up event listeners
  saveProfileBtn.addEventListener('click', handleSaveProfile);
  clearAllDataBtn.addEventListener('click', handleClearAllData);
  addCustomFieldBtn.addEventListener('click', handleAddCustomField);
  sigUpload.addEventListener('change', handleSignatureUpload);

  // Initialize profile data loading
  loadProfile();
  setupAutoSave();
  renderSignatureList();
}

/**
 * Handle save profile button
 */
function handleSaveProfile() {
  const success = saveProfile();
  if (success) {
    showToast(config.MESSAGES.profileSaved);
    eventBus.emit('profile:saved', {});
  }
}

/**
 * Handle clear all data button
 */
async function handleClearAllData() {
  const confirmed = await showConfirm(
    'Delete all data?',
    'This will permanently delete all your saved data (profile, signatures, forms). This action cannot be undone.',
    { confirmLabel: 'Delete Everything', cancelLabel: 'Cancel', danger: true },
  );
  if (!confirmed) {
    return;
  }

  if (clearAllData()) {
    showToast(config.MESSAGES.allDataCleared);

    // Clear form inputs immediately
    document.querySelectorAll('#profile-form input[data-key]').forEach(input => {
      input.value = '';
    });

    eventBus.emit('profile:cleared', {});
  }
}

/**
 * Handle add custom field button
 */
function handleAddCustomField() {
  addCustomFieldRow('', '');
}

/**
 * Handle signature file upload
 */
async function handleSignatureUpload(e) {
  const file = e.target.files[0];
  if (!file) {
    return;
  }

  const loadingOverlay = showLoadingOverlay('Optimizing signature image...');

  try {
    await addSignature(file);
    renderSignatureList();
    showToast(config.MESSAGES.signatureSaved, 'success');
    eventBus.emit('signature:saved', {});
  } catch (err) {
    console.error('Signature upload error:', err);
    showErrorNotification(`Failed to save signature: ${err.message}`, 'Signature Upload Failed');
  } finally {
    dismissLoadingOverlay(loadingOverlay);
    sigUpload.value = '';
  }
}

/**
 * Add a custom field row to the profile form
 * @param {string} label - field label
 * @param {string} value - field value
 */
function addCustomFieldRow(label, value) {
  const row = document.createElement('div');
  row.className = config.CLASS_NAMES.customFieldRow;

  // Build inputs with the DOM API and assign the saved strings via the `.value`
  // PROPERTY (not an HTML attribute). This treats them as literal text, so a
  // value like `" onfocus="..."` can never break out of the attribute and
  // inject markup — which the previous innerHTML template allowed (stored XSS).
  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'Field name';
  labelInput.className = config.CLASS_NAMES.customLabel;
  labelInput.value = label || '';

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'Value';
  valueInput.className = config.CLASS_NAMES.customValue;
  valueInput.value = value || '';

  const removeBtn = document.createElement('button');
  removeBtn.className = config.CLASS_NAMES.removeField;
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    row.remove();
  });

  row.append(labelInput, valueInput, removeBtn);
  customFieldsContainer.appendChild(row);
}

// Make function available globally for profile.js backward compatibility
window.addCustomFieldRow = addCustomFieldRow;
