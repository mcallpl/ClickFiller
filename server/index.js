import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { analyzeForm } from './analyze.js';
import { validateAnalyzeRequest } from './middleware/validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Behind nginx: trust the first proxy hop so express-rate-limit keys on the
// real client IP (X-Forwarded-For) rather than nginx's 127.0.0.1.
app.set('trust proxy', 1);

// Allow large payloads for images
app.use(express.json({ limit: '20mb' }));

// CORS middleware. No cookies/sessions are used, so credentials stay off and
// the cleartext-HTTP production origin is intentionally NOT whitelisted (it
// would let a MITM on the insecure origin ride cross-origin requests).
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3001',
    'https://clickfiller.peoplestar.com',
    'https://clickfiller.com',
    'https://www.clickfiller.com',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Rate limit the analysis endpoint: it is the only route that calls the paid
// Gemini API and buffers multi-MB images, so an unthrottled loop is a direct
// cost/DoS vector. 20 requests/min per IP is far above real single-user use.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files from dist folder
const distPath = process.env.NODE_ENV === 'production'
  ? '/app/dist'
  : path.join(__dirname, '../dist');

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }

  // Serve static assets from dist. Use sendFile's `root` option with a
  // relative path: it rejects any path containing `..` segments, so a crafted
  // request like `/../../etc/passwd` can't escape distPath. Anything missing
  // falls back to index.html so the SPA client-side router handles the route.
  const relPath = req.path === '/' ? 'index.html' : req.path.replace(/^\/+/, '');

  res.sendFile(relPath, { root: distPath }, (err) => {
    if (err) {
      res.sendFile('index.html', { root: distPath });
    }
  });
});

// Health check endpoint (for monitoring/deployment verification)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'ClickFiller API',
  });
});

// Form analysis endpoint with request validation
app.post('/api/analyze', analyzeLimiter, validateAnalyzeRequest, async (req, res) => {
  console.log('[POST /api/analyze] Starting form analysis');

  try {
    const { image, profile, imageWidth, imageHeight } = req.body;
    const result = await analyzeForm(image, profile, { imageWidth, imageHeight });

    console.log('[POST /api/analyze] Analysis successful, returning result');
    res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || 'Failed to analyze form';

    console.error(`[POST /api/analyze] Error (${statusCode}): ${errorMessage}`);
    res.status(statusCode).json({ error: errorMessage });
  }
});

// JSON-aware error handler — MUST be last and have 4 args so Express treats it
// as an error handler. Without this, malformed/oversized request bodies fall
// through to Express's default handler, which returns an HTML page containing a
// full Node.js stack trace (including absolute filesystem paths).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Body-parser: malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  // Body-parser: payload exceeded the 20mb limit
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request too large. The image may exceed the size limit.' });
  }

  // Anything else: log server-side, return a generic message. Never leak the
  // stack trace or internal error details to the client.
  console.error(`[error] ${req.method} ${req.path}: ${err.message}`);
  res.status(err.statusCode || err.status || 500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] ClickFiller API running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Health check available at GET http://localhost:${PORT}/health`);
  console.log(`[${new Date().toISOString()}] Form analysis available at POST http://localhost:${PORT}/api/analyze`);
});
