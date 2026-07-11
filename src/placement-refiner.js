/**
 * Placement Refiner — pixel-level "write like a human" placement.
 *
 * The AI returns an estimate of each field's writing area. This module reads
 * the actual form image and places text the way a person with a pen would:
 *
 *  1. SNAP TO STRUCTURE — find the printed rules a human eye aligns to:
 *     bordered boxes (center between the real borders), answer lines (sit
 *     just above the line), left borders (indent from the physical edge).
 *  2. NEVER COVER PRINTED WORDS — before committing a position, check the
 *     pixels underneath; if printed ink is there (field labels inside the
 *     box, instructions, "Date"), slide down/right into genuinely empty
 *     space. Text over text is never acceptable.
 *  3. CHECKBOXES — when the value is an X, locate the actual checkbox
 *     square in the pixels and center the X inside it, sized to the square.
 *  4. COMB FIELDS — when the writing area is a row of one-character cells
 *     (SSN/EIN), strip separators from the value and place each character
 *     centered in its own cell.
 *
 * All coordinates in and out are percentages of the image. Every failure
 * falls back to the AI placement — refinement can only improve, never block.
 * A field may refine into MULTIPLE placed values (comb cells), so the
 * top-level API returns a flat list.
 */

const ANALYSIS_MAX_DIM = 2000;
// A row/column is a solid printed rule when this fraction of it is ink.
const RULE_FRACTION = 0.55;
// Dotted/dashed rules: lower density but ink spans nearly the full width.
const DOTTED_FRACTION = 0.3;
const DOTTED_SPAN = 0.7;
// A candidate text rect "collides" if more than this fraction is non-rule ink.
const COLLISION_INK = 0.012;
const CHECK_VALUE = /^[xX✓✗]$/;

export async function refinePlacements(imageDataUrl, fields, opts = {}) {
  const img = await loadImage(imageDataUrl);
  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const locate = opts.locate || defaultLocate;
  const placed = [];
  for (const field of fields) {
    if (!field || !field.box) {
      placed.push(field);
      continue;
    }
    try {
      const refined = await refineField(ctx, w, h, field, locate);
      placed.push(...(Array.isArray(refined) ? refined : [refined]));
    } catch {
      placed.push(field);
    }
  }
  return placed;
}

/**
 * Default focused-locate transport: asks the backend to find one checkbox
 * square in a strip of the form. Injectable for tests.
 */
async function defaultLocate(stripDataUrl, label) {
  const response = await fetch('/api/locate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: stripDataUrl, label }),
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load form image for refinement'));
    img.src = dataUrl;
  });
}

/**
 * Extract a field's surrounding pixels plus the analysis primitives every
 * strategy shares: adaptive ink threshold, isDark, row profile, rules.
 */
