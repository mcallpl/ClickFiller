// Stores current state for save/export
let currentImageUrl = null;
let savedStateKey = 'clickfiller_result';

/**
 * Displays the form image with draggable text overlays.
 * All positions are stored and rendered as percentages of the image,
 * so they survive zoom, resize, and orientation changes.
 */
export function fillFormOnCanvas(canvas, imageDataUrl, fields) {
  currentImageUrl = imageDataUrl;

  return new Promise((resolve) => {
    const container = document.getElementById('result-form-container');
    const resultImg = document.getElementById('result-image');

    // Clear previous overlays
    container.querySelectorAll('.field-overlay').forEach(el => el.remove());
    container.querySelectorAll('.sig-overlay').forEach(el => el.remove());

    const img = new Image();
    img.onload = () => {
      resultImg.src = imageDataUrl;

      // Wait for image to render so we can get display dimensions for font sizing
      requestAnimationFrame(() => {
        setTimeout(() => {
          fields.forEach((field, i) => {
            if (!field.value) return;
            createFieldOverlay(container, resultImg, field, i);
          });
          setupResizeObserver();
          resolve();
        }, 150);
      });
    };
    img.src = imageDataUrl;
  });
}

/**
 * Restore a previously saved result (image + field positions).
 */
export function restoreResult() {
  const saved = localStorage.getItem(savedStateKey);
  if (!saved) return null;

  try {
    const state = JSON.parse(saved);
    if (!state.imageUrl || !state.fields) return null;

    currentImageUrl = state.imageUrl;
    const container = document.getElementById('result-form-container');
    const resultImg = document.getElementById('result-image');

    container.querySelectorAll('.field-overlay').forEach(el => el.remove());
    container.querySelectorAll('.sig-overlay').forEach(el => el.remove());
    resultImg.src = state.imageUrl;

    return new Promise((resolve) => {
      function placeFields() {
        requestAnimationFrame(() => {
          setTimeout(() => {
            state.fields.forEach((field, i) => {
              createFieldOverlay(container, resultImg, field, i);
            });
            if (state.signatures) {
              state.signatures.forEach(sig => {
                createSigOverlay(container, resultImg, sig);
              });
            }
            setupResizeObserver();
            resolve(state);
          }, 150);
        });
      }

      if (resultImg.complete && resultImg.naturalWidth > 0) {
        placeFields();
      } else {
        resultImg.onload = placeFields;
      }
    });
  } catch {
    return null;
  }
}

/**
 * Save current field positions + image to localStorage.
 */
export function saveResult() {
  const container = document.getElementById('result-form-container');
  const overlays = container.querySelectorAll('.field-overlay');

  const fields = [];
  overlays.forEach(el => {
    // Get text content excluding the delete button
    let text = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    });
    text = text.trim();
    if (!text) return;
    fields.push({
      value: text,
      label: el.dataset.label || '',
      x: parseFloat(el.dataset.xPct),
      y: parseFloat(el.dataset.yPct),
      fontSize: parseFloat(el.dataset.fontSizePct) || 1.5,
      editable: el.contentEditable === 'true',
    });
  });

  // Save signature overlays
  const sigOverlays = container.querySelectorAll('.sig-overlay');
  const signatures = [];
  sigOverlays.forEach(el => {
    signatures.push({
      x: parseFloat(el.dataset.xPct),
      y: parseFloat(el.dataset.yPct),
      w: parseFloat(el.dataset.wPct),
      sigUrl: el.dataset.sigUrl,
    });
  });

  const state = {
    imageUrl: currentImageUrl,
    fields: fields,
    signatures: signatures,
    savedAt: Date.now(),
  };

  localStorage.setItem(savedStateKey, JSON.stringify(state));
}

/**
 * Check if there's a saved result.
 */
export function hasSavedResult() {
  return !!localStorage.getItem(savedStateKey);
}

/**
 * Clear saved result.
 */
