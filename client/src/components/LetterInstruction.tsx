import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import type { LetterAsset } from '@/contexts/AppContext';
import { useRef, useEffect, useState, useCallback } from 'react';

interface LetterInstructionProps {
  onNext: () => void;
}

const SZ = 400;
const BRUSH = 30;
const O = '#FF8C42', T = '#5DCAA5', P = '#7F77DD';

type GuideStroke = { pts: number[][]; n: string; c: string; labelOffset?: [number, number]; d?: string; startTrim?: number; endTrim?: number };
type LetterDef = { path: string; sw: number; guides: GuideStroke[] };

function mg2(p1: number[][], c1: string, p2: number[][], c2: string, p3?: number[][], c3?: string): GuideStroke[] {
  const g: GuideStroke[] = [{ pts: p1, n: '1', c: c1 }, { pts: p2, n: '2', c: c2 }];
  if (p3 && c3) g.push({ pts: p3, n: '3', c: c3 });
  return g;
}
function mg1(p1: number[][], c1: string): GuideStroke[] {
  return [{ pts: p1, n: '1', c: c1 }];
}

// Reads every y-coordinate out of an SVG path string and returns [highest point, lowest point].
// Used so the capline/baseline guide lines hug the ACTUAL top/bottom of each letter shape,
// instead of a fixed number that curvy letters (C, G, O, Q, S...) naturally sweep past.
function pathYBounds(d: string): [number, number] {
  let min = Infinity, max = -Infinity;
  const re = /(-?\d+\.?\d*),(-?\d+\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const y = parseFloat(m[2]);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return [min, max];
}

const LETTERS: Record<string, LetterDef> = {
  A: {
    path: 'M60,340 L200,45 L340,340 M108,222 L292,222',
    sw: 52,
    guides: [
      { pts: [[60,340],[200,45]], n: '1', c: O },
      { pts: [[200,45],[340,340]], n: '2', c: T },
      { pts: [[108,222],[292,222]], n: '3', c: P, startTrim: 35 },
    ],
  },
  B: {
    path: 'M90,50 L90,350 M90,50 L195,50 Q268,50 268,148 Q268,200 185,200 L90,200 M90,200 L200,200 Q278,200 278,272 Q278,350 185,350 L90,350',
    sw: 48,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[90,50],[195,50],[255,90],[255,158],[185,200],[90,200]], d: 'M90,50 L195,50 Q268,50 268,148 Q268,200 185,200 L90,200', n: '2', c: T, startTrim: 30, endTrim: 115 },
      { pts: [[90,200],[200,200],[265,240],[265,310],[185,350],[90,350]], d: 'M90,200 L200,200 Q278,200 278,272 Q278,350 185,350 L90,350', n: '3', c: P, startTrim: 40 },
    ],
  },
  C: {
    path: 'M310,115 Q268,48 198,48 Q78,48 78,200 Q78,352 198,352 Q268,352 310,285',
    sw: 52,
    guides: [
      { pts: [[310,115],[268,58],[198,48],[128,55],[88,102],[70,162],[75,232],[108,288],[155,335],[210,352],[272,342],[310,285]], d: 'M310,115 Q268,48 198,48 Q78,48 78,200 Q78,352 198,352 Q268,352 310,285', n: '1', c: O },
    ],
  },
  D: {
    path: 'M90,50 L90,350 M90,50 L185,50 Q330,50 330,200 Q330,350 185,350 L90,350',
    sw: 50,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[90,50],[185,50],[310,100],[320,200],[305,300],[185,350],[90,350]], d: 'M90,50 L185,50 Q330,50 330,200 Q330,350 185,350 L90,350', n: '2', c: T, startTrim: 30 },
    ],
  },
  E: {
    path: 'M280,50 L90,50 L90,350 L280,350 M90,200 L240,200',
    sw: 48,
    guides: [
      // Stroke 1: the vertical spine, top to bottom
      { pts: [[90,50],[90,350]], n: '1', c: O },
      // Stroke 2: top horizontal arm, left to right
      { pts: [[90,50],[280,50]], n: '2', c: T, startTrim: 30 },
      // Stroke 3: middle horizontal arm, left to right
      { pts: [[90,200],[240,200]], n: '3', c: P, startTrim: 30 },
      // Stroke 4: bottom horizontal arm, left to right
      { pts: [[90,350],[280,350]], n: '4', c: '#F2B705', startTrim: 30 },
    ],
  },
  F: {
    path: 'M90,50 L90,350 M90,50 L275,50 M90,200 L240,200',
    sw: 48,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[90,50],[275,50]], n: '2', c: T, startTrim: 30 },
      { pts: [[90,200],[240,200]], n: '3', c: P, startTrim: 30 },
    ],
  },
  G: {
    path: 'M310,115 Q268,48 198,48 Q78,48 78,200 Q78,352 198,352 Q268,352 310,300 L310,200 L220,200',
    sw: 50,
    guides: [
      // Stroke 1: the big curve, extended down through the vertical drop
      { pts: [[310,115],[268,58],[198,48],[128,55],[88,102],[70,162],[75,232],[108,288],[155,335],[210,352],[272,342],[310,300],[310,200]], d: 'M310,115 Q268,48 198,48 Q78,48 78,200 Q78,352 198,352 Q268,352 310,300 L310,200', n: '1', c: O },
      // Stroke 2: straight horizontal bar only, no bend
      { pts: [[310,200],[220,200]], d: 'M310,200 L220,200', n: '2', c: T },
    ],
  },
  H: {
    path: 'M90,50 L90,350 M310,50 L310,350 M90,200 L310,200',
    sw: 50,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[310,50],[310,350]], n: '2', c: T },
      { pts: [[90,200],[310,200]], n: '3', c: P, startTrim: 30 },
    ],
  },
  I: {
    path: 'M140,50 L260,50 M200,50 L200,350 M140,350 L260,350',
    sw: 48,
    guides: [
      { pts: [[140,50],[260,50]], n: '1', c: O },
      { pts: [[200,50],[200,350]], n: '2', c: T, startTrim: 35 },
      { pts: [[140,350],[260,350]], n: '3', c: P },
    ],
  },
  J: {
    path: 'M150,50 L265,50 M210,50 L210,290 Q210,355 155,355 Q100,355 90,300',
    sw: 48,
    guides: [
      { pts: [[150,50],[265,50]], n: '1', c: O },
      { pts: [[210,50],[210,290],[200,340],[155,355],[105,340],[90,300]], d: 'M210,50 L210,290 Q210,355 155,355 Q100,355 90,300', n: '2', c: T, startTrim: 30 },
    ],
  },
  K: {
    path: 'M90,50 L90,350 M300,50 L90,200 L300,350',
    sw: 50,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[300,50],[90,200]], n: '2', c: T },
      { pts: [[90,200],[300,350]], n: '3', c: P, startTrim: 30 },
    ],
  },
  L: { path: 'M90,50 L90,350 L300,350', sw: 50, guides: mg2([[90,50],[90,350]], O, [[90,350],[300,350]], T) },
  M: {
    path: 'M55,350 L55,50 L200,230 L345,50 L345,350',
    sw: 52,
    guides: [
      // Stroke 1: straight down the left vertical
      { pts: [[55,50],[55,350]], n: '1', c: O },
      // Stroke 2: diagonal DOWN from top-left to the valley (trimmed at the
      // start so it doesn't begin at the exact same corner as stroke 1)
      { pts: [[55,50],[200,230]], n: '2', c: T, startTrim: 35 },
      // Stroke 3: diagonal UP from the valley to top-right
      { pts: [[200,230],[345,50]], n: '3', c: P },
      // Stroke 4: straight down the right vertical
      { pts: [[345,50],[345,350]], n: '4', c: '#F2B705' },
    ],
  },
  N: { path: 'M80,350 L80,50 L320,350 L320,50', sw: 50, guides: mg2([[80,350],[80,50]], O, [[80,50],[320,350]], T, [[320,350],[320,50]], P) },
  O: {
    path: 'M200,48 Q320,48 320,200 Q320,352 200,352 Q80,352 80,200 Q80,48 200,48',
    sw: 52,
    guides: [
      { pts: [[200,48],[280,65],[320,130],[320,200],[320,270],[280,335],[200,352],[120,335],[80,270],[80,200],[80,130],[120,65],[200,48]], d: 'M200,48 Q320,48 320,200 Q320,352 200,352 Q80,352 80,200 Q80,48 200,48', n: '1', c: O },
    ],
  },
  P: {
    path: 'M90,50 L90,350 M90,50 L200,50 Q290,50 290,155 Q290,210 200,210 L90,210',
    sw: 50,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[90,50],[200,50],[275,80],[278,155],[255,195],[200,210],[90,210]], d: 'M90,50 L200,50 Q290,50 290,155 Q290,210 200,210 L90,210', n: '2', c: T, startTrim: 35 },
    ],
  },
  Q: {
    path: 'M200,48 Q320,48 320,200 Q320,352 200,352 Q80,352 80,200 Q80,48 200,48 M240,270 L320,340',
    sw: 52,
    guides: [
      { pts: [[200,48],[120,65],[80,130],[80,200],[80,270],[120,335],[200,352],[280,335],[320,270],[320,200],[320,130],[280,65],[200,48]], d: 'M200,48 Q80,48 80,200 Q80,352 200,352 Q320,352 320,200 Q320,48 200,48', n: '1', c: O },
      { pts: [[240,270],[320,340]], n: '2', c: T },
    ],
  },
  R: {
    path: 'M90,50 L90,350 M90,50 L200,50 Q290,50 290,148 Q290,210 200,210 L90,210 M190,210 L310,350',
    sw: 50,
    guides: [
      { pts: [[90,50],[90,350]], n: '1', c: O },
      { pts: [[90,50],[200,50],[278,80],[278,150],[255,198],[200,210],[90,210]], d: 'M90,50 L200,50 Q290,50 290,148 Q290,210 200,210 L90,210', n: '2', c: T, startTrim: 30 },
      { pts: [[190,210],[310,350]], n: '3', c: P, startTrim: 30 },
    ],
  },
  S: {
    path: 'M288,128 Q265,58 195,48 Q98,38 90,128 Q84,185 148,210 Q218,236 268,266 Q308,300 278,342 Q248,378 178,368 Q108,358 90,288',
    sw: 52,
    guides: [
      { pts: [[288,128],[262,62],[195,48],[128,56],[94,98],[88,148],[118,182],[175,208],[235,230],[272,262],[285,308],[258,348],[198,368],[138,360],[94,330],[88,288]], d: 'M288,128 Q265,58 195,48 Q98,38 90,128 Q84,185 148,210 Q218,236 268,266 Q308,300 278,342 Q248,378 178,368 Q108,358 90,288', n: '1', c: O },
    ],
  },
  T: {
    path: 'M80,50 L320,50 M200,50 L200,350',
    sw: 50,
    guides: [
      { pts: [[80,50],[320,50]], n: '1', c: O },
      { pts: [[200,50],[200,350]], n: '2', c: T, startTrim: 35 },
    ],
  },
  U: {
    path: 'M80,50 L80,270 Q80,355 200,355 Q320,355 320,270 L320,50',
    sw: 50,
    guides: [
      { pts: [[80,50],[80,270],[100,330],[155,352],[200,355],[245,352],[300,330],[320,270],[320,50]], d: 'M80,50 L80,270 Q80,355 200,355 Q320,355 320,270 L320,50', n: '1', c: O },
    ],
  },
  V: { path: 'M65,50 L200,355 L335,50', sw: 50, guides: mg2([[65,50],[200,355]], O, [[200,355],[335,50]], T) },
  W: { path: 'M50,50 L120,350 L200,180 L280,350 L350,50', sw: 48, guides: mg2([[50,50],[120,350]], O, [[120,350],[200,180],[280,350]], T, [[280,350],[350,50]], P) },
  X: { path: 'M80,50 L320,350 M320,50 L80,350', sw: 50, guides: mg2([[80,50],[320,350]], O, [[320,50],[80,350]], T) },
  Y: { path: 'M80,50 L200,210 L320,50 M200,210 L200,350', sw: 50, guides: mg2([[80,50],[200,210]], O, [[320,50],[200,210]], T, [[200,210],[200,350]], P) },
  Z: { path: 'M80,50 L320,50 L80,350 L320,350', sw: 50, guides: mg2([[80,50],[320,50]], O, [[320,50],[80,350]], T, [[80,350],[320,350]], P) },
};

