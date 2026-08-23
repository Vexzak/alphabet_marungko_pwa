import { useApp, getLetterAssets } from '@/contexts/AppContext';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DragItem {
  id: string;        // e.g. "m-mango"
  letter: string;    // "m"
  word: string;      // "mango"
  image: string;     // "/letters/M-mango.png"
  sound: string;     // "/sounds/M_mango.mp3"
}

interface DropSlot {
  letter: string;    // "m"
  uppercase: string; // "M"
  droppedId: string | null;
}

interface DragAssessmentProps {
  onNext: () => void;
  learnerCompletedLetters: string[];
  assessmentLetters: readonly string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Asset data (word/image/sound per letter) now lives in AppContext as the
// single source of truth — see getLetterAssets(). Letters with no assets yet
// (currently k, l, y, n, g, h, p, r, d are stubbed empty there) are simply
// filtered out of the unlocked pool below until assets are added.

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `count` letters (from the day-appropriate pool) and build one drag item per letter */
function buildRound(
  unlockedLetters: string[],
  count = 3
): { items: DragItem[]; slots: DropSlot[] } {
  const pool = shuffle(unlockedLetters).slice(0, count);

  const items: DragItem[] = pool.map((letter) => {
    const assets = getLetterAssets(letter);
    const asset = assets[Math.floor(Math.random() * assets.length)] ?? {
      word: letter,
      image: '',
      sound: '',
    };
    return {
      id: `${letter}-${asset.word}`,
      letter,
      word: asset.word,
      image: asset.image,
      sound: asset.sound,
    };
  });

  const slots: DropSlot[] = pool.map((letter) => ({
    letter,
    uppercase: letter.toUpperCase(),
    droppedId: null,
  }));

  return {
    items: shuffle(items),
    slots: shuffle(slots),
  };
}

/**
 * Single shared <audio> element for all letter-sound playback. Reusing one
 * instance (instead of `new Audio()` per click) means we always have a
 * handle on "whatever is currently playing", so we can stop it before
 * starting the next clip — this is what prevents sounds from overlapping
 * when a kid taps the speaker icon multiple times in a row.
 */
let sharedAudio: HTMLAudioElement | null = null;

/**
 * Plays a sound clip, stopping any currently-playing clip first so repeated
 * clicks never overlap. Swallows any error (missing file, autoplay block,
 * etc.) so a bad/placeholder path never crashes the game.
 */
function playSound(src: string | undefined | null) {
  if (!src) return;
  try {
    if (!sharedAudio) {
      sharedAudio = new Audio();
    }
    // Stop whatever's currently playing before starting the new clip.
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    sharedAudio.src = src;
    void sharedAudio.play().catch(() => {
      // Missing file / blocked autoplay — fail silently, no crash.
    });
  } catch {
    // Defensive: never let audio break the game.
  }
}

// ─── Ghost image (hidden 1×1 for drag) ───────────────────────────────────────
const EMPTY_IMG = (() => {
  if (typeof document === 'undefined') return undefined;
  const img = new Image();
  img.src =
    'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  return img;
})();

// ─── SpeakerBadge ────────────────────────────────────────────────────────────
// Small round badge overlapping the corner of an image. Clicking it plays
// the sound for that image without starting a drag.

interface SpeakerBadgeProps {
  onPlay: () => void;
  size?: number;
}

function SpeakerBadge({ onPlay, size = 48 }: SpeakerBadgeProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onPlay(); }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      draggable={false}
      aria-label="Pakinggan ang tunog"
      style={{
        position: 'absolute',
        bottom: -12,
        right: -12,
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#6366f1',
        color: 'white',
        border: '3px solid white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.28)',
        padding: 0,
        lineHeight: 1,
        zIndex: 2,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9.5V14.5C3 15.0523 3.44772 15.5 4 15.5H6.5L10.5 19V5L6.5 8.5H4C3.44772 8.5 3 8.94772 3 9.5Z" fill="currentColor"/>
        <path d="M14.5 8.5C15.5 9.3 16 10.5 16 12C16 13.5 15.5 14.7 14.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M17 6C18.8 7.4 20 9.6 20 12C20 14.4 18.8 16.6 17 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

// ─── DragCard ────────────────────────────────────────────────────────────────

interface DragCardProps {
  item: DragItem;
  dragging: boolean;
  placed: boolean;
  onDragStart: (id: string, e: React.DragEvent | React.TouchEvent) => void;
  onDrag: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onPlaySound: (item: DragItem) => void;
  style?: React.CSSProperties;
}

function DragCard({ item, dragging, placed, onDragStart, onDrag, onDragEnd, onPlaySound, style }: DragCardProps) {
  const handleTouchStart = (e: React.TouchEvent) => {
    onDragStart(item.id, e);
  };

  return (
    <div
      draggable={!placed}
      onDragStart={(e) => {
        if (EMPTY_IMG) e.dataTransfer.setDragImage(EMPTY_IMG, 0, 0);
        onDragStart(item.id, e);
      }}
      onDrag={(e) => onDrag(item.id, e)}
      onDragEnd={onDragEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={onDragEnd}
      style={{
        position: 'relative',
        width: 'clamp(110px, 24vw, 160px)',
        height: 'clamp(110px, 24vw, 160px)',
        borderRadius: 20,
        background: placed ? 'transparent' : 'white',
        border: placed ? '2.5px dashed #d1d5db' : '2.5px solid #e5e7eb',
        boxShadow: placed ? 'none' : dragging ? '0 8px 24px rgba(99,102,241,0.35)' : '0 4px 12px rgba(0,0,0,0.10)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: placed ? 'default' : 'grab',
        opacity: placed ? 0 : dragging ? 0.3 : 1,
        transform: dragging ? 'scale(0.94)' : 'scale(1)',
        transition: 'box-shadow 0.2s, transform 0.15s, opacity 0.2s',
        userSelect: 'none',
        touchAction: 'none',
        ...style,
      }}
    >
      {!placed && (
        <>
          {item.image ? (
            <img
              src={item.image}
              alt=""
              draggable={false}
              style={{ width: '78%', height: '78%', objectFit: 'contain', pointerEvents: 'none' }}
            />
          ) : (
            <div style={{ fontSize: 'clamp(46px, 10vw, 64px)', lineHeight: 1 }}>🖼️</div>
          )}
          <SpeakerBadge onPlay={() => onPlaySound(item)} />
        </>
      )}
    </div>
  );
}

// ─── DropSlotBox ─────────────────────────────────────────────────────────────

interface DropSlotBoxProps {
  slot: DropSlot;
  placedItem: DragItem | null;
  isOver: boolean;
  result: 'correct' | 'wrong' | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (letter: string) => void;
  onRemove: (letter: string) => void;
  onPlaySound: (item: DragItem) => void;
}

function DropSlotBox({ slot, placedItem, isOver, result, onDragOver, onDrop, onRemove, onPlaySound }: DropSlotBoxProps) {
  const borderColor = result === 'correct'
    ? '#10b981'
    : result === 'wrong'
      ? '#ef4444'
      : isOver
        ? '#6366f1'
        : '#d1d5db';

  const bgColor = result === 'correct'
    ? '#ecfdf5'
    : result === 'wrong'
      ? '#fef2f2'
      : isOver
        ? '#eef2ff'
        : '#f9fafb';

  return (
    <div
      onDragOver={onDragOver}
      onDrop={() => onDrop(slot.letter)}
      style={{
        width: 'clamp(130px, 28vw, 190px)',
        borderRadius: 22,
        border: `3px dashed ${borderColor}`,
        background: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 10,
        gap: 8,
        transition: 'border-color 0.2s, background 0.2s',
        minHeight: 'clamp(170px, 36vw, 230px)',
        position: 'relative',
      }}
    >
      {/* Image preview area */}
      <div style={{
        position: 'relative',
        width: 'clamp(100px, 22vw, 150px)',
        height: 'clamp(100px, 22vw, 150px)',
        borderRadius: 16,
        background: placedItem ? 'white' : 'transparent',
        border: placedItem ? '2px solid #e5e7eb' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        boxShadow: placedItem ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
      }}>
        {placedItem && (
          placedItem.image ? (
            <img
              src={placedItem.image}
              alt=""
              style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }}
            />
          ) : (
            <div style={{ fontSize: 'clamp(40px, 9vw, 56px)' }}>🖼️</div>
          )
        )}
        {!placedItem && (
          <span style={{ fontSize: 'clamp(26px, 6vw, 36px)', opacity: 0.25 }}>?</span>
        )}

        {/* Speaker badge — replay sound for the dropped image */}
        {placedItem && (
          <SpeakerBadge onPlay={() => onPlaySound(placedItem)} />
        )}

        {/* Bring-back button — lets the learner undo a placement before checking */}
        {placedItem && !result && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(slot.letter); }}
            aria-label="Bawiin ang larawan"
            style={{
              position: 'absolute',
              top: -10,
              right: -10,
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: '#ef4444',
              color: 'white',
              border: '2.5px solid white',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
              lineHeight: 1,
              padding: 0,
              zIndex: 3,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Result icon */}
      {result && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          fontSize: 22,
          lineHeight: 1,
          animation: 'pop 0.3s ease',
        }}>
          {result === 'correct' ? '✅' : '❌'}
        </div>
      )}

