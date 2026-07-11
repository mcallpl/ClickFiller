/**
 * Capture Module - Handles image selection, cropping, and preview
 */

import { PerspectiveCrop } from '../perspective-crop.js';
import { config } from '../config.js';
import { eventBus } from '../event-bus.js';
import { stateManager } from '../state.js';
import { getProfile, saveProfile } from '../profile.js';
import { showLoadingOverlay, updateLoadingOverlay, dismissLoadingOverlay } from './ui-utils.js';
import { optimizeForAPI, getImageDimensions } from '../image-processor.js';
import { askForMissingFields } from '../components/missing-fields-modal.js';

let cameraInput = null;
let fileInput = null;
let savedInput = null;
let capturePrompt = null;
let cropContainer = null;
let cropCancelBtn = null;
let cropConfirmBtn = null;
let previewContainer = null;
let previewImg = null;
let saveCropBtn = null;
let retakeBtn = null;
let fillBtn = null;
let processing = null;

/**
 * Initialize capture module
 */
export function initCapture() {
  // Cache DOM elements
  cameraInput = document.getElementById('camera-input');
  fileInput = document.getElementById('file-input');
  savedInput = document.getElementById('saved-input');
  capturePrompt = document.getElementById('capture-prompt');
  cropContainer = document.getElementById('crop-container');
  cropCancelBtn = document.getElementById('crop-cancel-btn');
  cropConfirmBtn = document.getElementById('crop-confirm-btn');
  previewContainer = document.getElementById('preview-container');
  previewImg = document.getElementById('preview-img');
  saveCropBtn = document.getElementById('save-crop-btn');
  retakeBtn = document.getElementById('retake-btn');
  fillBtn = document.getElementById('fill-btn');
  processing = document.getElementById('processing');

  // Set up event listeners
  cameraInput.addEventListener('change', handleImageSelect);
  fileInput.addEventListener('change', handleImageSelect);
  savedInput.addEventListener('change', handleSavedImageSelect);
  cropConfirmBtn.addEventListener('click', handleCropConfirm);
  cropCancelBtn.addEventListener('click', resetCapture);
  saveCropBtn.addEventListener('click', handleSaveCrop);
  retakeBtn.addEventListener('click', resetCapture);
  fillBtn.addEventListener('click', handleFillForm);

  // Listen for capture reset event from navigation
  eventBus.on('capture:reset', () => {
    resetCapture();
  });
}

/**
 * Handle image selection from camera or file
 */
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    showCropper(ev.target.result);
  };
  reader.readAsDataURL(file);
}

/**
 * Handle loading a previously saved/cropped form (skip cropping)
 */
function handleSavedImageSelect(e) {
  const file = e.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    stateManager.setState('capturedImageData', ev.target.result);
    showPreview(ev.target.result);
  };
  reader.readAsDataURL(file);
}

/**
 * Show the perspective crop tool
 */
function showCropper(dataUrl) {
  capturePrompt.style.display = 'none';
  cropContainer.style.display = 'flex';

  // Small delay so the container is fully laid out before measuring
  const cropWrapper = document.getElementById('crop-wrapper');
  requestAnimationFrame(() => {
    const cropper = new PerspectiveCrop(cropWrapper, dataUrl);
    stateManager.setState('cropper', cropper);
  });
}

/**
 * Handle crop confirmation
 */
function handleCropConfirm() {
  const cropper = stateManager.getState('cropper');
  if (!cropper) {
    return;
  }

  const croppedImage = cropper.getCroppedImage();
  stateManager.setState('capturedImageData', croppedImage);
  cropper.destroy();
  stateManager.setState('cropper', null);
  cropContainer.style.display = 'none';
  showPreview(croppedImage);
}

/**
 * Show preview of cropped/selected image
 */
function showPreview(dataUrl) {
  previewImg.src = dataUrl;
  previewContainer.style.display = 'block';
  capturePrompt.style.display = 'none';
}

/**
 * Reset capture view to clean state
 */
export function resetCapture() {
  previewContainer.style.display = 'none';
  cropContainer.style.display = 'none';
  capturePrompt.style.display = 'block';
  processing.style.display = 'none';

  // Clean up cropper
  const cropper = stateManager.getState('cropper');
  if (cropper) {
    cropper.destroy();
    stateManager.setState('cropper', null);
  }

  // Clear state
  stateManager.setState('capturedImageData', null);

  // Clear input values. savedInput must be cleared too — otherwise re-selecting
  // the SAME saved file fires no `change` event (value unchanged) and nothing
  // happens.
  cameraInput.value = '';
  fileInput.value = '';
  if (savedInput) {
    savedInput.value = '';
  }
}

/**
 * Save cropped image to device
 */
function handleSaveCrop() {
  const imageData = stateManager.getState('capturedImageData');
  if (!imageData) {
    return;
  }

  const link = document.createElement('a');
  link.download = 'cropped-form.jpg';
  link.href = imageData;
  link.click();
}

/**
 * Handle fill form button click
 */
