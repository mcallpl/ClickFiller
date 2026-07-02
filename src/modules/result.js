/**
 * Result Module - Handles form filling, field editing, and PDF export
 */

import { config } from '../config.js';
import { eventBus } from '../event-bus.js';
import { showView } from './navigation.js';
import {
  fillFormOnCanvas,
  renderToCanvas,
  saveResult,
  restoreResult,
  addTextField,
  addSignatureOverlay,
} from '../canvas-fill.js';
import { exportToPdf } from '../pdf-export.js';
import { pickSignature } from '../signatures.js';
import { showToast, showErrorNotification, showLoadingOverlay, dismissLoadingOverlay } from './ui-utils.js';

let resultCanvas = null;
let downloadBtn = null;
let newFormBtn = null;
let addTextBtn = null;
let addSigBtn = null;
let savePositionsBtn = null;
let resumeBtn = null;

/**
 * Initialize result module
 */
export function initResult() {
  // Cache DOM elements
  resultCanvas = document.getElementById('result-canvas');
  downloadBtn = document.getElementById('download-btn');
  newFormBtn = document.getElementById('new-form-btn');
  addTextBtn = document.getElementById('add-text-btn');
  addSigBtn = document.getElementById('add-sig-btn');
  savePositionsBtn = document.getElementById('save-positions-btn');
  resumeBtn = document.getElementById('resume-btn');

  // Set up event listeners
  downloadBtn.addEventListener('click', handleDownloadPdf);
  newFormBtn.addEventListener('click', handleNewForm);
  addTextBtn.addEventListener('click', handleAddText);
  addSigBtn.addEventListener('click', handleAddSignature);
  savePositionsBtn.addEventListener('click', handleSavePositions);
  resumeBtn.addEventListener('click', handleResume);

  // Listen for form analysis completion
  eventBus.on('form:analyzing-complete', async (data) => {
    await handleFormAnalysisComplete(data);
  });
}

/**
 * Handle form analysis completion - fill the form on canvas
 */
async function handleFormAnalysisComplete(data) {
  const { imageData, fields } = data;

  try {
    await fillFormOnCanvas(resultCanvas, imageData, fields);

    // Switch to result view
    const views = {
      capture: document.getElementById('capture-view'),
      result: document.getElementById('result-view'),
      profile: document.getElementById('profile-view'),
    };
    Object.values(views).forEach(v => v.classList.remove(config.CLASS_NAMES.active));
    views.result.classList.add(config.CLASS_NAMES.active);

    // Update nav buttons
    document.querySelectorAll(`.${config.CLASS_NAMES.navBtn}`).forEach(btn => {
      btn.classList.toggle(config.CLASS_NAMES.active, btn.dataset.view === config.VIEWS.result);
    });

    eventBus.emit('view:changed', { view: config.VIEWS.result });
  } catch (err) {
    console.error('Fill form error:', err);
    eventBus.emit('error:occurred', {
      message: err.message,
      userFacing: true,
    });
  }
}

/**
 * Handle add text button
 */
function handleAddText() {
  addTextField();
}

/**
 * Handle add signature button
 */
async function handleAddSignature() {
  const sigUrl = await pickSignature();
  if (sigUrl) {
    addSignatureOverlay(sigUrl);
  }
}

/**
 * Handle save positions button
 */
function handleSavePositions() {
  try {
    saveResult();
    showToast(config.MESSAGES.positionsSaved);
  } catch (err) {
    console.error('Save error:', err);
    showErrorNotification(config.MESSAGES.storageFull);
  }
}

/**
 * Handle download PDF button
 */
async function handleDownloadPdf() {
  downloadBtn.disabled = true;
  const loadingOverlay = showLoadingOverlay('Generating PDF...');
  try {
    await renderToCanvas(resultCanvas);
    exportToPdf(resultCanvas);
    showToast('PDF downloaded successfully!', 'success');
  } catch (err) {
    console.error('PDF export error:', err);
    eventBus.emit('error:occurred', {
      message: err.message,
      title: 'PDF Export Failed',
      userFacing: true,
    });
  } finally {
    downloadBtn.disabled = false;
    dismissLoadingOverlay(loadingOverlay);
  }
}

/**
 * Handle new form button - go back to capture
 */
function handleNewForm() {
  showView(config.VIEWS.capture);
}

/**
 * Handle resume last edit button
 */
async function handleResume() {
  resumeBtn.disabled = true;
  const loadingOverlay = showLoadingOverlay('Loading saved form...');
  try {
    const restored = await restoreResult();
    if (restored) {
      // Switch to result view
      const views = {
        capture: document.getElementById('capture-view'),
        result: document.getElementById('result-view'),
        profile: document.getElementById('profile-view'),
      };
      Object.values(views).forEach(v => v.classList.remove(config.CLASS_NAMES.active));
      views.result.classList.add(config.CLASS_NAMES.active);

      // Update nav buttons
      document.querySelectorAll(`.${config.CLASS_NAMES.navBtn}`).forEach(btn => {
        btn.classList.toggle(config.CLASS_NAMES.active, btn.dataset.view === config.VIEWS.result);
      });

      eventBus.emit('view:changed', { view: config.VIEWS.result });
      showToast('Form restored!', 'success');
    } else {
      eventBus.emit('error:occurred', {
        message: config.MESSAGES.noSavedResult,
        title: 'No Saved Form',
        userFacing: true,
      });
    }
  } catch (err) {
    console.error('Resume error:', err);
    eventBus.emit('error:occurred', {
      message: err.message,
      title: 'Could Not Restore Form',
      userFacing: true,
    });
  } finally {
    resumeBtn.disabled = false;
    dismissLoadingOverlay(loadingOverlay);
  }
}
