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

type GuideStroke = { pts: number[][]; n: string; c: string };
type LetterDef = { path: string; sw: number; guides: GuideStroke[] };

function mg2(p1: number[][], c1: string, p2: number[][], c2: string, p3?: number[][], c3?: string): GuideStroke[] {
  const g: GuideStroke[] = [{ pts: p1, n: '1', c: c1 }, { pts: p2, n: '2', c: c2 }];
  if (p3 && c3) g.push({ pts: p3, n: '3', c: c3 });
  return g;
}
function mg1(p1: number[][], c1: string): GuideStroke[] {
  return [{ pts: p1, n: '1', c: c1 }];
}

const LETTERS: Record<string, LetterDef> = {
  A: { path: 'M60,340 L200,45 L340,340 M108,222 L292,222', sw: 52, guides: mg2([[60,340],[200,45]], O, [[200,45],[340,340]], T, [[108,222],[292,222]], P) },
  B: { path: 'M90,50 L90,350 M90,50 L195,50 Q268,50 268,148 Q268,200 185,200 L90,200 M90,200 L200,200 Q278,200 278,272 Q278,350 185,350 L90,350', sw: 48, guides: mg2([[90,50],[90,350]], O, [[90,50],[195,50],[255,90],[255,158],[185,200],[90,200]], T, [[90,200],[200,200],[265,240],[265,310],[185,350],[90,350]], P) },
  C: { path: 'M310,115 Q268,48 198,48 Q78,48 78,200 Q78,352 198,352 Q268,352 310,285', sw: 52, guides: mg1([[310,115],[268,58],[198,48],[128,55],[88,102],[70,162],[75,232],[108,288],[155,335],[210,352],[272,342],[310,285]], O) },
  D: { path: 'M90,50 L90,350 M90,50 L185,50 Q330,50 330,200 Q330,350 185,350 L90,350', sw: 50, guides: mg2([[90,50],[90,350]], O, [[90,50],[185,50],[310,100],[320,200],[305,300],[185,350],[90,350]], T) },
  E: { path: 'M280,50 L90,50 L90,350 L280,350 M90,200 L240,200', sw: 48, guides: mg2([[90,350],[90,50]], O, [[90,50],[280,50],[90,50],[90,200],[240,200],[90,200],[90,350],[280,350]], T) },
  F: { path: 'M90,50 L90,350 M90,50 L275,50 M90,200 L240,200', sw: 48, guides: mg2([[90,350],[90,50]], O, [[90,50],[275,50]], T, [[90,200],[240,200]], P) },
  G: { path: 'M310,115 Q268,48 198,48 Q78,48 78,200 Q78,352 198,352 Q268,352 310,300 L310,200 L220,200', sw: 50, guides: mg1([[310,115],[268,58],[198,48],[128,55],[88,102],[70,162],[75,232],[108,288],[155,335],[210,352],[272,342],[310,300],[310,200],[220,200]], O) },
  H: { path: 'M90,50 L90,350 M310,50 L310,350 M90,200 L310,200', sw: 50, guides: mg2([[90,50],[90,350]], O, [[310,50],[310,350]], T, [[90,200],[310,200]], P) },
  I: { path: 'M140,50 L260,50 M200,50 L200,350 M140,350 L260,350', sw: 48, guides: mg2([[140,50],[260,50]], O, [[200,50],[200,350]], T, [[140,350],[260,350]], P) },
  J: { path: 'M150,50 L265,50 M210,50 L210,290 Q210,355 155,355 Q100,355 90,300', sw: 48, guides: mg2([[150,50],[265,50]], O, [[210,50],[210,290],[200,340],[155,355],[105,340],[90,300]], T) },
  K: { path: 'M90,50 L90,350 M300,50 L90,200 L300,350', sw: 50, guides: mg2([[90,50],[90,350]], O, [[300,50],[90,200],[300,350]], T) },
  L: { path: 'M90,50 L90,350 L300,350', sw: 50, guides: mg2([[90,50],[90,350]], O, [[90,350],[300,350]], T) },
  M: { path: 'M55,350 L55,50 L200,230 L345,50 L345,350', sw: 52, guides: mg2([[55,350],[55,50]], O, [[55,50],[200,230],[345,50]], T, [[345,50],[345,350]], P) },
  N: { path: 'M80,350 L80,50 L320,350 L320,50', sw: 50, guides: mg2([[80,350],[80,50]], O, [[80,50],[320,350]], T, [[320,350],[320,50]], P) },
  O: { path: 'M200,48 Q320,48 320,200 Q320,352 200,352 Q80,352 80,200 Q80,48 200,48', sw: 52, guides: mg1([[200,48],[280,65],[320,130],[320,200],[320,270],[280,335],[200,352],[120,335],[80,270],[80,200],[80,130],[120,65],[200,48]], O) },
  P: { path: 'M90,50 L90,350 M90,50 L200,50 Q290,50 290,155 Q290,210 200,210 L90,210', sw: 50, guides: mg2([[90,50],[90,350]], O, [[90,50],[200,50],[275,80],[278,155],[255,195],[200,210],[90,210]], T) },
  Q: { path: 'M200,48 Q320,48 320,200 Q320,352 200,352 Q80,352 80,200 Q80,48 200,48 M240,270 L320,340', sw: 52, guides: mg2([[200,48],[280,65],[320,130],[320,200],[320,270],[280,335],[200,352],[120,335],[80,270],[80,200],[80,130],[120,65],[200,48]], O, [[240,270],[320,340]], T) },
  R: { path: 'M90,50 L90,350 M90,50 L200,50 Q290,50 290,148 Q290,210 200,210 L90,210 M190,210 L310,350', sw: 50, guides: mg2([[90,50],[90,350]], O, [[90,50],[200,50],[278,80],[278,150],[255,198],[200,210],[90,210]], T, [[190,210],[310,350]], P) },
  S: { path: 'M288,128 Q265,58 195,48 Q98,38 90,128 Q84,185 148,210 Q218,236 268,266 Q308,300 278,342 Q248,378 178,368 Q108,358 90,288', sw: 52, guides: mg1([[288,128],[262,62],[195,48],[128,56],[94,98],[88,148],[118,182],[175,208],[235,230],[272,262],[285,308],[258,348],[198,368],[138,360],[94,330],[88,288]], O) },
  T: { path: 'M80,50 L320,50 M200,50 L200,350', sw: 50, guides: mg2([[80,50],[320,50]], O, [[200,50],[200,350]], T) },
  U: { path: 'M80,50 L80,270 Q80,355 200,355 Q320,355 320,270 L320,50', sw: 50, guides: mg1([[80,50],[80,270],[100,330],[155,352],[200,355],[245,352],[300,330],[320,270],[320,50]], O) },
  V: { path: 'M65,50 L200,355 L335,50', sw: 50, guides: mg2([[65,50],[200,355]], O, [[200,355],[335,50]], T) },
  W: { path: 'M50,50 L120,350 L200,180 L280,350 L350,50', sw: 48, guides: mg2([[50,50],[120,350]], O, [[120,350],[200,180],[280,350]], T, [[280,350],[350,50]], P) },
  X: { path: 'M80,50 L320,350 M320,50 L80,350', sw: 50, guides: mg2([[80,50],[320,350]], O, [[320,50],[80,350]], T) },
  Y: { path: 'M80,50 L200,210 L320,50 M200,210 L200,350', sw: 50, guides: mg2([[80,50],[200,210]], O, [[320,50],[200,210]], T, [[200,210],[200,350]], P) },
  Z: { path: 'M80,50 L320,50 L80,350 L320,350', sw: 50, guides: mg2([[80,50],[320,50]], O, [[320,50],[80,350]], T, [[80,350],[320,350]], P) },
};

