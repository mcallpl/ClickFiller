import { PerspectiveCrop } from './perspective-crop.js';
import { loadProfile, saveProfile, getProfile } from './profile.js';
import { fillFormOnCanvas } from './canvas-fill.js';
import { exportToPdf } from './pdf-export.js';

// State
let capturedImageData = null;
let cropper = null;

// DOM Elements
const views = {
  capture: document.getElementById('capture-view'),
  result: document.getElementById('result-view'),
  profile: document.getElementById('profile-view'),
};

const navBtns = document.querySelectorAll('.nav-btn');
const cameraInput = document.getElementById('camera-input');
const fileInput = document.getElementById('file-input');
const capturePrompt = document.getElementById('capture-prompt');
const cropContainer = document.getElementById('crop-container');
const cropCancelBtn = document.getElementById('crop-cancel-btn');
const cropConfirmBtn = document.getElementById('crop-confirm-btn');
const previewContainer = document.getElementById('preview-container');
const previewImg = document.getElementById('preview-img');
const retakeBtn = document.getElementById('retake-btn');
const fillBtn = document.getElementById('fill-btn');
const processing = document.getElementById('processing');
const resultCanvas = document.getElementById('result-canvas');
const downloadBtn = document.getElementById('download-btn');
const newFormBtn = document.getElementById('new-form-btn');
const saveProfileBtn = document.getElementById('save-profile');
const addCustomFieldBtn = document.getElementById('add-custom-field');
const customFieldsContainer = document.getElementById('custom-fields');

// Navigation
function showView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// Handle image selection (both camera and file)
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    showCropper(ev.target.result);
  };
  reader.readAsDataURL(file);
}

cameraInput.addEventListener('change', handleImageSelect);
fileInput.addEventListener('change', handleImageSelect);

// Cropper
function showCropper(dataUrl) {
  capturePrompt.style.display = 'none';
  cropContainer.style.display = 'block';

  const cropWrapper = document.getElementById('crop-wrapper');
  cropper = new PerspectiveCrop(cropWrapper, dataUrl);
}

cropConfirmBtn.addEventListener('click', () => {
  if (!cropper) return;

  capturedImageData = cropper.getCroppedImage();
  cropper.destroy();
  cropper = null;
  cropContainer.style.display = 'none';
  showPreview(capturedImageData);
});

cropCancelBtn.addEventListener('click', () => {
  resetCapture();
});

function showPreview(dataUrl) {
  previewImg.src = dataUrl;
  previewContainer.style.display = 'block';
  capturePrompt.style.display = 'none';
}

function resetCapture() {
  previewContainer.style.display = 'none';
  cropContainer.style.display = 'none';
  capturePrompt.style.display = 'block';
  processing.style.display = 'none';
  capturedImageData = null;
  cameraInput.value = '';
  fileInput.value = '';
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
}

retakeBtn.addEventListener('click', resetCapture);

// Fill form
fillBtn.addEventListener('click', async () => {
  if (!capturedImageData) {
    alert('Please take or upload a photo first.');
    return;
  }

  const profile = getProfile();
  if (!profile || Object.keys(profile).filter(k => k !== '_custom').length === 0) {
    alert('Please fill in your information in the "My Info" tab first.');
    return;
  }

  previewContainer.style.display = 'none';
  processing.style.display = 'block';
  fillBtn.disabled = true;

  try {
    const result = await analyzeAndFill(capturedImageData, profile);
    if (!result.fields || result.fields.length === 0) {
      throw new Error('No fillable fields detected in the form.');
    }
    await fillFormOnCanvas(resultCanvas, capturedImageData, result.fields);
    processing.style.display = 'none';
    Object.values(views).forEach(v => v.classList.remove('active'));
    views.result.classList.add('active');
  } catch (err) {
    console.error('Fill error:', err);
    alert('Error: ' + err.message);
    processing.style.display = 'none';
    previewContainer.style.display = 'block';
  } finally {
    fillBtn.disabled = false;
  }
});

// API call to backend
async function analyzeAndFill(imageDataUrl, profile) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageDataUrl,
      profile: profile,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'Failed to analyze form');
  }

  return response.json();
}

// Download PDF
downloadBtn.addEventListener('click', () => {
  exportToPdf(resultCanvas);
});

// New form
newFormBtn.addEventListener('click', () => {
  showView('capture');
  resetCapture();
});

// Profile management
loadProfile();

saveProfileBtn.addEventListener('click', () => {
  saveProfile();
  showToast('Profile saved!');
});

addCustomFieldBtn.addEventListener('click', () => {
  addCustomFieldRow('', '');
});

function addCustomFieldRow(label, value) {
  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.innerHTML = `
    <input type="text" placeholder="Field name" class="custom-label" value="${label}">
    <input type="text" placeholder="Value" class="custom-value" value="${value}">
    <button class="remove-field">&times;</button>
  `;
  row.querySelector('.remove-field').addEventListener('click', () => row.remove());
  customFieldsContainer.appendChild(row);
}

window.addCustomFieldRow = addCustomFieldRow;

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