const LETTERS_LOWER: Record<string, LetterDef> = {
  a: {
    path: 'M280,100 L280,285 Q280,320 310,325 M280,155 Q280,100 220,100 Q130,100 130,200 Q130,310 220,310 Q280,310 280,255',
    sw: 46,
    guides: [
      { pts: [[280,100],[280,285],[295,315],[310,325]], d: 'M280,100 L280,285 Q280,320 310,325', n: '1', c: O },
      { pts: [[280,155],[260,105],[220,100],[165,105],[135,150],[130,200],[135,255],[165,300],[220,310],[268,310],[280,290],[280,255]], d: 'M280,155 Q280,100 220,100 Q130,100 130,200 Q130,310 220,310 Q280,310 280,255', n: '2', c: T, startTrim: 45, endTrim: 20 },
    ],
  },
  b: {
    path: 'M120,50 L120,310 M120,226 Q120,180 200,180 Q290,180 290,245 Q290,310 200,310 Q120,310 120,264',
    sw: 46,
    guides: [
      { pts: [[120,50],[120,310]], n: '1', c: O },
      { pts: [[120,226],[140,185],[200,180],[258,185],[285,214],[290,245],[280,279],[245,307],[200,310],[155,307],[120,279],[120,264]], d: 'M120,226 Q120,180 200,180 Q290,180 290,245 Q290,310 200,310 Q120,310 120,264', n: '2', c: T, startTrim: 45, endTrim: 20 },
    ],
  },
  c: {
    path: 'M280,148 Q255,100 205,100 Q120,100 120,205 Q120,310 205,310 Q255,310 280,262',
    sw: 46,
    guides: [
      { pts: [[280,148],[255,108],[205,100],[160,108],[130,148],[120,205],[130,262],[160,302],[205,310],[255,302],[280,262]], d: 'M280,148 Q255,100 205,100 Q120,100 120,205 Q120,310 205,310 Q255,310 280,262', n: '1', c: O },
    ],
  },
  d: {
    path: 'M280,50 L280,310 M280,235 Q280,195 205,195 Q145,195 145,252 Q145,310 205,310 Q243,308 280,283 Q280,275 280,270',
    sw: 46,
    guides: [
      { pts: [[280,50],[280,310]], n: '1', c: O },
      { pts: [[280,235],[262,200],[205,195],[158,200],[150,222],[145,252],[152,280],[180,305],[205,310],[243,308],[280,283],[280,270]], d: 'M280,235 Q280,195 205,195 Q145,195 145,252 Q145,310 205,310 Q243,308 280,283 Q280,275 280,270', n: '2', c: T, startTrim: 50, endTrim: 30 },
    ],
  },
  e: {
    path: 'M120,215 L285,215 Q285,100 200,100 Q115,100 115,205 Q115,310 200,310 Q255,310 282,268',
    sw: 34,
    guides: [
      { pts: [[120,215],[285,215]], n: '1', c: O },
      { pts: [[285,215],[285,155],[255,108],[200,100],[148,108],[120,155],[115,205],[125,262],[160,305],[200,310],[255,302],[282,268]], d: 'M285,215 Q285,100 200,100 Q115,100 115,205 Q115,310 200,310 Q255,310 282,268', n: '2', c: T },
    ],
  },
  f: {
    path: 'M260,80 Q240,50 210,50 Q170,50 165,90 L165,310 M120,165 L230,165',
    sw: 44,
    guides: [
      { pts: [[260,80],[240,55],[210,50],[178,55],[165,90],[165,310]], d: 'M260,80 Q240,55 210,50 Q170,50 165,90 L165,310', n: '1', c: O },
      { pts: [[120,165],[230,165]], n: '2', c: T },
    ],
  },
  g: {
    path: 'M280,200 Q280,100 200,100 Q110,100 110,200 Q110,300 200,300 Q280,300 280,200 L280,320 Q280,380 210,380 Q165,380 140,355',
    sw: 34,
    guides: [
      { pts: [[280,200],[258,112],[200,100],[148,108],[115,150],[110,200],[115,255],[148,292],[200,300],[255,292],[280,200]], d: 'M280,200 Q280,100 200,100 Q110,100 110,200 Q110,300 200,300 Q280,300 280,200', n: '1', c: O, startTrim: 50, endTrim: 30 },
      { pts: [[280,130],[280,320],[270,368],[210,380],[165,376],[140,355]], d: 'M280,130 L280,320 Q280,380 210,380 Q165,380 140,355', n: '2', c: T },
    ],
  },
  h: {
    path: 'M120,50 L120,310 M120,248 Q138,198 205,198 Q265,198 265,250 L265,310',
    sw: 46,
    guides: [
      { pts: [[120,50],[120,310]], n: '1', c: O },
      { pts: [[120,248],[136,210],[178,198],[220,203],[252,225],[265,250],[265,310]], d: 'M120,248 Q138,198 205,198 Q265,198 265,250 L265,310', n: '2', c: T, startTrim: 40 },
    ],
  },
  i: { path: 'M180,145 L180,350 M180,48 L180,75', sw: 44, guides: mg2([[180,145],[180,350]], O, [[180,48],[180,75]], T) },
  j: {
    path: 'M210,100 L210,330 Q210,385 160,385 Q130,385 115,362 M210,-20 L210,5',
    sw: 44,
    guides: [
      { pts: [[210,100],[210,330],[195,375],[160,385],[128,378],[115,362]], d: 'M210,100 L210,330 Q210,385 160,385 Q130,385 115,362', n: '1', c: O },
      { pts: [[210,-20],[210,5]], n: '2', c: T },
    ],
  },
  k: {
    // Diagonal strokes raised from raw y=100 to y=180, so after this
    // letter's headline->baseline scaling they land starting at the
    // midline instead of stretching up near the headline — matching
    // x-height-only strokes like v/w/x/y.
    path: 'M120,50 L120,310 M235,180 L120,245 L238,310',
    sw: 46,
    guides: [
      { pts: [[120,50],[120,310]], n: '1', c: O },
      { pts: [[235,180],[120,245]], n: '2', c: T },
      { pts: [[120,245],[238,310]], n: '3', c: P, startTrim: 30 },
    ],
  },
  l: {
    path: 'M180,50 L180,295 Q180,315 200,315',
    sw: 44,
    guides: [
      { pts: [[180,50],[180,295],[188,308],[200,315]], d: 'M180,50 L180,295 Q180,315 200,315', n: '1', c: O },
    ],
  },
  m: {
    // Rescaled so the peak of the arches sits exactly on the midline (200) and the baseline
    // matches the capital's baseline (350) — same ruled-paper convention as real Zaner-Bloser sheets.
    path: 'M80,350 L80,186 L80,221 Q80,200 130,200 Q180,200 180,236 L180,350 M180,236 Q180,200 230,200 Q290,200 290,254 L290,350',
    sw: 33,
    guides: [
      // Stroke 1: the left leg, straight down
      { pts: [[80,200],[80,350]], n: '1', c: O },
      // Stroke 2: first hump, curving down into the middle leg
      {
        pts: [[80,221],[130,200],[180,236],[180,350]],
        d: 'M80,221 Q80,200 130,200 Q180,200 180,236 L180,350',
        n: '2', c: T, startTrim: 20,
      },
      // Stroke 3: second hump (starts fresh at the top-center valley — no longer joined to stroke 2), curving down into the last leg
      {
        pts: [[180,236],[230,200],[290,254],[290,350]],
        d: 'M180,236 Q180,200 230,200 Q290,200 290,254 L290,350',
        n: '3', c: P, startTrim: 20,
      },
    ],
  },
  n: {
    path: 'M110,310 L110,70 Q110,100 175,100 Q255,100 255,178 L255,310',
    sw: 46,
    guides: [
      // Stroke 1: leg extended upward, straight down
      { pts: [[110,60],[110,310]], n: '1', c: O },
      // Stroke 2: arch over the top and down into the right leg
      { pts: [[110,155],[122,108],[175,100],[222,108],[248,148],[255,178],[255,310]], d: 'M110,155 Q110,100 175,100 Q255,100 255,178 L255,310', n: '2', c: T, startTrim: 45 },
    ],
  },
  o: {
    path: 'M200,100 Q290,100 290,205 Q290,310 200,310 Q110,310 110,205 Q110,100 200,100',
    sw: 48,
    guides: [
      { pts: [[200,100],[260,108],[288,155],[290,205],[282,260],[250,302],[200,310],[150,302],[118,260],[110,205],[118,150],[150,108],[200,100]], d: 'M200,100 Q290,100 290,205 Q290,310 200,310 Q110,310 110,205 Q110,100 200,100', n: '1', c: O },
    ],
  },
  p: {
    path: 'M120,200 Q120,100 200,100 Q290,100 290,205 Q290,310 200,310 Q120,310 120,200 L120,385',
    sw: 46,
    guides: [
      { pts: [[120,170],[120,385]], n: '1', c: O },
            { pts: [[120,200],[138,108],[200,100],[258,108],[285,155],[290,205],[280,260],[245,305],[200,310],[155,305],[120,260],[120,200]], d: 'M120,200 Q120,100 200,100 Q290,100 290,205 Q290,310 200,310 Q120,310 120,200', n: '2', c: T, startTrim: 50, endTrim: 50 },
    ],
  },
  q: {
    path: 'M280,205 Q280,100 200,100 Q110,100 110,205 Q110,310 200,310 Q280,310 280,205 L280,385',
    sw: 46,
    guides: [
      { pts: [[280,205],[260,108],[200,100],[145,108],[115,155],[110,205],[110,260],[145,302],[200,310],[255,302],[280,260],[280,205]], d: 'M280,205 Q280,100 200,100 Q110,100 110,205 Q110,310 200,310 Q280,310 280,205', n: '1', c: O, startTrim: 50, endTrim: 30 },
      { pts: [[280,150],[280,385]], n: '2', c: T },
    ],
  },
  r: {
    path: 'M120,310 L120,70 M120,190 Q140,100 220,100 Q252,100 265,118',
    sw: 44,
    guides: [
      { pts: [[120,70],[120,310]], n: '1', c: O },
      { pts: [[120,190],[142,118],[200,100],[245,108],[265,118]], d: 'M120,190 Q140,100 220,100 Q252,100 265,118', n: '2', c: T, startTrim: 30 },
    ],
  },
  s: {
    path: 'M268,148 Q248,100 195,100 Q120,100 122,168 Q124,210 195,225 Q268,240 272,285 Q275,330 205,330 Q155,330 128,295',
    sw: 46,
    guides: [
      { pts: [[268,148],[248,108],[195,100],[148,108],[122,145],[122,168],[150,205],[195,225],[242,242],[268,272],[272,302],[250,325],[205,330],[162,328],[128,295]], d: 'M268,148 Q248,100 195,100 Q120,100 122,168 Q124,210 195,225 Q268,240 272,285 Q275,330 205,330 Q155,330 128,295', n: '1', c: O },
    ],
  },
  t: {
    path: 'M185,55 L185,295 Q185,315 210,315 M130,160 L248,160',
    sw: 44,
    guides: [
      { pts: [[185,55],[185,295],[195,310],[210,315]], d: 'M185,55 L185,295 Q185,315 210,315', n: '1', c: O },
      { pts: [[130,160],[248,160]], n: '2', c: T },
    ],
  },
  u: {
    path: 'M110,100 L110,260 Q110,315 185,315 Q255,315 255,255 L255,100 L255,310',
    sw: 46,
    guides: [
       { pts: [[110,100],[110,260],[125,305],[185,315],[240,305],[255,255],[255,100]], d: 'M110,100 L110,260 Q110,315 185,315 Q255,315 255,255 L255,100', n: '1', c: O, endTrim: 130 },
      { pts: [[255,100],[255,320]], n: '2', c: T },
    ],
  },
  v: { path: 'M100,100 L200,320 L300,100', sw: 46, guides: mg2([[100,100],[200,320]], O, [[200,320],[300,100]], T) },
  w: { path: 'M70,100 L140,320 L200,180 L260,320 L330,100', sw: 46, guides: mg2([[70,100],[140,320]], O, [[140,320],[200,180],[260,320]], T, [[260,320],[330,100]], P) },
  x: { path: 'M110,100 L300,320 M300,100 L110,320', sw: 46, guides: mg2([[110,100],[300,320]], O, [[300,100],[110,320]], T) },
  y: { path: 'M100,100 L200,270 M300,100 L200,270 L165,340 Q145,385 105,380', sw: 46, guides: mg2([[100,100],[200,270]], O, [[300,100],[200,270],[165,340],[148,372],[105,380]], T) },
  z: { path: 'M120,100 L295,100 L120,310 L295,310', sw: 46, guides: mg2([[120,100],[295,100]], O, [[295,100],[120,310]], T, [[120,310],[295,310]], P) },
};