const LETTERS_LOWER: Record<string, LetterDef> = {
  a: { path: 'M280,155 Q280,100 220,100 Q130,100 130,200 Q130,310 220,310 Q268,310 280,268 L280,310', sw: 46, guides: mg2([[280,155],[260,105],[220,100],[165,105],[135,150],[130,200],[135,255],[165,300],[220,310],[268,300],[280,268]], O, [[280,268],[280,310]], T) },
  b: { path: 'M120,50 L120,310 M120,175 Q120,100 200,100 Q290,100 290,205 Q290,310 200,310 Q120,310 120,235', sw: 46, guides: mg2([[120,50],[120,310]], O, [[120,175],[140,108],[200,100],[258,108],[285,155],[290,205],[280,260],[245,305],[200,310],[155,305],[120,260],[120,235]], T) },
  c: { path: 'M280,148 Q255,100 205,100 Q120,100 120,205 Q120,310 205,310 Q255,310 280,262', sw: 46, guides: mg1([[280,148],[255,108],[205,100],[160,108],[130,148],[120,205],[130,262],[160,302],[205,310],[255,302],[280,262]], O) },
  d: { path: 'M280,50 L280,310 M280,175 Q280,100 200,100 Q110,100 110,205 Q110,310 200,310 Q280,310 280,235', sw: 46, guides: mg2([[280,50],[280,310]], O, [[280,175],[260,108],[200,100],[145,108],[115,155],[110,205],[120,260],[155,305],[200,310],[245,305],[280,260],[280,235]], T) },
  e: { path: 'M120,215 L285,215 Q285,100 200,100 Q115,100 115,205 Q115,310 200,310 Q255,310 282,268', sw: 46, guides: mg2([[120,215],[285,215]], O, [[285,215],[285,155],[255,108],[200,100],[148,108],[120,155],[115,205],[125,262],[160,305],[200,310],[255,302],[282,268]], T) },
  f: { path: 'M260,80 Q240,50 210,50 Q170,50 165,90 L165,310 M120,165 L230,165', sw: 44, guides: mg2([[260,80],[240,55],[210,50],[178,55],[165,90],[165,310]], O, [[120,165],[230,165]], T) },
  g: { path: 'M280,155 Q280,100 220,100 Q130,100 130,200 Q130,305 220,305 Q280,305 280,255 L280,320 Q280,380 210,380 Q165,380 140,355', sw: 46, guides: mg2([[280,155],[260,105],[220,100],[165,105],[135,150],[130,200],[135,252],[165,298],[220,305],[268,298],[280,255]], O, [[280,255],[280,320],[270,368],[210,380],[165,376],[140,355]], T) },
  h: { path: 'M120,50 L120,310 M120,190 Q140,100 220,100 Q290,100 290,180 L290,310', sw: 46, guides: mg2([[120,50],[120,310]], O, [[120,190],[138,118],[185,100],[235,108],[272,145],[290,180],[290,310]], T) },
  i: { path: 'M180,100 L180,310 M180,58 L180,72', sw: 44, guides: mg2([[180,72],[180,100],[180,310]], O, [[180,52],[180,64]], T) },
  j: { path: 'M210,100 L210,330 Q210,385 160,385 Q130,385 115,362', sw: 44, guides: mg2([[210,100],[210,330],[195,375],[160,385],[128,378],[115,362]], O, [[210,58],[210,72]], T) },
  k: { path: 'M120,50 L120,310 M270,100 L120,210 L275,310', sw: 46, guides: mg2([[120,50],[120,310]], O, [[270,100],[120,210],[275,310]], T) },
  l: { path: 'M180,50 L180,295 Q180,315 200,315', sw: 44, guides: mg1([[180,50],[180,295],[188,308],[200,315]], O) },
  m: { path: 'M80,310 L80,80 L80,130 Q80,100 130,100 Q180,100 180,150 L180,310 M180,150 Q180,100 230,100 Q290,100 290,175 L290,310', sw: 46, guides: mg2([[80,310],[80,80],[95,108],[130,100],[165,108],[180,150],[180,310]], O, [[180,150],[180,108],[230,100],[272,108],[290,148],[290,175],[290,310]], T) },
  n: { path: 'M110,310 L110,155 Q110,100 175,100 Q255,100 255,178 L255,310', sw: 46, guides: mg2([[110,310],[110,155],[122,108],[175,100],[222,108],[248,148],[255,178],[255,310]], O, [[110,155],[255,178]], T) },
  o: { path: 'M200,100 Q290,100 290,205 Q290,310 200,310 Q110,310 110,205 Q110,100 200,100', sw: 48, guides: mg1([[200,100],[260,108],[288,155],[290,205],[282,260],[250,302],[200,310],[150,302],[118,260],[110,205],[118,150],[150,108],[200,100]], O) },
  p: { path: 'M120,155 Q120,100 200,100 Q290,100 290,205 Q290,310 200,310 Q120,310 120,240 L120,385', sw: 46, guides: mg2([[120,155],[138,108],[200,100],[258,108],[285,155],[290,205],[280,260],[245,305],[200,310],[155,305],[120,260],[120,240]], O, [[120,240],[120,385]], T) },
  q: { path: 'M280,155 Q280,100 200,100 Q110,100 110,205 Q110,310 200,310 Q280,310 280,240 L280,385', sw: 46, guides: mg2([[280,155],[260,108],[200,100],[145,108],[115,155],[110,205],[120,260],[155,305],[200,310],[245,305],[280,260],[280,240]], O, [[280,240],[280,385]], T) },
  r: { path: 'M120,310 L120,155 M120,190 Q140,100 220,100 Q252,100 265,118', sw: 44, guides: mg2([[120,310],[120,155],[120,190]], O, [[120,190],[142,118],[200,100],[245,108],[265,118]], T) },
  s: { path: 'M268,148 Q248,100 195,100 Q120,100 122,168 Q124,210 195,225 Q268,240 272,285 Q275,330 205,330 Q155,330 128,295', sw: 46, guides: mg1([[268,148],[248,108],[195,100],[148,108],[122,145],[122,168],[150,205],[195,225],[242,242],[268,272],[272,302],[250,325],[205,330],[162,328],[128,295]], O) },
  t: { path: 'M185,55 L185,295 Q185,315 210,315 M130,160 L248,160', sw: 44, guides: mg2([[185,55],[185,295],[195,310],[210,315]], O, [[130,160],[248,160]], T) },
  u: { path: 'M110,100 L110,260 Q110,315 185,315 Q255,315 255,255 L255,100 L255,310', sw: 46, guides: mg2([[110,100],[110,260],[125,305],[185,315],[240,305],[255,255],[255,100]], O, [[255,100],[255,310]], T) },
  v: { path: 'M100,100 L200,320 L300,100', sw: 46, guides: mg2([[100,100],[200,320]], O, [[200,320],[300,100]], T) },
  w: { path: 'M70,100 L140,320 L200,180 L260,320 L330,100', sw: 46, guides: mg2([[70,100],[140,320]], O, [[140,320],[200,180],[260,320]], T, [[260,320],[330,100]], P) },
  x: { path: 'M110,100 L300,320 M300,100 L110,320', sw: 46, guides: mg2([[110,100],[300,320]], O, [[300,100],[110,320]], T) },
  y: { path: 'M100,100 L200,270 M300,100 L200,270 L165,340 Q145,385 105,380', sw: 46, guides: mg2([[100,100],[200,270]], O, [[300,100],[200,270],[165,340],[148,372],[105,380]], T) },
  z: { path: 'M120,100 L295,100 L120,310 L295,310', sw: 46, guides: mg2([[120,100],[295,100]], O, [[295,100],[120,310]], T, [[120,310],[295,310]], P) },
};

