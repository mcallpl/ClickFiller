export function validateLocateRequest(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be JSON' });
  }
  const { image, label } = req.body;
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Missing or invalid image data (must be a data:image/* URL)' });
  }
  if (image.length > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image strip too large (max ~6MB)' });
  }
  if (!label || typeof label !== 'string' || label.length > 200) {
    return res.status(400).json({ error: 'Missing or invalid label (string, max 200 chars)' });
  }
  next();
}

export function validateAnalyzeRequest(req, res, next) {
  // Check the body FIRST, before destructuring. Destructuring a null/undefined
  // req.body throws a TypeError, which previously crashed this middleware
  // instead of returning a clean 400.
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body is required and must be JSON' });
  }

  const { image, profile } = req.body;

  // Check if image exists and is a string (base64 data URL)
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image data (must be base64 data URL)' });
  }

  // Check if profile exists and is an object
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return res.status(400).json({ error: 'Missing or invalid profile data (must be an object)' });
  }

  // Check image size. The limit applies to the base64 PAYLOAD, not the whole
  // data-URL string — otherwise the `data:image/...;base64,` prefix pushes an
  // exactly-at-limit image over the edge and it gets wrongly rejected.
  const maxSize = 20 * 1024 * 1024; // 20MB of base64 data
  const base64Payload = image.includes(',') ? image.slice(image.indexOf(',') + 1) : image;
  if (base64Payload.length > maxSize) {
    return res.status(400).json({ error: `Image too large (max 20MB, got ${(base64Payload.length / 1024 / 1024).toFixed(1)}MB)` });
  }

  // Check if image looks like a data URL
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format (must be data:image/* format)' });
  }

  // All checks passed
  next();
}