// ─────────────────────────────────────────────────────────────────────────
// FIXED GRID + LETTER SIZING
// ─────────────────────────────────────────────────────────────────────────
// Every capital spans HEADLINE→BASELINE exactly, and every lowercase letter
// is grouped into one of the three real Zaner-Bloser categories so it sits
// in the correct zone: x-height letters sit MIDLINE→BASELINE, ascenders
// reach up to HEADLINE, and descenders dip below BASELINE. This ONLY
// changes how big/where each letter is drawn — the numbered arrow+circle
// guides below still work exactly the way they always have, just re-plotted
// onto the resized letter.
const HEADLINE = 5;
const MIDLINE = 183;
const BASELINE = 360;
const DESCENDER_DEPTH = 30; // how far below baseline g/j/p/q/y are allowed to drop

const ASCENDER_LETTERS = new Set(['b', 'd', 'f', 'h', 'k', 'l', 't', 'i']);
const DESCENDER_LETTERS = new Set(['g', 'j', 'p', 'q', 'y']);

type LowerCategory = 'xheight' | 'ascender' | 'descender';
function getLowerCategory(letter: string): LowerCategory {
  if (DESCENDER_LETTERS.has(letter)) return 'descender';
  if (ASCENDER_LETTERS.has(letter)) return 'ascender';
  return 'xheight';
}

// Renders a path to an offscreen canvas at its authored stroke width and
// scans for the topmost/bottommost non-transparent pixel rows. This gives
// the TRUE visual ink bounds (curves + stroke width included), unlike
// reading raw coordinates out of the path string.
function measurePathBounds(d: string, strokeWidth: number): { top: number; bottom: number } {
  const PAD = 120;
  const size = SZ + PAD * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(PAD, PAD);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = strokeWidth;
  ctx.stroke(new Path2D(d));
  const { data } = ctx.getImageData(0, 0, size, size);
  let top = Infinity, bottom = -Infinity;
  for (let y = 0; y < size; y++) {
    const rowStart = y * size * 4;
    let hasInk = false;
    for (let x = 0; x < size; x++) {
      if (data[rowStart + x * 4 + 3] > 10) { hasInk = true; break; }
    }
    if (hasInk) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (!isFinite(top)) return { top: 0, bottom: SZ };
  return { top: top - PAD, bottom: bottom - PAD };
}

// Vertically rescales+repositions a path so its measured [srcTop, srcBottom]
// maps exactly onto [dstTop, dstBottom]. X coordinates are untouched.
// Used for UPPERCASE, where headline→baseline is close to the letter's
// natural proportions already.
function transformPathY(d: string, srcTop: number, srcBottom: number, dstTop: number, dstBottom: number): string {
  const span = (srcBottom - srcTop) || 1;
  const scale = (dstBottom - dstTop) / span;
  return d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_: string, x: string, y: string) => {
    const ny = dstTop + (parseFloat(y) - srcTop) * scale;
    return `${x},${ny}`;
  });
}

