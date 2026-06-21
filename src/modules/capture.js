/**
 * Capture Module - Handles image selection, cropping, and preview
 */

import { PerspectiveCrop } from '../perspective-crop.js';
import { config } from '../config.js';
import { eventBus } from '../event-bus.js';
import { stateManager } from '../state.js';
import { getProfile } from '../profile.js';
import { showToast, showLoadingOverlay, updateLoadingOverlay, dismissLoadingOverlay } from './ui-utils.js';
import { optimizeForAPI, getImageDimensions } from '../image-processor.js';

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
  if (!file) return;
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
  if (!file) return;
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
  if (!cropper) return;

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

  // Clear input values
  cameraInput.value = '';
  fileInput.value = '';
}

/**
 * Save cropped image to device
 */
function handleSaveCrop() {
  const imageData = stateManager.getState('capturedImageData');
  if (!imageData) return;

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
  const loadingOverlay = showLoadingOverlay(
    'Analyzing form and filling fields...',
    'Step 1/3: Detecting form fields...'
  );

  try {
    // Update progress
    updateLoadingOverlay(loadingOverlay, 'Analyzing form and filling fields...', 'Step 2/3: Matching your data...');
    const result = await analyzeAndFill(imageData, profile);

    if (!result.fields || result.fields.length === 0) {
      throw new Error(config.MESSAGES.noFieldsDetected);
    }

    // Final step
    updateLoadingOverlay(loadingOverlay, 'Analyzing form and filling fields...', 'Step 3/3: Positioning text...');

    // Emit event for result module to handle
    eventBus.emit('form:analyzing-complete', {
      imageData,
      fields: result.fields,
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
