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
  // Rects (page px) already claimed by placed fields. Later fields must not
  // overlap earlier ones — two fields resolving to the same clear space is
  // how "business name stamped over the name" happens.
  const placedRects = [];

  const claim = (f) => {
    if (!f || typeof f.x !== 'number') {
      return;
    }
    const fontPx = ((f.fontSize || 1.5) / 100) * h;
    const x0 = (f.x / 100) * w;
    const y0 = (f.y / 100) * h;
    placedRects.push({
      x0: x0 - 2,
      y0: y0 - 2,
      x1: x0 + textWidth(String(f.value || ''), fontPx) + 2,
      y1: y0 + fontPx + 2,
    });
  };

  for (const field of fields) {
    if (!field || !field.box) {
      placed.push(field);
      continue;
    }
    try {
      const refined = await refineField(ctx, w, h, field, locate, placedRects);
      const list = Array.isArray(refined) ? refined : [refined];
      list.forEach(claim);
      placed.push(...list);
    } catch {
      claim(field);
      placed.push(field);
    }
  }
  return placed;
}

/** Does a page-px rect overlap any already-placed field? */
function hitsPlaced(placedRects, x0, y0, x1, y1) {
  return placedRects.some((r) => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0);
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

async function refineField(ctx, w, h, field, locate, placedRects) {
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
  // the window must reach past the row's bottom border AND into the next row
  // (the band-chain retries there when this row is already claimed by
  // another field).
  const fontPx0 = (field.fontSize / 100) * h;
  const padY = Math.max(boxHpx * 3.5, fontPx0 * 6, 30);
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

  // If the chosen band is already fully claimed (e.g. the AI anchored two
  // fields — name and business name — to the same row), the CORRECT home for
  // this field is usually the next row down. Try the primary band first,
  // then each band below it.
  const primaryIndex = bands.indexOf(band);
  const bandChain = [band, ...bands.slice(primaryIndex + 1)];

  for (const b of bandChain) {
    const result = placeInBand(region, w, h, field, value, rules, b, inX0, inX1, fontPx0, placedRects);
    if (result) {
      return result;
    }
  }

  // Nothing clear anywhere; least-bad fallback = bottom of the primary band.
  const fbFont = Math.min(fontPx0, (band.bottom - band.top) * 0.7);
  const fallbackY = band.bottom - Math.max(2, fbFont * 0.12) - fbFont;
  return {
    ...field,
    x: clampPct(((sx0 + inX0 + fbFont * 0.35) / w) * 100),
    y: clampPct(((sy0 + Math.max(band.top, fallbackY)) / h) * 100),
    fontSize: Math.max(0.7, Math.min((fbFont / h) * 100, 3.0)),
  };
}

/**
 * Try to place a value inside one writing band: comb split, separator split,
 * then a clear-space hunt that avoids BOTH printed ink and already-placed
 * fields. Returns the placed field(s) or null if this band has no room.
 */
function placeInBand(region, w, h, field, value, rules, band, inX0, inX1, fontPx0, placedRects) {
  const { sx0, sy0 } = region;
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

  // Segmented value over printed separators? (e.g. Date __/__/____ — place
  // "07" "11" "2026" into the spans between the printed slashes)
  const split = trySeparatorSplit(region, w, h, field, value, bandTop, bandBottom, inX0, inX1, fontPx0, placedRects);
  if (split) {
    return split;
  }

  // Physical left border → indent from it.
  const vr = findVRules(region, inX0, Math.floor(inX0 + (inX1 - inX0) * 0.3), Math.ceil(bandTop), Math.floor(bandBottom));
  if (vr.length > 0) {
    leftBound = vr[0].right + 1;
  }

  // ---- Choose a font that fits the band, then hunt for clear space -------
  const bandH = bandBottom - bandTop;
  if (bandH < 6) {
    return null;
  }
  let fontPx = Math.min(fontPx0, bandH * 0.7);

  // Another field already anchored at this band's left edge? Then this row
  // is that field's home (the AI gave both fields the same row) and ours is
  // the next band down — occupying the same row side-by-side reads as two
  // values in one field. Genuine side-by-side fields (City | State | ZIP)
  // have different x-windows and are unaffected.
  const bandPage = {
    x0: sx0 + leftBound,
    y0: sy0 + bandTop,
    x1: sx0 + leftBound + (inX1 - leftBound) * 0.5,
    y1: sy0 + bandBottom,
  };
  if (hitsPlaced(placedRects, bandPage.x0, bandPage.y0, bandPage.x1, bandPage.y1)) {
    return null;
  }

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
        const pageX = sx0 + x;
        const pageY = sy0 + y;
        if (!hitsPlaced(placedRects, pageX, pageY, pageX + tw, pageY + fontPx)
            && !collides(region, x - 1, y - 1, x + tw + 1, y + fontPx + 1)) {
          return {
            ...field,
            x: clampPct((pageX / w) * 100),
            y: clampPct((pageY / h) * 100),
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
  return null;
}

/**
 * Values with separators over printed separator marks: when the value splits
 * on / or - into 2+ parts AND the band contains exactly that many narrow
 * printed marks (the form's own "/" glyphs), place each part centered in the
 * clear span between marks — like a human writing MM / DD / YYYY.
 */
function trySeparatorSplit(region, w, h, field, value, bandTop, bandBottom, inX0, inX1, fontPx0, placedRects) {
  const parts = value.split(/[/-]/).map((s) => s.trim());
  if (parts.length < 2 || parts.some((p) => !p) || value.length > 24) {
    return null;
  }

  const { isDark, sx0, sy0 } = region;
  const y0 = Math.ceil(bandTop);
  const y1 = Math.floor(bandBottom);
  if (y1 - y0 < 5) {
    return null;
  }

  // Rows that are rules (a line's anti-aliased edge bleeding into the band)
  // must not count as ink — one faint full-width row merges every column
  // into a single cluster and kills separator detection.
  const ruleRow = new Array(y1 - y0 + 1).fill(false);
  for (let y = y0; y <= y1; y++) {
    let dark = 0;
    let n = 0;
    let first = -1;
    let last = -1;
    for (let x = inX0; x <= inX1; x += 2) {
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
    const span = first >= 0 ? (last - first) / Math.max(inX1 - inX0, 1) : 0;
    ruleRow[y - y0] = frac >= DOTTED_FRACTION && span >= DOTTED_SPAN;
  }

  // Column ink profile across the band → clusters of printed marks.
  const clusters = [];
  let run = null;
  for (let x = inX0; x <= inX1; x++) {
    let dark = 0;
    for (let y = y0; y <= y1; y++) {
      if (!ruleRow[y - y0] && isDark(x, y)) {
        dark++;
      }
    }
    if (dark > 0) {
      if (!run) {
        run = { left: x, right: x };
      } else {
        run.right = x;
      }
    } else if (run && x - run.right > 2) {
      // Gap wider than the merge distance closes the cluster. (Never advance
      // run.right on empty columns — that keeps the gap perpetually "small"
      // and merges everything into one mega cluster.)
      clusters.push(run);
      run = null;
    }
  }
  if (run) {
    clusters.push(run);
  }

  // Separator marks are NARROW (a "/" is well under an em); anything wider is
  // label text — its presence is fine, but it can't be a boundary.
  const seps = clusters.filter((c) => (c.right - c.left) <= fontPx0 * 0.8);
  if (seps.length !== parts.length - 1) {
    return null;
  }

  const fontPx = Math.min(fontPx0, (y1 - y0) * 0.75);
  const gap = Math.max(2, fontPx * 0.12);
  const yPx = bandBottom - gap - fontPx;
  const bounds = [inX0, ...seps.map((s) => (s.left + s.right) / 2), inX1];

  const placedParts = [];
  for (let i = 0; i < parts.length; i++) {
    const segLeft = i === 0 ? bounds[0] : seps[i - 1].right + 2;
    const segRight = i === parts.length - 1 ? bounds[bounds.length - 1] : seps[i].left - 2;
    // Largest ink-free sub-span inside the segment (skips label words like
    // the printed "Date" at the left edge).
    const clear = clearestSpan(region, segLeft, segRight, y0, y1, ruleRow);
    const tw = textWidth(parts[i], fontPx);
    if (!clear || (clear.right - clear.left) < tw) {
      return null; // a part doesn't fit cleanly — don't half-split
    }
    const x = clear.left + ((clear.right - clear.left) - tw) / 2;
    const pageX = sx0 + x;
    const pageY = sy0 + yPx;
    if (hitsPlaced(placedRects, pageX, pageY, pageX + tw, pageY + fontPx)) {
      return null;
    }
    placedParts.push({
      ...field,
      label: i === 0 ? field.label : `${field.label} (${i + 1})`,
      value: parts[i],
      x: clampPct((pageX / w) * 100),
      y: clampPct((pageY / h) * 100),
      fontSize: Math.max(0.7, Math.min((fontPx / h) * 100, 3.0)),
    });
  }
  return placedParts;
}

/** Widest ink-free horizontal span within [x0,x1] over rows y0..y1,
 *  ignoring rows flagged as rules (line edges bleeding into the band). */
function clearestSpan(region, x0, x1, y0, y1, ruleRow) {
  const { isDark } = region;
  let best = null;
  let runStart = null;
  for (let x = Math.max(0, Math.floor(x0)); x <= Math.ceil(x1); x++) {
    let dark = 0;
    for (let y = y0; y <= y1; y++) {
      if (!(ruleRow && ruleRow[y - y0]) && isDark(x, y)) {
        dark++;
      }
    }
    if (dark === 0) {
      if (runStart === null) {
        runStart = x;
      }
    } else if (runStart !== null) {
      if (!best || (x - runStart) > (best.right - best.left)) {
        best = { left: runStart, right: x - 1 };
      }
      runStart = null;
    }
  }
  if (runStart !== null && (!best || (Math.ceil(x1) - runStart) > (best.right - best.left))) {
    best = { left: runStart, right: Math.ceil(x1) };
  }
  return best;
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
 * ~30%-of-page misses), and even the focused look sometimes boxes the option
 * TEXT instead of its square. What holds: answers land on or near the right
 * OPTION, and the square is always on the same row, to the LEFT of the text.
 * So each signal becomes a row-locked corridor sweep: find real squares
 * (pixel-verified) in the row and take the nearest one left of the answer.
 *   1. FOCUSED LOOK — crop this row, ask the backend for the option's square.
 *   2. The AI's label-text box.
 *   3. The AI's original square estimate.
 * If no square is pixel-confirmed anywhere, fall back to the focused x on
 * the option's row — at minimum the mark stays on the right line.
 */
async function refineCheckbox(ctx, w, h, field, locate) {
  const boxHpx = ((field.box.y1 - field.box.y0) / 100) * h;
  const boxWpx = ((field.box.x1 - field.box.x0) / 100) * w;
  const sizeHint = Math.max(8, Math.min(boxHpx, boxWpx, 40));
  const aiCy = (((field.box.y0 + field.box.y1) / 2) / 100) * h;
  const aiCx = (((field.box.x0 + field.box.x1) / 2) / 100) * w;

  // Anchors: {x, y} points the square should be left-of / near, best first.
  const anchors = [];
  let locateAnswered = null;

  // 1) Focused strip query.
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
        const lx = ((b[1] + b[3]) / 2 / 1000) * w;
        const ly = syPx + ((b[0] + b[2]) / 2 / 1000) * shPx;
        locateAnswered = { x: lx, y: aiCy };
        anchors.push({ x: lx, y: aiCy });
        anchors.push({ x: lx, y: ly });
        // Alternate axis-order reading of the answer box.
        anchors.push({ x: ((b[0] + b[2]) / 2 / 1000) * w, y: aiCy });
      }
    } catch {
      // network/model failure — fall through to weaker signals
    }
  }

  // 2) Left edge of the AI's label-text box.
  const lb = field.labelBox;
  if (lb && lb.x1 > lb.x0 && lb.y1 > lb.y0) {
    anchors.push({
      x: (lb.x0 / 100) * w,
      y: (((lb.y0 + lb.y1) / 2) / 100) * h,
    });
  }

  // 3) The AI's own square estimate.
  anchors.push({ x: aiCx, y: aiCy });

  for (const soft of [false, true]) {
    for (const anchor of anchors) {
      const square = findSquareInRow(ctx, w, h, anchor.x, anchor.y, sizeHint, soft);
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
  }

  // No pixel-confirmed square. Keep the mark on the option's row at the
  // focused x if we have one; otherwise leave the AI placement.
  if (locateAnswered) {
    const fontPx = Math.max(6, sizeHint * 0.7);
    return {
      ...field,
      value: 'X',
      x: clampPct(((locateAnswered.x - 0.33 * fontPx) / w) * 100),
      y: clampPct(((aiCy - 0.52 * fontPx) / h) * 100),
      fontSize: Math.max(0.5, Math.min((fontPx / h) * 100, 2.5)),
    };
  }
  return field;
}

/**
 * Row-locked corridor sweep: collect pixel-verified squares in a wide band
 * left of (and slightly right of) the anchor, on the anchor's row, and pick
 * the closest one at or left of the anchor. Answers tend to land on the
 * option text; its square sits left of it on the same line.
 */
function findSquareInRow(ctx, w, h, anchorX, anchorY, sizeHint, soft) {
  const reach = soft ? 5 : 9; // in units of sizeHint, sweeping leftward
  const probe = {
    x0: Math.max(0, ((anchorX - sizeHint * reach) / w) * 100),
    y0: Math.max(0, ((anchorY - sizeHint * 2.2) / h) * 100),
    x1: Math.min(100, ((anchorX + sizeHint * 2.5) / w) * 100),
    y1: Math.min(100, ((anchorY + sizeHint * 2.2) / h) * 100),
  };
  const squares = collectSquares(ctx, w, h, probe, sizeHint, soft);
  if (squares.length === 0) {
    return null;
  }
  const ax = anchorX;
  // Prefer squares at/left of the anchor, nearest first; a square slightly
  // right of the anchor is acceptable only if nothing sits to the left.
  const leftOnes = squares.filter((s) => s.cx <= ax + sizeHint * 1.2);
  const pool = leftOnes.length > 0 ? leftOnes : squares;
  pool.sort((a, b) => Math.abs(ax - a.cx) - Math.abs(ax - b.cx));
  return pool[0];
}

/**
 * Pixel square detector over a probe region (percent coords): returns every
 * verified small square outline — paired short horizontal runs joined by
 * dark verticals, size-plausible, with an EMPTY interior (letter glyphs and
 * dense text fail these checks).
 */
function collectSquares(ctx, w, h, probe, sizeHint, soft) {
  const minSide = Math.max(soft ? 8 : 9, sizeHint * 0.5);
  const edgeFrac = soft ? 0.55 : 0.7;
  const interiorMax = soft ? 0.12 : 0.08;
  const runGap = soft ? 2 : 1;

  const region = analyzeRegion(ctx, w, h, probe, 0, 0);
  const { sx0, sy0, rw, rh, isDark } = region;

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
        gapAllowance = runGap;
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

  const squares = [];
  for (const a of runs) {
    for (const b of runs) {
      const height = b.y - a.y;
      if (height < minSide || height > 45) {
        continue;
      }
      if (Math.abs(a.x0 - b.x0) > 3 || Math.abs(a.x1 - b.x1) > 3) {
        continue;
      }
      const width = a.x1 - a.x0;
      if (width / height < 0.6 || width / height > 1.7) {
        continue;
      }
      const side = Math.max(width, height);
      if (side < sizeHint * 0.5 || side > sizeHint * 2.2) {
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
      if (leftDark / (height + 1) < edgeFrac || rightDark / (height + 1) < edgeFrac) {
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
      if (nInside > 0 && inkInside / nInside > interiorMax) {
        continue;
      }
      squares.push({
        cx: sx0 + (a.x0 + a.x1) / 2,
        cy: sy0 + (a.y + b.y) / 2,
        inner: Math.min(width, height) - 3,
      });
    }
  }
  return squares;
}

function clampPct(v) {
  return Math.max(0, Math.min(v, 98));
}