// Uniformly rescales a path (x AND y by the same factor) so [srcTop, srcBottom]
// maps onto [dstTop, dstBottom], keeping the letter horizontally centered on
// its own midpoint. Used for LOWERCASE, where the x-height/ascender/descender
// band is much shorter than the letter's natural width — scaling y only would
// stretch the width relative to height and make letters look squished.
function transformPathUniform(d: string, srcTop: number, srcBottom: number, dstTop: number, dstBottom: number): string {
  const span = (srcBottom - srcTop) || 1;
  const scale = (dstBottom - dstTop) / span;

  let minX = Infinity, maxX = -Infinity;
  const re = /(-?\d+\.?\d*),(-?\d+\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const x = parseFloat(m[1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const centerX = (minX + maxX) / 2;

  return d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_: string, x: string, y: string) => {
    const nx = centerX + (parseFloat(x) - centerX) * scale;
    const ny = dstTop + (parseFloat(y) - srcTop) * scale;
    return `${nx},${ny}`;
  });
}

// Finds the horizontal midpoint of a path's bounding box — used to keep
// lowercase guide points centered the same way transformPathUniform
// centers the letter itself.
function getPathXCenter(d: string): number {
  let minX = Infinity, maxX = -Infinity;
  const re = /(-?\d+\.?\d*),(-?\d+\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const x = parseFloat(m[1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  return (minX + maxX) / 2;
}

// For letters whose path includes a decorative dot (e.g. lowercase j) that
// should NOT influence the letter's own auto-scaling bounds — otherwise the
// dot stretches/compresses the whole letter's scale factor. This strips the
// dot subpath out before measuring, so the main body scales exactly as if
// the dot didn't exist; the dot then rides along using the body's own
// transform, extrapolated above it.
function getBoundsPath(letter: string, isUppercase: boolean, path: string): string {
  if (!isUppercase && letter.toLowerCase() === 'j') {
    return path.split(' M')[0]; // keep only the body subpath, drop the dot
  }
  return path;
}

// Cache: measuring + normalizing involves an offscreen canvas raster scan,
// so we only want to do it once per letter/case, not on every render.
const normalizedPathCache = new Map<string, string>();

function getNormalizedPath(letter: string, isUppercase: boolean): string {
  const cacheKey = `${isUppercase ? 'U' : 'L'}:${letter}`;
  const cached = normalizedPathCache.get(cacheKey);
  if (cached) return cached;

  const def = isUppercase
    ? (LETTERS[letter.toUpperCase()] ?? LETTERS['A'])
    : (LETTERS_LOWER[letter.toLowerCase()] ?? LETTERS_LOWER['a']);

  const measureWidth = def.sw + 8;
  const { top, bottom } = measurePathBounds(getBoundsPath(letter, isUppercase, def.path), measureWidth);

  let dstTop: number, dstBottom: number;
  if (isUppercase) {
    dstTop = HEADLINE;
    dstBottom = BASELINE;
  } else {
    const cat = getLowerCategory(letter.toLowerCase());
    if (cat === 'ascender') {
      dstTop = HEADLINE;
      dstBottom = BASELINE;
    } else if (cat === 'descender') {
      dstTop = MIDLINE;
      dstBottom = BASELINE + DESCENDER_DEPTH;
    } else {
      dstTop = MIDLINE;
      dstBottom = BASELINE;
    }
  }

  const normalized = isUppercase
    ? transformPathY(def.path, top, bottom, dstTop, dstBottom)
    : transformPathUniform(def.path, top, bottom, dstTop, dstBottom);
  normalizedPathCache.set(cacheKey, normalized);
  return normalized;
}

// Samples exact points along a REAL SVG path (including Q/Bezier curves) using
// the browser's native path length API, instead of the hand-drawn straight-line
// polygon approximations in `guides`. This is what makes curved-letter arrows
// (O, C, S, U, b, c, o, etc.) hug the actual letter curve instead of a polygon.
const svgPathSampleCache = new Map<string, number[][]>();

function sampleSvgPathPoints(d: string, numSamples = 72): number[][] {
  const cached = svgPathSampleCache.get(d);
  if (cached) return cached;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  const pathEl = document.createElementNS(svgNS, 'path');
  pathEl.setAttribute('d', d);
  svg.appendChild(pathEl);
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.setAttribute('aria-hidden', 'true');
  document.body.appendChild(svg);

  const points: number[][] = [];
  try {
    const total = pathEl.getTotalLength();
    for (let i = 0; i <= numSamples; i++) {
      const pt = pathEl.getPointAtLength((i / numSamples) * total);
      points.push([pt.x, pt.y]);
    }
  } finally {
    document.body.removeChild(svg);
  }

  svgPathSampleCache.set(d, points);
  return points;
}

// ── Generic polyline helpers (canvas-pixel-space, unit-agnostic) ──────────
// Used to trim a small visible gap at the start/end of every guide stroke
// (so strokes that used to touch at shared letter-joining points no longer
// connect), and to find the arrowhead tip / number anchor along a stroke.
function polylineLength(pts: number[][]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return total;
}

function pointAtDistance(pts: number[][], dist: number): number[] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const segLen = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + segLen >= dist || i === pts.length - 1) {
      const t = segLen > 0 ? Math.min(1, Math.max(0, (dist - acc) / segLen)) : 0;
      return [
        pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
        pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
      ];
    }
    acc += segLen;
  }
  return pts[pts.length - 1];
}

// Returns the portion of a polyline strictly between distances fromD and
// toD (measured along the path), with newly-interpolated endpoints — used
// to shorten a stroke away from its natural start/end so a visible gap
// appears where it used to touch a neighboring stroke.
function slicePolylineByDistance(pts: number[][], fromD: number, toD: number): number[][] {
  const acc: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const start = pointAtDistance(pts, fromD);
  const end = pointAtDistance(pts, toD);
  const mid = pts.filter((_, i) => acc[i] > fromD && acc[i] < toD);
  return [start, ...mid, end];
}

// Cache for normalized guide points. This ONLY moves each guide stroke's
// points to match the letter's new size/position (same transform as
// getNormalizedPath) — it does NOT touch color, arrow direction, or the
// numbered-circle rendering. It also returns the letter's own center point
// (in the same normalized space) so numbers can be nudged toward the
// interior of the letter.
type NormalizedGuides = { guides: GuideStroke[]; cx: number; cy: number };
const normalizedGuidePointsCache = new Map<string, NormalizedGuides>();

function getNormalizedGuidePoints(letter: string, isUppercase: boolean): NormalizedGuides {
  const cacheKey = `${isUppercase ? 'U' : 'L'}:${letter}`;
  const cached = normalizedGuidePointsCache.get(cacheKey);
  if (cached) return cached;

  const def = isUppercase
    ? (LETTERS[letter.toUpperCase()] ?? LETTERS['A'])
    : (LETTERS_LOWER[letter.toLowerCase()] ?? LETTERS_LOWER['a']);

  const measureWidth = def.sw + 8;
  const { top, bottom } = measurePathBounds(getBoundsPath(letter, isUppercase, def.path), measureWidth);

  let dstTop: number, dstBottom: number;
  if (isUppercase) {
    dstTop = HEADLINE;
    dstBottom = BASELINE;
  } else {
    const cat = getLowerCategory(letter.toLowerCase());
    if (cat === 'ascender') {
      dstTop = HEADLINE;
      dstBottom = BASELINE;
    } else if (cat === 'descender') {
      dstTop = MIDLINE;
      dstBottom = BASELINE + DESCENDER_DEPTH;
    } else {
      dstTop = MIDLINE;
      dstBottom = BASELINE;
    }
  }

  const span = (bottom - top) || 1;
  const scale = (dstBottom - dstTop) / span;
  const centerX = getPathXCenter(def.path);

  const normalized: GuideStroke[] = def.guides.map(g => {
    // If this stroke has a precise `d` (curved strokes), sample the REAL
    // curve instead of the hand-drawn polygon approximation in `pts`. This
    // is what makes the arrow hug the exact same ink as the gray letter
    // outline underneath, instead of a slightly-off polygon.
    const basePts = g.d ? sampleSvgPathPoints(g.d) : g.pts;
    return {
      ...g,
      pts: basePts.map(([x, y]) => {
        const ny = dstTop + (y - top) * scale;
        const nx = isUppercase ? x : centerX + (x - centerX) * scale;
        return [nx, ny];
      }),
      labelOffset: g.labelOffset
        ? ([isUppercase ? g.labelOffset[0] : g.labelOffset[0] * scale, g.labelOffset[1] * scale] as [number, number])
        : undefined,
    };
  });

  const result: NormalizedGuides = { guides: normalized, cx: centerX, cy: (dstTop + dstBottom) / 2 };
  normalizedGuidePointsCache.set(cacheKey, result);
  return result;
}

const SOUND_PLAYS_NEEDED = 3;
const ERASER_BRUSH = 40;

type CrayonColor = { name: string; file: string; r: number; g: number; b: number; rainbow?: boolean };
const CRAYONS: CrayonColor[] = [
  { name: 'blue',    file: 'blue.png',    r: 59,  g: 130, b: 246 },
  { name: 'red',     file: 'red.png',     r: 239, g: 68,  b: 68  },
  { name: 'yellow',  file: 'yellow.png',  r: 250, g: 204, b: 21  },
  { name: 'purple',  file: 'purple.png',  r: 168, g: 85,  b: 247 },
  { name: 'rainbow', file: 'rainbow.png', r: 0,   g: 0,   b: 0,  rainbow: true },
];

// ── Helper: stop an audio element cleanly ────────────────────────────────────
function stopAudio(ref: React.MutableRefObject<HTMLAudioElement | null>) {
  if (ref.current) {
    ref.current.pause();
    ref.current.currentTime = 0;
    ref.current = null;
  }
}

export default function LetterInstruction({ onNext }: LetterInstructionProps) {
  const { currentLetter, updateLetterProgress, consumeNextAsset } = useApp();

  // ── Panuto audio ──────────────────────────────────────────────────────────
  const panutoAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/Panuto_1.mp3');
    audio.volume = 1;
    panutoAudioRef.current = audio;
    audio.play().catch((err) => console.log('Panuto playback failed:', err));
    return () => {
      stopAudio(panutoAudioRef);
    };
  }, []);

  // ── Post-tracing sound phase ──────────────────────────────────────────────
  const [postTracingPhase, setPostTracingPhase] = useState<'none' | 'sound' | 'done'>('none');
  const [soundPlayCount, setSoundPlayCount] = useState(0);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const sfxRef = useRef<HTMLAudioElement | null>(null);

  // ── Eraser mode ───────────────────────────────────────────────────────────
  const [eraserMode, setEraserMode] = useState(false);
  const [followerPos, setFollowerPos] = useState<{ x: number; y: number } | null>(null);
  const followerVisible = followerPos !== null; // show follower for both eraser and crayons
  const [selectedCrayon, setSelectedCrayon] = useState<CrayonColor>(CRAYONS[0]); // blue default
  const rainbowHueRef = useRef(0);

  const playAssetSound = useCallback((src: string, onFinished?: () => void) => {
    if (sfxRef.current) {
      sfxRef.current.pause();
      sfxRef.current.currentTime = 0;
      sfxRef.current.onended = null;
      sfxRef.current = null;
    }
    const audio = new Audio(src);
    sfxRef.current = audio;
    setIsPlayingSound(true);
    setSoundPop(false);
    requestAnimationFrame(() => setSoundPop(true));
    audio.onended = () => {
      setIsPlayingSound(false);
      setSoundPop(false);
      onFinished?.();
    };
    audio.play().catch((err) => {
      console.error('Error playing sound:', err);
      setIsPlayingSound(false);
      setSoundPop(false);
      onFinished?.();
    });
  }, []);


  const letterCanvasRefUpper = useRef<HTMLCanvasElement>(null);
  const fillCanvasRefUpper   = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRefUpper = useRef<HTMLCanvasElement>(null);
  const letterCanvasRefLower = useRef<HTMLCanvasElement>(null);
  const fillCanvasRefLower   = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRefLower = useRef<HTMLCanvasElement>(null);
  const maskRefUpper = useRef<ImageData | null>(null);
  const maskRefLower = useRef<ImageData | null>(null);
  const pressingRefUpper = useRef(false);
  const pressingRefLower = useRef(false);

  const [progressUpper, setProgressUpper] = useState(0);
  const [progressLower, setProgressLower] = useState(0);
  const [isTracingComplete, setIsTracingComplete] = useState(false);
  const [showExcellent, setShowExcellent] = useState(false);
  const [hint, setHint] = useState('Hold and drag to fill the letter!');

  // ── Image animation states ────────────────────────────────────────────────
  const [idleBounce, setIdleBounce] = useState(false);
  const [soundPop, setSoundPop] = useState(false);

  // Every 2 seconds during tracing, trigger the idle bounce
  useEffect(() => {
    if (isTracingComplete) return;
    const interval = setInterval(() => {
      setIdleBounce(true);
      setTimeout(() => setIdleBounce(false), 700);
    }, 2000);
    return () => clearInterval(interval);
  }, [isTracingComplete]);

  // ── Asset ─────────────────────────────────────────────────────────────────
  const [tracingAsset, setTracingAsset] = useState<LetterAsset | null>(null);

  useEffect(() => {
    if (currentLetter) {
      setTracingAsset(consumeNextAsset());
    }
  }, [currentLetter?.letter, consumeNextAsset]);

  // ── When tracing completes: stop panuto, auto-play asset sound ────────────
  const handleTracingComplete = useCallback((asset: LetterAsset) => {
    stopAudio(panutoAudioRef);
    setPostTracingPhase('sound');
    setSoundPlayCount(1);
    playAssetSound(asset.sound);
  }, [playAssetSound]);

  const handlePlaySoundBtn = useCallback(() => {
    if (!tracingAsset) return;
    const next = soundPlayCount + 1;
    setSoundPlayCount(next);
    if (next >= SOUND_PLAYS_NEEDED) {
      playAssetSound(tracingAsset.sound, () => setShowExcellent(true));
    } else {
      playAssetSound(tracingAsset.sound);
    }
  }, [tracingAsset, soundPlayCount, playAssetSound]);

  const handlePlayAgain = () => {
    setShowExcellent(false);
    setIsTracingComplete(false);
    setPostTracingPhase('none');
    setSoundPlayCount(0);
    setEraserMode(false);
    setSelectedCrayon(CRAYONS[0]);
    rainbowHueRef.current = 0;
    setTracingAsset(consumeNextAsset());
    initCanvases();
    resetFill();
  };

  const handleContinue = useCallback(() => {
    stopAudio(sfxRef);
    onNext();
  }, [onNext]);

  // ── Letter helpers ────────────────────────────────────────────────────────
  const getLetter = useCallback((isUppercase: boolean) => {
    if (!currentLetter) return 'A';
    return isUppercase ? currentLetter.uppercase : currentLetter.lowercase;
  }, [currentLetter]);

  const getLetterDef = useCallback((isUppercase: boolean): LetterDef => {
    if (!currentLetter) return LETTERS['A'];
    if (isUppercase) return LETTERS[currentLetter.uppercase.toUpperCase()] ?? LETTERS['A'];
    return LETTERS_LOWER[currentLetter.lowercase.toLowerCase()] ?? LETTERS_LOWER['a'];
  }, [currentLetter]);

  const scalePath = useCallback((d: string, sz: number) =>
    d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_: string, x: string, y: string) =>
      `${+x / SZ * sz},${+y / SZ * sz}`
    ), []);

  const sc  = (v: number, sz: number) => v / SZ * sz;
  const scp = (p: number[], sz: number): [number, number] => [sc(p[0], sz), sc(p[1], sz)];

  const buildMask = useCallback((sz: number, isUppercase: boolean) => {
    const def = getLetterDef(isUppercase);
    const letter = getLetter(isUppercase);
    const tmp = document.createElement('canvas');
    tmp.width = sz; tmp.height = sz;
    const tctx = tmp.getContext('2d')!;
    tctx.lineCap = 'round'; tctx.lineJoin = 'round';
    tctx.strokeStyle = '#000';
    tctx.lineWidth = sc(def.sw, sz) + 2;
    const normalizedPath = getNormalizedPath(letter, isUppercase);
    tctx.stroke(new Path2D(scalePath(normalizedPath, sz)));
    if (isUppercase) maskRefUpper.current = tctx.getImageData(0, 0, sz, sz);
    else             maskRefLower.current = tctx.getImageData(0, 0, sz, sz);
  }, [getLetterDef, getLetter, scalePath]);

  const drawLetter = useCallback((sz: number, isUppercase: boolean) => {
    const lc = isUppercase ? letterCanvasRefUpper.current : letterCanvasRefLower.current;
    if (!lc) return;
    const ctx = lc.getContext('2d')!;
    const def = getLetterDef(isUppercase);
    const letter = getLetter(isUppercase);

    ctx.clearRect(0, 0, sz, sz);

    // Zaner-Bloser 3-line system: solid headline (top), dashed midline (x-height), solid baseline.
    // Fixed grid, shared by every letter.
    ctx.save();
    ctx.strokeStyle = 'rgba(70,80,110,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, sc(HEADLINE, sz)); ctx.lineTo(sz, sc(HEADLINE, sz)); ctx.stroke();

    ctx.strokeStyle = 'rgba(70,80,110,0.38)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(0, sc(MIDLINE, sz)); ctx.lineTo(sz, sc(MIDLINE, sz)); ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(70,80,110,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, sc(BASELINE, sz)); ctx.lineTo(sz, sc(BASELINE, sz)); ctx.stroke();
    ctx.restore();

    const normalizedPath = getNormalizedPath(letter, isUppercase);
    const p  = new Path2D(scalePath(normalizedPath, sz));
    const sw = sc(def.sw, sz);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000'; ctx.lineWidth = sw + 8;  ctx.stroke(p);
    ctx.strokeStyle = '#f9f8f5'; ctx.lineWidth = sw + 2; ctx.stroke(p);
    // NOTE: the thin gray '#999' outline pass that used to sit here has been
    // removed — the dashed guide arrows below now draw directly on top of
    // the exact same ink (sampled from this letter's own real path), so they
    // replace that gray line instead of layering over/near it.
    ctx.restore();

    const { guides, cx: cxRaw, cy: cyRaw } = getNormalizedGuidePoints(letter, isUppercase);
    const centerPx: [number, number] = [sc(cxRaw, sz), sc(cyRaw, sz)];

    // Tunables (in the 400-unit letter space, scaled to canvas pixels below):
    // GAP separates each stroke from strokes it used to touch/join (raised,
    // and the cap on short strokes below is loosened, so tight-curve letters
    // like lowercase a/b no longer look like one continuous joined arrow);
    // HEAD_LEN is the visible arrowhead length; DASH is the on/off pattern
    // for the shaft; NUM_R is the number-circle radius; NUM_GAP is a FIXED
    // pixel gap between a stroke and its number (previously this was a
    // percentage-of-distance-to-center nudge, which made the gap balloon on
    // wide strokes and vanish on tight ones — now every letter gets the same
    // small, consistent gap).
    const GAP      = sc(20, sz);
    const HEAD_LEN = sc(12, sz);
    const DASH_ON  = sc(9, sz);
    const DASH_OFF = sc(6, sz);
    const NUM_R    = sc(7.5, sz);
    const NUM_GAP  = sc(-3, sz);

    guides.forEach(g => {
      let pts = g.pts.map(pt => scp(pt, sz));
      if (pts.length < 2) return;

      // Optional: push this stroke's actual starting point further along its
      // own path before anything else is computed. Used when two strokes
      // share the exact same physical start corner (e.g. M's strokes 1 & 2,
      // or m's leg vs. hump strokes) — without this, both strokes' numbers
      // get placed on top of each other since each is just "pulled back a
      // fixed gap from its own start." Trimming the start moves that shared
      // point apart in each stroke's own direction.
      if (g.startTrim) {
        const trimPx = sc(g.startTrim, sz);
        const rawTotal = polylineLength(pts);
        if (trimPx > 0 && trimPx < rawTotal) {
          pts = slicePolylineByDistance(pts, trimPx, rawTotal);
        }
      }
      // Same idea but from the tail end — used when a stroke's arrowhead
      // visually runs into a different stroke's line (e.g. lowercase a's
      // loop arrow ending right where the tail stroke begins).
      if (g.endTrim) {
        const trimPx = sc(g.endTrim, sz);
        const rawTotal = polylineLength(pts);
        if (trimPx > 0 && trimPx < rawTotal) {
          pts = slicePolylineByDistance(pts, 0, rawTotal - trimPx);
        }
      }

      const total = polylineLength(pts);
      if (total < 1) return;

      // Trim a gap off BOTH ends — separates strokes that used to share a
      // coordinate (letter-joining points) into visibly distinct arrows.
      const startGap = Math.min(GAP, total * 0.32);
      const endGap   = Math.min(GAP, total * 0.32);
      const tipD     = Math.max(startGap + 0.5, total - endGap);
      const tip      = pointAtDistance(pts, tipD);

      // Shaft stops a bit before the tip so the arrowhead sits cleanly on
      // top of it instead of the dashes poking through the triangle.
      const lineEndD = Math.max(startGap, tipD - HEAD_LEN);
      const beforeTip = pointAtDistance(pts, Math.max(startGap, tipD - 1));
      const ang = Math.atan2(tip[1] - beforeTip[1], tip[0] - beforeTip[0]);

      ctx.save();
      ctx.strokeStyle = g.c;
      ctx.lineWidth = sc(4, sz);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (lineEndD - startGap > 1) {
        const shaft = slicePolylineByDistance(pts, startGap, lineEndD);
        ctx.setLineDash([DASH_ON, DASH_OFF]);
        ctx.beginPath();
        ctx.moveTo(shaft[0][0], shaft[0][1]);
        for (let i = 1; i < shaft.length; i++) ctx.lineTo(shaft[i][0], shaft[i][1]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Solid arrowhead at the tip, pointing along the stroke's own direction.
      ctx.fillStyle = g.c;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(tip[0] - HEAD_LEN * Math.cos(ang - Math.PI / 7), tip[1] - HEAD_LEN * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(tip[0] - HEAD_LEN * Math.cos(ang + Math.PI / 7), tip[1] - HEAD_LEN * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Number label: placed BEFORE the stroke's true starting point, pulled
      // straight back along the stroke's own start direction (not to the
      // side). This gives the reading order number -> dashed line ->
      // arrowhead along every stroke, with the same fixed gap (NUM_GAP)
      // everywhere since it's just "start point, minus NUM_GAP along the
      // line's own direction" — no perpendicular/sideways offset at all.
      const dirSampleD = Math.min(total, 4);
      const dirPt = pointAtDistance(pts, dirSampleD);
      let sdx = dirPt[0] - pts[0][0];
      let sdy = dirPt[1] - pts[0][1];
      const sdlen = Math.hypot(sdx, sdy) || 1;
      sdx /= sdlen; sdy /= sdlen;
      const numX = pts[0][0] - sdx * NUM_GAP;
      const numY = pts[0][1] - sdy * NUM_GAP;

      ctx.save();
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.round(NUM_R * 1.6)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.n, numX, numY);
      ctx.restore();
    });
  }, [getLetterDef, getLetter, scalePath, scp]);

  const initCanvases = useCallback(() => {
    const init = (
      letter: React.RefObject<HTMLCanvasElement | null>,
      fill:   React.RefObject<HTMLCanvasElement | null>,
      cursor: React.RefObject<HTMLCanvasElement | null>,
      isUppercase: boolean
    ) => {
      const lc = letter.current;
      if (!lc) return;
      const sz = lc.offsetWidth;
      [letter, fill, cursor].forEach(r => {
        if (r.current) { r.current.width = sz; r.current.height = sz; }
      });
      drawLetter(sz, isUppercase);
      buildMask(sz, isUppercase);
    };
    init(letterCanvasRefUpper, fillCanvasRefUpper, cursorCanvasRefUpper, true);
    init(letterCanvasRefLower, fillCanvasRefLower, cursorCanvasRefLower, false);
  }, [drawLetter, buildMask]);

  const resetFill = useCallback(() => {
    [
      { fill: fillCanvasRefUpper, cursor: cursorCanvasRefUpper },
      { fill: fillCanvasRefLower, cursor: cursorCanvasRefLower },
    ].forEach(({ fill, cursor }) => {
      fill.current?.getContext('2d')!.clearRect(0, 0, fill.current.width, fill.current.height);
      cursor.current?.getContext('2d')!.clearRect(0, 0, cursor.current.width, cursor.current.height);
    });
    setProgressUpper(0);
    setProgressLower(0);
    setHint('Hold and drag to fill the letters!');
  }, []);

  useEffect(() => {
    setIsTracingComplete(false);
    setShowExcellent(false);
    setProgressUpper(0);
    setProgressLower(0);
    setPostTracingPhase('none');
    setSoundPlayCount(0);
    setEraserMode(false);
    setSelectedCrayon(CRAYONS[0]);
    rainbowHueRef.current = 0;
  }, [currentLetter]);

  useEffect(() => {
    setTimeout(() => { initCanvases(); resetFill(); }, 50);
  }, [currentLetter]);

  useEffect(() => {
    const handleResize = () => { initCanvases(); resetFill(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvases, resetFill]);

  // ── Erase at position (uses destination-out composite) ───────────────────
  const erase = useCallback((cx: number, cy: number, isUppercase: boolean) => {
    const fc = isUppercase ? fillCanvasRefUpper.current : fillCanvasRefLower.current;
    if (!fc) return;
    const fctx = fc.getContext('2d')!;
    const sz   = fc.width;
    const br   = sc(ERASER_BRUSH, sz);

    fctx.save();
    fctx.globalCompositeOperation = 'destination-out';
    fctx.beginPath();
    fctx.arc(cx, cy, br, 0, Math.PI * 2);
    fctx.fill();
    fctx.restore();

    // Recalculate progress after erase
    const mask = isUppercase ? maskRefUpper.current : maskRefLower.current;
    if (!mask) return;
    const full = fctx.getImageData(0, 0, sz, sz).data;
    const md   = mask.data;
    let total = 0, filled = 0;
    for (let i = 3; i < md.length; i += 4) {
      if (md[i] > 128) { total++; if (full[i] > 50) filled++; }
    }
    const pct = total > 0 ? Math.min(100, Math.round(filled / total * 100)) : 0;
    if (isUppercase) setProgressUpper(pct);
    else             setProgressLower(pct);
  }, []);

  const paint = useCallback((cx: number, cy: number, isUppercase: boolean) => {
    const fc   = isUppercase ? fillCanvasRefUpper.current : fillCanvasRefLower.current;
    const mask = isUppercase ? maskRefUpper.current       : maskRefLower.current;
    if (!fc || !mask) return;
    const fctx = fc.getContext('2d')!;
    const sz   = fc.width;
    const br   = sc(BRUSH, sz);
    const md   = mask.data;

    // Compute this brush stamp's color — rainbow advances once per stamp (solid blob, clean color shift)
    let stampR = selectedCrayon.r, stampG = selectedCrayon.g, stampB = selectedCrayon.b;
    if (selectedCrayon.rainbow) {
      rainbowHueRef.current = (rainbowHueRef.current + 4) % 360;
      const h = rainbowHueRef.current / 360;
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = 0.5 * (1 + 1); // l=0.55, s=1 → q = l + s - l*s = 0.55+1-0.55 = 1 → clamp
      const qq = 1, pp = 2 * 0.55 - qq;
      stampR = Math.round(hue2rgb(pp, qq, h + 1/3) * 255);
      stampG = Math.round(hue2rgb(pp, qq, h) * 255);
      stampB = Math.round(hue2rgb(pp, qq, h - 1/3) * 255);
    }

    const x0 = Math.max(0, Math.floor(cx - br));
    const y0 = Math.max(0, Math.floor(cy - br));
    const x1 = Math.min(sz, Math.ceil(cx + br));
    const y1 = Math.min(sz, Math.ceil(cy + br));
    const fd = fctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const fw = x1 - x0;

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = px - cx, dy = py - cy;
        if (dx * dx + dy * dy > br * br) continue;
        if (md[(py * sz + px) * 4 + 3] < 128) continue;
        const fi = ((py - y0) * fw + (px - x0)) * 4;
        fd.data[fi] = stampR; fd.data[fi + 1] = stampG; fd.data[fi + 2] = stampB; fd.data[fi + 3] = 230;
      }
    }
    fctx.putImageData(fd, x0, y0);

    const full = fctx.getImageData(0, 0, sz, sz).data;
    let total = 0, filled = 0;
    for (let i = 3; i < md.length; i += 4) {
      if (md[i] > 128) { total++; if (full[i] > 50) filled++; }
    }
    const pct = total > 0 ? Math.min(100, Math.round(filled / total * 100)) : 0;

    if (isUppercase) setProgressUpper(pct);
    else             setProgressLower(pct);

    const upperDone = progressUpper >= 90 || (isUppercase  && pct >= 90);
    const lowerDone = progressLower >= 90 || (!isUppercase && pct >= 90);

    if (upperDone && lowerDone && !isTracingComplete) {
      setHint('Amazing! You filled both letters!');
      updateLetterProgress(currentLetter!.letter, { tracingCompleted: true });
      setIsTracingComplete(true);
      if (tracingAsset) {
        handleTracingComplete(tracingAsset);
      }
    } else if (pct >= 90) {
      setHint('Great! Now try the other letter!');
    } else if (pct >= 50) {
      setHint('Keep going — looking great!');
    } else {
      setHint('Hold and drag to fill the letters!');
    }
  }, [progressUpper, progressLower, isTracingComplete, currentLetter, updateLetterProgress, tracingAsset, handleTracingComplete, selectedCrayon]);

  const drawCursor = useCallback((x: number, y: number, isUppercase: boolean) => {
    const cc = isUppercase ? cursorCanvasRefUpper.current : cursorCanvasRefLower.current;
    if (!cc) return;
    cc.getContext('2d')!.clearRect(0, 0, cc.width, cc.height);
  }, []);

  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null>
  ): [number, number] => {
    const cc = ref.current!;
    const r  = cc.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return [(cx - r.left) * (cc.width / r.width), (cy - r.top) * (cc.height / r.height)];
  };

  // ── Unified action: paint or erase depending on mode ─────────────────────
  const eraserModeRef = useRef(eraserMode);
  useEffect(() => { eraserModeRef.current = eraserMode; }, [eraserMode]);

  const applyBrush = useCallback((x: number, y: number, isu: boolean) => {
    if (eraserModeRef.current) erase(x, y, isu);
    else paint(x, y, isu);
  }, [erase, paint]);

  const handleMouseDown  = (e: React.MouseEvent<HTMLCanvasElement>,  isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = true;  const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); applyBrush(x,y,isu); drawCursor(x,y,isu); updateFollower(e.clientX, e.clientY); };
  const handleMouseMove  = (e: React.MouseEvent<HTMLCanvasElement>,  isu: boolean) => { const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); drawCursor(x,y,isu); updateFollower(e.clientX, e.clientY); if ((isu ? pressingRefUpper : pressingRefLower).current) applyBrush(x,y,isu); };
  const handleMouseUp    = (isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = false; };
  const handleMouseLeave = (isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = false; clearFollower(); };
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>, isu: boolean) => { e.preventDefault(); (isu ? pressingRefUpper : pressingRefLower).current = true;  const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); applyBrush(x,y,isu); drawCursor(x,y,isu); updateFollower(e.touches[0].clientX, e.touches[0].clientY); };
  const handleTouchMove  = (e: React.TouchEvent<HTMLCanvasElement>, isu: boolean) => { e.preventDefault(); const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); drawCursor(x,y,isu); updateFollower(e.touches[0].clientX, e.touches[0].clientY); if ((isu ? pressingRefUpper : pressingRefLower).current) applyBrush(x,y,isu); };
  const handleTouchEnd   = (isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = false; clearFollower(); };

  // Canvas cursor: hide native cursor when eraser active, show follower instead
  const canvasCursorStyle = 'none'; // follower image replaces cursor for all tools

  // Update floating eraser follower position
  const updateFollower = (clientX: number, clientY: number) => setFollowerPos({ x: clientX, y: clientY });
  const clearFollower  = () => setFollowerPos(null);

  const canvasPanel = (isUppercase: boolean) => (
    <div className="flex flex-col items-center flex-1 min-w-0" style={{ maxWidth: 'min(42vw, 52dvh, 500px)' }}>
      <h3 className="font-fredoka font-bold text-foreground mb-1" style={{ fontSize: 'clamp(14px, 3vmin, 24px)', lineHeight: 1.1 }}>
        {isUppercase ? 'Malaki na' : 'Maliit na'} {getLetter(isUppercase)}
      </h3>
      <div
        className="relative rounded-2xl overflow-hidden w-full"
        style={{ aspectRatio: '1 / 1', width: '100%' }}
      >
        <canvas ref={isUppercase ? letterCanvasRefUpper : letterCanvasRefLower} className="absolute inset-0 w-full h-full" />
        <canvas ref={isUppercase ? fillCanvasRefUpper   : fillCanvasRefLower}   className="absolute inset-0 w-full h-full" />
        <canvas
          ref={isUppercase ? cursorCanvasRefUpper : cursorCanvasRefLower}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: canvasCursorStyle }}
          onMouseDown={(e) => handleMouseDown(e, isUppercase)}
          onMouseMove={(e) => handleMouseMove(e, isUppercase)}
          onMouseUp={() => handleMouseUp(isUppercase)}
          onMouseLeave={() => handleMouseLeave(isUppercase)}
          onTouchStart={(e) => handleTouchStart(e, isUppercase)}
          onTouchMove={(e) => handleTouchMove(e, isUppercase)}
          onTouchEnd={() => handleTouchEnd(isUppercase)}
          onTouchCancel={() => handleTouchEnd(isUppercase)}
        />
      </div>
      <div className="w-full mt-1" style={{ maxWidth: 280 }}>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${isUppercase ? progressUpper : progressLower}%`,
              background: selectedCrayon.rainbow ? `hsl(${rainbowHueRef.current},85%,52%)` : `rgb(${selectedCrayon.r},${selectedCrayon.g},${selectedCrayon.b})`,
            }}
          />
        </div>
        <p
          className="text-xs text-center mt-0.5"
          style={{
            color: (isUppercase ? progressUpper : progressLower) >= 90
              ? '#1D9E75'
              : (isUppercase ? progressUpper : progressLower) >= 50
              ? '#FF8C42'
              : undefined,
          }}
        >
          {isUppercase ? progressUpper : progressLower}%
        </p>
      </div>
    </div>
  );

  // ── Dots indicator for sound plays ────────────────────────────────────────
  const soundDots = () => (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
      {Array.from({ length: SOUND_PLAYS_NEEDED }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < soundPlayCount ? '#FF8C42' : '#e2e8f0',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes fadeInScale {
          0%   { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        .feedback-popup { animation: fadeInScale 0.25s ease-out forwards; }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.8) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .play-again-btn { animation: popIn 0.3s ease-out forwards; }
        .pop-in { animation: popIn 0.3s ease-out forwards; }

        @keyframes idleBounce {
          0%   { transform: translateY(-50%) scale(1) rotate(0deg); }
          20%  { transform: translateY(-55%) scale(1.04) rotate(-1deg); }
          40%  { transform: translateY(-47%) scale(0.98) rotate(1deg); }
          60%  { transform: translateY(-52%) scale(1.02) rotate(-1deg); }
          80%  { transform: translateY(-49%) scale(1.01) rotate(0deg); }
          100% { transform: translateY(-50%) scale(1) rotate(0deg); }
        }
        @keyframes soundPop {
          0%   { transform: scale(1); filter: drop-shadow(0 6px 24px rgba(0,0,0,0.12)); }
          15%  { transform: scale(1.22) rotate(-5deg); filter: drop-shadow(0 12px 32px rgba(255,140,66,0.5)); }
          30%  { transform: scale(0.92) rotate(4deg); filter: drop-shadow(0 6px 24px rgba(93,202,165,0.4)); }
          50%  { transform: scale(1.15) rotate(-3deg); filter: drop-shadow(0 10px 28px rgba(255,140,66,0.4)); }
          70%  { transform: scale(0.97) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 6px 24px rgba(0,0,0,0.12)); }
        }
        .img-idle-bounce {
          animation: idleBounce 0.7s cubic-bezier(0.36,0.07,0.19,0.97) forwards;
        }
        .img-sound-pop {
          animation: soundPop 0.65s cubic-bezier(0.36,0.07,0.19,0.97) forwards;
        }

        /* Eraser tool button */
        @keyframes eraserSelect {
          0%   { transform: scale(1) rotate(0deg); }
          40%  { transform: scale(1.2) rotate(-8deg); }
          70%  { transform: scale(1.15) rotate(4deg); }
          100% { transform: scale(1.18) rotate(-3deg) translateX(-4px); }
        }
        .eraser-btn {
          position: fixed;
          top: clamp(60px, 10vmin, 90px);
          right: 8px;
          z-index: 35;
          width: clamp(64px, 12vmin, 90px);
          height: clamp(64px, 12vmin, 90px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          cursor: pointer;
          background: transparent;
          border: none;
          box-shadow: none;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          transition: transform 0.2s;
        }
        .eraser-btn:active {
          transform: scale(0.92);
        }
        .eraser-btn.active {
          animation: eraserSelect 0.35s cubic-bezier(0.36,0.07,0.19,0.97) forwards;
        }
        .eraser-btn img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          transition: filter 0.2s, transform 0.2s;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2));
        }
        .eraser-btn.active img {
          filter: drop-shadow(0 4px 12px rgba(255,140,66,0.7)) drop-shadow(0 0 6px rgba(255,140,66,0.5));
        }
        /* Tooltip label */
        .eraser-label {
          position: absolute;
          bottom: -28px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: bold;
          color: #FF8C42;
          white-space: nowrap;
          font-family: 'Fredoka One', sans-serif;
          opacity: 0;
          transition: opacity 0.2s;
          text-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .eraser-btn.active .eraser-label {
          opacity: 1;
        }
        /* Crayon color buttons */
        @keyframes crayonSelect {
          0%   { transform: scale(1) rotate(0deg); }
          30%  { transform: scale(1.25) rotate(-10deg); }
          60%  { transform: scale(1.18) rotate(5deg); }
          100% { transform: scale(1.2) rotate(-4deg) translateX(-3px); }
        }
        .crayon-btn {
          position: relative;
          width: clamp(56px, 10.5vmin, 80px);
          height: clamp(56px, 10.5vmin, 80px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: transparent;
          border: none;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          transition: transform 0.15s;
          flex-shrink: 0;
        }
        .crayon-btn:active { transform: scale(0.9); }
        .crayon-btn.active {
          animation: crayonSelect 0.35s cubic-bezier(0.36,0.07,0.19,0.97) forwards;
        }
        .crayon-btn img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2));
          transition: filter 0.2s;
        }
        .crayon-btn.active img {
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35)) drop-shadow(0 0 8px rgba(255,255,255,0.6));
        }
        /* Floating eraser cursor follower */
        .eraser-follower {
          position: fixed;
          pointer-events: none;
          z-index: 9999;
          width: 64px;
          height: 64px;
          /* offset so the tip of eraser/crayon lines up with touch point */
          transform: translate(-12px, -56px);
          transition: src 0s;
          filter: drop-shadow(0 3px 10px rgba(0,0,0,0.3));
        }
      `}</style>

      {/* ── Eraser Tool — fixed top-right ── */}
      <div
        className={`eraser-btn ${eraserMode ? 'active' : ''}`}
        onClick={() => setEraserMode(prev => !prev)}
        title={eraserMode ? 'Bumalik sa pagbatak' : 'Burahin'}
      >
        <img src="/eraser.png" alt="Eraser" />
        <span className="eraser-label">{eraserMode ? 'Burahin' : ''}</span>
      </div>

      {/* ── Floating eraser image that follows cursor/touch ── */}
      {followerVisible && followerPos && (
        <img
          src={eraserMode ? "/eraser.png" : `/${selectedCrayon.file}`}
          alt=""
          className="eraser-follower"
          style={{
            left: followerPos.x,
            top: followerPos.y,
          }}
        />
      )}

      {/* ── Crayon color toolbar — stacked below eraser ── */}
      <div style={{
        position: 'fixed',
        top: `calc(clamp(60px, 10vmin, 90px) + clamp(64px, 12vmin, 90px) + 8px)`,
        right: 8,
        zIndex: 35,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {CRAYONS.map((crayon) => (
          <div
            key={crayon.name}
            className={`crayon-btn ${!eraserMode && selectedCrayon.name === crayon.name ? 'active' : ''}`}
            onClick={() => {
              setSelectedCrayon(crayon);
              setEraserMode(false);
              rainbowHueRef.current = 0;
            }}
            title={crayon.name}
          >
            <img src={`/${crayon.file}`} alt={crayon.name} />
          </div>
        ))}
      </div>

      {/* ── Excellent overlay — only after sound phase is done ── */}
      {showExcellent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(220, 252, 231, 0.55)',
        }}>
          <div className="feedback-popup" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 64, lineHeight: 1 }}>⭐</p>
            <p className="text-3xl font-fredoka font-bold text-green-700">Mahusay!</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                onClick={handlePlayAgain}
                className="play-again-btn h-14 px-8 text-xl font-fredoka font-bold bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-2xl shadow-lg"
              >
                Umulit
              </Button>
              <Button
                onClick={handleContinue}
                className="h-14 px-10 text-xl font-fredoka font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg"
              >
                Magpatuloy →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sound phase overlay — appears after tracing complete ── */}
      {postTracingPhase !== 'none' && !showExcellent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 40,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(220, 252, 231, 0.55)',
        }}>
          <div className="feedback-popup" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          
            <p className="text-3xl font-fredoka font-bold text-green-700">Mahusay!</p>

            {tracingAsset && (
              <div style={{
                width: 'clamp(180px, 58vmin, 400px)', height: 'clamp(180px, 58vmin, 400px)', borderRadius: 'clamp(28px, 10vmin, 70px)',
                overflow: 'hidden', background: '#f1f5f9',
                boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src={tracingAsset.image}
                  alt={tracingAsset.word}
                  className={soundPop ? 'img-sound-pop' : ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}

            <p className="text-lg font-fredoka text-muted-foreground">
              {soundPlayCount < SOUND_PLAYS_NEEDED
                ? `Pakinggan ang tunog! (${soundPlayCount}/${SOUND_PLAYS_NEEDED})`
                : 'Magaling!'}
            </p>

            {soundDots()}

            {postTracingPhase === 'sound' && soundPlayCount < SOUND_PLAYS_NEEDED && (
              <Button
                onClick={handlePlaySoundBtn}
                className="pop-in h-14 px-8 text-xl font-fredoka font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl shadow-lg"
              >
                 Pakinggan ang tunog
              </Button>
            )}

            {postTracingPhase === 'done' && (
              <Button
                onClick={() => setShowExcellent(true)}
                className="pop-in h-14 px-10 text-xl font-fredoka font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg"
              >
                Next Game 🎮
              </Button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', gap: 'clamp(4px, 1.5vh, 8px)' }}>
        <div className="text-center flex-shrink-0">
          <h2 className="font-fredoka font-bold text-foreground" style={{ fontSize: 'clamp(16px, 3.8vmin, 24px)', lineHeight: 1.15 }}>
            Panuto: Bakatin ang malaki at maliit na titik {' '}
            <span style={{ color: 'white', WebkitTextStroke: '4px black', paintOrder: 'stroke fill' }}>{getLetter(true)}</span>{' '}
            <span style={{ color: 'white', WebkitTextStroke: '4px black', paintOrder: 'stroke fill' }}>{getLetter(false)}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Tunog: <span className="font-fredoka font-bold text-primary">{currentLetter?.sound}</span>
          </p>
        </div>

        <div style={{ position: 'relative', flex: 1, minHeight: '160px', overflow: 'visible' }}>
          {tracingAsset && (
            <img
              src={tracingAsset.image}
              alt={tracingAsset.word}
              className={`tracing-side-image ${idleBounce ? 'img-idle-bounce' : ''}`}
              style={{
                position: 'fixed',
                top: '56%',
                left: 'clamp(4px, 1vw, 12px)',
                transform: 'translateY(-50%)',
                width: 'clamp(150px, 28vw, 360px)',
                height: 'clamp(220px, 72dvh, 520px)',
                objectFit: 'contain',
                zIndex: 30,
                pointerEvents: 'none',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))',
              }}
            />
          )}

          <div className="tracing-canvas-row" style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 'clamp(8px, 2vw, 12px)',
          }}>
            {canvasPanel(true)}
            {canvasPanel(false)}
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-center gap-2 pb-1">
          <p
            className="text-sm text-muted-foreground text-center"
            style={{
              color: progressUpper >= 90 && progressLower >= 90
                ? '#2f00ff'
                : progressUpper >= 50 || progressLower >= 50
                ? '#ffffff'
                : undefined,
            }}
          >
            {hint}
          </p>
        </div>
      </div>
    </>
  );
}