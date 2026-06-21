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
import { showToast, showErrorNotification, showWarningNotification, showLoadingOverlay, dismissLoadingOverlay } from './ui-utils.js';

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
function handleClearAllData() {
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
  if (!file) return;

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
  row.innerHTML = `
    <input type="text" placeholder="Field name" class="${config.CLASS_NAMES.customLabel}" value="${label}">
    <input type="text" placeholder="Value" class="${config.CLASS_NAMES.customValue}" value="${value}">
    <button class="${config.CLASS_NAMES.removeField}">&times;</button>
  `;
  row.querySelector(`.${config.CLASS_NAMES.removeField}`).addEventListener('click', () => {
    row.remove();
  });
  customFieldsContainer.appendChild(row);
}

// Make function available globally for profile.js backward compatibility
window.addCustomFieldRow = addCustomFieldRow;
