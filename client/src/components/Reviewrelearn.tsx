import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import RewardFeedback from '@/components/RewardFeedback';
import { getLetterAssets } from '@/contexts/AppContext';
import { playAudio, stopCurrentAudio, getLetterSound } from '@/lib/audio';
import type { LetterProgress, LetterAsset } from '@/contexts/AppContext';

interface ReviewRound {
  image: string;
  sound: string;
  word: string;
  correctLetter: string;
  choices: string[];
}

interface ReviewRelearnProps {
  discoveredLetters: string[];
  allLetters: LetterProgress[];
  onComplete: () => void;
  dayNumber: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildAllRounds(discoveredLetters: string[], allLetters: LetterProgress[], dayNumber: number): ReviewRound[] {
  const meta = allLetters.filter(l => discoveredLetters.includes(l.letter.toLowerCase()));
  const withAssets = meta.filter(l => getLetterAssets(l.letter).length > 0);
  // Allow a review round even when there's only one discovered letter
  if (withAssets.length === 0) return [];
  const shuffledLetters = shuffle(withAssets);
  return shuffledLetters.map((lp) => {
    const assets = getLetterAssets(lp.letter);
    const asset: LetterAsset = assets[Math.floor(Math.random() * assets.length)];
    const correctDisplay = lp.uppercase + lp.lowercase;
    const others = withAssets.filter(l => l.letter !== lp.letter);
    const wrong = shuffle(others).slice(0, 2).map(l => l.uppercase + l.lowercase);
    // Use letter-based sound depending on the review day so we don't play
    // image-specific word audio during assessment/review contexts.
    const letterSound = getLetterSound(lp.letter, dayNumber);
    return { image: asset.image, sound: letterSound, word: asset.word, correctLetter: correctDisplay, choices: shuffle([correctDisplay, ...wrong]) };
  });
}

interface Point { x: number; y: number }

function CircleCard({ label, isCorrect, onCircled, disabled, revealed, entryDelay = 0 }: {
  label: string; isCorrect: boolean; onCircled: (label: string) => void;
  disabled: boolean; revealed: boolean; entryDelay?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<Point[]>([]);
  const [circled, setCircled] = useState(false);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => { setAnimIn(false); const t = setTimeout(() => setAnimIn(true), 50); return () => clearTimeout(t); }, [entryDelay]);
  useEffect(() => { if (!revealed) setCircled(false); }, [revealed]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement): Point => {
    const r = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * (canvas.width / r.width), y: (e.touches[0].clientY - r.top) * (canvas.height / r.height) };
    return { x: ((e as React.MouseEvent).clientX - r.left) * (canvas.width / r.width), y: ((e as React.MouseEvent).clientY - r.top) * (canvas.height / r.height) };
  };

  const isClosedLoop = (pts: Point[]) => pts.length >= 20 && Math.hypot(pts[pts.length-1].x - pts[0].x, pts[pts.length-1].y - pts[0].y) < 55;