export function clearSavedResult() {
  localStorage.removeItem(savedStateKey);
}

/**
 * Creates a single draggable field overlay positioned by percentage.
 */
function createFieldOverlay(container, imgEl, field, index) {
  const el = document.createElement('div');
  el.className = 'field-overlay';
  el.textContent = field.value;
  el.dataset.index = index;
  el.dataset.label = field.label || '';
  el.dataset.xPct = field.x;
  el.dataset.yPct = field.y;
  el.dataset.fontSizePct = field.fontSize || 1.5;

  // Mark as editable if it was a custom-added field
  if (field.editable) {
    el.contentEditable = 'true';
    el.classList.add('editable');
  }

  // Position using CSS percentages — survives zoom and resize
  el.style.left = field.x + '%';
  el.style.top = field.y + '%';

  // Font size: calculate from image display height
  updateFontSize(el, imgEl);

  addDeleteButton(el);
  makeDraggable(el, imgEl);
  container.appendChild(el);
}

/**
 * Adds a delete button and tap-to-select behavior to an overlay.
 */
function addDeleteButton(el) {
  const btn = document.createElement('div');
  btn.className = 'overlay-delete';
  btn.textContent = '✕';
  btn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  btn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    el.remove();
  });
  el.appendChild(btn);

  // Tap on the overlay toggles selection (shows/hides delete button)
  // This is handled in makeDraggable via the onEnd handler
}

/**
 * Deselects all overlays in the container.
 */
function deselectAll() {
  const container = document.getElementById('result-form-container');
  if (!container) return;
  container.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
}

/**
 * Sets font size in px based on the image's current display height.
 * fontSizePct is a % of image height (e.g., 1.5 = 1.5% of image height).
 */
function updateFontSize(el, imgEl) {
  const fontPct = parseFloat(el.dataset.fontSizePct) || 1.5;
  const displayH = imgEl.getBoundingClientRect().height;
  const fontSize = Math.max((fontPct / 100) * displayH, 8);
  el.style.fontSize = fontSize + 'px';
}

// Tap on the form image background deselects all overlays
document.addEventListener('click', (e) => {
  if (e.target.id === 'result-image' || e.target.id === 'result-form-container') {
    deselectAll();
  }
});

// Keep font sizes correct when the image resizes (zoom, orientation, etc.)
let resizeObserverSet = false;
function setupResizeObserver() {
  if (resizeObserverSet) return;
  resizeObserverSet = true;

  const imgEl = document.getElementById('result-image');
  const container = document.getElementById('result-form-container');
  if (!imgEl || !container) return;

  const ro = new ResizeObserver(() => {
    container.querySelectorAll('.field-overlay').forEach(el => {
      updateFontSize(el, imgEl);
    });
  });
  ro.observe(imgEl);
}

/**
 * Makes an element draggable via mouse and touch.
 * Updates percentage-based position on drag so it stays correct on resize.
 * For editable elements: a short tap focuses for typing, a longer press+move drags.
 */
