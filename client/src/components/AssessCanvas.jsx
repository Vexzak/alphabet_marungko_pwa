import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import RewardFeedback from '@/components/RewardFeedback';

// ---------------------------------------------------------------------------
// Ink / mask utilities
// ---------------------------------------------------------------------------

function getInkMask(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const mask = new Uint8Array(width * height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const isWhiteish = r > 245 && g > 245 && b > 245;
      if (a > 10 && !isWhiteish) {
        mask[y * width + x] = 1;
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    mask, width, height, count,
    bbox: count > 0 ? { minX, minY, maxX, maxY } : null,
  };
}

function getInkMaskFromCanvas(canvas) {
  return getInkMask(canvas);
}

function dilateMaskSeparable(mask, width, height, radius) {
  if (radius <= 0) return mask;
  const temp = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let hit = 0;
      const xStart = Math.max(0, x - radius);
      const xEnd = Math.min(width - 1, x + radius);
      for (let nx = xStart; nx <= xEnd; nx++) {
        if (mask[rowOffset + nx]) { hit = 1; break; }
      }
      temp[rowOffset + x] = hit;
    }
  }
  const out = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let hit = 0;
      const yStart = Math.max(0, y - radius);
      const yEnd = Math.min(height - 1, y + radius);
      for (let ny = yStart; ny <= yEnd; ny++) {
        if (temp[ny * width + x]) { hit = 1; break; }
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zone helpers
// ---------------------------------------------------------------------------

function zoneInkRatio(mask, canvasW, bbox, x0, x1, y0, y1) {
  const { minX, minY, maxX, maxY } = bbox;
  const bW = maxX - minX + 1;
  const bH = maxY - minY + 1;

  const px0 = Math.floor(minX + x0 * bW);
  const px1 = Math.ceil(minX + x1 * bW);
  const py0 = Math.floor(minY + y0 * bH);
  const py1 = Math.ceil(minY + y1 * bH);

  let total = 0, hit = 0;
  for (let y = py0; y < py1; y++) {
    for (let x = px0; x < px1; x++) {
      if (x >= 0 && x < canvasW && y >= 0) {
        total++;
        if (mask[y * canvasW + x]) hit++;
      }
    }
  }
  return total > 0 ? hit / total : 0;
}

function zoneRowCoverage(mask, canvasW, bbox, x0, x1, y0, y1, slices = 8) {
  const { minX, minY, maxX, maxY } = bbox;
  const bW = maxX - minX + 1;
  const bH = maxY - minY + 1;

  const px0 = Math.floor(minX + x0 * bW);
  const px1 = Math.ceil(minX + x1 * bW);

  let filledSlices = 0;
  for (let s = 0; s < slices; s++) {
    const py0s = Math.floor(minY + (y0 + (y1 - y0) * s / slices) * bH);
    const py1s = Math.ceil(minY + (y0 + (y1 - y0) * (s + 1) / slices) * bH);
    let hasInk = false;
    for (let y = py0s; y < py1s && !hasInk; y++) {
      for (let x = px0; x < px1 && !hasInk; x++) {
        if (x >= 0 && x < canvasW && y >= 0 && mask[y * canvasW + x]) hasInk = true;
      }
    }
    if (hasInk) filledSlices++;
  }
  return filledSlices / slices;
}

function zoneColCoverage(mask, canvasW, bbox, x0, x1, y0, y1, slices = 8) {
  const { minX, minY, maxX, maxY } = bbox;
  const bW = maxX - minX + 1;
  const bH = maxY - minY + 1;

  const py0 = Math.floor(minY + y0 * bH);
  const py1 = Math.ceil(minY + y1 * bH);

  let filledSlices = 0;
  for (let s = 0; s < slices; s++) {
    const px0s = Math.floor(minX + (x0 + (x1 - x0) * s / slices) * bW);
    const px1s = Math.ceil(minX + (x0 + (x1 - x0) * (s + 1) / slices) * bW);
    let hasInk = false;
    for (let y = py0; y < py1 && !hasInk; y++) {
      for (let x = px0s; x < px1s && !hasInk; x++) {
        if (x >= 0 && x < canvasW && y >= 0 && mask[y * canvasW + x]) hasInk = true;
      }
    }
    if (hasInk) filledSlices++;
  }
  return filledSlices / slices;
}

// ---------------------------------------------------------------------------
// NEW: Anti-scribble gate
// A random scribble fills the bbox uniformly. We measure how "structured"
// the ink is by checking horizontal ink-density variance across vertical
// slices. Letters have concentrated strokes; scribbles are uniform blobs.
// Returns a penalty multiplier 0..1 (1 = looks like a real letter, 0 = scribble)
// ---------------------------------------------------------------------------

function antiScribblePenalty(userInk, canvasW) {
  const { mask, bbox } = userInk;
  if (!bbox) return 1;

  const bboxW = (bbox.maxX - bbox.minX + 1) / canvasW;
  const bboxH = (bbox.maxY - bbox.minY + 1) / userInk.height;
  const nonWhiteRatio = userInk.count / (canvasW * userInk.height);

  // If ink fills more than 85% of both dimensions AND ink density is high
  // it is almost certainly a scribble/blob
  if (bboxW > 0.85 && bboxH > 0.85 && nonWhiteRatio > 0.07) {
    return 0.35;
  }

  // Measure vertical column density variance
  // A letter has very different ink amounts in left vs right columns
  // A scribble has roughly equal ink everywhere
  const COLS = 10;
  const bW = bbox.maxX - bbox.minX + 1;
  const bH = bbox.maxY - bbox.minY + 1;
  const colDensities = [];
  for (let c = 0; c < COLS; c++) {
    const x0 = Math.floor(bbox.minX + (c / COLS) * bW);
    const x1 = Math.floor(bbox.minX + ((c + 1) / COLS) * bW);
    let colInk = 0, colTotal = 0;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < canvasW) {
          colTotal++;
          if (mask[y * canvasW + x]) colInk++;
        }
      }
    }
    colDensities.push(colTotal > 0 ? colInk / colTotal : 0);
  }

  const mean = colDensities.reduce((a, b) => a + b, 0) / COLS;
  const variance = colDensities.reduce((a, b) => a + (b - mean) ** 2, 0) / COLS;

  // Low variance (< 0.005) with high mean density (> 0.25) means uniform blob = scribble
  if (variance < 0.005 && mean > 0.25) {
    return 0.4;
  }

  // Also check row density variance (horizontal uniformity)
  const ROWS = 10;
  const rowDensities = [];
  for (let r = 0; r < ROWS; r++) {
    const y0 = Math.floor(bbox.minY + (r / ROWS) * bH);
    const y1 = Math.floor(bbox.minY + ((r + 1) / ROWS) * bH);
    let rowInk = 0, rowTotal = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = bbox.minX; x <= bbox.maxX; x++) {
        if (x >= 0 && x < canvasW) {
          rowTotal++;
          if (mask[y * canvasW + x]) rowInk++;
        }
      }
    }
    rowDensities.push(rowTotal > 0 ? rowInk / rowTotal : 0);
  }

  const rowMean = rowDensities.reduce((a, b) => a + b, 0) / ROWS;
  const rowVariance = rowDensities.reduce((a, b) => a + (b - rowMean) ** 2, 0) / ROWS;

  if (rowVariance < 0.005 && rowMean > 0.25 && variance < 0.008) {
    return 0.4;
  }

  // --- Multi-diagonal / multi-stroke scribble detection ---
  // Real letters always leave at least one quadrant mostly empty.
  // A scribble with crossing strokes fills all 4 quadrants.
  if (bboxW > 0.50 && bboxH > 0.50) {
    const q = (x0f, x1f, y0f, y1f) => {
      const px0 = Math.floor(bbox.minX + x0f * bW);
      const px1 = Math.ceil(bbox.minX + x1f * bW);
      const py0 = Math.floor(bbox.minY + y0f * bH);
      const py1 = Math.ceil(bbox.minY + y1f * bH);
      let ink = 0, total = 0;
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          if (x >= 0 && x < canvasW && y >= 0) {
            total++;
            if (mask[y * canvasW + x]) ink++;
          }
        }
      }
      return total > 0 ? ink / total : 0;
    };
    const tl = q(0, 0.5, 0, 0.5);
    const tr = q(0.5, 1, 0, 0.5);
    const bl = q(0, 0.5, 0.5, 1);
    const br = q(0.5, 1, 0.5, 1);
    const minQ = Math.min(tl, tr, bl, br);
    const maxQ = Math.max(tl, tr, bl, br);
    // All 4 quadrants have ink AND they're similarly populated → scribble
    // Real letters have at least one near-empty quadrant (minQ/maxQ < 0.25)
    if (minQ > 0.04 && minQ / Math.max(maxQ, 0.001) > 0.28) {
      return 0.42;
    }
  }

  return 1; // looks structured, no penalty
}