  const enclosesCenter = (pts: Point[], canvas: HTMLCanvasElement) => {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const { x: xi, y: yi } = pts[i], { x: xj, y: yj } = pts[j];
      if (((yi > cy) !== (yj > cy)) && (cx < ((xj-xi)*(cy-yi))/(yj-yi) + xi)) inside = !inside;
    }
    return inside;
  };

  const drawPath = useCallback((pts: Point[], color: string) => {
    const canvas = canvasRef.current; if (!canvas || pts.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }, []);

  const spawnStars = useCallback((canvasEl: HTMLCanvasElement, x: number, y: number, count = 3) => {
    const rect = canvasEl.getBoundingClientRect(); const hues = [50, 200, 280, 320];
    for (let i = 0; i < count; i++) {
      // Fairy dust: gentle sideways drift + slow downward fall (gravity), with a light sway
      const vx = (Math.random() - 0.5) * 24;      // slight horizontal drift
      const vy = 30 + Math.random() * 30;          // slow initial downward speed
      const gravity = 60 + Math.random() * 40;     // accelerates the fall a bit
      const swayAmp = 6 + Math.random() * 10;      // side-to-side sway amplitude
      const swayFreq = 2 + Math.random() * 2;      // sway speed
      const s = 5 + Math.random() * 4, dur = 900 + Math.random() * 500;
      const hue = hues[Math.floor(Math.random() * hues.length)];
      const star = document.createElement('canvas'); star.width = s*4; star.height = s*4;
      Object.assign(star.style, { position: 'fixed', left: `${rect.left+x-s*2}px`, top: `${rect.top+y-s*2}px`, pointerEvents: 'none', zIndex: '9999' });
      const sc = star.getContext('2d')!; sc.save(); sc.translate(s*2, s*2); sc.beginPath();
      for (let p = 0; p < 5; p++) {
        const oa = (p*4*Math.PI)/5 - Math.PI/2, ia = oa + (2*Math.PI)/10;
        p===0 ? sc.moveTo(Math.cos(oa)*s, Math.sin(oa)*s) : sc.lineTo(Math.cos(oa)*s, Math.sin(oa)*s);
        sc.lineTo(Math.cos(ia)*s*0.42, Math.sin(ia)*s*0.42);
      }
      sc.closePath(); sc.fillStyle = `hsl(${hue},100%,75%)`; sc.fill(); sc.restore();
      document.body.appendChild(star);
      const t0 = performance.now(), initL = rect.left+x-s*2, initT = rect.top+y-s*2;
      let rot = Math.random() * 360; const rotSpeed = (Math.random()-0.5)*180;
      (function tick(now: number) {
        const elapsed = now-t0, t = Math.min(elapsed/dur, 1);
        const secs = elapsed * 0.001;
        const fallY = vy*secs + 0.5*gravity*secs*secs;
        const swayX = vx*secs + Math.sin(secs*swayFreq*Math.PI) * swayAmp;
        star.style.left = `${initL + swayX}px`; star.style.top = `${initT + fallY}px`;
        rot += rotSpeed/60;
        // Twinkle: fade in quickly, hold, then fade out near the end of the fall
        const twinkle = t < 0.15 ? t/0.15 : t > 0.7 ? 1 - (t-0.7)/0.3 : 1;
        star.style.transform = `rotate(${rot}deg) scale(${0.6 + twinkle*0.5})`;
        star.style.opacity = String(Math.max(0, twinkle));
        if (t < 1) requestAnimationFrame(tick); else star.remove();
      })(t0);
    }
  }, []);

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || circled) return; e.preventDefault(); drawing.current = true;
    const pos = getPos(e, canvasRef.current!); points.current = [pos]; spawnStars(canvasRef.current!, pos.x, pos.y, 4);
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled || circled) return; e.preventDefault();
    const pos = getPos(e, canvasRef.current!); points.current.push(pos); drawPath(points.current, '#6366f1');
    spawnStars(canvasRef.current!, pos.x, pos.y, 1);
  };
  const onEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled || circled) return; e.preventDefault(); drawing.current = false;
    const canvas = canvasRef.current!, pts = points.current;
    if (isClosedLoop(pts) && enclosesCenter(pts, canvas)) { setCircled(true); drawPath(pts, isCorrect ? '#22c55e' : '#ef4444'); onCircled(label); }
    else { canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height); points.current = []; }
  };

  const borderColor = circled ? (isCorrect ? '#22c55e' : '#ef4444') : (revealed && isCorrect ? '#22c55e' : 'transparent');
  const bgColor = circled ? (isCorrect ? '#dcfce7' : '#fee2e2') : (revealed && isCorrect ? '#dcfce7' : '#f3f4f6');

  return (
    <div className={animIn && !circled ? 'rr-card-entry' : ''} style={{ animationDelay: `${entryDelay}ms`, position: 'relative', width: 'clamp(88px, 22vmin, 160px)', height: 'clamp(88px, 22vmin, 160px)', borderRadius: 'clamp(16px, 4vmin, 28px)', border: `4px solid ${borderColor}`, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.3s, background 0.3s', userSelect: 'none', boxShadow: '0 6px 0 rgba(0,0,0,0.15)', overflow: 'visible', flexShrink: 0 }}>
      <span style={{ fontSize: 'clamp(38px, 9vmin, 72px)', fontWeight: 'bold', color: '#1e293b', pointerEvents: 'none' }}>{label}</span>
      <canvas ref={canvasRef} width={170} height={170} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 28, touchAction: 'none', cursor: circled || disabled ? 'default' : 'crosshair' }} onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} />
    </div>
  );
}