function makeDraggable(el, imgEl) {
  let startX, startY, origXPct, origYPct;
  let dragging = false;
  let hasMoved = false;
  const DRAG_THRESHOLD = 5; // px of movement before it counts as a drag

  function onStart(e) {
    // Don't prevent default immediately for editable elements — let taps focus
    if (!el.contentEditable || el.contentEditable === 'false') {
      e.preventDefault();
    }
    e.stopPropagation();

    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    origXPct = parseFloat(el.dataset.xPct);
    origYPct = parseFloat(el.dataset.yPct);
    hasMoved = false;
    dragging = true;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  function onMove(e) {
    if (!dragging) return;

    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Only start dragging after moving past threshold
    if (!hasMoved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      return;
    }

    hasMoved = true;
    e.preventDefault();
    el.classList.add('dragging');

    // Blur editable element while dragging so the keyboard doesn't interfere
    if (el.contentEditable === 'true') {
      el.blur();
    }

    // Convert pixel drag distance to percentage of displayed image size
    const imgRect = imgEl.getBoundingClientRect();
    const dxPct = (dx / imgRect.width) * 100;
    const dyPct = (dy / imgRect.height) * 100;

    let newXPct = origXPct + dxPct;
    let newYPct = origYPct + dyPct;

    // Constrain to image bounds (0-98%)
    newXPct = Math.max(0, Math.min(newXPct, 98));
    newYPct = Math.max(0, Math.min(newYPct, 98));

    // Update both CSS and data attributes
    el.style.left = newXPct + '%';
    el.style.top = newYPct + '%';
    el.dataset.xPct = newXPct;
    el.dataset.yPct = newYPct;
  }

  function onEnd() {
    dragging = false;
    el.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);

    // If it was a tap (not a drag), toggle selection to show/hide delete button
    if (!hasMoved) {
      const wasSelected = el.classList.contains('selected');
      deselectAll();
      if (!wasSelected) {
        el.classList.add('selected');
      }
    }
  }

  el.addEventListener('mousedown', onStart);
  el.addEventListener('touchstart', onStart, { passive: false });
}

/**
 * Adds an editable, draggable text field to the form at the center of the visible area.
 */
export function addTextField() {
  const container = document.getElementById('result-form-container');
  const imgEl = document.getElementById('result-image');
  if (!container || !imgEl) return;

  const el = document.createElement('div');
  el.className = 'field-overlay editable';
  el.contentEditable = 'true';
  el.dataset.label = 'custom';
  el.dataset.xPct = 10;
  el.dataset.yPct = 10;
  el.dataset.fontSizePct = 1.5;

  el.style.left = '10%';
  el.style.top = '10%';
  updateFontSize(el, imgEl);

  makeDraggable(el, imgEl);
  container.appendChild(el);

  // Focus so user can start typing immediately
  setTimeout(() => el.focus(), 100);
}

/**
 * Inserts a signature image onto the form as a draggable, resizable overlay.
 */
export function addSignatureOverlay(sigDataUrl) {
  const container = document.getElementById('result-form-container');
  const imgEl = document.getElementById('result-image');
  if (!container || !imgEl) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'sig-overlay';
  wrapper.dataset.xPct = 10;
  wrapper.dataset.yPct = 80;
  wrapper.dataset.wPct = 20;
  wrapper.dataset.sigUrl = sigDataUrl;

  wrapper.style.left = '10%';
  wrapper.style.top = '80%';
  wrapper.style.width = '20%';

  const img = document.createElement('img');
  img.src = sigDataUrl;
  wrapper.appendChild(img);

  // Resize handle
  const handle = document.createElement('div');
  handle.className = 'sig-resize';
  wrapper.appendChild(handle);

  addDeleteButton(wrapper);
  makeDraggable(wrapper, imgEl);
  makeResizable(wrapper, handle, imgEl);
  container.appendChild(wrapper);
}

/**
 * Restores a saved signature overlay.
 */
function createSigOverlay(container, imgEl, sig) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sig-overlay';
  wrapper.dataset.xPct = sig.x;
  wrapper.dataset.yPct = sig.y;
  wrapper.dataset.wPct = sig.w;
  wrapper.dataset.sigUrl = sig.sigUrl;

  wrapper.style.left = sig.x + '%';
  wrapper.style.top = sig.y + '%';
  wrapper.style.width = sig.w + '%';

  const img = document.createElement('img');
  img.src = sig.sigUrl;
  wrapper.appendChild(img);

  const handle = document.createElement('div');
  handle.className = 'sig-resize';
  wrapper.appendChild(handle);

  addDeleteButton(wrapper);
  makeDraggable(wrapper, imgEl);
  makeResizable(wrapper, handle, imgEl);
  container.appendChild(wrapper);
}

/**
 * Makes a signature overlay resizable via its handle.
 */