async function handleFillForm() {
  const imageData = stateManager.getState('capturedImageData');
  if (!imageData) {
    eventBus.emit('error:occurred', {
      message: config.MESSAGES.noImage,
      title: 'No Image Selected',
      userFacing: true,
    });
    return;
  }

  const profile = getProfile();
  if (!profile || Object.keys(profile).filter(k => k !== '_custom').length === 0) {
    eventBus.emit('error:occurred', {
      message: config.MESSAGES.noProfile,
      title: 'Profile Missing',
      userFacing: true,
      action: {
        label: 'Go to Profile',
        callback: () => {
          eventBus.emit('navigation:go-to-view', { view: 'profile' });
        },
      },
    });
    return;
  }

  previewContainer.style.display = 'none';
  fillBtn.disabled = true;
  stateManager.setState('isProcessing', true);

  // Show loading overlay with progress
  let loadingOverlay = showLoadingOverlay(
    'Analyzing form and filling fields...',
    'Step 1/3: Detecting form fields...',
  );

  try {
    // Update progress
    updateLoadingOverlay(loadingOverlay, 'Analyzing form and filling fields...', 'Step 2/3: Matching your data...');
    const result = await analyzeAndFill(imageData, profile);

    const fields = result.fields || [];
    const missing = result.missingFields || [];
    if (fields.length === 0 && missing.length === 0) {
      throw new Error(config.MESSAGES.noFieldsDetected);
    }

    // The AI found fields the profile has no data for — ask the user now,
    // save the answers to the profile, and place them like any other field.
    if (missing.length > 0) {
      dismissLoadingOverlay(loadingOverlay);
      const answers = await askForMissingFields(missing);
      loadingOverlay = showLoadingOverlay(
        'Analyzing form and filling fields...',
        'Step 3/3: Positioning text...',
      );

      const answeredLabels = Object.keys(answers);
      if (answeredLabels.length > 0) {
        saveAnswersToProfile(answers);
        missing.forEach(f => {
          const value = answers[f.label.trim()];
          if (value) {
            fields.push({ ...f, value });
          }
        });
      }
    }

    if (fields.length === 0) {
      throw new Error(config.MESSAGES.noFieldsDetected);
    }

    // Final step
    updateLoadingOverlay(loadingOverlay, 'Analyzing form and filling fields...', 'Step 3/3: Positioning text...');

    // Emit event for result module to handle
    eventBus.emit('form:analyzing-complete', {
      imageData,
      fields,
    });
  } catch (err) {
    console.error('Fill error:', err);
    eventBus.emit('error:occurred', {
      message: err.message,
      title: 'Analysis Failed',
      userFacing: true,
    });
    previewContainer.style.display = 'block';
  } finally {
    stateManager.setState('isProcessing', false);
    fillBtn.disabled = false;
    dismissLoadingOverlay(loadingOverlay);
  }
}

/**
 * Turn a raw form label from the AI (e.g. "WEIGHT (lb)", "BIRTHDATE *
 * (MM/DD/YYYY)") into a clean, storable custom-field name ("Weight",
 * "Birthdate"). Parenthetical hints and stray punctuation are dropped so the
 * saved name passes profile validation and matches cleanly on future forms.
 * @param {string} raw - the AI's field label
 * @returns {string} a tidy field name, or '' if nothing usable remains
 */
function normalizeFieldLabel(raw) {
  return String(raw)
    .replace(/\([^)]*\)/g, ' ')                  // drop parenthetical hints
    .replace(/[*:]/g, ' ')                        // drop asterisks / colons
    .replace(/[^a-zA-Z0-9\s\-&'#]/g, ' ')         // strip other punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())     // Title Case for tidiness
    .slice(0, 50)
    .trim();
}

/**
 * Save user-provided answers for missing fields into the profile as custom
 * fields (updating an existing row if the label already exists), so the app
 * never has to ask for the same information twice.
 * @param {Object} answers - map of label -> value
 */
function saveAnswersToProfile(answers) {
  Object.entries(answers).forEach(([rawLabel, value]) => {
    const label = normalizeFieldLabel(rawLabel);
    if (!label) {
      return;
    }

    let existingRow = null;
    document.querySelectorAll(`.${config.CLASS_NAMES.customFieldRow}`).forEach(row => {
      const rowLabel = row.querySelector(`.${config.CLASS_NAMES.customLabel}`);
      if (rowLabel && rowLabel.value.trim().toLowerCase() === label.toLowerCase()) {
        existingRow = row;
      }
    });

    if (existingRow) {
      existingRow.querySelector(`.${config.CLASS_NAMES.customValue}`).value = value;
    } else if (typeof window.addCustomFieldRow === 'function') {
      window.addCustomFieldRow(label, value);
    }
  });

  saveProfile();
}

/**
 * Call backend API to analyze form
 */
async function analyzeAndFill(imageDataUrl, profile) {
  // Validate image dimensions before processing
  const dims = await getImageDimensions(imageDataUrl);
  if (dims.width < 400 || dims.height < 300) {
    throw new Error('Form image is too small. Please retake the photo with better framing.');
  }
  if (dims.width > 8000 || dims.height > 8000) {
    throw new Error('Form image is too large. Please retake the photo.');
  }

  // Optimize image: resize + progressive compression
  const optimized = await optimizeForAPI(imageDataUrl);

  const response = await fetch(config.API_ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: optimized.dataUrl,
      imageWidth: optimized.width,
      imageHeight: optimized.height,
      profile: profile,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = `HTTP ${response.status}`;
    try {
      const err = JSON.parse(text);
      msg = err.error?.message || err.error || msg;
    } catch {
      msg = text.substring(0, 200) || msg;
    }
    throw new Error(msg);
  }

  return response.json();
}