      {/* Letter label */}
      <div style={{
        fontFamily: 'Fredoka One, Fredoka, sans-serif',
        fontSize: 'clamp(26px, 6vw, 34px)',
        fontWeight: 700,
        color: result === 'correct' ? '#10b981' : result === 'wrong' ? '#ef4444' : '#374151',
        lineHeight: 1,
        transition: 'color 0.2s',
      }}>
        {slot.uppercase}{slot.letter}
      </div>
    </div>
  );
}

// ─── Ghost drag image (follows cursor/finger — gives the "picked up" feel) ──

interface GhostProps {
  item: DragItem | null;
  x: number;
  y: number;
}

function Ghost({ item, x, y }: GhostProps) {
  if (!item) return null;
  return (
    <>
      {/* Soft blurred shadow beneath the floating image */}
      <div style={{
        position: 'fixed',
        left: x - 50,
        top: y + 40,
        width: 100,
        height: 22,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.18)',
        filter: 'blur(6px)',
        pointerEvents: 'none',
        zIndex: 9998,
      }} />
      <div style={{
        position: 'fixed',
        left: x - 60,
        top: y - 60,
        width: 120,
        height: 120,
        borderRadius: 22,
        background: 'white',
        border: '3px solid #6366f1',
        boxShadow: '0 16px 32px rgba(99,102,241,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 0.96,
        animation: 'floatBob 0.6s ease-in-out infinite alternate',
      }}>
        {item.image ? (
          <img src={item.image} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 54 }}>🖼️</div>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Assessment({ onNext, assessmentLetters }: DragAssessmentProps) {
  const { allLetters } = useApp();

  // The parent supplies exactly the letters in the just-completed day.
  const unlockedLetters = useMemo(() => {
    return [...assessmentLetters];
  }, [assessmentLetters]);

  // Round state
  const [items, setItems] = useState<DragItem[]>([]);
  const [slots, setSlots] = useState<DropSlot[]>([]);
  const [results, setResults] = useState<Record<string, 'correct' | 'wrong' | null>>({});
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [roundsDone, setRoundsDone] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<string | null>(null);

  // Floating "held" image — used for BOTH mouse drag and touch drag
  const [ghostItem, setGhostItem] = useState<DragItem | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

  // Slot refs for touch hit-testing
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const startNewRound = useCallback(() => {
    const { items: newItems, slots: newSlots } = buildRound(unlockedLetters, 3);
    setItems(newItems);
    setSlots(newSlots);
    setResults({});
    setChecked(false);
    setDraggingId(null);
    setOverSlot(null);
    setGhostItem(null);
  }, [unlockedLetters]);

  useEffect(() => { startNewRound(); }, [startNewRound]);

  // ── Sound ────────────────────────────────────────────────────────────────────

  const handlePlaySound = useCallback((item: DragItem) => {
    playSound(item.sound);
  }, []);

  // ── Mouse / HTML5 drag ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((id: string, e: React.DragEvent | React.TouchEvent) => {
    if (checked) return;
    setDraggingId(id);
    const item = items.find((i) => i.id === id) ?? null;
    setGhostItem(item);
    if ('touches' in e) {
      setGhostPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else {
      const dragEvent = e as React.DragEvent;
      setGhostPos({ x: dragEvent.clientX, y: dragEvent.clientY });
    }
  }, [checked, items]);

  // Continuously update the floating image position while dragging with a mouse
  const handleDragMove = useCallback((_id: string, e: React.DragEvent) => {
    // The browser fires one final drag event with (0,0) on drop in some browsers — ignore it
    if (e.clientX === 0 && e.clientY === 0) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragOver = (e: React.DragEvent, slotLetter: string) => {
    e.preventDefault();
    setOverSlot(slotLetter);
  };

  const handleDrop = useCallback((slotLetter: string) => {
    if (!draggingId || checked) return;
    setSlots((prev) =>
      prev.map((s) =>
        s.letter === slotLetter
          ? { ...s, droppedId: draggingId }
          : s.droppedId === draggingId
            ? { ...s, droppedId: null }      // remove from previous slot if moved
            : s
      )
    );
    setDraggingId(null);
    setOverSlot(null);
  }, [draggingId, checked]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setOverSlot(null);
    setGhostItem(null);
  }, []);

  // Bring an image back from a slot into the tray
  const handleRemoveFromSlot = useCallback((letter: string) => {
    if (checked) return;
    setSlots((prev) => prev.map((s) => (s.letter === letter ? { ...s, droppedId: null } : s)));
  }, [checked]);

  // ── Touch drag ──────────────────────────────────────────────────────────────

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!draggingId) return;
    const touch = e.touches[0];
    setGhostPos({ x: touch.clientX, y: touch.clientY });

    // Hit test slots
    let found: string | null = null;
    for (const [letter, el] of Object.entries(slotRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        touch.clientX >= rect.left && touch.clientX <= rect.right &&
        touch.clientY >= rect.top  && touch.clientY <= rect.bottom
      ) {
        found = letter;
        break;
      }
    }
    setOverSlot(found);
  }, [draggingId]);

  const handleTouchEnd = useCallback(() => {
    if (draggingId && overSlot) {
      handleDrop(overSlot);
    }
    setDraggingId(null);
    setOverSlot(null);
    setGhostItem(null);
  }, [draggingId, overSlot, handleDrop]);

  useEffect(() => {
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  // ── Check answers ───────────────────────────────────────────────────────────

  const allPlaced = slots.every((s) => s.droppedId !== null);

  const handleCheck = () => {
    if (!allPlaced || checked) return;
    const newResults: Record<string, 'correct' | 'wrong'> = {};
    let correct = 0;
    for (const slot of slots) {
      const placed = items.find((i) => i.id === slot.droppedId);
      const isCorrect = placed?.letter === slot.letter;
      newResults[slot.letter] = isCorrect ? 'correct' : 'wrong';
      if (isCorrect) correct++;
    }
    setResults(newResults);
    setChecked(true);
    setScore((prev) => prev + correct);
    setRoundsDone((prev) => prev + 1);
    if (correct === 3) {
      setTimeout(() => setShowSuccess(true), 600);
    }
  };

  const handleRetry = () => {
    startNewRound();
  };

  // ── Return item lookup ──────────────────────────────────────────────────────

  const getPlacedItem = (droppedId: string | null) =>
    droppedId ? items.find((i) => i.id === droppedId) ?? null : null;

  const isItemPlaced = (itemId: string) =>
    slots.some((s) => s.droppedId === itemId);

  // ── Total score display ─────────────────────────────────────────────────────

  const totalPossible = roundsDone * 3;
  const accuracy = totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0;

  // ── Success screen ──────────────────────────────────────────────────────────

  if (showSuccess) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '24px 16px',
      }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>🎉</div>
        <div style={{
          fontFamily: 'Fredoka One, Fredoka, sans-serif',
          fontSize: 'clamp(26px, 6vmin, 38px)',
          fontWeight: 700,
          color: '#10b981',
          textAlign: 'center',
        }}>
          Perfect Match!
        </div>
        <div style={{
          fontFamily: 'Quicksand, sans-serif',
          fontSize: 'clamp(15px, 3.5vmin, 20px)',
          color: '#6b7280',
          textAlign: 'center',
        }}>
          You matched all 3 images correctly! 🌟
        </div>
        {roundsDone > 1 && (
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #10b981',
            borderRadius: 16,
            padding: '12px 24px',
            fontFamily: 'Quicksand, sans-serif',
            fontSize: 16,
            color: '#065f46',
            fontWeight: 700,
          }}>
            Score: {score} / {totalPossible} ({accuracy}%)
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            onClick={() => { setShowSuccess(false); startNewRound(); }}
            className="px-8 font-fredoka font-bold rounded-2xl bg-secondary hover:bg-secondary/90 text-white"
            style={{ height: 52, fontSize: 18 }}
          >
            Play Again 🔄
          </Button>
          <Button
            onClick={onNext}
            className="px-8 font-fredoka font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
            style={{ height: 52, fontSize: 18 }}
          >
            Next ➡️
          </Button>
        </div>
      </div>
    );
  }

  // ── Main game UI ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating image that follows the cursor (mouse) or finger (touch) while dragging */}
      <Ghost item={ghostItem} x={ghostPos.x} y={ghostPos.y} />

      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(12px, 3vh, 24px)',
        padding: 'clamp(8px, 2vh, 16px) 12px',
        userSelect: 'none',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'Fredoka One, Fredoka, sans-serif',
            fontSize: 'clamp(20px, 5vmin, 30px)',
            fontWeight: 700,
            color: '#1e293b',
            margin: 0,
            lineHeight: 1.2,
          }}>
            Ilagay ang larawan sa tamang letra!
          </h2>
        </div>

        {/* Draggable image cards */}
        <div style={{
          display: 'flex',
          gap: 'clamp(10px, 3vw, 20px)',
          justifyContent: 'center',
          flexWrap: 'wrap',
          minHeight: 'clamp(110px, 24vw, 160px)',
        }}>
          {items.map((item) => (
            <DragCard
              key={item.id}
              item={item}
              dragging={draggingId === item.id}
              placed={isItemPlaced(item.id)}
              onDragStart={handleDragStart}
              onDrag={handleDragMove}
              onDragEnd={handleDragEnd}
              onPlaySound={handlePlaySound}
            />
          ))}
        </div>

        {/* Divider with arrow hint */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#9ca3af',
          fontSize: 13,
          fontFamily: 'Quicksand, sans-serif',
        }}>
          <div style={{ width: 40, height: 1, background: '#e5e7eb' }} />
          <span>↓ i-drop dito</span>
          <div style={{ width: 40, height: 1, background: '#e5e7eb' }} />
        </div>

        {/* Drop slots */}
        <div style={{
          display: 'flex',
          gap: 'clamp(10px, 3vw, 20px)',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {slots.map((slot) => (
            <div
              key={slot.letter}
              ref={(el) => { slotRefs.current[slot.letter] = el; }}
            >
              <DropSlotBox
                slot={slot}
                placedItem={getPlacedItem(slot.droppedId)}
                isOver={overSlot === slot.letter}
                result={results[slot.letter] ?? null}
                onDragOver={(e) => handleDragOver(e, slot.letter)}
                onDrop={handleDrop}
                onRemove={handleRemoveFromSlot}
                onPlaySound={handlePlaySound}
              />
            </div>
          ))}
        </div>

        {/* Feedback banner */}
        {checked && (
          <div style={{
            background: Object.values(results).every((r) => r === 'correct')
              ? '#ecfdf5'
              : '#fef9c3',
            border: `2px solid ${Object.values(results).every((r) => r === 'correct') ? '#10b981' : '#f59e0b'}`,
            borderRadius: 16,
            padding: '10px 24px',
            textAlign: 'center',
            fontFamily: 'Fredoka One, Fredoka, sans-serif',
            fontSize: 'clamp(15px, 3.5vmin, 20px)',
            color: Object.values(results).every((r) => r === 'correct') ? '#065f46' : '#78350f',
          }}>
            {Object.values(results).every((r) => r === 'correct')
              ? '🌟 Tama lahat! Napakagaling!'
              : `${Object.values(results).filter((r) => r === 'correct').length} / 3 ang tama — kailangang tama lahat, subukan ulit!`}
          </div>
        )}

        {/* Action buttons — Susunod only ever appears on the dedicated success screen above */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {!checked ? (
            <Button
              onClick={handleCheck}
              disabled={!allPlaced}
              className={`px-10 font-fredoka font-bold rounded-2xl ${allPlaced ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-secondary text-white/70'}`}
              style={{ height: 'clamp(44px, 9vmin, 54px)', fontSize: 'clamp(15px, 3.5vmin, 20px)' }}
            >
              Suriin ✅
            </Button>
          ) : (
            <Button
              onClick={handleRetry}
              className="px-8 font-fredoka font-bold rounded-2xl bg-secondary hover:bg-secondary/90 text-white"
              style={{ height: 'clamp(44px, 9vmin, 54px)', fontSize: 'clamp(15px, 3.5vmin, 20px)' }}
            >
              Ulit 🔄
            </Button>
          )}
        </div>

        {/* Round counter */}
        {roundsDone > 0 && (
          <div style={{
            fontFamily: 'Quicksand, sans-serif',
            fontSize: 13,
            color: '#9ca3af',
          }}>
            Round {roundsDone} • Score: {score}/{totalPossible}
          </div>
        )}

      </div>

      <style>{`
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes floatBob {
          from { transform: translateY(0px) rotate(-3deg) scale(1.05); }
          to   { transform: translateY(-7px) rotate(-3deg) scale(1.05); }
        }
      `}</style>
    </>
  );
}