function makeResizable(wrapper, handle, imgEl) {
  let startX, origWPct;
  let resizing = false;

  function onStart(e) {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;

    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    origWPct = parseFloat(wrapper.dataset.wPct);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  function onMove(e) {
    if (!resizing) return;
    e.preventDefault();

    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - startX;
    const imgRect = imgEl.getBoundingClientRect();
    const dxPct = (dx / imgRect.width) * 100;

    let newWPct = origWPct + dxPct;
    newWPct = Math.max(5, Math.min(newWPct, 80));

    wrapper.style.width = newWPct + '%';
    wrapper.dataset.wPct = newWPct;
  }

  function onEnd() {
    resizing = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }

  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, { passive: false });
}

/**
 * Renders the current image + all positioned field overlays onto a canvas
 * at full resolution for PDF export.
 *
 * To match DOM positioning exactly:
 * - We use the same percentage coordinates
 * - textBaseline 'top' + line-height 1 in CSS = text top edge at the y coordinate
 * - The 1px border on overlays shifts content by 1px; we account for that
 */
export function renderToCanvas(canvas) {
  return new Promise((resolve) => {
    const container = document.getElementById('result-form-container');
    const resultImg = document.getElementById('result-image');
    const overlays = container.querySelectorAll('.field-overlay');

    // Measure the display-to-actual ratio from the current DOM image
    const displayRect = resultImg.getBoundingClientRect();
    const displayW = displayRect.width;
    const displayH = displayRect.height;

    const img = new Image();
    img.onload = () => {
      const MAX = 2048;
      let w = img.width;
      let h = img.height;

      if (w > MAX || h > MAX) {
        const scale = Math.min(MAX / w, MAX / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // Draw the form image, then lighten it and push near-white to pure white
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        // Lighten all pixels
        d[i]     = Math.min(255, d[i] + 80);     // R
        d[i + 1] = Math.min(255, d[i + 1] + 80); // G
        d[i + 2] = Math.min(255, d[i + 2] + 80); // B
        // If close to white, snap to pure white
        if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) {
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Scale factor from display size to canvas size
      const scaleX = w / displayW;
      const scaleY = h / displayH;

      // Draw text overlays
      overlays.forEach(el => {
        let text = '';
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
        });
        text = text.trim();
        if (!text) return;

        const xPct = parseFloat(el.dataset.xPct);
        const yPct = parseFloat(el.dataset.yPct);

        const computedFontSize = parseFloat(window.getComputedStyle(el).fontSize);
        const canvasFontSize = Math.max(computedFontSize * scaleY, 10);

        const fx = (xPct / 100) * w + (1 * scaleX);
        const fy = (yPct / 100) * h + (1 * scaleY);

        ctx.fillStyle = '#000000';
        ctx.font = `${canvasFontSize}px Arial, Helvetica, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(text, fx, fy);
      });

      // Draw signature overlays
      const sigOverlays = container.querySelectorAll('.sig-overlay');
      let sigsRemaining = sigOverlays.length;
      if (sigsRemaining === 0) {
        resolve();
        return;
      }

      sigOverlays.forEach(el => {
        const xPct = parseFloat(el.dataset.xPct);
        const yPct = parseFloat(el.dataset.yPct);
        const wPct = parseFloat(el.dataset.wPct);

        const sigImg = new Image();
        sigImg.onload = () => {
          const sx = (xPct / 100) * w;
          const sy = (yPct / 100) * h;
          const sw = (wPct / 100) * w;
          const sh = sw * (sigImg.height / sigImg.width);
          ctx.drawImage(sigImg, sx, sy, sw, sh);

          sigsRemaining--;
          if (sigsRemaining === 0) resolve();
        };
        sigImg.onerror = () => {
          sigsRemaining--;
          if (sigsRemaining === 0) resolve();
        };
        sigImg.src = el.dataset.sigUrl;
      });
    };
    img.src = currentImageUrl;
  });
}