// ---------------------------------------------------------------------------
// Letter feature definitions — FIXED & STRICTER
// ---------------------------------------------------------------------------

function scoreByFeatures(letterChar, userInk) {
  const { mask, width: canvasW, bbox } = userInk;
  if (!bbox) return null;

  const ri = (x0, x1, y0, y1) => zoneInkRatio(mask, canvasW, bbox, x0, x1, y0, y1);
  const rc = (x0, x1, y0, y1, s) => zoneRowCoverage(mask, canvasW, bbox, x0, x1, y0, y1, s);
  const cc = (x0, x1, y0, y1, s) => zoneColCoverage(mask, canvasW, bbox, x0, x1, y0, y1, s);

  let checks = [];

  switch (letterChar) {

    case 'b': {
      const stemContinuity  = rc(0, 0.22, 0, 1.0, 10);
      const topRightClear   = 1 - ri(0.25, 1.0, 0, 0.45);
      const bowlTopEdge     = cc(0.15, 0.85, 0.52, 0.68, 6);
      const bowlBottomEdge  = cc(0.15, 0.80, 0.82, 1.0, 6);
      const bowlRightSide   = rc(0.55, 0.95, 0.55, 0.95, 6);
      // ANTI-SCRIBBLE: right zone in upper half must be EMPTY
      const upperRightEmpty = 1 - ri(0.4, 1.0, 0.0, 0.45);
      checks = [
        [stemContinuity,  0.30],
        [topRightClear,   0.15],
        [bowlTopEdge,     0.18],
        [bowlBottomEdge,  0.18],
        [bowlRightSide,   0.10],
        [upperRightEmpty, 0.09],
      ];
      break;
    }

    case 'd': {
      const stemContinuity  = rc(0.78, 1.0, 0, 1.0, 10);
      const topLeftClear    = 1 - ri(0, 0.75, 0, 0.45);
      const bowlTopEdge     = cc(0.15, 0.85, 0.52, 0.68, 6);
      const bowlBottomEdge  = cc(0.20, 0.85, 0.82, 1.0, 6);
      const bowlLeftSide    = rc(0.05, 0.45, 0.55, 0.95, 6);
      const upperLeftEmpty  = 1 - ri(0, 0.6, 0.0, 0.45);
      checks = [
        [stemContinuity,  0.30],
        [topLeftClear,    0.15],
        [bowlTopEdge,     0.18],
        [bowlBottomEdge,  0.18],
        [bowlLeftSide,    0.10],
        [upperLeftEmpty,  0.09],
      ];
      break;
    }

    case 'p': {
      const stemContinuity    = rc(0, 0.22, 0, 1.0, 10);
      const bowlTopEdge       = cc(0.15, 0.85, 0.05, 0.25, 6);
      const bowlBottomEdge    = cc(0.15, 0.80, 0.40, 0.60, 6);
      const bowlRightSide     = rc(0.55, 0.95, 0.08, 0.58, 6);
      const bottomRightClear  = 1 - ri(0.3, 1.0, 0.65, 1.0);
      checks = [
        [stemContinuity,   0.35],
        [bowlTopEdge,      0.20],
        [bowlBottomEdge,   0.20],
        [bowlRightSide,    0.15],
        [bottomRightClear, 0.10],
      ];
      break;
    }

    case 'q': {
      const stemContinuity  = rc(0.78, 1.0, 0, 1.0, 10);
      const bowlTopEdge     = cc(0.15, 0.85, 0.05, 0.25, 6);
      const bowlBottomEdge  = cc(0.20, 0.85, 0.40, 0.60, 6);
      const bowlLeftSide    = rc(0.05, 0.45, 0.08, 0.58, 6);
      const bottomLeftClear = 1 - ri(0, 0.7, 0.65, 1.0);
      checks = [
        [stemContinuity,  0.35],
        [bowlTopEdge,     0.20],
        [bowlBottomEdge,  0.20],
        [bowlLeftSide,    0.15],
        [bottomLeftClear, 0.10],
      ];
      break;
    }

    case 'h': {
      const leftStem       = rc(0, 0.22, 0, 1.0, 10);
      const archTop        = cc(0.3, 0.85, 0.3, 0.58, 5);
      const rightLeg       = rc(0.7, 1.0, 0.5, 1.0, 6);
      const upperRightInk  = ri(0.3, 1.0, 0, 0.35);
      // Right side upper must be mostly clear
      const upperRightClear = Math.max(0, 1 - upperRightInk * 2);
      checks = [
        [leftStem,        0.38],
        [archTop,         0.24],
        [rightLeg,        0.24],
        [upperRightClear, 0.14],
      ];
      break;
    }

    case 'n': {
      const leftLeg  = rc(0, 0.22, 0, 1.0, 10);
      const archTop  = cc(0.15, 0.85, 0, 0.3, 5);
      const rightLeg = rc(0.75, 1.0, 0.3, 1.0, 6);
      // Top-center must have ink (arch), top-right must NOT be a full stem
      const topCenterInk = ri(0.2, 0.8, 0, 0.25);
      checks = [
        [leftLeg,      0.32],
        [archTop,      0.28],
        [rightLeg,     0.28],
        [topCenterInk, 0.12],
      ];
      break;
    }

    case 'f': {
      const vertStroke = rc(0.35, 0.65, 0, 1.0, 10);
      const topHook    = ri(0, 0.65, 0, 0.25);
      const crossbar   = cc(0.05, 0.95, 0.25, 0.45, 6);
      // Bottom half right must be clear (no right leg)
      const bottomRightClear = 1 - ri(0.55, 1.0, 0.5, 1.0);
      checks = [
        [vertStroke,       0.35],
        [topHook,          0.22],
        [crossbar,         0.30],
        [bottomRightClear, 0.13],
      ];
      break;
    }

    case 't': {
      const vertStroke   = rc(0.25, 0.65, 0, 1.0, 10);
      const crossbar     = cc(0, 1.0, 0.2, 0.45, 6);
      const bottomStroke = rc(0.3, 0.65, 0.45, 1.0, 6);
      // Crossbar must extend to right side
      const crossbarRight = rc(0.55, 1.0, 0.2, 0.45, 4);
      checks = [
        [vertStroke,    0.30],
        [crossbar,      0.32],
        [bottomStroke,  0.22],
        [crossbarRight, 0.16],
      ];
      break;
    }

    case 'k': {
      const leftStem    = rc(0, 0.25, 0, 1.0, 10);
      const upperRight  = ri(0.3, 1.0, 0.1, 0.55);
      const lowerRight  = ri(0.3, 1.0, 0.5, 0.95);
      const midJunction = ri(0.2, 0.65, 0.35, 0.65);
      // Center-left should be mostly clear between upper and lower diagonals
      const midClear = 1 - ri(0.25, 0.65, 0.45, 0.55);
      checks = [
        [leftStem,    0.35],
        [upperRight,  0.18],
        [lowerRight,  0.18],
        [midJunction, 0.18],
        [midClear,    0.11],
      ];
      break;
    }

    case 'y': {
      const leftUpper  = ri(0, 0.55, 0, 0.55);
      const rightUpper = ri(0.45, 1.0, 0, 0.55);
      const tailDown   = rc(0.1, 0.6, 0.5, 1.0, 6);
      // Top-center must be fairly clear (V gap)
      const topCenterClear = 1 - ri(0.3, 0.7, 0, 0.2);
      checks = [
        [leftUpper,       0.27],
        [rightUpper,      0.27],
        [tailDown,        0.32],
        [topCenterClear,  0.14],
      ];
      break;
    }

    case 'g': {
      const bowlTop    = cc(0.1, 0.9, 0, 0.2, 5);
      const bowlBottom = cc(0.1, 0.9, 0.45, 0.65, 5);
      const bowlRight  = rc(0.7, 1.0, 0.05, 0.65, 6);
      const bowlLeft   = rc(0, 0.3, 0.05, 0.65, 6);
      const tail       = ri(0.4, 1.0, 0.6, 1.0);
      const centerClear = 1 - ri(0.25, 0.75, 0.1, 0.55);
      checks = [
        [bowlTop,     0.18],
        [bowlBottom,  0.18],
        [bowlRight,   0.18],
        [bowlLeft,    0.18],
        [tail,        0.18],
        [centerClear, 0.10],
      ];
      break;
    }

    case 'j': {
      const vertStroke = rc(0.55, 0.85, 0, 0.75, 8);
      const bottomHook = ri(0, 0.7, 0.7, 1.0);
      const topDot     = ri(0.4, 0.9, 0, 0.15);
      // Left side must be mostly clear
      const leftClear  = 1 - ri(0, 0.45, 0.05, 0.7);
      checks = [
        [vertStroke, 0.38],
        [bottomHook, 0.32],
        [topDot,     0.14],
        [leftClear,  0.16],
      ];
      break;
    }

    case 'l': {
      const vertStroke = rc(0.25, 0.75, 0, 1.0, 10);
      const topInk     = ri(0.2, 0.8, 0, 0.15);
      const bottomInk  = ri(0.2, 0.8, 0.85, 1.0);
      // Wide zones left+right must be mostly clear (it's a thin stroke)
      const leftClear  = 1 - ri(0, 0.2, 0.1, 0.9);
      const rightClear = 1 - ri(0.8, 1.0, 0.1, 0.9);
      checks = [
        [vertStroke, 0.48],
        [topInk,     0.16],
        [bottomInk,  0.16],
        [leftClear,  0.10],
        [rightClear, 0.10],
      ];
      break;
    }

    case 'i': {
      const vertStroke = rc(0.25, 0.75, 0.2, 1.0, 8);
      const dot        = ri(0.2, 0.8, 0, 0.18);
      // Wide zones must be clear
      const leftClear  = 1 - ri(0, 0.2, 0.2, 1.0);
      const rightClear = 1 - ri(0.8, 1.0, 0.2, 1.0);
      checks = [
        [vertStroke, 0.45],
        [dot,        0.35],
        [leftClear,  0.10],
        [rightClear, 0.10],
      ];
      break;
    }

    case 'O':
    case 'o': {
      const topEdge     = cc(0.15, 0.85, 0,    0.18, 6);
      const bottomEdge  = cc(0.15, 0.85, 0.82, 1.0,  6);
      const leftEdge    = rc(0,    0.18, 0.15, 0.85, 6);
      const rightEdge   = rc(0.82, 1.0,  0.15, 0.85, 6);
      const centerClear = 1 - ri(0.25, 0.75, 0.25, 0.75);
      checks = [
        [topEdge,     0.20],
        [bottomEdge,  0.20],
        [leftEdge,    0.20],
        [rightEdge,   0.20],
        [centerClear, 0.20],
      ];
      break;
    }

    case 'Q': {
      const topEdge     = cc(0.15, 0.85, 0,    0.18, 6);
      const bottomEdge  = cc(0.15, 0.75, 0.82, 1.0,  6);
      const leftEdge    = rc(0,    0.18, 0.15, 0.85, 6);
      const rightEdge   = rc(0.82, 1.0,  0.15, 0.75, 6);
      const centerClear = 1 - ri(0.25, 0.75, 0.25, 0.75);
      const tail        = ri(0.5, 1.0, 0.65, 1.0);
      checks = [
        [topEdge,     0.18],
        [bottomEdge,  0.18],
        [leftEdge,    0.18],
        [rightEdge,   0.18],
        [centerClear, 0.18],
        [tail,        0.10],
      ];
      break;
    }

    case 'D': {
      const leftEdge    = rc(0, 0.15, 0, 1.0, 10);
      const topEdge     = cc(0.1, 0.8, 0, 0.18, 5);
      const bottomEdge  = cc(0.1, 0.8, 0.82, 1.0, 5);
      const rightBulge  = rc(0.75, 1.0, 0.2, 0.8, 6);
      const centerClear = 1 - ri(0.2, 0.75, 0.2, 0.8);
      // Right side top/bottom must be clear (D curves, not square)
      const topRightClear    = 1 - ri(0.75, 1.0, 0, 0.15);
      const bottomRightClear = 1 - ri(0.75, 1.0, 0.85, 1.0);
      checks = [
        [leftEdge,         0.26],
        [topEdge,          0.13],
        [bottomEdge,       0.13],
        [rightBulge,       0.18],
        [centerClear,      0.18],
        [topRightClear,    0.06],
        [bottomRightClear, 0.06],
      ];
      break;
    }

    case 'C':
    case 'c': {
      const topEdge     = cc(0.1, 0.9,  0,    0.2,  6);
      const bottomEdge  = cc(0.1, 0.9,  0.8,  1.0,  6);
      const leftEdge    = rc(0,   0.2,  0.15, 0.85, 6);
      const rightOpen   = 1 - rc(0.8, 1.0, 0.25, 0.75, 4);
      const centerClear = 1 - ri(0.2, 0.8, 0.2, 0.8);
      checks = [
        [topEdge,     0.22],
        [bottomEdge,  0.22],
        [leftEdge,    0.28],
        [rightOpen,   0.14],
        [centerClear, 0.14],
      ];
      break;
    }

    case 'G': {
      const topEdge     = cc(0.1, 0.9,  0,    0.2,  6);
      const bottomEdge  = cc(0.1, 0.9,  0.8,  1.0,  6);
      const leftEdge    = rc(0,   0.2,  0.15, 0.85, 6);
      const midBar      = cc(0.4, 1.0,  0.4,  0.62, 5);
      const centerClear = 1 - ri(0.2, 0.75, 0.2, 0.75);
      checks = [
        [topEdge,     0.22],
        [bottomEdge,  0.22],
        [leftEdge,    0.25],
        [midBar,      0.18],
        [centerClear, 0.13],
      ];
      break;
    }

    case 'U':
    case 'u': {
      const leftLeg     = rc(0,    0.2,  0,    0.85, 8);
      const rightLeg    = rc(0.8,  1.0,  0,    0.85, 8);
      const bottomCurve = cc(0.1, 0.9,  0.75, 1.0,  6);
      const topOpen     = 1 - ri(0.2, 0.8, 0, 0.2);
      const centerClear = 1 - ri(0.2, 0.8, 0.1, 0.75);
      checks = [
        [leftLeg,     0.28],
        [rightLeg,    0.28],
        [bottomCurve, 0.24],
        [topOpen,     0.10],
        [centerClear, 0.10],
      ];
      break;
    }

    case 'e': {
      // lowercase 'e' key shape facts:
      //   - NO left vertical stem (curve, not a straight left edge top-to-bottom)
      //   - Midbar cuts horizontally through the middle
      //   - Top curve closes over (top ink present)
      //   - Bottom curve closes under (bottom ink present)
      //   - Right side is OPEN only in the bottom half (not top)
      //   - Center/interior is hollow (no dense fill)

      const midBar      = cc(0.05, 0.9, 0.42, 0.62, 8);
      const topCurve    = cc(0.1,  0.9, 0,    0.25, 6);
      const bottomCurve = cc(0.1,  0.9, 0.75, 1.0,  6);
      const leftEdge    = rc(0, 0.22, 0.1, 0.9, 6);

      // Right side open at BOTTOM (below midbar) — the 'e' mouth opening
      const rightOpenBottom = 1 - rc(0.78, 1.0, 0.55, 0.95, 4);
      // Right side must be CLOSED at TOP (above midbar) — unlike uppercase E
      const rightClosedTop  = rc(0.65, 1.0, 0.05, 0.40, 4);

      // NO left vertical stem — a straight left stem from top to bottom is NOT 'e'
      // Real 'e' has a curved left side, not a full-height straight stroke
      // Check: the left 20% must NOT have continuous ink top-to-bottom like a stem
      const leftStemContinuity = rc(0, 0.18, 0, 1.0, 10);
      const noLeftStem = 1 - leftStemContinuity; // penalizes if there's a full left stem

      // Center must be hollow (not a filled rectangle)
      const centerClear = 1 - ri(0.2, 0.75, 0.2, 0.75);

      // Midbar must reach right side (real 'e' midbar goes to right edge)
      const midBarRight = cc(0.5, 0.92, 0.42, 0.62, 6);

      // Anti-E-shape: top-right AND bottom-right should NOT both be present
      // Uppercase E has ink at top-right (top bar) AND bottom-right (bottom bar)
      // lowercase e has top-right (curve closes) but NOT bottom-right (open mouth)
      const bottomRightInk = ri(0.65, 1.0, 0.65, 1.0);
      const noBottomRightCorner = 1 - bottomRightInk;

      checks = [
        [midBar,             0.18],
        [topCurve,           0.12],
        [bottomCurve,        0.12],
        [leftEdge,           0.10],
        [rightOpenBottom,    0.10],
        [rightClosedTop,     0.12],
        [noLeftStem,         0.10],
        [centerClear,        0.08],
        [midBarRight,        0.05],
        [noBottomRightCorner,0.03],
      ];
      break;
    }

    case 'a': {
      const rightStroke = rc(0.75, 1.0, 0, 1.0, 8);
      const topCurve    = cc(0.1, 0.85, 0, 0.22, 5);
      const bottomCurve = cc(0.1, 0.85, 0.78, 1.0, 5);
      const leftSide    = rc(0, 0.25, 0.15, 0.85, 6);
      const centerClear = 1 - ri(0.2, 0.75, 0.2, 0.8);
      checks = [
        [rightStroke,  0.28],
        [topCurve,     0.18],
        [bottomCurve,  0.18],
        [leftSide,     0.18],
        [centerClear,  0.18],
      ];
      break;
    }

    case 's':
    case 'S': {
      const topCurve    = cc(0.2, 0.9, 0,    0.22, 5);
      const bottomCurve = cc(0.1, 0.8, 0.78, 1.0,  5);
      const topRight    = rc(0.7, 1.0, 0.05, 0.3,  4);
      const bottomLeft  = rc(0,   0.3, 0.7,  0.95, 4);
      const midInk      = ri(0.1, 0.9, 0.4, 0.62);
      // S-shape: top-left open, bottom-right open
      const topLeftOpen    = 1 - rc(0, 0.25, 0, 0.25, 3);
      const bottomRightOpen = 1 - rc(0.75, 1.0, 0.75, 1.0, 3);
      checks = [
        [topCurve,        0.18],
        [bottomCurve,     0.18],
        [topRight,        0.15],
        [bottomLeft,      0.15],
        [midInk,          0.16],
        [topLeftOpen,     0.09],
        [bottomRightOpen, 0.09],
      ];
      break;
    }

    case 'r': {
      const leftLeg         = rc(0, 0.25, 0, 1.0, 10);
      const archTop         = cc(0.2, 0.9, 0, 0.35, 5);
      const archRight       = rc(0.7, 1.0, 0.05, 0.45, 5);
      const bottomRightClear = 1 - ri(0.4, 1.0, 0.55, 1.0);
      // Bottom center must also be clear (r doesn't go down-right)
      const bottomCenterClear = 1 - ri(0.25, 0.75, 0.6, 1.0);
      checks = [
        [leftLeg,            0.35],
        [archTop,            0.20],
        [archRight,          0.20],
        [bottomRightClear,   0.14],
        [bottomCenterClear,  0.11],
      ];
      break;
    }

    case 'v':
    case 'V': {
      const leftDiag  = ri(0, 0.6, 0, 0.85);
      const rightDiag = ri(0.4, 1.0, 0, 0.85);
      const bottomTip = ri(0.3, 0.7, 0.7, 1.0);
      const topOpen   = 1 - ri(0.25, 0.75, 0, 0.2);
      // Top-left and top-right must have ink but top-center must not
      const topCenterClear = 1 - ri(0.35, 0.65, 0, 0.15);
      checks = [
        [leftDiag,       0.24],
        [rightDiag,      0.24],
        [bottomTip,      0.25],
        [topOpen,        0.14],
        [topCenterClear, 0.13],
      ];
      break;
    }

    case 'x':
    case 'X': {
      const topLeft     = ri(0, 0.5, 0, 0.5);
      const topRight    = ri(0.5, 1.0, 0, 0.5);
      const bottomLeft  = ri(0, 0.5, 0.5, 1.0);
      const bottomRight = ri(0.5, 1.0, 0.5, 1.0);
      const centerInk   = ri(0.3, 0.7, 0.3, 0.7);
      // Top/bottom center must be clear (X has open top and bottom)
      const topCenterClear    = 1 - ri(0.35, 0.65, 0, 0.15);
      const bottomCenterClear = 1 - ri(0.35, 0.65, 0.85, 1.0);
      checks = [
        [topLeft,            0.17],
        [topRight,           0.17],
        [bottomLeft,         0.17],
        [bottomRight,        0.17],
        [centerInk,          0.17],
        [topCenterClear,     0.08],
        [bottomCenterClear,  0.07],
      ];
      break;
    }

    case 'z':
    case 'Z': {
      const topBar     = cc(0.05, 0.95, 0, 0.2, 6);
      const bottomBar  = cc(0.05, 0.95, 0.8, 1.0, 6);
      const diagonal   = ri(0.1, 0.9, 0.15, 0.85);
      const topRight   = ri(0.5, 1.0, 0, 0.3);
      const bottomLeft = ri(0, 0.5, 0.7, 1.0);
      // Center left and center right must be clear (diagonal only)
      const centerLeftClear  = 1 - ri(0, 0.3, 0.35, 0.65);
      const centerRightClear = 1 - ri(0.7, 1.0, 0.35, 0.65);
      checks = [
        [topBar,           0.21],
        [bottomBar,        0.21],
        [diagonal,         0.17],
        [topRight,         0.12],
        [bottomLeft,       0.12],
        [centerLeftClear,  0.09],
        [centerRightClear, 0.08],
      ];
      break;
    }

    // ---- UPPERCASE STRUCTURAL (FIXED) ----

    case 'A': {
      const leftDiag   = ri(0, 0.6, 0.1, 1.0);
      const rightDiag  = ri(0.4, 1.0, 0.1, 1.0);
      const crossbar   = cc(0.1, 0.9, 0.45, 0.65, 5);
      const topPoint   = ri(0.3, 0.7, 0, 0.25);
      const bottomOpen = 1 - ri(0.3, 0.7, 0.75, 1.0);
      // Crossbar must be distinct from the legs
      const crossbarCenter = ri(0.25, 0.75, 0.45, 0.65);
      checks = [
        [leftDiag,       0.22],
        [rightDiag,      0.22],
        [crossbar,       0.22],
        [topPoint,       0.13],
        [bottomOpen,     0.10],
        [crossbarCenter, 0.11],
      ];
      break;
    }

    case 'B': {
      const leftStroke  = rc(0, 0.18, 0, 1.0, 10);
      const topBulge    = rc(0.7, 1.0, 0.05, 0.5, 5);
      const bottomBulge = rc(0.7, 1.0, 0.5, 0.95, 5);
      const midBar      = cc(0.1, 0.85, 0.44, 0.58, 5);
      const topBar      = cc(0.1, 0.7, 0.02, 0.12, 5);
      // Two bumps: top-right and bottom-right centers should both have ink
      const topCenter    = ri(0.4, 0.85, 0.1, 0.44);
      const bottomCenter = ri(0.4, 0.85, 0.56, 0.9);
      checks = [
        [leftStroke,   0.26],
        [topBulge,     0.16],
        [bottomBulge,  0.16],
        [midBar,       0.18],
        [topBar,       0.12],
        [topCenter,    0.06],
        [bottomCenter, 0.06],
      ];
      break;
    }

    // FIXED E — gap-based detection, very strict
    case 'E': {
      // 1. Left stem must run full height
      const leftStroke = rc(0, 0.20, 0, 1.0, 10);

      // 2. Each bar must span horizontally across most of the width
      //    Use high slice counts so a diagonal (which only clips corners) scores low
      const topBar    = cc(0.10, 0.92, 0.00, 0.22, 10);
      const midBar    = cc(0.10, 0.78, 0.38, 0.62, 10);
      const bottomBar = cc(0.10, 0.92, 0.78, 1.00, 10);

      // 3. RIGHT-SIDE PRESENCE: bars must reach the right edge
      //    A diagonal only skims the top-right, not the bottom-right and mid-right
      const topBarFarRight    = cc(0.65, 0.95, 0.00, 0.20, 6);
      const bottomBarFarRight = cc(0.65, 0.95, 0.78, 1.00, 6);

      // 4. GAP ZONES — the spaces BETWEEN bars on the right side must be EMPTY
      //    A diagonal fills these zones; a real E leaves them open
      //    Gap between top bar and mid bar (right half)
      const gap1Clear = 1 - ri(0.30, 1.00, 0.22, 0.38);
      //    Gap between mid bar and bottom bar (right half)
      const gap2Clear = 1 - ri(0.30, 1.00, 0.62, 0.78);

      // 5. DIAGONAL PENALTY: top-right corner to bottom-left corner diagonal
      //    A diagonal scribble fills both; a real E only fills top-right (top bar)
      //    Check that bottom-left area (below midbar, left of center) isn't also filled
      //    alongside the top-right (above midbar, right of center)
      const topRightInk   = ri(0.50, 1.00, 0.00, 0.38);
      const bottomLeftInk = ri(0.00, 0.50, 0.62, 1.00);
      // If BOTH have ink simultaneously → likely a diagonal, penalize
      const diagonalPenalty = 1 - Math.min(topRightInk, bottomLeftInk);

      checks = [
        [leftStroke,        0.20],
        [topBar,            0.12],
        [midBar,            0.12],
        [bottomBar,         0.12],
        [topBarFarRight,    0.08],
        [bottomBarFarRight, 0.08],
        [gap1Clear,         0.12],
        [gap2Clear,         0.12],
        [diagonalPenalty,   0.04],
      ];
      break;
    }

    // FIXED F — same gap-based approach, no bottom bar
    case 'F': {
      const leftStroke = rc(0, 0.20, 0, 1.0, 10);
      const topBar     = cc(0.10, 0.92, 0.00, 0.22, 10);
      const midBar     = cc(0.10, 0.78, 0.38, 0.62, 10);
      // Top bar must reach far right
      const topBarFarRight = cc(0.65, 0.95, 0.00, 0.20, 6);
      // Gap between top and mid bar (right side) must be empty
      const gap1Clear = 1 - ri(0.30, 1.00, 0.22, 0.38);
      // Bottom half right must be CLEAR (no bottom bar)
      const bottomClear      = 1 - ri(0.25, 1.00, 0.65, 1.00);
      const lowerRightClear  = 1 - ri(0.40, 1.00, 0.62, 0.95);
      // Diagonal penalty (same as E)
      const topRightInk   = ri(0.50, 1.00, 0.00, 0.38);
      const bottomLeftInk = ri(0.00, 0.50, 0.62, 1.00);
      const diagonalPenalty = 1 - Math.min(topRightInk, bottomLeftInk);
      checks = [
        [leftStroke,      0.22],
        [topBar,          0.14],
        [midBar,          0.14],
        [topBarFarRight,  0.08],
        [gap1Clear,       0.12],
        [bottomClear,     0.14],
        [lowerRightClear, 0.10],
        [diagonalPenalty, 0.06],
      ];
      break;
    }

    case 'H': {
      const leftStroke  = rc(0, 0.2, 0, 1.0, 10);
      const rightStroke = rc(0.8, 1.0, 0, 1.0, 10);
      const crossbar    = cc(0.15, 0.85, 0.42, 0.58, 5);
      // Zones above and below crossbar on both sides should be clear of horizontal ink
      const aboveCrossClear = 1 - ri(0.25, 0.75, 0, 0.38);
      const belowCrossClear = 1 - ri(0.25, 0.75, 0.62, 1.0);
      checks = [
        [leftStroke,       0.30],
        [rightStroke,      0.30],
        [crossbar,         0.25],
        [aboveCrossClear,  0.08],
        [belowCrossClear,  0.07],
      ];
      break;
    }

    case 'K': {
      const leftStroke  = rc(0, 0.25, 0, 1.0, 10);
      const upperRight  = ri(0.3, 1.0, 0.05, 0.5);
      const lowerRight  = ri(0.3, 1.0, 0.5, 0.95);
      const midJunction = ri(0.2, 0.65, 0.35, 0.65);
      checks = [
        [leftStroke,  0.40],
        [upperRight,  0.20],
        [lowerRight,  0.20],
        [midJunction, 0.20],
      ];
      break;
    }

    case 'L': {
      const vertStroke = rc(0, 0.22, 0, 1.0, 10);
      const bottomBar  = cc(0.1, 0.95, 0.82, 1.0, 5);
      const topInk     = ri(0, 0.22, 0, 0.15);
      // Right side (except bottom bar) must be clear
      const rightClear = 1 - ri(0.3, 1.0, 0, 0.78);
      checks = [
        [vertStroke, 0.42],
        [bottomBar,  0.30],
        [topInk,     0.12],
        [rightClear, 0.16],
      ];
      break;
    }

    case 'M': {
      const leftLeg   = rc(0, 0.18, 0, 1.0, 10);
      const rightLeg  = rc(0.82, 1.0, 0, 1.0, 10);
      const leftPeak  = ri(0.1, 0.55, 0, 0.55);
      const rightPeak = ri(0.45, 0.9, 0, 0.55);
      // Bottom center must be clear (M spreads at top, not bottom)
      const bottomCenterClear = 1 - ri(0.3, 0.7, 0.7, 1.0);
      checks = [
        [leftLeg,           0.25],
        [rightLeg,          0.25],
        [leftPeak,          0.20],
        [rightPeak,         0.20],
        [bottomCenterClear, 0.10],
      ];
      break;
    }

    case 'm': {
      const leftLeg  = rc(0, 0.18, 0, 1.0, 10);
      const midLeg   = rc(0.40, 0.60, 0.35, 1.0, 7);
      const rightLeg = rc(0.82, 1.0, 0.35, 1.0, 7);
      const topArch1 = cc(0.05, 0.55, 0, 0.45, 5);
      const topArch2 = cc(0.45, 0.95, 0, 0.45, 5);
      checks = [
        [leftLeg,  0.25],
        [midLeg,   0.20],
        [rightLeg, 0.20],
        [topArch1, 0.18],
        [topArch2, 0.17],
      ];
      break;
    }

    case 'N': {
      const leftLeg  = rc(0, 0.2, 0, 1.0, 10);
      const rightLeg = rc(0.8, 1.0, 0, 1.0, 10);
      const diagonal = ri(0.1, 0.9, 0.1, 0.9);
      // Center horizontal must be clear (N has diagonal not crossbar)
      const midHorizClear = 1 - cc(0.15, 0.85, 0.42, 0.58, 4);
      checks = [
        [leftLeg,       0.32],
        [rightLeg,      0.32],
        [diagonal,      0.26],
        [midHorizClear, 0.10],
      ];
      break;
    }

    case 'P': {
      const leftStroke  = rc(0, 0.18, 0, 1.0, 10);
      const topBulge    = rc(0.7, 1.0, 0.05, 0.5, 5);
      const midBar      = cc(0.1, 0.8, 0.44, 0.58, 5);
      const bottomClear = 1 - ri(0.3, 1.0, 0.62, 1.0);
      // Top-right bump center must have ink
      const bumpCenter  = ri(0.4, 0.85, 0.1, 0.44);
      checks = [
        [leftStroke,  0.30],
        [topBulge,    0.22],
        [midBar,      0.22],
        [bottomClear, 0.15],
        [bumpCenter,  0.11],
      ];
      break;
    }

    case 'R': {
      const leftStroke = rc(0, 0.18, 0, 1.0, 10);
      const topBulge   = rc(0.7, 1.0, 0.05, 0.5, 5);
      const midBar     = cc(0.1, 0.8, 0.44, 0.58, 5);
      const legDiag    = ri(0.3, 1.0, 0.55, 1.0);
      // Bump center must have ink
      const bumpCenter = ri(0.4, 0.85, 0.1, 0.44);
      checks = [
        [leftStroke, 0.26],
        [topBulge,   0.20],
        [midBar,     0.20],
        [legDiag,    0.22],
        [bumpCenter, 0.12],
      ];
      break;
    }

    case 'T': {
      const topBar     = cc(0, 1.0, 0, 0.2, 6);
      const vertStroke = rc(0.35, 0.65, 0.1, 1.0, 10);
      // Left and right of vertical stroke below topbar must be clear
      const leftClear  = 1 - ri(0, 0.3, 0.25, 1.0);
      const rightClear = 1 - ri(0.7, 1.0, 0.25, 1.0);
      checks = [
        [topBar,     0.38],
        [vertStroke, 0.42],
        [leftClear,  0.10],
        [rightClear, 0.10],
      ];
      break;
    }

    case 'W': {
      const leftLeg  = rc(0, 0.2, 0, 1.0, 8);
      const rightLeg = rc(0.8, 1.0, 0, 1.0, 8);
      const midPeak  = ri(0.3, 0.7, 0.5, 1.0);
      const topLeft  = ri(0, 0.55, 0, 0.5);
      const topRight = ri(0.45, 1.0, 0, 0.5);
      checks = [
        [leftLeg,  0.22],
        [rightLeg, 0.22],
        [midPeak,  0.22],
        [topLeft,  0.17],
        [topRight, 0.17],
      ];
      break;
    }

    case 'w': {
      const leftLeg  = rc(0, 0.18, 0, 1.0, 8);
      const rightLeg = rc(0.82, 1.0, 0, 1.0, 8);
      const midV     = ri(0.3, 0.7, 0.5, 1.0);
      checks = [
        [leftLeg,  0.30],
        [rightLeg, 0.30],
        [midV,     0.40],
      ];
      break;
    }

    case 'Y': {
      const leftDiag  = ri(0, 0.55, 0, 0.55);
      const rightDiag = ri(0.45, 1.0, 0, 0.55);
      const tailDown  = rc(0.35, 0.65, 0.45, 1.0, 7);
      // Left and right of tail must be clear
      const tailLeftClear  = 1 - ri(0, 0.3, 0.5, 1.0);
      const tailRightClear = 1 - ri(0.7, 1.0, 0.5, 1.0);
      checks = [
        [leftDiag,       0.26],
        [rightDiag,      0.26],
        [tailDown,       0.32],
        [tailLeftClear,  0.08],
        [tailRightClear, 0.08],
      ];
      break;
    }

    default:
      return null;
  }

  let totalWeight = 0, weightedScore = 0;
  for (const [val, weight] of checks) {
    weightedScore += Math.min(1, Math.max(0, val)) * weight;
    totalWeight += weight;
  }

  const raw = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return Math.round(raw * 100);
}

