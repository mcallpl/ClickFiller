export function validateAnalyzeRequest(req, res, next) {
  const { image, profile } = req.body;

  // Check if body exists
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be JSON' });
  }

  // Check if image exists and is a string (base64 data URL)
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image data (must be base64 data URL)' });
  }

  // Check if profile exists and is an object
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return res.status(400).json({ error: 'Missing or invalid profile data (must be an object)' });
  }

  // Check image size (loose check: base64 string length)
  // Base64 is ~1.33x original size, so 20MB base64 ≈ 15MB original
  const maxSize = 20 * 1024 * 1024; // 20MB in bytes
  if (image.length > maxSize) {
    return res.status(400).json({ error: `Image too large (max 20MB, got ${(image.length / 1024 / 1024).toFixed(1)}MB)` });
  }

  // Check if image looks like a data URL
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format (must be data:image/* format)' });
  }

  // All checks passed
  next();
}
