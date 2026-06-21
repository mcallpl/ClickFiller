/**
 * Image Processing Module
 * Handles resizing, compression, format detection, and optimization for API calls.
 */

/**
 * Get image dimensions from a data URL
 * @param {string} dataUrl - Data URL of the image
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 */
export function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = dataUrl;
  });
}

/**
 * Detect image format from data URL
 * @param {string} dataUrl - Data URL of the image
 * @returns {string} Format type: 'jpeg', 'png', 'webp', or 'unknown'
 */
export function detectFormat(dataUrl) {
  if (dataUrl.startsWith('data:image/jpeg')) return 'jpeg';
  if (dataUrl.startsWith('data:image/png')) return 'png';
  if (dataUrl.startsWith('data:image/webp')) return 'webp';
  return 'unknown';
}

/**
 * Resize image to a maximum dimension, maintaining aspect ratio
 * @param {string} dataUrl - Data URL of the image
 * @param {number} maxDim - Maximum width or height (default: 1024)
 * @returns {Promise<string>} Resized image as data URL (JPEG)
 */
export function resizeImage(dataUrl, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      // Resize if larger than max dimension
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };
    img.src = dataUrl;
  });
}

/**
 * Compress image to a specified quality level
 * @param {string} dataUrl - Data URL of the image
 * @param {number} quality - Quality level 0-1 (default: 0.85)
 * @returns {Promise<string>} Compressed image as data URL (JPEG)
 */
export function compressImage(dataUrl, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };
    img.src = dataUrl;
  });
}

/**
 * Get size of data URL in bytes
 * @param {string} dataUrl - Data URL of the image
 * @returns {number} Size in bytes
 */
function getDataUrlSize(dataUrl) {
  // Remove the data:image/jpeg;base64, prefix
  const base64 = dataUrl.split(',')[1];
  // Base64 encoding: 4 characters = 3 bytes
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Optimize image for API call with progressive compression
 * Resizes to max 1024px, then applies progressive compression if needed
 * @param {string} dataUrl - Data URL of the image
 * @param {number} maxSizeMB - Maximum acceptable size in MB (default: 20)
 * @returns {Promise<{dataUrl: string, width: number, height: number, quality: number}>}
 */
export async function optimizeForAPI(dataUrl, maxSizeMB = 20) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Step 1: Resize to max 1024px
  let optimized = await resizeImage(dataUrl, 1024);
  const dims = await getImageDimensions(optimized);

  // Step 2: Check size and apply progressive compression if needed
  let sizeBytes = getDataUrlSize(optimized);
  let quality = 0.95;

  const qualityLevels = [0.95, 0.85, 0.75, 0.65, 0.55];

  for (const q of qualityLevels) {
    if (sizeBytes <= maxSizeBytes) {
      break;
    }
    optimized = await compressImage(optimized, q);
    sizeBytes = getDataUrlSize(optimized);
    quality = q;
  }

  // If still too large, reject
  if (sizeBytes > maxSizeBytes) {
    throw new Error(
      `Image is too large (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB). ` +
      `Please try with a smaller or lower-resolution image.`
    );
  }

  return {
    dataUrl: optimized,
    width: dims.width,
    height: dims.height,
    quality,
  };
}