function analyzeRegion(ctx, w, h, box, padX, padY) {
  const bx0 = (box.x0 / 100) * w;
  const bx1 = (box.x1 / 100) * w;
  const by0 = (box.y0 / 100) * h;
  const by1 = (box.y1 / 100) * h;

  const sx0 = Math.max(0, Math.floor(bx0 - padX));
  const sx1 = Math.min(w - 1, Math.ceil(bx1 + padX));
  const sy0 = Math.max(0, Math.floor(by0 - padY));
  const sy1 = Math.min(h - 1, Math.ceil(by1 + padY));
  const rw = sx1 - sx0 + 1;
  const rh = sy1 - sy0 + 1;
  const data = ctx.getImageData(sx0, sy0, rw, rh).data;

  // Adaptive ink threshold: paper = 90th percentile luminance of the window.
  const hist = new Uint32Array(256);
  let sampled = 0;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x += 2) {
      const i = (y * rw + x) * 4;
      hist[(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0]++;
      sampled++;
    }
  }
  let acc = 0;
  let paper = 255;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= sampled * 0.1) {
      paper = v;
      break;
    }
  }
  const inkThreshold = Math.max(120, Math.min(paper - 30, 225));

  const lum = (x, y) => {
    const i = (y * rw + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  const isDark = (x, y) => lum(x, y) < inkThreshold;

  return { sx0, sy0, rw, rh, isDark, bx0, bx1, by0, by1 };
}

/**
 * Horizontal rules within [x0,x1) of the region: solid (dense) or dotted
 * (sparse but spanning). Returns merged line bands {top,bottom,center,solid}.
 */
function findHRules(region, x0, x1, y0, y1) {
  const { isDark } = region;
  const bands = [];
  let run = null;
  for (let y = Math.max(0, y0); y <= y1; y++) {
    let dark = 0;
    let n = 0;
    let first = -1;
    let last = -1;
    for (let x = x0; x < x1; x += 2) {
      if (isDark(x, y)) {
        dark++;
        if (first < 0) {
          first = x;
        }
        last = x;
      }
      n++;
    }
    const frac = dark / Math.max(n, 1);
    const span = first >= 0 ? (last - first) / Math.max(x1 - x0, 1) : 0;
    const isRule = frac >= RULE_FRACTION || (frac >= DOTTED_FRACTION && span >= DOTTED_SPAN);
    if (isRule) {
      if (!run) {
        run = { top: y, bottom: y, solid: frac >= RULE_FRACTION };
      } else {
        run.bottom = y;
        run.solid = run.solid || frac >= RULE_FRACTION;
      }
    } else if (run) {
      run.center = (run.top + run.bottom) / 2;
      bands.push(run);
      run = null;
    }
  }
  if (run) {
    run.center = (run.top + run.bottom) / 2;
    bands.push(run);
  }
  return bands;
}

/** Vertical rules between rows y0..y1 within columns x0..x1. Tolerates
 *  1px anti-aliasing wobble (checks the neighbor column) and slightly broken
 *  lines, common in photos and thin comb-cell dividers. */
function findVRules(region, x0, x1, y0, y1) {
  const { isDark, rw } = region;
  const height = Math.max(1, y1 - y0 + 1);
  const bands = [];
  let run = null;
  for (let x = Math.max(0, x0); x <= x1; x++) {
    let dark = 0;
    for (let y = y0; y <= y1; y++) {
      if (isDark(x, y) || (x + 1 < rw && isDark(x + 1, y))) {
        dark++;
      }
    }
    if (dark / height >= 0.45) {
      if (!run) {
        run = { left: x, right: x };
      } else {
        run.right = x;
      }
    } else if (run) {
      run.center = (run.left + run.right) / 2;
      bands.push(run);
      run = null;
    }
  }
  if (run) {
    run.center = (run.left + run.right) / 2;
    bands.push(run);
  }
  return bands;
}

/**
 * Does a candidate text rect overlap printed ink? Rows that are rules
 * (solid or dotted lines crossing the rect) don't count — text may sit ON a
 * line; it may not sit on words.
 */
function collides(region, rx0, ry0, rx1, ry1) {
  const { isDark, rw, rh } = region;
  const x0 = Math.max(0, Math.floor(rx0));
  const x1 = Math.min(rw - 1, Math.ceil(rx1));
  const y0 = Math.max(0, Math.floor(ry0));
  const y1 = Math.min(rh - 1, Math.ceil(ry1));
  if (x1 <= x0 || y1 <= y0) {
    return true;
  }
  let ink = 0;
  let total = 0;
  for (let y = y0; y <= y1; y++) {
    let rowDark = 0;
    let n = 0;
    let first = -1;
    let last = -1;
    for (let x = x0; x <= x1; x += 2) {
      if (isDark(x, y)) {
        rowDark++;
        if (first < 0) {
          first = x;
        }
        last = x;
      }
      n++;
    }
    const frac = rowDark / Math.max(n, 1);
    const span = first >= 0 ? (last - first) / Math.max(x1 - x0, 1) : 0;
    const isRuleRow = frac >= RULE_FRACTION || (frac >= DOTTED_FRACTION && span >= DOTTED_SPAN);
    if (!isRuleRow) {
      ink += rowDark;
      total += n;
    }
  }
  // Also discount full-height vertical rules crossing the rect: a column
  // contributes at most (y1-y0) dark pixels; treat columns with >85% dark as
  // structure by subtracting them.
  for (let x = x0; x <= x1; x += 2) {
    let colDark = 0;
    for (let y = y0; y <= y1; y++) {
      if (isDark(x, y)) {
        colDark++;
      }
    }
    if (colDark / (y1 - y0 + 1) > 0.85) {
      ink -= colDark;
    }
  }
  return total > 0 && ink / total > COLLISION_INK;
}

/** Estimated rendered text width in px for Arial-style fonts. */
function textWidth(value, fontPx) {
  return value.length * 0.52 * fontPx;
}

async function refineField(ctx, w, h, field, locate) {
  const value = String(field.value || '').trim();
  if (!value) {
    return field;
  }

  // ---- Checkbox: find the real square, center the X in it ----------------
  if (CHECK_VALUE.test(value)) {
    return refineCheckbox(ctx, w, h, field, locate);
  }

  const boxHpx = ((field.box.y1 - field.box.y0) / 100) * h;
  const boxWpx = ((field.box.x1 - field.box.x0) / 100) * w;
  if (boxHpx < 5 || boxWpx < 10) {
    return field;
  }

  // Generous window: on many forms (W-9 style) the AI box covers only the
  // printed label line while the real writing space is a taller row below —
  // the window must reach the row's bottom border to find it.
  const fontPx0 = (field.fontSize / 100) * h;
  const padY = Math.max(boxHpx * 2, fontPx0 * 3, 12);
  const region = analyzeRegion(ctx, w, h, field.box, 3, padY);
  const { sx0, sy0, rw, rh } = region;
  const inX0 = Math.max(0, Math.floor(region.bx0 - sx0));
  const inX1 = Math.min(rw, Math.ceil(region.bx1 - sx0));

  const rules = findHRules(region, inX0, inX1, 0, rh - 1);
  const boxTopInWin = region.by0 - sy0;
  const boxBottomInWin = region.by1 - sy0;

  // --- Candidate writing bands = gaps between consecutive SOLID rules -----
  const solids = rules.filter((r) => r.solid);
  const bands = [];
  for (let i = 0; i < solids.length - 1; i++) {
    const top = solids[i].bottom + 1;
    const bottom = solids[i + 1].top - 1;
    if (bottom - top >= 8) {
      bands.push({ top, bottom });
    }
  }
  if (solids.length === 1) {
    // Single rule: it's an answer line (band above it) if it sits below the
    // field's upper third, else a top border (band below it).
    const r = solids[0];
    if (r.center >= boxTopInWin + boxHpx * 0.35) {
      bands.push({ top: Math.max(0, r.top - Math.max(fontPx0 * 1.8, boxHpx)), bottom: r.top - 1 });
    } else {
      bands.push({ top: r.bottom + 1, bottom: rh - 1 });
    }
  }
  if (bands.length === 0) {
    bands.push({ top: boxTopInWin, bottom: Math.min(rh - 1, boxBottomInWin) });
  }

  // Pick the writing band. Primary signal: the band containing the AI box's
  // TOP — a field's box starts at its printed label, and the label lives in
  // the field's own row (an overlap score can tie across the row boundary
  // when the box straddles it, landing text in the NEXT row's field).
  // Fall back to max overlap when the top band is too thin to write in.
  let band = bands.find((b) => boxTopInWin >= b.top - 1 && boxTopInWin <= b.bottom) || null;
  if (band && (band.bottom - band.top) < fontPx0 * 1.1) {
    band = null;
  }
  if (!band) {
    let bestOverlap = -1;
    for (const b of bands) {
      const overlap = Math.min(b.bottom, boxBottomInWin) - Math.max(b.top, boxTopInWin);
      const score = overlap + (b.bottom - b.top) * 0.01;
      if (score > bestOverlap) {
        bestOverlap = score;
        band = b;
      }
    }
  }
  if (!band) {
    return field;
  }

  const bandTop = band.top;
  let bandBottom = band.bottom;
  let leftBound = inX0;
  const rightBound = inX1;

  // A writing line INSIDE the band (dotted or solid, e.g. the W-9 address
  // rows) — text belongs just above it, not centered in the whole row.
  const inner = rules.filter((r) => r.top > bandTop + 2 && r.bottom < bandBottom - 2);
  const writing = inner.filter((r) => r.center > bandTop + (bandBottom - bandTop) * 0.35);
  const hasWritingLine = writing.length > 0;
  if (hasWritingLine) {
    bandBottom = writing[writing.length - 1].top - 1;
  }

  // Comb cells? (row of one-character boxes, e.g. SSN/EIN)
  const comb = tryCombSplit(region, w, h, field, value, bandTop, bandBottom, inX0, inX1);
  if (comb) {
    return comb;
  }

  // Physical left border → indent from it.
  const vr = findVRules(region, inX0, Math.floor(inX0 + (inX1 - inX0) * 0.3), Math.ceil(bandTop), Math.floor(bandBottom));
  if (vr.length > 0) {
    leftBound = vr[0].right + 1;
  }

  // ---- Choose a font that fits the band, then hunt for clear space -------
  const bandH = bandBottom - bandTop;
  if (bandH < 6) {
    return field;
  }
  let fontPx = Math.min(fontPx0, bandH * 0.7);

  for (let attempt = 0; attempt < 2; attempt++) {
    const tw = textWidth(value, fontPx);
    const gap = Math.max(2, fontPx * 0.12);
    const yPreferred = bandBottom - gap - fontPx; // sitting on the line/bottom
    const yCentered = bandTop + (bandH - fontPx) / 2;
    // Writing-line bands and shallow bands anchor to the line (walking UP on
    // collision); roomy boxes start centered (walking DOWN on collision).
    const bottomFirst = hasWritingLine || bandH <= fontPx * 2.2;

    const yStep = Math.max(2, fontPx * 0.25);
    const xStep = Math.max(4, fontPx * 0.6);
    const xBase = leftBound + fontPx * 0.35;

    const ys = [];
    if (bottomFirst) {
      for (let y = yPreferred; y >= bandTop - 0.01; y -= yStep) {
        ys.push(y);
      }
    } else {
      for (let y = yCentered; y <= bandBottom - fontPx - gap + 0.01; y += yStep) {
        ys.push(y);
      }
    }
    if (ys.length === 0) {
      ys.push(Math.max(bandTop, yPreferred));
    }

    for (const y of ys) {
      for (let x = xBase; x + tw <= rightBound - 2; x += xStep) {
        if (!collides(region, x - 1, y - 1, x + tw + 1, y + fontPx + 1)) {
          return {
            ...field,
            x: clampPct(((sx0 + x) / w) * 100),
            y: clampPct(((sy0 + y) / h) * 100),
            fontSize: Math.max(0.7, Math.min((fontPx / h) * 100, 3.0)),
          };
        }
        if (x === xBase && xBase + tw > rightBound - 2) {
          break; // value wider than the band — no x shifts possible
        }
      }
    }
    fontPx *= 0.8; // nothing clear at this size — try smaller once
  }

  // No ink-free spot found; least-bad fallback = bottom of the band.
  const fallbackY = bandBottom - Math.max(2, fontPx * 0.12) - fontPx;
  return {
    ...field,
    x: clampPct(((sx0 + leftBound + fontPx * 0.35) / w) * 100),
    y: clampPct(((sy0 + Math.max(bandTop, fallbackY)) / h) * 100),
    fontSize: Math.max(0.7, Math.min((fontPx / h) * 100, 3.0)),
  };
}

/**
 * Comb fields: a row of one-character cells (SSN/EIN). Detected by several
 * evenly-sized enclosed cells between vertical rules. Returns one placed
 * value per character, or null if this isn't a comb.
 */
function tryCombSplit(region, w, h, field, value, bandTop, bandBottom, inX0, inX1) {
  const chars = value.replace(/[^0-9a-zA-Z]/g, '');
  if (chars.length < 3) {
    return null;
  }

  const vr = findVRules(region, inX0, inX1, Math.ceil(bandTop) + 1, Math.floor(bandBottom) - 1);
  if (vr.length < 3) {
    return null;
  }

  // Candidate cells between consecutive verticals, sane one-character widths.
  const bandH = bandBottom - bandTop;
  const { isDark } = region;

  // A REAL cell is enclosed: its top border runs across the span. The gap
  // between groups of boxes (which may contain a printed dash) has no border
  // above it — without this check the dash gap becomes a phantom cell and
  // every following digit lands one cell to the left.
  const hasTopBorder = (left, right) => {
    const yTop = Math.max(0, Math.floor(bandTop) - 3);
    for (let y = yTop; y <= Math.floor(bandTop) + 1; y++) {
      let dark = 0;
      let n = 0;
      for (let x = left; x <= right; x += 2) {
        if (isDark(x, y)) {
          dark++;
        }
        n++;
      }
      if (n > 0 && dark / n >= 0.7) {
        return true;
      }
    }
    return false;
  };
  // Reject spans that already contain printed ink (e.g. a separator dash).
  const interiorEmpty = (left, right) => {
    let dark = 0;
    let n = 0;
    for (let y = Math.ceil(bandTop) + 2; y <= Math.floor(bandBottom) - 2; y += 2) {
      for (let x = left + 1; x < right; x += 2) {
        if (isDark(x, y)) {
          dark++;
        }
        n++;
      }
    }
    return n === 0 || dark / n < 0.03;
  };

  const cells = [];
  for (let i = 0; i < vr.length - 1; i++) {
    const left = vr[i].right + 1;
    const right = vr[i + 1].left - 1;
    const width = right - left;
    if (width >= bandH * 0.25 && width <= bandH * 1.6 && hasTopBorder(left, right) && interiorEmpty(left, right)) {
      cells.push({ left, right, center: (left + right) / 2 });
    }
  }
  if (cells.length < chars.length || cells.length < 3) {
    return null;
  }

  const { sx0, sy0 } = region;
  const fontPx = Math.min(((field.fontSize / 100) * h), bandH * 0.68);
  const y = bandTop + (bandH - fontPx) / 2;

  // Left-align characters into the first N cells.
  return chars.split('').map((ch, i) => ({
    ...field,
    label: i === 0 ? field.label : `${field.label} (${i + 1})`,
    value: ch,
    x: clampPct(((sx0 + cells[i].center - 0.26 * fontPx) / w) * 100),
    y: clampPct(((sy0 + y) / h) * 100),
    fontSize: Math.max(0.7, Math.min((fontPx / h) * 100, 3.0)),
  }));
}

/**
 * Checkbox: place an X centered in the correct square.
 *
 * Full-page AI localization of tiny empty squares is unreliable (observed
 * ~30%-of-page misses), so this works through a chain of target points and
 * pixel-verifies each with a dedicated square detector:
 *   1. FOCUSED LOOK — crop just this row of the form and ask the backend to
 *      find "the square left of the printed label"; with the square large
 *      relative to the strip, localization is far more accurate.
 *   2. The AI's label-text box (text localization beats square localization).
 *   3. The AI's original square estimate.
 * The X is only ever drawn where the pixel detector confirms an actual
 * square outline; otherwise the AI placement stands.
 */
async function refineCheckbox(ctx, w, h, field, locate) {
  const boxHpx = ((field.box.y1 - field.box.y0) / 100) * h;
  const boxWpx = ((field.box.x1 - field.box.x0) / 100) * w;
  const sizeHint = Math.max(8, Math.min(boxHpx, boxWpx, 40));
  const targets = [];

  // 1) Focused strip query (the strongest signal).
  if (locate && field.label) {
    try {
      const stripTopPct = Math.max(0, field.box.y0 - 2.5);
      const stripBotPct = Math.min(100, field.box.y1 + 2.5);
      const syPx = Math.floor((stripTopPct / 100) * h);
      const shPx = Math.max(8, Math.ceil(((stripBotPct - stripTopPct) / 100) * h));
      const strip = document.createElement('canvas');
      strip.width = w;
      strip.height = shPx;
      strip.getContext('2d').drawImage(ctx.canvas, 0, syPx, w, shPx, 0, 0, w, shPx);
      const res = await locate(strip.toDataURL('image/png'), field.label);
      if (res && res.found && Array.isArray(res.box_2d)) {
        const b = res.box_2d;
        const aiCy = (((field.box.y0 + field.box.y1) / 2) / 100) * h;
        // Axis order can't be voted on a single box — try both readings, and
        // also cross x-from-locate with y-from-the-AI-box (the strip answer's
        // x tends to be excellent while its y within the strip can be sloppy).
        targets.push({
          x: ((b[1] + b[3]) / 2 / 1000) * w,
          y: syPx + ((b[0] + b[2]) / 2 / 1000) * shPx,
        });
        targets.push({ x: ((b[1] + b[3]) / 2 / 1000) * w, y: aiCy });
        targets.push({
          x: ((b[0] + b[2]) / 2 / 1000) * w,
          y: syPx + ((b[1] + b[3]) / 2 / 1000) * shPx,
        });
      }
    } catch {
      // network/model failure — fall through to weaker signals
    }
  }

  // 2) Left of the AI's label-text box.
  const lb = field.labelBox;
  if (lb && lb.x1 > lb.x0 && lb.y1 > lb.y0) {
    const labelHpx = ((lb.y1 - lb.y0) / 100) * h;
    targets.push({
      x: ((lb.x0 / 100) * w) - labelHpx * 1.2,
      y: (((lb.y0 + lb.y1) / 2) / 100) * h,
    });
  }

  // 3) The AI's own square estimate.
  targets.push({
    x: (((field.box.x0 + field.box.x1) / 2) / 100) * w,
    y: (((field.box.y0 + field.box.y1) / 2) / 100) * h,
  });

  for (const t of targets) {
    const square = findSquareNear(ctx, w, h, t.x, t.y, sizeHint);
    if (square) {
      const fontPx = Math.max(6, square.inner * 0.85);
      return {
        ...field,
        value: 'X',
        x: clampPct(((square.cx - 0.33 * fontPx) / w) * 100),
        y: clampPct(((square.cy - 0.52 * fontPx) / h) * 100),
        fontSize: Math.max(0.5, Math.min((fontPx / h) * 100, 2.5)),
      };
    }
  }
  return field;
}

/**
 * Pixel square detector: search a window around a target point for a small
 * square outline (paired short horizontal runs joined by dark verticals) and
 * return the one nearest the target, in page pixel coords.
 */
function findSquareNear(ctx, w, h, targetX, targetY, sizeHint) {
  const pad = Math.max(24, sizeHint * 3.2);
  const probe = {
    x0: Math.max(0, ((targetX - pad) / w) * 100),
    y0: Math.max(0, ((targetY - pad) / h) * 100),
    x1: Math.min(100, ((targetX + pad) / w) * 100),
    y1: Math.min(100, ((targetY + pad) / h) * 100),
  };
  const region = analyzeRegion(ctx, w, h, probe, 0, 0);
  const { sx0, sy0, rw, rh, isDark } = region;
  const tX = targetX - sx0;
  const tY = targetY - sy0;

  // Short horizontal dark runs = candidate square edges.
  const runs = [];
  for (let y = 0; y < rh; y++) {
    let start = -1;
    let gapAllowance = 0;
    for (let x = 0; x <= rw; x++) {
      const dark = x < rw && isDark(x, y);
      if (dark) {
        if (start < 0) {
          start = x;
        }
        gapAllowance = 1;
      } else if (start >= 0) {
        if (gapAllowance > 0 && x < rw) {
          gapAllowance--;
          continue;
        }
        const len = x - start - (gapAllowance === 0 ? 1 : 0);
        if (len >= 7 && len <= 45) {
          runs.push({ y, x0: start, x1: start + len });
        }
        start = -1;
      }
    }
  }

  let best = null;
  for (const a of runs) {
    for (const b of runs) {
      const height = b.y - a.y;
      if (height < 9 || height > 45) {
        continue;
      }
      if (Math.abs(a.x0 - b.x0) > 3 || Math.abs(a.x1 - b.x1) > 3) {
        continue;
      }
      const width = a.x1 - a.x0;
      if (width / height < 0.6 || width / height > 1.7) {
        continue;
      }
      // Size plausibility vs the AI's estimate — rejects letter-glyph loops.
      const side = Math.max(width, height);
      if (side < sizeHint * 0.4 || side > sizeHint * 2.2) {
        continue;
      }
      let leftDark = 0;
      let rightDark = 0;
      for (let y = a.y; y <= b.y; y++) {
        if (isDark(a.x0, y) || isDark(a.x0 + 1, y)) {
          leftDark++;
        }
        if (isDark(a.x1, y) || isDark(a.x1 - 1, y)) {
          rightDark++;
        }
      }
      if (leftDark / (height + 1) < 0.7 || rightDark / (height + 1) < 0.7) {
        continue;
      }
      // A real checkbox is EMPTY inside; glyph shapes and dense text are not.
      let inkInside = 0;
      let nInside = 0;
      for (let y = a.y + 3; y <= b.y - 3; y++) {
        for (let x = a.x0 + 3; x <= a.x1 - 3; x++) {
          if (isDark(x, y)) {
            inkInside++;
          }
          nInside++;
        }
      }
      if (nInside > 0 && inkInside / nInside > 0.08) {
        continue;
      }
      const cx = (a.x0 + a.x1) / 2;
      const cy = (a.y + b.y) / 2;
      const dist = (cx - tX) ** 2 + (cy - tY) ** 2;
      if (!best || dist < best.dist) {
        best = { cx: sx0 + cx, cy: sy0 + cy, inner: Math.min(width, height) - 3, dist };
      }
    }
  }
  return best;
}

function clampPct(v) {
  return Math.max(0, Math.min(v, 98));
}
