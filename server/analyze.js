import { GoogleGenAI, Type } from '@google/genai';

// Model is configurable via env; defaults to the value used in the vault.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

// Single client instance. The API key comes from GEMINI_API_KEY (loaded from
// the vault into .env). vertexai defaults to false, so this uses the Gemini API.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Enforce the exact output shape at the API level (responseSchema), so we get
// clean structured JSON instead of relying on the model to "return only JSON".
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          width: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
          value: { type: Type.STRING },
          fontSize: { type: Type.NUMBER },
        },
        required: ['label', 'x', 'y', 'value', 'fontSize'],
      },
    },
  },
  required: ['fields'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Gemini Flash models frequently return transient 503 "high demand" / 429 rate
// limits. Retry those a few times with exponential backoff before giving up.
async function generateWithRetry(request, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      lastErr = err;
      const transient = err && (err.status === 429 || err.status === 503 || err.status === 504);
      if (!transient || attempt === maxAttempts) {
        throw err;
      }
      const backoffMs = 800 * 2 ** (attempt - 1); // 800ms, 1.6s, 3.2s
      console.log(`[analyzeForm] transient ${err.status}, retry ${attempt}/${maxAttempts - 1} in ${backoffMs}ms`);
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}

export async function analyzeForm(imageDataUrl, profile) {
  console.log('[analyzeForm] IMAGE RECEIVED');

  if (!process.env.GEMINI_API_KEY) {
    const keyError = new Error('Server is missing GEMINI_API_KEY. Add it to .env (from the vault).');
    keyError.statusCode = 500;
    throw keyError;
  }

  const base64Match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!base64Match) {
    console.error('[analyzeForm] Invalid image data format');
    throw new Error('Invalid image data');
  }

  const mediaType = base64Match[1];
  const base64Data = base64Match[2];
  console.log(`[analyzeForm] Media type: ${mediaType}, size: ${base64Data.length} bytes`);

  // Sanitize profile data before sending to the model.
  // This prevents prompt injection attacks via user-supplied values.
  const profileSummary = Object.entries(profile)
    .filter(([key]) => key !== '_custom')
    .map(([key, value]) => {
      // Remove newlines, tabs, and other control characters that could break out
      const clean = String(value)
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200); // Max 200 chars per field for safety
      return `${key}: ${clean}`;
    })
    .join('\n');

  const promptText = `You are an expert form-filling assistant. Look at this form image very carefully.

STEP 1: Study the form's layout. Note where each label is and where the corresponding blank/line/box is where someone would write. Pay attention to the SIZE of the printed text on the form — your filled text should match that size.

STEP 2: Match fields to the user's data below.

User's data:
${profileSummary}

STEP 3: For each matchable field, return PRECISE coordinates of WHERE TO WRITE the value.

COORDINATE SYSTEM:
- All values are percentages of the image dimensions (0-100)
- x = distance from LEFT edge to where text should START writing
- y = distance from TOP edge to the TOP of the writing area
- width = how wide the writing area is
- height = how tall the writing area is

POSITIONING RULES:
- Look at where the blank line, underline, or empty box is — that's where x,y should point
- If label says "Name:" followed by a line, x should be at the START of that line, NOT at the "N" in "Name"
- If there are boxes/cells in a table, position inside the cell
- y should put text directly ON the baseline/line, not floating above it
- Measure carefully — even small % errors will be very visible

FONT SIZE:
- Look at the existing printed text on the form (the labels like "Name", "Address", etc.)
- Your fontSize should match that printed text size
- Estimate fontSize as a percentage of image height (e.g., if labels are about 1.5% of image height tall, use fontSize: 1.5)
- This is critical — text that's too small or too big looks wrong

- fontSize is a percentage of image height
- Only include fields with matching user data`;

  try {
    console.log(`[analyzeForm] CALLING GEMINI API (model: ${MODEL})`);
    const response = await generateWithRetry({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mediaType, data: base64Data } },
            { text: promptText },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        // Disable "thinking" — this is a structured extraction task, not a
        // reasoning one. Thinking tokens count against the output budget and
        // were truncating the JSON (causing parse failures) on flash models.
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    console.log('[analyzeForm] RESPONSE RECEIVED from Gemini');
    const text = response.text;
    if (!text) {
      console.error('[analyzeForm] Empty response from model');
      throw new Error('Empty response from AI');
    }

    // With responseSchema the output is clean JSON, but stay defensive: extract
    // the JSON object and parse it.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[analyzeForm] Failed to parse AI response - no JSON found');
      throw new Error('Failed to parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log('[analyzeForm] RESPONSE PARSED successfully');

    // Normalize the model's output before returning it. Vision coordinate
    // estimates can drift slightly outside the documented 0-100% range; clamp
    // them here (defense in depth alongside the client) so a field never gets
    // silently clipped out of view. Drop any entry without a value.
    if (Array.isArray(result.fields)) {
      const clamp = (n, lo, hi, fallback) => {
        const v = parseFloat(n);
        if (Number.isNaN(v)) {
          return fallback;
        }
        return Math.max(lo, Math.min(v, hi));
      };
      result.fields = result.fields
        .filter((f) => f && f.value !== undefined && f.value !== null && String(f.value).trim() !== '')
        .map((f) => ({
          ...f,
          x: clamp(f.x, 0, 100, 0),
          y: clamp(f.y, 0, 100, 0),
          fontSize: clamp(f.fontSize, 0.5, 10, 1.5),
        }));
    }

    console.log(`[analyzeForm] Analysis complete: ${result.fields?.length || 0} fields identified`);
    return result;
  } catch (err) {
    // Malformed JSON from the model
    if (err instanceof SyntaxError) {
      console.error('[analyzeForm] PARSE ERROR: Invalid JSON response from AI');
      const parseError = new Error('Invalid response from AI - could not parse form analysis.');
      parseError.statusCode = 400;
      throw parseError;
    }

    // The Gemini SDK throws ApiError with a numeric HTTP `status`.
    // Treat rate-limit / overloaded / timeout as retryable with a friendly message.
    if (err && (err.status === 429 || err.status === 503 || err.status === 504)) {
      console.error(`[analyzeForm] TRANSIENT (${err.status}): ${err.message}`);
      const busyError = new Error('The AI service is busy or timed out. Please try again in a moment.');
      busyError.statusCode = 503;
      throw busyError;
    }

    if (err && typeof err.status === 'number' && err.status >= 400) {
      console.error(`[analyzeForm] API ERROR: ${err.status} - ${err.message}`);
      const apiError = new Error(`Gemini API error: ${err.message}`);
      apiError.statusCode = 500;
      throw apiError;
    }

    // Preserve statusCode we set ourselves (e.g. missing key, empty response)
    if (err && err.statusCode) {
      console.error(`[analyzeForm] ERROR (${err.statusCode}): ${err.message}`);
      throw err;
    }

    console.error(`[analyzeForm] UNEXPECTED ERROR: ${err.message}`);
    throw err;
  }
}
