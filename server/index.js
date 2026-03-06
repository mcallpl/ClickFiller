import 'dotenv/config';
import express from 'express';
import { analyzeForm } from './analyze.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Allow large payloads for images
app.use(express.json({ limit: '20mb' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const { image, profile } = req.body;

    if (!image || !profile) {
      return res.status(400).json({ error: 'Missing image or profile data' });
    }

    const result = await analyzeForm(image, profile);
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze form' });
  }
});

app.listen(PORT, () => {
  console.log(`ClickFiller API running on port ${PORT}`);
});
