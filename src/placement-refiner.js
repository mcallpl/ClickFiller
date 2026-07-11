/**
 * Placement Refiner — pixel-level "snap to the printed line".
 *
 * The AI returns a good estimate of each field's writing area, but an estimate
 * is not ground truth. This module reads the actual form image and, inside
 * each field's detection box, finds the printed structure a human eye would
 * align to:
 *   - a bordered input box (top + bottom border lines)  → center between them
 *   - an underline / answer line (single bottom line)    → sit just above it
 *   - a left border (box edge)                           → indent from it
 * and refines the text position to those physical lines. If no structure is
 * found (open space), the AI placement stands.
 *
 * All coordinates in and out are percentages of the image, matching the rest
 * of the app. Failures never break filling — every field falls back to its
 * original placement.
 */

// A row/column is "a line" when at least this fraction of its pixels are dark.
// Printed text rows peak around 0.2–0.4; solid rules exceed 0.75.
const LINE_DARK_FRACTION = 0.55;
const ANALYSIS_MAX_DIM = 2000;

/**
 * Refine an array of fields against the form image.
 * @param {string} imageDataUrl - the form image (same one shown to the user)
 * @param {Array} fields - fields carrying {box:{x0,y0,x1,y1}, fontSize, x, y}
 * @returns {Promise<Array>} fields with refined x/y/fontSize where possible
 */
export async function refinePlacements(imageDataUrl, fields) {
  const img = await loadImage(imageDataUrl);
  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  return fields.map((field) => {
    if (!field || !field.box) {
      return field;
    }
    try {
      return refineField(ctx, w, h, field);
    } catch {
      return field;
    }
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load form image for refinement'));
    img.src = dataUrl;
  });
}

function refineField(ctx, w, h, field) {
  const bx0 = (field.box.x0 / 100) * w;
  const bx1 = (field.box.x1 / 100) * w;
  const by0 = (field.box.y0 / 100) * h;
  const by1 = (field.box.y1 / 100) * h;
  const boxHpx = by1 - by0;
  const boxWpx = bx1 - bx0;
  if (boxHpx < 5 || boxWpx < 10) {
    return field;
  }

  // Search window: the box plus 40% of its height above/below, so a line the
  // AI box slightly missed is still found — but never a neighboring row's.
  const padY = Math.max(4, boxHpx * 0.4);
  const sx0 = Math.max(0, Math.floor(bx0 - 3));
  const sx1 = Math.min(w - 1, Math.ceil(bx1 + 3));
  const sy0 = Math.max(0, Math.floor(by0 - padY));
  const sy1 = Math.min(h - 1, Math.ceil(by1 + padY));
  const rw = sx1 - sx0 + 1;
  const rh = sy1 - sy0 + 1;
  const data = ctx.getImageData(sx0, sy0, rw, rh).data;

  // Adaptive ink threshold: measure the window's paper brightness (90th
  // percentile luminance) and count as ink anything meaningfully darker.
  // A fixed threshold misses light-gray borders on bright paper and breaks
  // on grayish phone photos; measuring the paper handles both.
  const histogram = new Uint32Array(256);
  let sampled = 0;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x += 2) {
      const i = (y * rw + x) * 4;
      histogram[(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0]++;
      sampled++;
    }
  }
  let acc = 0;
  let paper = 255;
  for (let v = 255; v >= 0; v--) {
    acc += histogram[v];
    if (acc >= sampled * 0.1) {
      paper = v;
      break;
    }
  }
  const inkThreshold = Math.max(120, Math.min(paper - 30, 225));

  const isDark = (x, y) => {
    const i = (y * rw + x) * 4;
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) < inkThreshold;
  };

  // --- Horizontal rules: rows where most pixels are ink ------------------
  const lineRows = [];
  for (let y = 0; y < rh; y++) {
    let dark = 0;
    let n = 0;
    for (let x = 0; x < rw; x += 2) {
      if (isDark(x, y)) {
        dark++;
      }
      n++;
    }
    lineRows.push(dark / n >= LINE_DARK_FRACTION);
  }
  // Merge adjacent line rows (a printed rule is 1–5 px thick) into centers.
  const lines = [];
  let runStart = -1;
  for (let y = 0; y <= rh; y++) {
    const on = y < rh && lineRows[y];
    if (on && runStart < 0) {
      runStart = y;
    }
    if (!on && runStart >= 0) {
      lines.push({ center: (runStart + y - 1) / 2, top: runStart, bottom: y - 1 });
      runStart = -1;
    }
  }
  if (lines.length === 0) {
    return field; // open space — trust the AI placement
  }

  const fontPx = (field.fontSize / 100) * h;
  let newYpx = null;
  let innerTop = null;
  let innerBottom = null;

  const first = lines[0];
  const last = lines[lines.length - 1];
  const isBorderedBox = lines.length >= 2 && (last.center - first.center) >= boxHpx * 0.5;

  if (isBorderedBox) {
    // Bordered input box: center the text between the measured inner edges
    // of the top and bottom borders. 0.70 of the inner height reads like
    // confident handwriting — clearly inside the box without crowding it.
    innerTop = first.bottom + 1;
    innerBottom = last.top - 1;
    const innerH = innerBottom - innerTop;
    if (innerH > 6) {
      const fit = Math.min(fontPx, innerH * 0.70);
      newYpx = sy0 + innerTop + (innerH - fit) / 2;
      return finalize(field, sx0, sy0, rw, w, h, newYpx, fit, isDark, first.bottom + 1, last.top - 1);
    }
  }

  // Underline / answer line: use the lowest rule in the window; text sits
  // just above it, the way a hand writes on a line. Sanity: an answer line
  // lives in the LOWER part of the field — if the only rule found is in the
  // top third (it's a box top border whose bottom mate went undetected, or a
  // divider above the field), refining on it would push text out of the
  // field; keep the AI placement instead.
  const boxTopInWindow = by0 - sy0;
  if (last.center < boxTopInWindow + boxHpx * 0.35) {
    return field;
  }
  const gap = Math.max(2, fontPx * 0.1);
  newYpx = sy0 + last.top - gap - fontPx;
  return finalize(field, sx0, sy0, rw, w, h, newYpx, fontPx, isDark, Math.max(0, last.top - fontPx * 1.4), last.top - 1);
}