// ---------------------------------------------------------------------------
// buildLetterTemplateMask
// ---------------------------------------------------------------------------

function buildLetterTemplateMask(letterChar, width, height, renderW, renderH) {
  const rW = renderW || width;
  const rH = renderH || height;

  if (letterChar === 'I') {
    const canvas = document.createElement('canvas');
    canvas.width = rW;
    canvas.height = rH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rW, rH);
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const inkH = rH * 0.82;
    const top = (rH - inkH) / 2;
    const bottom = top + inkH;
    const cx = rW / 2;
    const strokeW = Math.max(6, Math.round(Math.min(rW, rH) * 0.07));
    const barHalfWidth = Math.max(strokeW * 1.6, inkH * 0.16);

    ctx.lineWidth = strokeW;
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - barHalfWidth, top); ctx.lineTo(cx + barHalfWidth, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - barHalfWidth, bottom); ctx.lineTo(cx + barHalfWidth, bottom); ctx.stroke();

    return getInkMaskFromCanvas(canvas);
  }

  const renderAt = (fontSize) => {
    const canvas = document.createElement('canvas');
    canvas.width = rW;
    canvas.height = rH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rW, rH);
    ctx.font = `normal ${fontSize}px Arial, "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 10;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(6, Math.round(Math.min(rW, rH) * 0.055));
    ctx.strokeText(letterChar, rW / 2, rH / 2 + fontSize * 0.04);
    return getInkMaskFromCanvas(canvas);
  };

  const PROBE_SIZE = Math.max(rH * 2, 200);
  const probe = renderAt(PROBE_SIZE);
  if (!probe.bbox) return renderAt(Math.round(rH * 0.78));

  const probeInkH = probe.bbox.maxY - probe.bbox.minY + 1;
  const probeInkW = probe.bbox.maxX - probe.bbox.minX + 1;
  const targetInkH = rH * 0.82;
  const targetInkW = rW * 0.82;
  const scaleByH = probeInkH > 0 ? targetInkH / probeInkH : 1;
  const scaleByW = probeInkW > 0 ? targetInkW / probeInkW : 1;
  const scale = Math.min(scaleByH, scaleByW);
  const correctedFontSize = Math.max(4, Math.round(PROBE_SIZE * scale));
  const clampedFontSize = Math.min(correctedFontSize, Math.max(rW, rH) * 3);

  return renderAt(clampedFontSize);
}

function inkDensity(mask, width, bbox) {
  if (!bbox) return 0;
  const bw = Math.max(1, bbox.maxX - bbox.minX + 1);
  const bh = Math.max(1, bbox.maxY - bbox.minY + 1);
  let count = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    const rowOffset = y * width;
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (mask[rowOffset + x]) count++;
    }
  }
  return count / (bw * bh);
}

// ---------------------------------------------------------------------------
// Template-based shape matching
// ---------------------------------------------------------------------------

function matchLetterShape(userInk, letterChar, width, height, opts = {}) {
  if (!userInk.bbox) return { score: 0, coverage: 0, precision: 0 };

  const ub = userInk.bbox;
  const uW = Math.max(1, ub.maxX - ub.minX);
  const uH = Math.max(1, ub.maxY - ub.minY);

  const margin = Math.round(Math.max(uW, uH) * 0.12);
  const tW = uW + margin * 2;
  const tH = uH + margin * 2;

  const template = buildLetterTemplateMask(letterChar, width, height, tW, tH);
  if (!template.bbox) return { score: 0, coverage: 0, precision: 0 };

  const tolFactor = typeof opts.toleranceFactor === 'number' ? opts.toleranceFactor : 0.06;
  const tolerancePx = Math.max(6, Math.round(Math.min(tW, tH) * tolFactor));

  const localUser = new Uint8Array(tW * tH);
  for (let ty = 0; ty < tH; ty++) {
    for (let tx = 0; tx < tW; tx++) {
      const sx = ub.minX - margin + tx;
      const sy = ub.minY - margin + ty;
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        if (userInk.mask[sy * width + sx]) localUser[ty * tW + tx] = 1;
      }
    }
  }

  const templateCentroidX = (template.bbox.minX + template.bbox.maxX) / 2;
  const templateCentroidY = (template.bbox.minY + template.bbox.maxY) / 2;
  const shiftX = Math.round(tW / 2 - templateCentroidX);
  const shiftY = Math.round(tH / 2 - templateCentroidY);

  let alignedTemplate = template.mask;
  if (shiftX !== 0 || shiftY !== 0) {
    alignedTemplate = new Uint8Array(tW * tH);
    for (let y = 0; y < tH; y++) {
      for (let x = 0; x < tW; x++) {
        const sx = x - shiftX;
        const sy = y - shiftY;
        if (sx >= 0 && sx < tW && sy >= 0 && sy < tH) {
          alignedTemplate[y * tW + x] = template.mask[sy * tW + sx];
        }
      }
    }
  }

  const templateDilated = dilateMaskSeparable(alignedTemplate, tW, tH, tolerancePx);
  const userDilated = dilateMaskSeparable(localUser, tW, tH, tolerancePx);

  let templateCount = 0, userCount = 0, coverHits = 0, precHits = 0;
  const localSize = tW * tH;
  for (let i = 0; i < localSize; i++) {
    if (alignedTemplate[i]) {
      templateCount++;
      if (userDilated[i]) coverHits++;
    }
    if (localUser[i]) {
      userCount++;
      if (templateDilated[i]) precHits++;
    }
  }

  const coverage = templateCount > 0 ? coverHits / templateCount : 0;
  const precision = userCount > 0 ? precHits / userCount : 0;
  const combined = Math.sqrt(coverage * precision);

  const templateDensity = inkDensity(alignedTemplate, tW, template.bbox);
  const userDensityRaw = inkDensity(userInk.mask, width, userInk.bbox);
  const densityRatio = templateDensity > 0 ? userDensityRaw / templateDensity : 1;
  let densityPenalty = 1;
  if (densityRatio > 1.8) {
    densityPenalty = Math.max(0.25, 1 - (densityRatio - 1.8) * 0.35);
  }

  const templateInkW = Math.max(1, template.bbox.maxX - template.bbox.minX);
  const templateInkH = Math.max(1, template.bbox.maxY - template.bbox.minY);
  const userAspect = uW / uH;
  const templateAspect = templateInkW / templateInkH;
  const aspectDiff = Math.abs(Math.log(userAspect / templateAspect));
  let aspectPenalty = 1;
  if (aspectDiff > 0.5) {
    aspectPenalty = Math.max(0.4, 1 - (aspectDiff - 0.5) * 0.6);
  }

  const adjusted = combined * densityPenalty * aspectPenalty;
  const score = Math.round(Math.max(0, Math.min(1, adjusted)) * 100);

  return { score, coverage, precision, densityRatio, aspectDiff };
}

// ---------------------------------------------------------------------------
// computeCanvasScore — hybrid: feature-based OR template-based
// FIXED: anti-scribble gate applied to BOTH paths
// ---------------------------------------------------------------------------

function computeCanvasScore(canvas, letterChar, opts = {}) {
  const { requiredScore = 60, minNonWhiteRatio = 0.006 } = opts;
  const { width, height } = canvas;
  const userInk = getInkMask(canvas);
  userInk.height = height; // attach for antiScribblePenalty
  const nonWhiteRatio = userInk.count / (width * height);

  if (!userInk.bbox || nonWhiteRatio < minNonWhiteRatio) {
    return { ok: false, score: 0, coverage: 0, precision: 0, nonWhiteRatio, bbox: null };
  }

  const MAX_REASONABLE_INK_RATIO = 0.25;
  const inkTooHeavy = nonWhiteRatio > MAX_REASONABLE_INK_RATIO;

  // --- ANTI-SCRIBBLE GATE (applied before any letter scoring) ---
  const scribblePenalty = antiScribblePenalty(userInk, width);

  const featureScore = scoreByFeatures(letterChar, userInk);

  let finalScore;
  let coverage = 0, precision = 0;
  let method = 'feature';

  // If feature rules exist, use them first but allow a template fallback
  if (featureScore !== null) {
    let feat = featureScore;
    if (inkTooHeavy) feat = Math.round(feat * 0.65);
    feat = Math.round(feat * scribblePenalty);

    // If features confidently pass, accept immediately
    if (feat >= requiredScore) {
      finalScore = feat;
      coverage = finalScore / 100;
      precision = finalScore / 100;
      method = 'feature';
    } else {
      // Fallback: try template matching with a looser tolerance
      const tryTemplate = matchLetterShape(userInk, letterChar, width, height, { toleranceFactor: 0.12 });
      let tempScore = tryTemplate.score;
      if (inkTooHeavy) tempScore = Math.round(tempScore * 0.6);
      tempScore = Math.round(tempScore * scribblePenalty);

      // Choose the better of feature vs template
      if (tempScore > feat) {
        finalScore = tempScore;
        coverage = tryTemplate.coverage;
        precision = tryTemplate.precision;
        method = 'template';
      } else {
        finalScore = feat;
        coverage = finalScore / 100;
        precision = finalScore / 100;
        method = 'feature';
      }
    }
  } else {
    method = 'template';
    const result = matchLetterShape(userInk, letterChar, width, height);
    finalScore = result.score;
    coverage = result.coverage;
    precision = result.precision;

    if (inkTooHeavy) finalScore = Math.round(finalScore * 0.6);
    // Apply anti-scribble penalty
    finalScore = Math.round(finalScore * scribblePenalty);

    const CONFUSABLES = {
      'M': ['m', 'N', 'W'], 'm': ['M', 'n', 'w'],
      'N': ['M', 'n', 'H'], 'n': ['N', 'm', 'h'],
      'W': ['M', 'w', 'V'], 'w': ['W', 'm', 'v'],
      'U': ['u', 'V', 'J'], 'u': ['U', 'n', 'v'],
      'V': ['U', 'v', 'Y'], 'v': ['V', 'u', 'y'],
      'O': ['o', 'Q', 'C'], 'o': ['O', 'c', 'e'],
      'C': ['c', 'G', 'O'], 'c': ['C', 'e', 'o'],
      'P': ['p', 'R', 'F'], 'p': ['P', 'q', 'b'],
      'B': ['b', 'P', 'R'], 'b': ['B', 'p', 'd'],
      'D': ['d', 'O', 'B'], 'd': ['D', 'b', 'q'],
      'I': ['l', '1', 'i'], 'i': ['I', 'l', 'j'],
      'S': ['s', '5', 'Z'], 's': ['S', 'z', '5'],
    };
    const rivals = CONFUSABLES[letterChar] || [];
    let bestRivalCoverage = 0;
    for (const rival of rivals) {
      const rivalResult = matchLetterShape(userInk, rival, width, height);
      if (rivalResult.coverage > bestRivalCoverage) bestRivalCoverage = rivalResult.coverage;
    }
    const ambiguous = rivals.length > 0 && result.coverage < bestRivalCoverage - 0.05;
    if (ambiguous) finalScore = Math.min(finalScore, 55);
    if (result.precision < 0.50) finalScore = Math.min(finalScore, 45);
  }

  const coverageTooLow = finalScore < requiredScore;

  return {
    ok: finalScore >= requiredScore,
    score: finalScore,
    coverage,
    precision,
    nonWhiteRatio,
    bbox: userInk.bbox,
    inkTooHeavy,
    coverageTooLow,
    scribblePenalty,
    method,
  };
}

// ---------------------------------------------------------------------------
// DrawingPanel
// ---------------------------------------------------------------------------
function DrawingPanel({ letterChar, phase, onCorrect, onClear }) {
  const REQUIRED_SCORE = 60;
  const MIN_NON_WHITE_RATIO = 0.006;

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);

  const [hasDrawn, setHasDrawn] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [checkerDone, setCheckerDone] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    drawingRef.current = false;
    pointsRef.current = [];
    setHasDrawn(false);
    setFeedback(null);
    setCheckerDone(false);
    setLastCheck(null);
    onClear?.();
  };

  useEffect(() => {
    clearCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterChar, phase]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const drawLine = (from, to) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handleStart = (e) => {
    if (checkerDone) return;
    e.preventDefault();
    drawingRef.current = true;
    const p = getPos(e);
    pointsRef.current = [p];
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleMove = (e) => {
    if (!drawingRef.current || checkerDone) return;
    e.preventDefault();
    const prev = pointsRef.current[pointsRef.current.length - 1];
    const next = getPos(e);
    pointsRef.current.push(next);
    if (prev) drawLine(prev, next);
  };

  const handleEnd = () => { drawingRef.current = false; };

  const checkAnswer = () => {
    if (!canvasRef.current || checkerDone) return;
    const res = computeCanvasScore(canvasRef.current, letterChar, {
      requiredScore: REQUIRED_SCORE,
      minNonWhiteRatio: MIN_NON_WHITE_RATIO,
    });
    setLastCheck(res);
    const correct = !!res.ok;
    setFeedback(correct ? 'correct' : 'incorrect');
    setCheckerDone(true);
    if (correct) onCorrect?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 'min(85vw, 380px)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: checkerDone
          ? feedback === 'correct'
            ? '0 0 0 3px #10b981, 0 8px 24px rgba(16,185,129,0.2)'
            : '0 0 0 3px #ef4444, 0 8px 24px rgba(239,68,68,0.2)'
          : '0 8px 24px rgba(0,0,0,0.10)',
        transition: 'box-shadow 0.3s',
        background: '#fff',
      }}>
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            aspectRatio: '1 / 1',
            background: '#fff',
            touchAction: 'none',
            cursor: checkerDone ? 'default' : 'crosshair',
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          onClick={checkAnswer}
          disabled={!hasDrawn || checkerDone}
          className={`px-8 font-fredoka font-bold rounded-2xl ${hasDrawn && !checkerDone ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-secondary text-white/80'}`}
          style={{ height: 'clamp(44px, 9vmin, 54px)', fontSize: 'clamp(15px, 3.5vmin, 20px)' }}
        >
          Check ✅
        </Button>
        <Button
          onClick={clearCanvas}
          className="px-8 font-fredoka font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl"
          style={{ height: 'clamp(44px, 9vmin, 54px)', fontSize: 'clamp(15px, 3.5vmin, 20px)' }}
        >
          Clear 🗑️
        </Button>
      </div>

      {lastCheck && (
        <div className="text-center text-xs text-muted-foreground" style={{ maxWidth: 460 }}>
          score={lastCheck.score} | cov={(lastCheck.coverage * 100).toFixed(0)}% | prec={(lastCheck.precision * 100).toFixed(0)}%
          | ink={(lastCheck.nonWhiteRatio * 100).toFixed(2)}% | {lastCheck.method}
          | scribble×{lastCheck.scribblePenalty?.toFixed(2)}
          {lastCheck.inkTooHeavy ? ' ⚠ too heavy' : ''}
          {lastCheck.coverageTooLow ? ' ⚠ score low' : ''}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AssessmentCanvas
// ---------------------------------------------------------------------------
/**
 * @param {{
 *   onNext: () => void,
 *   learnerCompletedLetters?: string[]
 * }} props
 */
export default function AssessmentCanvas({ onNext, learnerCompletedLetters = [] }) {
  const { currentLetter, updateLetterProgress } = useApp();

  const uppercase = currentLetter?.uppercase;
  const lowercase = currentLetter?.lowercase;
  const hasBoth = !!(uppercase && lowercase);

  const [phase, setPhase] = useState('uppercase');
  const [uppercaseCorrect, setUppercaseCorrect] = useState(false);
  const [showReward, setShowReward] = useState(null);

  useEffect(() => {
    setPhase(hasBoth ? 'uppercase' : (uppercase ? 'uppercase' : 'lowercase'));
    setUppercaseCorrect(false);
    setShowReward(null);
  }, [currentLetter?.letter, hasBoth, uppercase]);

  const handleUppercaseCorrect = () => {
    setUppercaseCorrect(true);
    setShowReward('correct');
    setTimeout(() => setShowReward(null), 1800);
  };

  const handleLowercaseCorrect = () => {
    setShowReward('correct');
    if (currentLetter) {
      updateLetterProgress(currentLetter.letter, { assessmentScore: 3, completed: true });
    }
    setTimeout(() => { setPhase('done'); }, 1800);
  };

  const handleSingleCorrect = () => {
    setShowReward('correct');
    if (currentLetter) {
      updateLetterProgress(currentLetter.letter, { assessmentScore: 3, completed: true });
    }
    setTimeout(() => { setPhase('done'); }, 1800);
  };

  const advanceToLowercase = () => { setPhase('lowercase'); };

  if (!hasBoth) {
    const char = uppercase || lowercase;
    const singlePhase = uppercase ? 'uppercase' : 'lowercase';
    if (phase === 'done') {
      return <CompletionCard letterChar={char} onRetry={() => setPhase(singlePhase)} onNext={onNext} />;
    }
    return (
      <div style={containerStyle}>
        <RewardFeedback show={showReward !== null} type={showReward === 'correct' ? 'correct' : 'incorrect'} />
        <Header letter={char} subtitle={uppercase ? `Gumuhit ng Malaking letter ${char}` : `Gumuhit ng maliit na ${char}`} />
        <DrawingPanel letterChar={char} phase={singlePhase} onCorrect={handleSingleCorrect} />
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <CompletionCard
        letterChar={`${uppercase}${lowercase}`}
        onRetry={() => { setPhase('uppercase'); setUppercaseCorrect(false); setShowReward(null); }}
        onNext={onNext}
      />
    );
  }

  if (phase === 'uppercase') {
    return (
      <div style={containerStyle}>
        <RewardFeedback show={showReward !== null} type={showReward === 'correct' ? 'correct' : 'incorrect'} />
        <Header letter={`${uppercase}${lowercase}`} subtitle={`Gumuhit ng Malaking letter ${uppercase}`} />
        <StepDots current={1} total={2} />
        <DrawingPanel letterChar={uppercase} phase="uppercase" onCorrect={handleUppercaseCorrect} />
        {uppercaseCorrect && (
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <Button
              onClick={advanceToLowercase}
              className="px-10 font-fredoka font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
              style={{ height: 'clamp(48px, 10vmin, 58px)', fontSize: 'clamp(16px, 3.8vmin, 22px)', animation: 'pulse 1s infinite' }}
            >
              Next → draw the small letter 🔡
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <RewardFeedback show={showReward !== null} type={showReward === 'correct' ? 'correct' : 'incorrect'} />
      <Header letter={`${uppercase}${lowercase}`} subtitle={`Gumuhit ng maliit na ${lowercase}`} />
      <StepDots current={2} total={2} />
      <DrawingPanel letterChar={lowercase} phase="lowercase" onCorrect={handleLowercaseCorrect} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const containerStyle = {
  height: '100%',
  overflow: 'hidden',
  padding: '6px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

function Header({ letter, subtitle }) {
  return (
    <div className="text-center">
      <h2
        className="font-fredoka font-bold text-foreground mb-1"
        style={{ fontSize: 'clamp(20px, 5vmin, 34px)', lineHeight: 1.1 }}
      >
        ✍️ {subtitle}
      </h2>
    </div>
  );
}

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === current ? 28 : 10,
            height: 10,
            borderRadius: 5,
            background: i + 1 <= current
              ? (i + 1 === current ? '#6366f1' : '#10b981')
              : 'rgba(0,0,0,0.15)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

function CompletionCard({ letterChar, onRetry, onNext }) {
  return (
    <div style={{ ...containerStyle, gap: 20 }}>
      <div style={{ fontSize: 72, lineHeight: 1 }}>🎉</div>
      <div className="font-fredoka font-bold text-foreground text-center" style={{ fontSize: 'clamp(24px, 6vmin, 40px)' }}>
        Great job!
      </div>
      <div className="text-muted-foreground text-center" style={{ fontSize: 'clamp(16px, 3.5vmin, 22px)' }}>
        You drew <span className="font-fredoka font-bold text-primary">{letterChar}</span> perfectly!
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          onClick={onRetry}
          className="px-10 font-fredoka font-bold rounded-2xl bg-secondary hover:bg-secondary/90 text-white"
          style={{ height: 54, fontSize: 18, marginTop: 8 }}
        >
          Try again 🔄
        </Button>
        <Button
          onClick={onNext}
          disabled={!onNext}
          className="px-10 font-fredoka font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
          style={{ height: 54, fontSize: 18, marginTop: 8 }}
        >
          Next ➡️
        </Button>
      </div>
    </div>
  );
}