function CompleteBanner({ onContinue, totalRounds }: { onContinue: () => void; totalRounds: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(220,252,231,0.6)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 'clamp(48px, 12vmin, 90px)' }}>🌟</div>
        <p className="font-fredoka font-bold text-green-700" style={{ fontSize: 'clamp(22px, 5vmin, 36px)' }}>Napakahusay!</p>
        <p className="font-fredoka text-green-600" style={{ fontSize: 'clamp(14px, 3vmin, 20px)', padding: '0 24px', textAlign: 'center' }}>
          Naalala mo ang lahat ng {totalRounds} titik! Handa ka na para sa susunod na mga titik!
        </p>
        <Button onClick={onContinue} className="mt-4 h-14 px-10 text-xl font-fredoka font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg">Magpatuloy →</Button>
      </div>
    </div>
  );
}

export default function ReviewRelearn({ discoveredLetters, allLetters, onComplete, dayNumber }: ReviewRelearnProps) {
  useEffect(() => () => { stopCurrentAudio(); }, []);

  // Build one round per discovered letter, shuffled — done once on mount
  const [queue] = useState<ReviewRound[]>(() => buildAllRounds(discoveredLetters, allLetters, dayNumber));
  console.log('[REVIEW DEBUG] ReviewRelearn RENDERED', { discoveredLetters, queueLength: queue.length });
  const totalRounds = queue.length;

  const [roundIndex, setRoundIndex] = useState(0);
  const [roundKey, setRoundKey] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [optionsRevealed, setOptionsRevealed] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [rotations, setRotations] = useState(() => [0,1,2].map(() => (Math.random()-0.5)*14));
  const [slotOrder, setSlotOrder] = useState(() => [0,1,2].sort(() => Math.random()-0.5));

  useEffect(() => { playAudio('/instructions/Instruction_6.mp3'); return () => { stopCurrentAudio(); }; }, []);

  const round = queue[roundIndex] ?? null;

  const handleCircled = (label: string) => {
    if (showFeedback || !round) return;
    stopCurrentAudio();
    const correct = label === round.correctLetter;
    setIsCorrect(correct); setShowFeedback(true); setShowReward(true); setOptionsRevealed(true);
    const sfx = new Audio(correct ? '/win.mp3' : '/lose.mp3'); sfx.volume = 1.0;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      sfx.oncanplaythrough = async () => { if (ctx.state === 'suspended') await ctx.resume(); const src = ctx.createMediaElementSource(sfx); const gain = ctx.createGain(); gain.gain.value = correct ? 2.0 : 3.0; src.connect(gain); gain.connect(ctx.destination); sfx.play().catch(() => {}); };
      sfx.load();
    } catch { sfx.play().catch(() => {}); }
  };

  const advanceRound = () => {
    if (isCorrect) {
      const next = roundIndex + 1;
      if (next >= totalRounds) { setShowFeedback(false); setShowReward(false); setShowComplete(true); return; }
      setRoundIndex(next);
      setRotations([0,1,2].map(() => (Math.random()-0.5)*14));
      setSlotOrder([0,1,2].sort(() => Math.random()-0.5));
    }
    setShowFeedback(false); setShowReward(false); setOptionsRevealed(false); setRoundKey(k => k+1);
  };

  useEffect(() => {
    if (showComplete) {
      console.log('[REVIEW DEBUG] ReviewRelearn COMPLETE');
    }
  }, [showComplete]);

  if (!round || totalRounds === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <p className="font-fredoka text-xl text-foreground">Handa ka na para sa susunod!</p>
        <Button onClick={onComplete} className="h-14 px-10 text-xl font-fredoka font-bold bg-primary text-white rounded-2xl">Magpatuloy →</Button>
      </div>
    );
  }

  const slotToOption = [0,1,2].map(slot => slotOrder.indexOf(slot));

  return (
    <>
      <style>{`
        @keyframes rrCardEntry { 0% { transform: scale(0.5) rotate(-15deg); opacity: 0; } 40% { transform: scale(1.15) rotate(6deg); opacity: 1; } 60% { transform: scale(0.95) rotate(-4deg); } 75% { transform: scale(1.05) rotate(2deg); } 90% { transform: scale(0.98) rotate(-1deg); } 100% { transform: scale(1) rotate(0deg); } }
        .rr-card-entry { animation: rrCardEntry 0.65s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes rrFadeInScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        .rr-feedback-popup { animation: rrFadeInScale 0.25s ease-out forwards; }
        @media (max-height: 500px) {
          .rr-image-box { max-width: 220px !important; }
        }
      `}</style>

      <RewardFeedback show={showReward} type={isCorrect ? 'correct' : 'incorrect'} />
      {showComplete && <CompleteBanner onContinue={onComplete} totalRounds={totalRounds} />}

      {showFeedback && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', backgroundColor: isCorrect ? 'rgba(220,252,231,0.55)' : 'rgba(254,226,226,0.55)' }}>
          <div className="rr-feedback-popup" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {isCorrect ? (
              <>
                <p className="text-3xl font-fredoka font-bold text-green-700">Tama! Mahusay! 🎉</p>
                <p className="font-fredoka text-green-600" style={{ fontSize: 'clamp(13px, 2.5vmin, 18px)' }}>{roundIndex + 1} / {totalRounds} titik</p>
                <Button onClick={advanceRound} className="mt-2 h-14 px-10 text-xl font-fredoka font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg">
                  {roundIndex + 1 >= totalRounds ? 'Tapos na! →' : 'Susunod →'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-3xl font-fredoka font-bold text-red-700">Mali!</p>
                <p className="font-fredoka text-red-600" style={{ fontSize: 'clamp(14px, 3vmin, 20px)' }}>Ang tamang sagot ay <strong>{round.correctLetter}</strong></p>
                <Button onClick={advanceRound} className="mt-2 h-14 px-10 text-xl font-fredoka font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl shadow-lg">Ulitin</Button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="text-center flex-shrink-0" style={{ paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 999, padding: '4px 14px', marginBottom: 6, boxShadow: '0 2px 8px rgba(245,158,11,0.35)' }}>
            <span style={{ fontSize: 16 }}>🔁</span>
            <span className="font-fredoka font-bold text-white" style={{ fontSize: 'clamp(12px, 2.5vmin, 16px)' }}>Pagbabalik-Aral at Muling Pagkatuto {dayNumber}</span>
          </div>

          {/* One dot per letter */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 4, flexWrap: 'wrap', padding: '0 12px' }}>
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div key={i} style={{ width: totalRounds > 12 ? 10 : 12, height: totalRounds > 12 ? 10 : 12, borderRadius: '50%', background: i < roundIndex ? '#22c55e' : i === roundIndex ? '#fbbf24' : '#e2e8f0', transition: 'background 0.3s', boxShadow: i < roundIndex ? '0 0 0 2px #bbf7d0' : i === roundIndex ? '0 0 0 2px #fde68a' : 'none', flexShrink: 0 }} />
            ))}
          </div>

          <h2 className="font-fredoka font-bold text-foreground" style={{ fontSize: 'clamp(13px, 3.2vmin, 24px)', lineHeight: 1.2, padding: '0 12px' }}>
            Tingnan ang larawan at bilugan kung anong titik ang may unang tunog sa larawang ito.
          </h2>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 'clamp(8px,5vw,48px)', paddingRight: 'clamp(8px,5vw,48px)', paddingBottom: 'clamp(6px,2vh,12px)' }}>
          <div className="rr-image-box" style={{ width: '100%', maxWidth: 560, height: '100%', maxHeight: '44dvh', borderRadius: 28, overflow: 'hidden', background: 'rgba(255,255,255,0.85)', boxShadow: '0 8px 32px rgba(0,0,0,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img key={`${roundIndex}-${roundKey}-img`} src={round.image} alt={round.word} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 'clamp(8px,3vw,16px)', paddingBottom: 'clamp(8px,3vh,24px)', paddingLeft: 'clamp(8px,3vw,24px)', paddingRight: 'clamp(8px,3vw,24px)' }}>
          {[0,1,2].map((slot, idx) => {
            const optionIdx = slotToOption[slot];
            const label = round.choices[optionIdx];
            if (!label) return null;
            return (
              <div key={`${roundIndex}-${roundKey}-${slot}`} style={{ transform: `rotate(${rotations[slot]}deg)`, display: 'inline-block', overflow: 'visible', flexShrink: 0 }}>
                <CircleCard label={label} isCorrect={label === round.correctLetter} onCircled={handleCircled} disabled={showFeedback} revealed={optionsRevealed} entryDelay={idx * 150} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}