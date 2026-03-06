let stream = null;

export async function initCamera(videoElement) {
  // Clear any previous error messages
  const container = videoElement.parentElement;
  const oldError = container?.querySelector('.camera-error');
  if (oldError) oldError.remove();

  try {
    if (stream) return;

    // Check if getUserMedia is available (requires HTTPS)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera requires HTTPS. Use "Upload Photo" instead.');
    }

    // Try rear camera first, fall back to any camera
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 2048 },
          height: { ideal: 2732 },
        },
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    videoElement.srcObject = stream;
    await videoElement.play();
  } catch (err) {
    console.error('Camera error:', err);
    if (container && !container.querySelector('.camera-error')) {
      const msg = document.createElement('div');
      msg.className = 'camera-error';
      msg.style.cssText = `
        color: white;
        text-align: center;
        padding: 40px 20px;
        font-size: 16px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
      `;
      msg.innerHTML = `Camera not available.<br><br><small style="color:#94a3b8;">${err.message}</small><br><br>Use "Upload Photo" below.`;
      container.style.position = 'relative';
      container.appendChild(msg);
    }
  }
}

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

export function capturePhoto(videoElement, canvasElement) {
  const w = videoElement.videoWidth;
  const h = videoElement.videoHeight;
  canvasElement.width = w;
  canvasElement.height = h;
  const ctx = canvasElement.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, w, h);
  return canvasElement.toDataURL('image/jpeg', 0.92);
}