const SOUND_PLAYS_NEEDED = 3;

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

  const playAssetSound = useCallback((src: string, onFinished?: () => void) => {
    // Always stop whatever is currently playing first (no stacking)
    if (sfxRef.current) {
      sfxRef.current.pause();
      sfxRef.current.currentTime = 0;
      sfxRef.current.onended = null;
      sfxRef.current = null;
    }
    const audio = new Audio(src);
    sfxRef.current = audio;
    setIsPlayingSound(true);
    // Trigger pop animation on the image
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
  // Pull the first asset eagerly so it's available on the very first render.
  // consumeNextAsset() reads from a ref (queueRef) — it's safe to call during
  // render since it doesn't trigger any state updates.
  const [tracingAsset, setTracingAsset] = useState<LetterAsset | null>(
    () => consumeNextAsset()   // 👈 lazy initializer — runs once on mount
  );

  useEffect(() => {
    if (currentLetter) {
      setTracingAsset(consumeNextAsset());
    }
  }, [currentLetter?.letter]);

  // ── When tracing completes: stop panuto, auto-play asset sound ────────────
  const handleTracingComplete = useCallback((asset: LetterAsset) => {
    // FIX 1: Stop the panuto instruction audio so it doesn't stack with the asset sound
    stopAudio(panutoAudioRef);

    setPostTracingPhase('sound');
    setSoundPlayCount(1);
    playAssetSound(asset.sound);
  }, [playAssetSound]);

  const handlePlaySoundBtn = useCallback(() => {
    if (!tracingAsset) return;
    const next = soundPlayCount + 1;
    setSoundPlayCount(next);
    // playAssetSound always cuts any in-progress sound before starting the new one.
    // On the final play, wait for it to fully finish before showing Excellent.
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
    setTracingAsset(consumeNextAsset());
    initCanvases();
    resetFill();
  };

  // ── FIX 3: Stop asset sound when Continue is clicked ─────────────────────
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
    const tmp = document.createElement('canvas');
    tmp.width = sz; tmp.height = sz;
    const tctx = tmp.getContext('2d')!;
    tctx.lineCap = 'round'; tctx.lineJoin = 'round';
    tctx.strokeStyle = '#000';
    tctx.lineWidth = sc(def.sw, sz) + 2;
    tctx.stroke(new Path2D(scalePath(def.path, sz)));
    if (isUppercase) maskRefUpper.current = tctx.getImageData(0, 0, sz, sz);
    else             maskRefLower.current = tctx.getImageData(0, 0, sz, sz);
  }, [getLetterDef, scalePath]);

  const drawLetter = useCallback((sz: number, isUppercase: boolean) => {
    const lc = isUppercase ? letterCanvasRefUpper.current : letterCanvasRefLower.current;
    if (!lc) return;
    const ctx = lc.getContext('2d')!;
    const def = getLetterDef(isUppercase);

    ctx.clearRect(0, 0, sz, sz);
    ctx.save();
    [0.25, 0.5, 0.75].forEach(t => {
      ctx.strokeStyle = 'rgba(150,170,220,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(0, sz * t); ctx.lineTo(sz, sz * t); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.restore();

    const p  = new Path2D(scalePath(def.path, sz));
    const sw = sc(def.sw, sz);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000'; ctx.lineWidth = sw + 8;  ctx.stroke(p);
    ctx.strokeStyle = '#f9f8f5'; ctx.lineWidth = sw + 2; ctx.stroke(p);
    ctx.strokeStyle = '#999';   ctx.lineWidth = 1.8;     ctx.stroke(p);
    ctx.restore();

    def.guides.forEach(g => {
      const pts = g.pts.map(pt => scp(pt, sz));
      const [sx, sy] = pts[0];
      const r = sc(14, sz);
      ctx.save();
      ctx.fillStyle = g.c;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(r * 1.15)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.n, sx, sy);
      ctx.restore();

      let arrowPt: [number, number] | null = null;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - sx, dy = pts[i][1] - sy;
        if (Math.sqrt(dx * dx + dy * dy) > sc(28, sz)) { arrowPt = pts[i]; break; }
      }
      if (arrowPt) {
        const ang = Math.atan2(arrowPt[1] - sy, arrowPt[0] - sx);
        const ad  = r + sc(10, sz);
        ctx.save();
        ctx.fillStyle = g.c;
        ctx.translate(sx + Math.cos(ang) * ad, sy + Math.sin(ang) * ad);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(sc(9, sz), 0);
        ctx.lineTo(-sc(7, sz), sc(5, sz));
        ctx.lineTo(-sc(7, sz), -sc(5, sz));
        ctx.closePath(); ctx.fill(); ctx.restore();
      }

      const [ex, ey] = pts[pts.length - 1];
      ctx.save();
      ctx.strokeStyle = g.c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, sc(8, sz), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }, [getLetterDef, scalePath]);

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
  }, [currentLetter]);

  useEffect(() => {
    setTimeout(() => { initCanvases(); resetFill(); }, 50);
  }, [currentLetter]);

  useEffect(() => {
    const handleResize = () => { initCanvases(); resetFill(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvases, resetFill]);

  const paint = useCallback((cx: number, cy: number, isUppercase: boolean) => {
    const fc   = isUppercase ? fillCanvasRefUpper.current : fillCanvasRefLower.current;
    const mask = isUppercase ? maskRefUpper.current       : maskRefLower.current;
    if (!fc || !mask) return;
    const fctx = fc.getContext('2d')!;
    const sz   = fc.width;
    const br   = sc(BRUSH, sz);
    const md   = mask.data;

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
        fd.data[fi] = 255; fd.data[fi + 1] = 140; fd.data[fi + 2] = 66; fd.data[fi + 3] = 230;
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
  }, [progressUpper, progressLower, isTracingComplete, currentLetter, updateLetterProgress, tracingAsset, handleTracingComplete]);

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

  const handleMouseDown  = (e: React.MouseEvent<HTMLCanvasElement>,  isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = true;  const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); paint(x,y,isu); drawCursor(x,y,isu); };
  const handleMouseMove  = (e: React.MouseEvent<HTMLCanvasElement>,  isu: boolean) => { const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); drawCursor(x,y,isu); if ((isu ? pressingRefUpper : pressingRefLower).current) paint(x,y,isu); };
  const handleMouseUp    = (isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = false; };
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>, isu: boolean) => { e.preventDefault(); (isu ? pressingRefUpper : pressingRefLower).current = true;  const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); paint(x,y,isu); drawCursor(x,y,isu); };
  const handleTouchMove  = (e: React.TouchEvent<HTMLCanvasElement>, isu: boolean) => { e.preventDefault(); const [x,y] = getPos(e, isu ? cursorCanvasRefUpper : cursorCanvasRefLower); drawCursor(x,y,isu); if ((isu ? pressingRefUpper : pressingRefLower).current) paint(x,y,isu); };
  const handleTouchEnd   = (isu: boolean) => { (isu ? pressingRefUpper : pressingRefLower).current = false; };

  const canvasPanel = (isUppercase: boolean) => (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <h3 className="text-2xl font-fredoka font-bold text-foreground mb-1">
        {isUppercase ? 'Malaki na' : 'Maliit na'} {getLetter(isUppercase)}
      </h3>
      <div
        className="relative rounded-2xl overflow-hidden w-full"
        style={{ aspectRatio: '1 / 1', maxWidth: 500, width: '100%' }}
      >
        <canvas ref={isUppercase ? letterCanvasRefUpper : letterCanvasRefLower} className="absolute inset-0 w-full h-full" />
        <canvas ref={isUppercase ? fillCanvasRefUpper   : fillCanvasRefLower}   className="absolute inset-0 w-full h-full" />
        <canvas
          ref={isUppercase ? cursorCanvasRefUpper : cursorCanvasRefLower}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
          onMouseDown={(e) => handleMouseDown(e, isUppercase)}
          onMouseMove={(e) => handleMouseMove(e, isUppercase)}
          onMouseUp={() => handleMouseUp(isUppercase)}
          onMouseLeave={() => handleMouseUp(isUppercase)}
          onTouchStart={(e) => handleTouchStart(e, isUppercase)}
          onTouchMove={(e) => handleTouchMove(e, isUppercase)}
          onTouchEnd={() => handleTouchEnd(isUppercase)}
        />
      </div>
      <div className="w-full mt-1" style={{ maxWidth: 280 }}>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${isUppercase ? progressUpper : progressLower}%`,
              background: '#FF8C42',
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
      `}</style>

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
            <p style={{ fontSize: 56, lineHeight: 1 }}>🎉</p>
            <p className="text-3xl font-fredoka font-bold text-green-700">Mahusay!</p>

            {/* Image */}
            {tracingAsset && (
              <div style={{
                width: 400, height: 400, borderRadius: 70,
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

            {/* Sound dots */}
            {soundDots()}

            {/* Play Sound button — hidden once all plays done */}
            {postTracingPhase === 'sound' && soundPlayCount < SOUND_PLAYS_NEEDED && (
              <Button
                onClick={handlePlaySoundBtn}
                className="pop-in h-14 px-8 text-xl font-fredoka font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl shadow-lg"
              >
                🔊 Pakinggan ang tunog
              </Button>
            )}

            {/* Next Game button — appears after 3 plays */}
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

<div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'visible', gap: 8 }}>
  <div className="text-center flex-shrink-0">
    <h2 className="text-2xl font-fredoka font-bold text-foreground">
      Panuto: Bakatin ang malaki at maliit na titik {' '}
      <span style={{ color: 'white', WebkitTextStroke: '4px black', paintOrder: 'stroke fill' }}>{getLetter(true)}</span>{' '}
      <span style={{ color: 'white', WebkitTextStroke: '4px black', paintOrder: 'stroke fill' }}>{getLetter(false)}</span>
    </h2>
    <p className="text-sm text-muted-foreground">
      Tunog: <span className="font-fredoka font-bold text-primary">{currentLetter?.sound}</span>
    </p>
  </div>

        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'visible' }}>
          {tracingAsset && (
            <img
              src={tracingAsset.image}
              alt={tracingAsset.word}
              className={idleBounce ? 'img-idle-bounce' : ''}
              style={{
                position: 'absolute',
                top: '50%',
                left: '-30%',
                transform: 'translateY(-50%)',
                width: '35%',
                height: '80%',
                objectFit: 'contain',
                zIndex: 10,
                pointerEvents: 'none',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))',
              }}
            />
          )}

          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 12,
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
          <Button
            onClick={() => { initCanvases(); resetFill(); }}
            variant="outline"
            className="h-9 px-5 text-sm font-fredoka font-bold border-2 border-secondary text-secondary rounded-xl"
          >
            Burahin Lahat
          </Button>
        </div>
      </div>
    </>
  );
}