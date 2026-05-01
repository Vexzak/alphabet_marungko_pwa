import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import type { LetterAsset } from '@/contexts/AppContext';
import RewardFeedback from '@/components/RewardFeedback';
import { useState, useRef, useEffect, useCallback } from 'react';

interface StructuredActivityProps {
  onNext: () => void;
  mode?: 'guided' | 'independent';
  learnerCompletedLetters: string[];
}

interface Point { x: number; y: number; }

function CircleLetterCard({
  letter,
  isCorrect,
  onCircled,
  disabled,
  revealed,
  entryDelay = 0,
}: {
  letter: string;
  isCorrect: boolean;
  onCircled: (letter: string) => void;
  disabled: boolean;
  revealed: boolean;
  entryDelay?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<Point[]>([]);
  const [circled, setCircled] = useState(false);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    setAnimating(false);
    const t = setTimeout(() => setAnimating(true), 50);
    return () => clearTimeout(t);
  }, [entryDelay]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * (canvas.width / rect.width),
        y: (e.touches[0].clientY - rect.top) * (canvas.height / rect.height),
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * (canvas.width / rect.width),
      y: ((e as React.MouseEvent).clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const isClosedLoop = (pts: Point[]): boolean => {
    if (pts.length < 20) return false;
    const start = pts[0];
    const end = pts[pts.length - 1];
    return Math.hypot(end.x - start.x, end.y - start.y) < 55;
  };

  const enclosesCenter = (pts: Point[], canvas: HTMLCanvasElement): boolean => {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > cy) !== (yj > cy)) && (cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const drawPath = useCallback((pts: Point[], color: string) => {
    const canvas = canvasRef.current;
    if (!canvas || pts.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, []);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || circled) return;
    e.preventDefault();
    drawing.current = true;
    points.current = [getPos(e, canvasRef.current!)];
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled || circled) return;
    e.preventDefault();
    points.current.push(getPos(e, canvasRef.current!));
    drawPath(points.current, '#6366f1');
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled || circled) return;
    e.preventDefault();
    drawing.current = false;
    const canvas = canvasRef.current!;
    const pts = points.current;
    if (isClosedLoop(pts) && enclosesCenter(pts, canvas)) {
      setCircled(true);
      drawPath(pts, isCorrect ? '#22c55e' : '#ef4444');
      onCircled(letter);
    } else {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      points.current = [];
    }
  };

  useEffect(() => {
    if (!revealed && !circled) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [revealed, circled]);

  useEffect(() => {
    if (!revealed) setCircled(false);
  }, [revealed]);

  const borderColor = circled
    ? isCorrect ? '#22c55e' : '#ef4444'
    : revealed && isCorrect ? '#22c55e' : 'transparent';

  const bgColor = circled
    ? isCorrect ? '#dcfce7' : '#fee2e2'
    : revealed && isCorrect ? '#dcfce7' : '#f3f4f6';

  return (
    <div
      className={animating && !circled ? 'card-entry' : ''}
      style={{
        animationDelay: `${entryDelay}ms`,
        position: 'relative',
        width: 'clamp(88px, 22vmin, 170px)',
        height: 'clamp(88px, 22vmin, 170px)',
        borderRadius: 'clamp(16px, 4vmin, 28px)',
        border: `4px solid ${borderColor}`,
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.3s, background 0.3s',
        userSelect: 'none',
        boxShadow: '0 6px 0 rgba(0,0,0,0.15)',
        overflow: 'visible',
        flexShrink: 0,
      }}
    >
      <span style={{
        fontSize: 'clamp(42px, 10vmin, 80px)',
        fontWeight: 'bold',
        color: '#1e293b',
        pointerEvents: 'none',
      }}>
        {letter}
      </span>
      <canvas
        ref={canvasRef}
        width={170}
        height={170}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: 28,
          touchAction: 'none',
          cursor: circled || disabled ? 'default' : 'crosshair',
          overflow: 'visible',
        }}
        onMouseDown={handleStart} onMouseMove={handleMove}
        onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
      />
    </div>
  );
}

// Progressive letter sequence based on Marungko method
const LETTER_PROGRESSION = [
  ['m', 's', 'a'],
  ['m', 's', 'a', 'i', 'o', 'b'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd', 'c', 'j', 'f'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd', 'c', 'j', 'f', 'v', 'z', 'q'],
  ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd', 'c', 'j', 'f', 'v', 'z', 'q', 'x'],
];

