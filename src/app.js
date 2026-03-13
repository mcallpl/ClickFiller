import { PerspectiveCrop } from './perspective-crop.js';
import { loadProfile, saveProfile, getProfile, setupAutoSave } from './profile.js';
import { fillFormOnCanvas, renderToCanvas, saveResult, restoreResult, hasSavedResult, clearSavedResult, addTextField, addSignatureOverlay } from './canvas-fill.js';
import { addSignature, renderSignatureList, pickSignature } from './signatures.js';
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
const saveCropBtn = document.getElementById('save-crop-btn');
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
  // Always reset capture view to clean state
  if (name === 'capture') {
    resetCapture();
    // Show resume button if there's saved work
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
      resumeBtn.style.display = hasSavedResult() ? '' : 'none';
    }
  }
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

// Load a previously saved/cropped form — skip cropping
const savedInput = document.getElementById('saved-input');
savedInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    capturedImageData = ev.target.result;
    showPreview(capturedImageData);
  };
  reader.readAsDataURL(file);
});

// Cropper
function showCropper(dataUrl) {
  capturePrompt.style.display = 'none';
  cropContainer.style.display = 'flex';

  // Small delay so the container is fully laid out before measuring
  const cropWrapper = document.getElementById('crop-wrapper');
  requestAnimationFrame(() => {
    cropper = new PerspectiveCrop(cropWrapper, dataUrl);
  });
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

// Save cropped image to device
saveCropBtn.addEventListener('click', () => {
  if (!capturedImageData) return;
  const link = document.createElement('a');
  link.download = 'cropped-form.jpg';
  link.href = capturedImageData;
  link.click();
});

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

// Resize image to keep payload under server limits
// Returns { dataUrl, width, height } so we can send dimensions to the API
function resizeImage(dataUrl, maxDim = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round(h * maxDim / w);
          w = maxDim;
        } else {
          w = Math.round(w * maxDim / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.75), width: w, height: h });
    };
    img.src = dataUrl;
  });
}

// API call to backend
async function analyzeAndFill(imageDataUrl, profile) {
  // Resize to keep under server payload limit
  const resized = await resizeImage(imageDataUrl);

  const response = await fetch('api/analyze.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: resized.dataUrl,
      imageWidth: resized.width,
      imageHeight: resized.height,
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

// Add text field
const addTextBtn = document.getElementById('add-text-btn');
addTextBtn.addEventListener('click', () => {
  addTextField();
});

// Add signature
const addSigBtn = document.getElementById('add-sig-btn');
addSigBtn.addEventListener('click', async () => {
  const sigUrl = await pickSignature();
  if (sigUrl) {
    addSignatureOverlay(sigUrl);
  }
});

// Save field positions
const savePositionsBtn = document.getElementById('save-positions-btn');
savePositionsBtn.addEventListener('click', () => {
  try {
    saveResult();
    showToast('Positions saved!');
  } catch (err) {
    console.error('Save error:', err);
    alert('Could not save — storage may be full. Try clearing old data.');
  }
});

// Download PDF — flatten draggable overlays onto canvas first
downloadBtn.addEventListener('click', async () => {
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Rendering...';
  try {
    await renderToCanvas(resultCanvas);
    exportToPdf(resultCanvas);
  } catch (err) {
    console.error('PDF export error:', err);
    alert('Error exporting PDF: ' + err.message);
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'PDF';
  }
});

// New form — go back to capture but DON'T delete saved work
newFormBtn.addEventListener('click', () => {
  showView('capture');
  resetCapture();
});

// Resume last edit
const resumeBtn = document.getElementById('resume-btn');
if (hasSavedResult()) {
  resumeBtn.style.display = '';
}
resumeBtn.addEventListener('click', async () => {
  resumeBtn.disabled = true;
  resumeBtn.textContent = 'Loading...';
  try {
    const restored = await restoreResult();
    if (restored) {
      Object.values(views).forEach(v => v.classList.remove('active'));
      views.result.classList.add('active');
    } else {
      alert('No saved result found.');
    }
  } catch (err) {
    console.error('Resume error:', err);
    alert('Could not restore: ' + err.message);
  } finally {
    resumeBtn.disabled = false;
    resumeBtn.textContent = 'Resume Last Edit';
  }
});

// Profile management
loadProfile();
setupAutoSave();

// Signature management
renderSignatureList();
document.getElementById('sig-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await addSignature(file);
  renderSignatureList();
  showToast('Signature saved!');
  e.target.value = '';
});

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
