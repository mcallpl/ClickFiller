import { GoogleGenAI, Type } from '@google/genai';

// Model is configurable via env. Default matches the .env pin — NEVER default
// to flash-lite: it returns pixel coordinates instead of normalized ones.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Single client instance. The API key comes from GEMINI_API_KEY (loaded from
// the vault into .env). vertexai defaults to false, so this uses the Gemini API.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Enforce the exact output shape at the API level (responseSchema), so we get
// clean structured JSON instead of relying on the model to "return only JSON".
//
// box_2d uses Gemini's NATIVE detection format: [ymin, xmin, ymax, xmax]
// normalized to 0-1000. Gemini's vision training localizes objects in this
// exact convention — asking for it directly gives far more precise boxes than
// asking the model to invent 0-100 percentages (which produced the drifting /
// pixel-scale coordinates that piled fields up at the page edges).
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            minItems: 4,
            maxItems: 4,
          },
          value: { type: Type.STRING },
        },
        required: ['label', 'box_2d', 'value'],
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

export async function analyzeForm(imageDataUrl, profile, dims = {}) {
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
  // Cap the number of keys (defense against a caller inflating the prompt with
  // thousands of fields to amplify Gemini cost/latency) before mapping.
  const MAX_PROFILE_KEYS = 100;
  const profileSummary = Object.entries(profile)
    .filter(([key]) => key !== '_custom')
    .slice(0, MAX_PROFILE_KEYS)
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

  const promptText = `Detect every fillable input area on this form that matches the user's data, and return each one's bounding box.

User's data:
${profileSummary}

For EVERY fillable input area on the form, output:
- "label": the form's printed label for the field (e.g. "Name", "Date of Birth")
- "box_2d": the bounding box of the EMPTY WRITING AREA in [ymin, xmin, ymax, xmax] format, with coordinates normalized to 0-1000
- "value": the user's data to write there. If none of the user's data matches this field, return the field anyway with "value" set to "" (empty string) — the app will ask the user for it.

STRICT MATCHING — a wrong value is far worse than an empty one:
- Only fill a field if the user's data means the same thing as the field's label. Same TYPE is not enough.
- NEVER reuse the date of birth for any other date field ("Today's Date", "Date Signed", "Test Date", "Appointment Date" — those get "" unless the user's data explicitly provides them).
- NEVER put a phone number in a fax/work-phone field, a home address in an employer/emergency-contact address, or the user's name in a witness/physician/emergency-contact name field.
- When unsure whether data matches a field, leave "value" as "" and let the app ask the user.

CRITICAL — what the box must cover:
- The box is the BLANK space where a person would handwrite the answer: the empty area above a blank line, inside an empty box, or inside a table cell.
- Do NOT include the printed label in the box. If the form says "Name: ________", the box starts immediately AFTER the colon, at the beginning of the blank line, and ends at the end of the line.
- The box's bottom edge (ymax) sits ON the answer line / underline. The box's top edge (ymin) is one text-line height above it.
- For an empty rectangle/cell, the box is the interior of that rectangle.
- For a checkbox that should be checked, the box is the checkbox square itself and the value is "X".

Accuracy matters more than quantity:
- Boxes must be tight and precise — a few pixels of drift is visible to the user.
- Skip areas the user should not fill: "For office use only" sections, other parties' signature blocks, and purely decorative lines.
- Each field appears once. If the same label appears twice on the form (e.g. two "Signature" lines), return each occurrence separately.`;

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
        // Temperature 0: box coordinates are measurements, not prose. The
        // default (1.0) adds run-to-run jitter of 1-2% of the page, which is
        // the difference between text on the line and text below the box.
        temperature: 0,
        // Full-detail image tokens — finer localization on dense forms.
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        // Thinking measurably improves spatial localization, but thinking
        // tokens share the output budget — the cap must stay far above
        // thinkingBudget + worst-case JSON size or the JSON gets truncated
        // (the reason thinking was previously disabled at maxOutputTokens 8192).
        maxOutputTokens: 32768,
        thinkingConfig: { thinkingBudget: 2048 },
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

    // Convert the model's native box_2d boxes ([ymin, xmin, ymax, xmax],
    // 0-1000) into the x/y/fontSize percentage format the client renders:
    //   x, y      = top-left of the text, as % of image width/height
    //               (client draws with textBaseline 'top' at y)
    //   fontSize  = text height as % of image height
    // The text is sized from the writing area's height and bottom-aligned in
    // the box, so it sits ON the answer line instead of floating above it.
    if (Array.isArray(result.fields)) {
      const clamp = (n, lo, hi) => Math.max(lo, Math.min(parseFloat(n) || 0, hi));
      const candidates = result.fields
        .filter((f) => f && Array.isArray(f.box_2d) && f.box_2d.length === 4);

      // Gemini's documented box_2d order is [ymin, xmin, ymax, xmax], but in
      // practice it sometimes emits [xmin, ymin, xmax, ymax]. Form writing
      // areas are almost always wider than tall, so pick the interpretation
      // that makes the majority of this response's boxes wide (one vote per
      // response — the model is consistent within a single reply).
      let wideIfYFirst = 0;
      let wideIfXFirst = 0;
      candidates.forEach((f) => {
        const [a, b, c, d] = f.box_2d.map((n) => clamp(n, 0, 1000));
        const widthIfYFirst = d - b;
        const heightIfYFirst = c - a;
        if (widthIfYFirst > heightIfYFirst) {
          wideIfYFirst++;
        } else if (heightIfYFirst > widthIfYFirst) {
          wideIfXFirst++;
        }
      });
      const yFirst = wideIfYFirst >= wideIfXFirst;
      console.log(`[analyzeForm] box_2d order detected: ${yFirst ? '[ymin,xmin,ymax,xmax]' : '[xmin,ymin,xmax,ymax]'}`);

      const mapped = candidates
        .map((f) => {
          const box = f.box_2d.map((n) => clamp(n, 0, 1000));
          const [yMinRaw, xMinRaw, yMaxRaw, xMaxRaw] = yFirst
            ? box
            : [box[1], box[0], box[3], box[2]];
          const yMin = yMinRaw / 10;
          const xMin = xMinRaw / 10;
          const yMax = yMaxRaw / 10;
          const xMax = xMaxRaw / 10;

          const boxH = Math.max(yMax - yMin, 0);
          const boxW = Math.max(xMax - xMin, 0);
          const value = f.value === undefined || f.value === null ? '' : String(f.value);
          const imgW = parseFloat(dims.imageWidth);
          const imgH = parseFloat(dims.imageHeight);
          const aspect = imgW > 0 && imgH > 0 ? imgH / imgW : 1.29; // height:width

          // --- Font size -------------------------------------------------
          // Diagnostic (drawing raw boxes + text on real forms) showed the
          // model's boxes are tight and accurate; the visible error was all in
          // this conversion. Target ~52% of the writing-area height — enough to
          // read clearly, small enough to sit inside the box like real ink
          // rather than filling it edge to edge.
          let fontSize = clamp(boxH * 0.52, 1.0, 3.0);

          // Width-aware shrink so long values never spill past the box's right
          // edge. Reserve a small right margin (0.9 of the box width) matching
          // the left inset below, and use 0.52em as the average Arial glyph
          // advance. %-width and %-height differ by the image aspect ratio.
          if (value && boxW > 0 && imgW > 0 && imgH > 0) {
            const usableWpx = (boxW * 0.9 / 100) * imgW;
            const fontFitsWidthPct = (usableWpx / (0.52 * value.length)) / imgH * 100;
            fontSize = clamp(Math.min(fontSize, fontFitsWidthPct), 0.8, 3.0);
          }

          // --- Vertical position -----------------------------------------
          // Center the text within the box. This is correct for bordered input
          // boxes and also right for underline fields (the box's bottom edge is
          // the line, so a centered glyph floats just above it). textBaseline
          // 'top' places the em-box top at y; cap-height ink is optically ~0.06em
          // low within the em, so nudge up a hair for true optical centering.
          let y = yMin + (boxH - fontSize) / 2 - fontSize * 0.06;
          if (!(y > 0) || boxH === 0) {
            y = yMin;
          }

          // --- Horizontal position ---------------------------------------
          // Inset ~0.4em from the box's left edge so text doesn't touch the
          // border. 0.4em is a height measure; convert to a width-% via aspect.
          const leftInsetPct = Math.min(fontSize * 0.4 * aspect, boxW * 0.5);

          return {
            label: f.label || '',
            value,
            x: clamp(xMin + leftInsetPct, 0, 98),
            y: clamp(y, 0, 98),
            width: boxW,
            height: boxH,
            fontSize,
            // Raw detection box (percent coords). The client uses this to
            // pixel-refine placement against the form's actual printed
            // lines/borders — the AI box is a good estimate, the ink on the
            // page is ground truth.
            box: { x0: xMin, y0: yMin, x1: xMax, y1: yMax },
          };
        });

      // Fields with a value get filled immediately; fields the model detected
      // but couldn't match to the user's data are returned separately so the
      // client can ask the user for them (and save the answers to the profile).
      result.fields = mapped.filter((f) => f.value.trim() !== '');
      result.missingFields = mapped.filter((f) => f.value.trim() === '' && f.label.trim() !== '');
    }

    console.log(`[analyzeForm] Analysis complete: ${result.fields?.length || 0} filled, ${result.missingFields?.length || 0} need user input`);
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
      // Log the raw upstream message server-side, but never echo it to the
      // client — it can carry internal SDK/endpoint detail.
      console.error(`[analyzeForm] API ERROR: ${err.status} - ${err.message}`);
      const apiError = new Error('The form-analysis service returned an error. Please try again.');
      apiError.statusCode = 502;
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