const TOTAL_ROUNDS = 3;

// ── Animated letter sidebar shown during guided mode ─────────────────────────
function LetterSidebar({ uppercase, lowercase }: { uppercase: string; lowercase: string }) {
  return (
    <div
      className="letter-bounce"
      style={{
        position: 'fixed',
        left: 'clamp(8px, 8vw, 10vw)',
        top: '43%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        userSelect: 'none',
        lineHeight: 1,
        padding: '0 8px',
        zIndex: 40,               // ← sits on top of the image container
        pointerEvents: 'none',    // ← won't block clicks
      }}
    >
      <span style={{
        fontSize: 'clamp(54px, 13vmin, 160px)',
        fontWeight: 900,
        color: '#ffffff',
        letterSpacing: 0,
        WebkitTextStroke: 'clamp(3px, 0.8vmin, 6px) rgba(60,60,60,0.55)',
        textShadow: '0 4px 0 rgb(94, 94, 94)',
        paintOrder: 'stroke fill',
      }}>
        {uppercase}{lowercase}
      </span>
    </div>
  );
}

export default function StructuredActivity({ onNext, mode = 'guided', learnerCompletedLetters }: StructuredActivityProps) {
  const { currentLetter, allLetters, updateLetterProgress, consumeNextAsset } = useApp();

  const sfxRef     = useRef<HTMLAudioElement | null>(null);
  const panutoRef  = useRef<HTMLAudioElement | null>(null);
  const panuto3Ref = useRef<HTMLAudioElement | null>(null);
  const panuto4Ref = useRef<HTMLAudioElement | null>(null);

  const stopSfx = useCallback(() => {
    if (sfxRef.current) { sfxRef.current.pause(); sfxRef.current.currentTime = 0; sfxRef.current = null; }
  }, []);

  const stopPanuto = useCallback(() => {
    if (panutoRef.current) { panutoRef.current.pause(); panutoRef.current.currentTime = 0; panutoRef.current = null; }
  }, []);

  const stopPanuto3 = useCallback(() => {
    if (panuto3Ref.current) { panuto3Ref.current.pause(); panuto3Ref.current.currentTime = 0; panuto3Ref.current = null; }
  }, []);

  const stopPanuto4 = useCallback(() => {
    if (panuto4Ref.current) { panuto4Ref.current.pause(); panuto4Ref.current.currentTime = 0; panuto4Ref.current = null; }
    setIsPanuto4Playing(false);
  }, []);

  const playSound = useCallback((src: string, onEnded?: () => void) => {
    stopSfx();
    const audio = new Audio(src);
    sfxRef.current = audio;
    audio.onended = () => {
      if (sfxRef.current === audio) {
        sfxRef.current = null;
      }
      onEnded?.();
    };
    audio.play().catch((err) => {
      console.error('Error playing sound:', err);
      if (sfxRef.current === audio) {
        sfxRef.current = null;
      }
      onEnded?.();
    });
  }, [stopSfx]);

  const playPanuto = useCallback(() => {
    stopPanuto();
    const audio = new Audio('/Panuto_2.mp3');
    panutoRef.current = audio;
    audio.play().catch((err) => console.error('Error playing Panuto_2:', err));
  }, [stopPanuto]);

  const playPanuto3 = useCallback(() => {
    stopPanuto3();
    const audio = new Audio('/Panuto_3.mp3');
    panuto3Ref.current = audio;
    audio.play().catch((err) => console.error('Error playing Panuto_3:', err));
  }, [stopPanuto3]);

  const [isPanuto4Playing, setIsPanuto4Playing] = useState(false);
  const playPanuto4 = useCallback(() => {
    stopPanuto4();
    const audio = new Audio('/Panuto_4.mp3');
    panuto4Ref.current = audio;
    setIsPanuto4Playing(true);
    audio.onended = () => setIsPanuto4Playing(false);
    audio.play().catch((err) => { console.error('Error playing Panuto_4:', err); setIsPanuto4Playing(false); });
  }, [stopPanuto4]);

  useEffect(() => {
    return () => { stopSfx(); stopPanuto(); stopPanuto3(); stopPanuto4(); };
  }, []);

  const getAvailableLetters = useCallback(() => {
    const completedCount = learnerCompletedLetters.length;
    let availableLetters = LETTER_PROGRESSION[0];
    for (let i = 0; i < LETTER_PROGRESSION.length; i++) {
      const progressionSet = LETTER_PROGRESSION[i];
      const hasCompletedThisLevel = progressionSet.every(letter =>
        learnerCompletedLetters.includes(letter.toLowerCase())
      );
      if (hasCompletedThisLevel && i < LETTER_PROGRESSION.length - 1) {
        availableLetters = LETTER_PROGRESSION[i + 1];
      } else {
        availableLetters = progressionSet;
        break;
      }
    }
    return availableLetters;
  }, [learnerCompletedLetters]);

  const [clickCount, setClickCount] = useState(0);
  const [currentAsset, setCurrentAsset] = useState<LetterAsset | null>(null);
  const [lastAsset, setLastAsset] = useState<LetterAsset | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [showReplayBtn, setShowReplayBtn] = useState(false);
  const [choicesReady, setChoicesReady] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [optionsRevealed, setOptionsRevealed] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [round, setRound] = useState(1);

  const getOptions = useCallback(() => {
    const availableLetters = getAvailableLetters();
    const availableLetterObjects = allLetters.filter(l =>
      availableLetters.includes(l.letter.toLowerCase())
    );
    const options = [`${currentLetter?.uppercase || ''}${currentLetter?.lowercase || ''}`];
    const wrongOptions = availableLetterObjects
      .filter((l) => l.letter !== currentLetter?.letter)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    options.push(...wrongOptions.map((l) => `${l.uppercase}${l.lowercase}`));
    return options.sort(() => Math.random() - 0.5);
  }, [currentLetter, allLetters, getAvailableLetters]);

  const [options, setOptions] = useState<string[]>([]);
  const generateSlotOrder = () => [0, 1, 2].sort(() => Math.random() - 0.5);
  const generateRotations = () => [0, 1, 2].map(() => (Math.random() - 0.5) * 14);
  const [slotOrder, setSlotOrder] = useState(generateSlotOrder);
  const [rotations, setRotations] = useState(generateRotations);
  const slotToOption = [0, 1, 2].map((slot) => slotOrder.indexOf(slot));

  const choicesUnlocked = mode !== 'guided' || choicesReady;

  useEffect(() => {
    if (currentLetter) {
      const first = consumeNextAsset();
      setCurrentAsset(first);
      setLastAsset(first);
      setClickCount(0);
      setShowReplayBtn(false);
      setChoicesReady(false);
      setOptions(getOptions());
      if (mode === 'guided') playPanuto();
      if (mode === 'independent') playPanuto3();
    }
  }, [currentLetter?.letter]);

  useEffect(() => {
    if (choicesUnlocked && mode === 'guided') {
      stopSfx();
      stopPanuto4();
      setShowReplayBtn(false);
      const audio = new Audio('/Panuto_4.mp3');
      panuto4Ref.current = audio;
      setIsPanuto4Playing(true);
      audio.onended = () => {
        setIsPanuto4Playing(false);
        setShowReplayBtn(true);
      };
      audio.play().catch(() => {
        setIsPanuto4Playing(false);
        setShowReplayBtn(true);
      });
    }
  }, [choicesUnlocked]);

  const handlePlaySound = () => {
    if (!currentAsset) return;
    stopPanuto();
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
    const next = clickCount + 1;
    if (next > TOTAL_ROUNDS) return;
    setClickCount(next);

    let assetToPlay = currentAsset;
    if (next === 1) {
      setLastAsset(currentAsset);
    } else {
      const nextAsset = consumeNextAsset();
      if (nextAsset) {
        setCurrentAsset(nextAsset);
        setLastAsset(nextAsset);
        assetToPlay = nextAsset;
      }
    }

    playSound(assetToPlay.sound, () => {
      if (next >= TOTAL_ROUNDS) {
        setChoicesReady(true);
      }
    });
  };

  const handleReplayLastSound = () => {
    if (lastAsset) playSound(lastAsset.sound);
  };

  const handleSelectAnswer = (answer: string) => {
    if (showFeedback) return;
    stopPanuto4();
    stopPanuto3();
    setSelectedAnswer(answer);
    const correct = answer === `${currentLetter?.uppercase}${currentLetter?.lowercase}`;
    setIsCorrect(correct);
    setShowFeedback(true);
    setShowReward(true);
    setOptionsRevealed(true);
    if (correct && currentLetter) {
      updateLetterProgress(currentLetter.letter, { listeningCompleted: true });
    }
  };

  const handlePlayAgain = () => {
    stopPanuto4();
    stopPanuto3();
    setSelectedAnswer(null);
    setShowFeedback(false);
    setShowReward(false);
    setOptionsRevealed(false);
    setOptions(getOptions());
    setSlotOrder(generateSlotOrder());
    setRotations(generateRotations());
    setRound(1);
    setClickCount(0);
    setChoicesReady(false);
    setRoundKey((k) => k + 1);
    if (currentLetter) {
      setCurrentAsset(consumeNextAsset());
      if (mode === 'guided') playPanuto();
      if (mode === 'independent') playPanuto3();
    }
  };

  const handleReset = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    setShowReward(false);
    setOptionsRevealed(false);
  };

  useEffect(() => {
    if (!showFeedback) return;
    const soundFile = isCorrect ? '/win.mp3' : '/lose.mp3';
    const audio = new Audio(soundFile);
    audio.volume = 1.0;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBoosted = async () => {
      if (audioContext.state === 'suspended') await audioContext.resume();
      const source = audioContext.createMediaElementSource(audio);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = isCorrect ? 2.0 : 3.0;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      audio.play().catch((err) => console.error(`Error playing ${soundFile}:`, err));
    };
    playBoosted();
  }, [showFeedback, isCorrect]);

  const renderCard = (optionIdx: number, delayMs: number) => (
    <div
      key={`${roundKey}-${optionIdx}`}
      style={{ transform: `rotate(${rotations[optionIdx]}deg)`, display: 'inline-block', overflow: 'visible', flexShrink: 0 }}
    >
      <CircleLetterCard
        letter={options[optionIdx]}
        isCorrect={options[optionIdx] === `${currentLetter?.uppercase}${currentLetter?.lowercase}`}
        onCircled={handleSelectAnswer}
        disabled={showFeedback}
        revealed={optionsRevealed}
        entryDelay={delayMs}
      />
    </div>
  );

  const progressDots = () => (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: '50%',
          background: i < clickCount ? '#FF8C42' : '#e2e8f0',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes cardEntry {
          0%   { transform: scale(0.5) rotate(-15deg); opacity: 0; }
          40%  { transform: scale(1.15) rotate(6deg);  opacity: 1; }
          60%  { transform: scale(0.95) rotate(-4deg); }
          75%  { transform: scale(1.05) rotate(2deg);  }
          90%  { transform: scale(0.98) rotate(-1deg); }
          100% { transform: scale(1)   rotate(0deg);   }
        }
        .card-entry { animation: cardEntry 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        @keyframes letterBounce {
          0%, 100%  { transform: translateY(0) scale(1); }
          10%       { transform: translateY(-10px) scale(1.06); }
          20%       { transform: translateY(0) scale(0.97); }
          28%       { transform: translateY(-5px) scale(1.02); }
          36%       { transform: translateY(0) scale(1); }
        }
        .letter-bounce {
          animation: letterBounce 3s ease-in-out infinite;
          display: inline-block;
        }

        @keyframes shake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-8px) rotate(-2deg); }
          30%  { transform: translateX(8px) rotate(2deg); }
          45%  { transform: translateX(-6px) rotate(-1deg); }
          60%  { transform: translateX(6px) rotate(1deg); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
        .shake { animation: shake 0.6s ease-in-out; }

        @keyframes press {
          0%   { transform: scale(1); }
          50%  { transform: scale(0.93); }
          100% { transform: scale(1); }
        }
        .btn-press { animation: press 0.15s ease-in-out; }

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
      `}</style>

      <RewardFeedback show={showReward} type={isCorrect ? 'correct' : 'incorrect'} />

      {showFeedback && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          backgroundColor: isCorrect ? 'rgba(220, 252, 231, 0.55)' : 'rgba(254, 226, 226, 0.55)',
        }}>
          <div className="feedback-popup" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {isCorrect ? (
              <>
                <p style={{ fontSize: 64, lineHeight: 1 }}>🎉</p>
                <p className="text-3xl font-fredoka font-bold text-green-700">Mahusay!</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button onClick={handlePlayAgain} className="play-again-btn h-14 px-8 text-xl font-fredoka font-bold bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-2xl shadow-lg">
                    Umulit
                  </Button>
                  <Button onClick={() => { stopPanuto4(); stopPanuto3(); onNext(); }} className="h-14 px-10 text-xl font-fredoka font-bold bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-lg">
                    Magpatuloy →
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 64, lineHeight: 1 }}>🤔</p>
                <p className="text-3xl font-fredoka font-bold text-red-700">Try Again!</p>
                <p className="text-lg text-red-600">The correct letter is {currentLetter?.uppercase}{currentLetter?.lowercase}</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button onClick={handleReset} className="h-14 px-10 text-xl font-fredoka font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl shadow-lg">
                    Ulitin
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'independent' ? (
        // ── Look & Circle mode ─────────────────────────────────────────────────
        <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div className="text-center flex-shrink-0" style={{ paddingTop: 8, paddingBottom: 8 }}>
            <h2 className="font-fredoka font-bold text-foreground" style={{ fontSize: 'clamp(16px, 4vmin, 30px)', lineHeight: 1.15 }}>Panuto: Tingnan ang larawan at bilugan kung anong titik ang may unang tunog sa larawang ito.</h2>
          </div>

          <div style={{
            flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            paddingLeft: 'clamp(8px, 5vw, 48px)', paddingRight: 'clamp(8px, 5vw, 48px)', paddingBottom: 'clamp(6px, 2vh, 12px)',
          }}>
            {currentAsset && (
              <div style={{
                width: '100%', maxWidth: 600, height: '100%', maxHeight: '48dvh', borderRadius: 28, overflow: 'hidden',
                background: 'rgba(255,255,255,0.85)', boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  key={currentAsset.image}
                  src={currentAsset.image}
                  alt={currentAsset.word}
                  className={isShaking ? 'shake' : ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>

          {choicesUnlocked && (
            <div style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 'clamp(8px, 3vw, 16px)',
              paddingBottom: 'clamp(8px, 3vh, 24px)',
              paddingLeft: 'clamp(8px, 3vw, 24px)',
              paddingRight: 'clamp(8px, 3vw, 24px)',
            }}>
              {renderCard(slotToOption[0], 0)}
              {renderCard(slotToOption[1], 150)}
              {renderCard(slotToOption[2], 300)}
            </div>
          )}
        </div>
      ) : (
        // ── Guided mode: Listen & Repeat ──────────────────────────────────────
        <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 2vh, 12px)', overflow: 'auto' }}>
          <div className="text-center flex-shrink-0">
            <h2 className="font-fredoka font-bold text-foreground mb-2" style={{ fontSize: 'clamp(16px, 4vmin, 30px)', lineHeight: 1.15 }}>Pakinggan nang mabuti ang tunog ng letra at bilugan kung anong letra ito. </h2>
            {!choicesUnlocked && progressDots()}
          </div>

          {/* Image row: image centered, letter absolutely on the left */}
          <div style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Animated letter sidebar — absolutely positioned, doesn't affect image centering */}
            {currentLetter && (
              <LetterSidebar
                uppercase={currentLetter.uppercase}
                lowercase={currentLetter.lowercase}
              />
            )}

            {/* Image — always centered */}
            {currentAsset && (
              <div style={{
                width: '100%',
                maxWidth: 480,
                maxHeight: '48dvh',
                height: '100%',
                borderRadius: 20,
                overflow: 'hidden',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  key={currentAsset.image}
                  src={currentAsset.image}
                  alt={currentAsset.word}
                  className={isShaking ? 'shake' : ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>

          {/* Listen button (pre-unlock) */}
          {!choicesUnlocked && (
            <div className="flex justify-center flex-shrink-0">
              <Button
                onClick={handlePlaySound}
                disabled={isPanuto4Playing}
                className={`px-8 font-fredoka font-bold bg-secondary hover:bg-secondary/90 text-white rounded-2xl shadow-lg ${isPressed ? 'btn-press' : ''} ${isPanuto4Playing ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ height: 'clamp(44px, 9vmin, 64px)', fontSize: 'clamp(15px, 3.5vmin, 20px)' }}
              >
                🔊 Pakinggan nag tunog
              </Button>
            </div>
          )}

          {/* Circle-to-answer cards (replaces button grid after unlock) */}
          {choicesUnlocked && (
            <div style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 'clamp(8px, 3vw, 16px)',
              paddingBottom: 'clamp(8px, 3vh, 20px)',
              paddingLeft: 'clamp(8px, 3vw, 24px)',
              paddingRight: 'clamp(8px, 3vw, 24px)',
            }}>
              {renderCard(slotToOption[0], 0)}
              {renderCard(slotToOption[1], 150)}
              {renderCard(slotToOption[2], 300)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
