const SIG_KEY = 'clickfiller_signatures';

/**
 * Get all saved signatures from localStorage.
 * Returns array of { name, dataUrl }
 */
export function getSignatures() {
  try {
    const saved = localStorage.getItem(SIG_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveSignatures(sigs) {
  localStorage.setItem(SIG_KEY, JSON.stringify(sigs));
}

/**
 * Add a signature image. Resizes to max 400px wide to save storage.
 */
export function addSignature(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 400px wide
        const maxW = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round(h * maxW / w);
          w = maxW;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');

        const sigs = getSignatures();
        const name = 'Signature ' + (sigs.length + 1);
        sigs.push({ name, dataUrl });
        saveSignatures(sigs);
        resolve({ name, dataUrl });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Remove a signature by index.
 */
export function removeSignature(index) {
  const sigs = getSignatures();
  sigs.splice(index, 1);
  saveSignatures(sigs);
}

/**
 * Render the signature list in the profile view.
 */
export function renderSignatureList() {
  const container = document.getElementById('signature-list');
  if (!container) return;
  container.innerHTML = '';

  const sigs = getSignatures();
  sigs.forEach((sig, i) => {
    const item = document.createElement('div');
    item.className = 'sig-item';
    item.innerHTML = `
      <img src="${sig.dataUrl}" alt="${sig.name}">
      <span class="sig-name">${sig.name}</span>
      <button class="remove-sig">&times;</button>
    `;
    item.querySelector('.remove-sig').addEventListener('click', () => {
      removeSignature(i);
      renderSignatureList();
    });
    container.appendChild(item);
  });
}

/**
 * Show the signature picker modal. Returns a promise that resolves
 * with the chosen signature's dataUrl, or null if cancelled.
 */
export function pickSignature() {
  return new Promise((resolve) => {
    const sigs = getSignatures();
    if (sigs.length === 0) {
      alert('No signatures saved. Go to My Info to add one.');
      resolve(null);
      return;
    }

    const picker = document.getElementById('sig-picker');
    const list = document.getElementById('sig-picker-list');
    const cancelBtn = document.getElementById('sig-picker-cancel');
    const backdrop = document.getElementById('sig-picker-backdrop');

    list.innerHTML = '';
    sigs.forEach((sig, i) => {
      const btn = document.createElement('button');
      btn.className = 'sig-pick-option';
      btn.innerHTML = `<img src="${sig.dataUrl}" alt="${sig.name}">`;
      btn.addEventListener('click', () => {
        picker.style.display = 'none';
        resolve(sig.dataUrl);
      });
      list.appendChild(btn);
    });

    function cancel() {
      picker.style.display = 'none';
      resolve(null);
    }

    cancelBtn.onclick = cancel;
    backdrop.onclick = cancel;
    picker.style.display = 'flex';
  });
}