/**
 * Shared tail: find the left border/line start for horizontal alignment,
 * clamp the vertical move to a sane distance, and return the refined field.
 */
function finalize(field, sx0, sy0, rw, w, h, newYpx, fontPx, isDark, scanTop, scanBottom) {
  // --- Left edge: a vertical border (bordered box) or the start of the
  // underline ink. Scan the left 30% of the window for the first column that
  // is consistently dark between scanTop and scanBottom.
  let leftPx = null;
  const scanH = Math.max(1, Math.floor(scanBottom) - Math.ceil(scanTop) + 1);
  const maxScanX = Math.floor(rw * 0.3);
  for (let x = 0; x < maxScanX; x++) {
    let dark = 0;
    for (let y = Math.ceil(scanTop); y <= Math.floor(scanBottom); y++) {
      if (isDark(x, y)) {
        dark++;
      }
    }
    if (dark / scanH >= 0.6) {
      leftPx = x;
      break;
    }
  }

  const refined = { ...field };

  // Vertical: accept only sane moves (within 1.2 box heights of the AI's y) —
  // a bigger jump means we probably latched onto the wrong structure.
  const aiYpx = (field.y / 100) * h;
  const boxHpx = ((field.box.y1 - field.box.y0) / 100) * h;
  if (newYpx !== null && Math.abs(newYpx - aiYpx) <= Math.max(boxHpx * 1.2, 10)) {
    refined.y = Math.max(0, Math.min((newYpx / h) * 100, 98));
    refined.fontSize = Math.max(0.8, Math.min((fontPx / h) * 100, 3.0));
  }

  // Horizontal: indent ~0.4em from the found left border; if none was found
  // (open underline that starts at the label), keep the AI x.
  if (leftPx !== null) {
    const xPx = sx0 + leftPx + fontPx * 0.4;
    const xPct = (xPx / w) * 100;
    if (Math.abs(xPct - field.x) <= Math.max(((field.box.x1 - field.box.x0) * 0.5), 2)) {
      refined.x = Math.max(0, Math.min(xPct, 98));
    }
  }

  return refined;
}
