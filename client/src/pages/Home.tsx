import { useApp } from '@/contexts/AppContext';
import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import LetterInstruction from '@/components/LetterInstruction';
import StructuredActivity from '@/components/StructuredActivity';
import Assessment from '@/components/Assessment';

const MARUNGKO_ORDER = ['m','s','a','i','o','b','e','u','t','k','l','y','n','g','h','p','r','d','c','j','f','v','z','q','x'];

// ── Week/Day Mapping ─────────────────────────────────────────────────────────
const WEEK_DAY_SCHEDULE = [
  { week: 1, day: 1, letters: ['m', 's', 'a'] },
  { week: 1, day: 2, letters: ['m', 's', 'a', 'i', 'o', 'b'] },
  { week: 1, day: 3, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't'] },
  { week: 1, day: 4, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y'] },
  { week: 1, day: 5, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h'] },
  { week: 2, day: 1, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd'] },
  { week: 2, day: 2, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd', 'c', 'j', 'f'] },
  { week: 2, day: 3, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd', 'c', 'j', 'f', 'v', 'z', 'q'] },
  { week: 2, day: 4, letters: ['m', 's', 'a', 'i', 'o', 'b', 'e', 'u', 't', 'k', 'l', 'y', 'n', 'g', 'h', 'p', 'r', 'd', 'c', 'j', 'f', 'v', 'z', 'q', 'x'] },
  { week: 2, day: 5, letters: MARUNGKO_ORDER }, // All 25 letters
];

function calculateWeekDay(completedLetters: string[]): { week: number; day: number; label: string } {
  if (completedLetters.length === 0) {
    return { week: 0, day: 0, label: 'Hindi pa nagsimula' };
  }

  // Find the highest day completed
  for (let i = WEEK_DAY_SCHEDULE.length - 1; i >= 0; i--) {
    const schedule = WEEK_DAY_SCHEDULE[i];
    const allCompleted = schedule.letters.every(letter => completedLetters.includes(letter));
    if (allCompleted) {
      return {
        week: schedule.week,
        day: schedule.day,
        label: `Week ${schedule.week}, Day ${schedule.day}`
      };
    }
  }

  return { week: 0, day: 0, label: 'Nagsisimula pa...' };
}

// ── Lock/unlock helper ────────────────────────────────────────────────────────
// A letter is unlocked if it is 'm' (always first) OR every letter before it
// in MARUNGKO_ORDER has been completed.
function isLetterUnlocked(letterKey: string, completedLetters: string[]): boolean {
  const idx = MARUNGKO_ORDER.indexOf(letterKey.toLowerCase());
  if (idx === -1) return false; // unknown letter — keep locked
  if (idx === 0) return true;   // 'm' is always available
  // All letters before this one must be completed
  return MARUNGKO_ORDER.slice(0, idx).every(prev => completedLetters.includes(prev));
}

// ── Learner storage helpers ──────────────────────────────────────────────────
interface Learner {
  id: string;
  name: string;
  completedLetters: string[];
  progress: Record<string, Record<string, boolean>>;
  overallProgress: number;
  currentLetterKey?: string;
  currentPhase?: string;
  weekDay?: { week: number; day: number; label: string };
}

const STORAGE_KEY = 'alpabetitik_learners';

function loadLearners(): Learner[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const learners = raw ? JSON.parse(raw) : [];
    return learners.map((l: Learner) => ({
      ...l,
      completedLetters: l.completedLetters || [],
      weekDay: calculateWeekDay(l.completedLetters || [])
    }));
  } catch {
    return [];
  }
}

function saveLearners(learners: Learner[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(learners));
}

function createLearner(name: string): Learner {
  return {
    id: Date.now().toString(),
    name: name.trim(),
    completedLetters: [],
    progress: {},
    overallProgress: 0,
    weekDay: { week: 0, day: 0, label: 'Hindi pa nagsimula' }
  };
}

// ── Avatar colors per learner ────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: '#FF6B6B', shadow: '#c94b4b' },
  { bg: '#FF9F43', shadow: '#c97a2a' },
  { bg: '#FECA57', shadow: '#c9a030' },
  { bg: '#1DD1A1', shadow: '#13a077' },
  { bg: '#48DBFB', shadow: '#28a7c9' },
  { bg: '#A29BFE', shadow: '#6c63d4' },
  { bg: '#FD79A8', shadow: '#c94d7a' },
  { bg: '#55EFC4', shadow: '#2aba94' },
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Shared button press helpers ──────────────────────────────────────────────
const press = (shadow: string) => ({
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'translateY(4px)';
    e.currentTarget.style.boxShadow = `0 2px 0 ${shadow}`;
  },
  onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = `0 6px 0 ${shadow}`;
  },
  onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'translateY(4px)';
    e.currentTarget.style.boxShadow = `0 2px 0 ${shadow}`;
  },
  onTouchEnd: (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = `0 6px 0 ${shadow}`;
  },
});

const pressSmall = (shadow: string) => ({
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'translateY(3px)';
    e.currentTarget.style.boxShadow = `0 2px 0 ${shadow}`;
  },
  onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = `0 5px 0 ${shadow}`;
  },
  onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'translateY(3px)';
    e.currentTarget.style.boxShadow = `0 2px 0 ${shadow}`;
  },
  onTouchEnd: (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
    e.currentTarget.style.boxShadow = `0 5px 0 ${shadow}`;
  },
});

// ── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation();
  const { currentLetter, setCurrentLetter, currentPhase, setCurrentPhase, allLetters } = useApp();

  const [showLanding, setShowLanding] = useState(true);
  const [showLetterPicker, setShowLetterPicker] = useState(false);
  const [showMarungkoStartPicker, setShowMarungkoStartPicker] = useState(false);

  // Learner modal state
  const [showLearnersModal, setShowLearnersModal] = useState(false);
  const [learners, setLearners] = useState<Learner[]>(loadLearners);
  const [activeLearner, setActiveLearner] = useState<Learner | null>(null);
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Locked-tile tooltip: which tile index is showing the "🔒 locked" hint
  const [lockedTooltipIdx, setLockedTooltipIdx] = useState<number | null>(null);

  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const chooseAudioRef = useRef<HTMLAudioElement | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const introPlayedRef = useRef(false);

  // Persist learners whenever they change
  useEffect(() => {
    saveLearners(learners);
  }, [learners]);

  // ── Function to mark letter as complete and update learner ──
  const markLetterComplete = (letterKey: string) => {
    if (!activeLearner) return;

    const updatedLearners = learners.map(l => {
      if (l.id === activeLearner.id) {
        const newCompletedLetters = [...new Set([...l.completedLetters, letterKey.toLowerCase()])];
        const weekDay = calculateWeekDay(newCompletedLetters);
        const updated = {
          ...l,
          completedLetters: newCompletedLetters,
          overallProgress: Math.round((newCompletedLetters.length / MARUNGKO_ORDER.length) * 100),
          weekDay
        };
        setActiveLearner(updated);
        return updated;
      }
      return l;
    });

    setLearners(updatedLearners);
  };

  // ── Stop a one-shot sfx cleanly ──
  const stopSfx = (ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (ref.current) {
      ref.current.pause();
      ref.current.currentTime = 0;
    }
  };

  const playBackgroundMusic = () => {
    if (!backgroundAudioRef.current) {
      backgroundAudioRef.current = new Audio('/Home_bg.mp3');
      backgroundAudioRef.current.loop = true;
      backgroundAudioRef.current.volume = 0.5;
    }
    if (!backgroundAudioRef.current.paused) return;
    backgroundAudioRef.current.play().catch((err) => {
      console.log('Background music playback failed:', err);
    });
  };

  const playChooseSound = () => {
    stopSfx(introAudioRef);
    if (!chooseAudioRef.current) {
      chooseAudioRef.current = new Audio('/Choose.mp3');
      chooseAudioRef.current.volume = 1;
    }
    chooseAudioRef.current.currentTime = 0;
    chooseAudioRef.current.play().catch((err) => {
      console.log('Choose sound playback failed:', err);
    });
  };//

  const playIntroSound = () => {
    if (introPlayedRef.current) return;
    introPlayedRef.current = true;
    stopSfx(chooseAudioRef);
    if (!introAudioRef.current) {
      introAudioRef.current = new Audio('/intro.mp3');
      introAudioRef.current.volume = 1;
    }
    introAudioRef.current.currentTime = 0;
    introAudioRef.current.play().catch((err) => {
      console.log('Intro sound playback failed:', err);
    });
  };

  // ── Learner actions ──
  const handleAddLearner = () => {
    if (!newName.trim()) return;
    const learner = createLearner(newName);
    const updated = [...learners, learner];
    setLearners(updated);
    setNewName('');
    setShowAddForm(false);
    handleSelectLearner(learner);
  };

  const handleSelectLearner = (learner: Learner) => {
    setActiveLearner(learner);
    setShowLearnersModal(false);
    playChooseSound();
    setShowLanding(false);
    setShowMarungkoStartPicker(true);
    setCurrentPhase('anticipatory');
  };

  const handleDeleteLearner = (id: string) => {
    const updated = learners.filter((l) => l.id !== id);
    setLearners(updated);
    setConfirmDeleteId(null);
    if (activeLearner?.id === id) setActiveLearner(null);
  };

  // ── Navigation ──
  const handleGoHome = () => {
    stopSfx(chooseAudioRef);
    stopSfx(introAudioRef);
    introPlayedRef.current = false;
    setShowLetterPicker(false);
    setShowMarungkoStartPicker(false);
    setLocation('/');
    setShowLanding(true);
    setActiveLearner(null);
  };

  const handleSelectLetter = (letter: (typeof allLetters)[number]) => {
    // Only allow selecting unlocked letters in the A-Z quick picker
    if (!isLetterUnlocked(letter.letter, activeLearner?.completedLetters ?? [])) return;
    setCurrentLetter(letter);
    setCurrentPhase('anticipatory');
    setShowLetterPicker(false);
  };

  const handleMarungkoStart = (letter: (typeof allLetters)[number]) => {
    // Guard: if somehow a locked letter is tapped, do nothing
    if (!isLetterUnlocked(letter.letter, activeLearner?.completedLetters ?? [])) return;
    setCurrentLetter(letter);
    setCurrentPhase('instruction');
    setShowMarungkoStartPicker(false);
  };

  const getCurrentLetterIndex = () => {
    if (!currentLetter) return -1;
    return allLetters.findIndex((l) => l.letter === currentLetter.letter);
  };

  const handleBack = () => {
    switch (currentPhase) {
      case 'assessment': setCurrentPhase('independent'); return;
      case 'independent': setCurrentPhase('guided'); return;
      case 'guided': setCurrentPhase('instruction'); return;
      case 'instruction': setCurrentPhase('anticipatory'); return;
      case 'anticipatory': {
        if (!showMarungkoStartPicker) {
          setShowMarungkoStartPicker(true);
          playChooseSound();
          return;
        }
        const currentIndex = getCurrentLetterIndex();
        if (currentIndex > 0) {
          setCurrentLetter(allLetters[currentIndex - 1]);
          setCurrentPhase('assessment');
        } else {
          setShowLanding(true);
        }
        return;
      }
      default: return;
    }
  };

  // ── Landing screen ───────────────────────────────────────────────────────
  if (showLanding) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center p-4"
        style={{
          backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663372738420/5YYiob29hdgWf3rvoHMtnj/home-screen-background-ZZ98N45DQGex9TwQtauwVx.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-fredoka font-bold text-primary mb-2">AlpabeTitik</h1>
            <p className="text-lg text-foreground">Magandang Araw Bata!</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                playBackgroundMusic();
                playIntroSound();
                setShowLearnersModal(true);
                setShowAddForm(true);
              }}
              style={{ width: '100%', background: '#FF6B6B', boxShadow: '0 6px 0 #c94b4b', borderRadius: '18px', border: 'none', height: '56px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '20px', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s' }}
              {...press('#c94b4b')}
            >
              Simulang Matuto 🚀
            </button>

            <button
              onClick={() => { playBackgroundMusic(); playIntroSound(); setShowLearnersModal(true); setShowAddForm(false); }}
              style={{ width: '100%', background: '#1DD1A1', boxShadow: '0 6px 0 #13a077', borderRadius: '18px', border: 'none', height: '56px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '20px', color: '#fff', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s' }}
              {...press('#13a077')}
            >
              👧 Mga Mag-aaral {learners.length > 0 && `(${learners.length})`}
            </button>
          </div>
        </div>

        {/* ── Learners Modal ── */}
        {showLearnersModal && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 50, padding: '16px',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowLearnersModal(false); setShowAddForm(false); setNewName(''); }}}
          >
            <div
              style={{
                background: '#fff', borderRadius: '28px', padding: '28px 24px',
                width: '100%', maxWidth: '420px', maxHeight: '85vh',
                display: 'flex', flexDirection: 'column', gap: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '22px', color: '#FF6B6B' }}>
                  Anong Pangalan Mo?
                </span>
                <button
                  onClick={() => { setShowLearnersModal(false); setShowAddForm(false); setNewName(''); }}
                  style={{ background: '#f0f0f0', border: 'none', borderRadius: '50%', width: '34px', height: '34px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ×
                </button>
              </div>

              {showAddForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '15px', color: '#555', margin: 0 }}>
                    Ilagay ang iyong pangalan:
                  </p>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddLearner(); }}
                    placeholder="Pangalan mo..."
                    maxLength={30}
                    style={{
                      border: '3px solid #FF6B6B', borderRadius: '14px',
                      padding: '12px 16px', fontSize: '18px',
                      fontFamily: 'var(--font-fredoka, sans-serif)',
                      outline: 'none', width: '100%', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={handleAddLearner}
                      disabled={!newName.trim()}
                      style={{
                        flex: 1, background: newName.trim() ? '#FF6B6B' : '#ccc',
                        boxShadow: newName.trim() ? '0 5px 0 #c94b4b' : 'none',
                        borderRadius: '14px', border: 'none', height: '48px',
                        fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
                        fontSize: '17px', color: '#fff', cursor: newName.trim() ? 'pointer' : 'not-allowed',
                      }}
                      {...(newName.trim() ? pressSmall('#c94b4b') : {})}
                    >
                      Maglaro! 🎉
                    </button>
                    {learners.length > 0 && (
                      <button
                        onClick={() => { setShowAddForm(false); setNewName(''); }}
                        style={{
                          background: '#f0f0f0', boxShadow: '0 5px 0 #ccc',
                          borderRadius: '14px', border: 'none', height: '48px',
                          padding: '0 16px', fontFamily: 'var(--font-fredoka, sans-serif)',
                          fontWeight: 700, fontSize: '15px', color: '#555', cursor: 'pointer',
                        }}
                        {...pressSmall('#ccc')}
                      >
                        ← Bumalik
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {learners.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#999', fontFamily: 'var(--font-quicksand, sans-serif)', padding: '20px 0' }}>
                        Wala pang mag-aaral. Magdagdag na!
                      </p>
                    )}
                    {learners.map((learner) => {
                      const color = getAvatarColor(learner.id);
                      return (
                        <div key={learner.id}>
                          {confirmDeleteId === learner.id ? (
                            <div style={{
                              background: '#fff3f3', borderRadius: '16px', padding: '14px 16px',
                              border: '2px solid #FF6B6B', display: 'flex', flexDirection: 'column', gap: '10px',
                            }}>
                              <p style={{ margin: 0, fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '14px', color: '#c94b4b', fontWeight: 700 }}>
                                Tanggalin si {learner.name}? Mawawala ang lahat ng progreso niya.
                              </p>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleDeleteLearner(learner.id)}
                                  style={{ flex: 1, background: '#FF6B6B', boxShadow: '0 4px 0 #c94b4b', borderRadius: '10px', border: 'none', height: '36px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '14px', color: '#fff', cursor: 'pointer' }}
                                >
                                  Oo, tanggalin
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  style={{ flex: 1, background: '#f0f0f0', boxShadow: '0 4px 0 #ccc', borderRadius: '10px', border: 'none', height: '36px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '14px', color: '#555', cursor: 'pointer' }}
                                >
                                  Hindi
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                onClick={() => handleSelectLearner(learner)}
                                style={{
                                  flex: 1, display: 'flex', alignItems: 'center', gap: '14px',
                                  background: '#f9f9f9', border: '2px solid #eee',
                                  borderRadius: '16px', padding: '12px 14px', cursor: 'pointer',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#f9f9f9')}
                              >
                                <div style={{
                                  width: '46px', height: '46px', borderRadius: '50%',
                                  background: color.bg, boxShadow: `0 4px 0 ${color.shadow}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '18px', color: '#fff' }}>
                                    {getInitials(learner.name)}
                                  </span>
                                </div>
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                  <p style={{ margin: 0, fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '18px', color: '#333' }}>
                                    {learner.name}
                                  </p>
                                  {/* Progress bar */}
                                  <div style={{ marginTop: '4px', marginBottom: '2px', width: '100%', height: '6px', background: '#e8e8e8', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${learner.overallProgress ?? 0}%`,
                                      background: `linear-gradient(90deg, ${color.bg}, ${color.shadow})`,
                                      borderRadius: '99px',
                                      transition: 'width 0.4s ease',
                                    }} />
                                  </div>
                                  <p style={{ margin: 0, fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: '#999' }}>
                                    {learner.weekDay?.label || 'Hindi pa nagsimula'} · {learner.completedLetters?.length ?? 0}/{MARUNGKO_ORDER.length} titik
                                  </p>
                                </div>
                                <span style={{ marginLeft: 'auto', fontSize: '20px' }}>▶️</span>
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(learner.id)}
                                style={{
                                  background: '#ffe4e4', border: 'none', borderRadius: '12px',
                                  width: '38px', height: '38px', cursor: 'pointer', fontSize: '16px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{
                      width: '100%', background: '#A29BFE', boxShadow: '0 5px 0 #6c63d4',
                      borderRadius: '14px', border: 'none', height: '48px',
                      fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
                      fontSize: '17px', color: '#fff', cursor: 'pointer',
                    }}
                    {...pressSmall('#6c63d4')}
                  >
                    + Bagong Mag-aaral
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Marungko Start Letter Picker ─────────────────────────────────────────
  if (showMarungkoStartPicker) {
    const completedLetters = activeLearner?.completedLetters ?? [];

    const marungkoSorted = MARUNGKO_ORDER
      .map((ltr) => allLetters.find((l) => l.letter === ltr))
      .filter(Boolean) as (typeof allLetters);

    const tileColors = [
      { bg: '#FF6B6B', shadow: '#c94b4b', text: '#fff' },
      { bg: '#FF9F43', shadow: '#c97a2a', text: '#fff' },
      { bg: '#FECA57', shadow: '#c9a030', text: '#7a5c00' },
      { bg: '#48DBFB', shadow: '#28a7c9', text: '#004d6b' },
      { bg: '#1DD1A1', shadow: '#13a077', text: '#003d2e' },
      { bg: '#FF6B81', shadow: '#c94b5e', text: '#fff' },
      { bg: '#A29BFE', shadow: '#6c63d4', text: '#fff' },
      { bg: '#74B9FF', shadow: '#3d8ed4', text: '#003d6b' },
      { bg: '#55EFC4', shadow: '#2aba94', text: '#003d2e' },
      { bg: '#FD79A8', shadow: '#c94d7a', text: '#fff' },
    ];

    const COLS = 5;
    const colorGrid: number[] = [];
    for (let i = 0; i < marungkoSorted.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const forbidden = new Set<number>();
      if (col > 0) forbidden.add(colorGrid[i - 1]);
      if (row > 0) forbidden.add(colorGrid[i - COLS]);
      let pick = (i * 3 + row * 2 + col * 7) % tileColors.length;
      let tries = 0;
      while (forbidden.has(pick) && tries < tileColors.length) {
        pick = (pick + 1) % tileColors.length;
        tries++;
      }
      colorGrid.push(pick);
    }

    return (
      <div
        style={{
          height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          backgroundImage: "url('/land_bg.png')", backgroundSize: 'cover',
          backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="flex-shrink-0 px-4 pt-4 flex items-center justify-between">
          <button
            onClick={handleGoHome}
            style={{ background: '#FF6B6B', boxShadow: '0 5px 0 #c94b4b', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }}
            {...pressSmall('#c94b4b')}
          >
            Home
          </button>
          {activeLearner && (
            <div style={{
              background: 'rgba(255,255,255,0.88)', borderRadius: '50px', padding: '6px 14px 6px 8px',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 3px 0 rgba(0,0,0,0.1)',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: getAvatarColor(activeLearner.id).bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '11px', color: '#fff' }}>
                  {getInitials(activeLearner.name)}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '14px', color: '#333' }}>
                {activeLearner.name}
              </span>
              <span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '11px', color: '#666', marginLeft: '4px' }}>
                ({activeLearner.weekDay?.label})
              </span>
            </div>
          )}
        </div>

        <style>{`.marungko-grid::-webkit-scrollbar { display: none; }`}</style>
        <div
          className="marungko-grid"
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '12px 16px 16px', gap: '14px',
          }}
        >

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#1DD1A1' }} />
              <span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Natapos na ✓</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FF9F43' }} />
              <span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Susunod na pag-aralan</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#ccc' }} />
              <span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Naka-lock 🔒</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 110px)', gap: '14px', justifyContent: 'center' }}>
            {marungkoSorted.map((letter, idx) => {
              const color = tileColors[colorGrid[idx]];
              const isCompleted = completedLetters.includes(letter.letter.toLowerCase());
              const isUnlocked = isLetterUnlocked(letter.letter, completedLetters);
              const isLocked = !isUnlocked;
              // The very next letter to study (first unlocked + not completed)
              const isNext = isUnlocked && !isCompleted;

              // Visual overrides for lock states
              const tileBg = isLocked
                ? '#d0d0d0'
                : isCompleted
                  ? '#1DD1A1'
                  : isNext
                    ? '#FF9F43'
                    : color.bg;
              const tileShadow = isLocked
                ? '#aaa'
                : isCompleted
                  ? '#13a077'
                  : isNext
                    ? '#c97a2a'
                    : color.shadow;
              const tileText = isLocked
                ? '#999'
                : isCompleted
                  ? '#fff'
                  : isNext
                    ? '#fff'
                    : color.text;

              return (
                <div key={letter.letter} style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      if (isLocked) {
                        // Show a brief "locked" tooltip
                        setLockedTooltipIdx(idx);
                        setTimeout(() => setLockedTooltipIdx(null), 1500);
                        return;
                      }
                      handleMarungkoStart(letter);
                    }}
                    style={{
                      background: tileBg,
                      boxShadow: `0 5px 0 ${tileShadow}`,
                      borderRadius: '16px',
                      border: isCompleted ? '3px solid rgba(255,255,255,0.5)' : isNext ? '3px solid rgba(255,255,255,0.6)' : 'none',
                      width: '110px', height: '110px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      position: 'relative', overflow: 'hidden', flexShrink: 0,
                      opacity: isLocked ? 0.7 : 1,
                    }}
                    onMouseDown={(e) => {
                      if (isLocked) return;
                      e.currentTarget.style.transform = 'translateY(3px)';
                      e.currentTarget.style.boxShadow = `0 2px 0 ${tileShadow}`;
                    }}
                    onMouseUp={(e) => {
                      if (isLocked) return;
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = `0 5px 0 ${tileShadow}`;
                    }}
                    onTouchStart={(e) => {
                      if (isLocked) return;
                      e.currentTarget.style.transform = 'translateY(3px)';
                      e.currentTarget.style.boxShadow = `0 2px 0 ${tileShadow}`;
                    }}
                    onTouchEnd={(e) => {
                      if (isLocked) return;
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = `0 5px 0 ${tileShadow}`;
                    }}
                  >
                    {/* Order number */}
                    <span style={{
                      position: 'absolute', top: '5px', left: '7px',
                      fontSize: '9px', fontFamily: 'var(--font-quicksand, sans-serif)',
                      fontWeight: 700, color: tileText, opacity: 0.7,
                    }}>
                      {idx + 1}
                    </span>

                    {/* Completed checkmark badge */}
                    {isCompleted && (
                      <span style={{
                        position: 'absolute', top: '4px', right: '5px',
                        fontSize: '11px', lineHeight: 1,
                      }}>✓</span>
                    )}

                    {/* Lock icon overlay */}
                    {isLocked && (
                      <span style={{
                        position: 'absolute', top: '4px', right: '5px',
                        fontSize: '11px', lineHeight: 1,
                      }}>🔒</span>
                    )}

                    {/* Letter display */}
                    {isLocked ? (
                      <span style={{ fontSize: '26px', lineHeight: 1 }}>🔒</span>
                    ) : (
                      <>
                        <span style={{ fontSize: '46px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, color: tileText, lineHeight: 1 }}>
                          {letter.uppercase}
                        </span>
                        <span style={{ fontSize: '36px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 600, color: tileText, opacity: 0.85, lineHeight: 1 }}>
                          {letter.lowercase}
                        </span>
                      </>
                    )}

                    {/* "Next!" pulse ring for the very next letter */}
                    {isNext && (
                      <span style={{
                        position: 'absolute', inset: 0, borderRadius: '16px',
                        boxShadow: '0 0 0 3px rgba(255,159,67,0.5)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </button>

                  {/* Locked tooltip */}
                  {lockedTooltipIdx === idx && (
                    <div style={{
                      position: 'absolute', bottom: '88px', left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.78)', color: '#fff',
                      borderRadius: '10px', padding: '6px 10px',
                      fontSize: '11px', fontFamily: 'var(--font-quicksand, sans-serif)',
                      fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10,
                      pointerEvents: 'none',
                    }}>
                      Tapusin muna ang naunang titik!
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pulse animation keyframes */}
          <style>{`
            @keyframes pulse {
              0%, 100% { box-shadow: 0 0 0 3px rgba(255,159,67,0.5); }
              50% { box-shadow: 0 0 0 7px rgba(255,159,67,0.15); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!currentLetter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // ── Main game screen ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        backgroundImage: "url('/land_bg.png')", backgroundSize: 'cover',
        backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="max-w-4xl w-full mx-auto px-4 pt-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={handleGoHome}
              style={{ background: '#FF6B6B', boxShadow: '0 5px 0 #c94b4b', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }}
              {...pressSmall('#c94b4b')}
            >
              Home
            </button>
            <button
              onClick={handleBack}
              style={{ background: '#A29BFE', boxShadow: '0 5px 0 #6c63d4', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }}
              {...pressSmall('#6c63d4')}
            >
              ← Back
            </button>
          </div>

          <div className="relative flex items-center gap-2">
            {activeLearner && (
              <div style={{
                background: 'rgba(255,255,255,0.88)', borderRadius: '50px', padding: '4px 10px 4px 6px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: getAvatarColor(activeLearner.id).bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '10px', color: '#fff' }}>
                    {getInitials(activeLearner.name)}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '13px', color: '#333' }}>
                  {activeLearner.name}
                </span>
              </div>
            )}

            <div className="text-right">
              <p className="text-xs text-foreground/80 leading-none">
                Titik {allLetters.findIndex((l) => l.letter === currentLetter.letter) + 1} sa {allLetters.length}
              </p>
              <p className="font-fredoka font-bold text-xl text-foreground leading-tight">
                {currentLetter.uppercase} / {currentLetter.lowercase}
              </p>
            </div>
            <button
              onClick={() => setShowLetterPicker((prev) => !prev)}
              style={{ background: '#1DD1A1', boxShadow: '0 5px 0 #13a077', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer', flexShrink: 0 }}
              {...pressSmall('#13a077')}
            >
              A-Z
            </button>
            {showLetterPicker && (
              <div className="absolute top-11 right-0 w-64 rounded-2xl bg-white text-foreground shadow-2xl p-3 z-20">
                <p className="text-sm font-fredoka font-bold mb-2 text-primary">Pumili ng titik</p>
                <div className="grid grid-cols-5 gap-2">
                  {allLetters.map((letter) => {
                    const unlocked = isLetterUnlocked(letter.letter, activeLearner?.completedLetters ?? []);
                    const completed = activeLearner?.completedLetters?.includes(letter.letter.toLowerCase());
                    return (
                      <button
                        key={letter.letter}
                        onClick={() => handleSelectLetter(letter)}
                        title={!unlocked ? 'Tapusin muna ang naunang titik!' : ''}
                        className={`h-10 rounded-lg font-fredoka font-bold transition relative ${
                          !unlocked
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : currentLetter.letter === letter.letter
                              ? 'bg-primary text-white'
                              : completed
                                ? 'bg-green-400 text-white'
                                : 'bg-muted hover:bg-accent text-foreground'
                        }`}
                      >
                        {!unlocked ? '🔒' : letter.uppercase}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          width: '100%', display: 'flex', flexDirection: 'column',
        }}
      >
        {currentPhase === 'anticipatory' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
            <h2 className="text-3xl font-fredoka font-bold text-foreground mb-4 text-center">
              HALI NA'T PAG-ARALAN NATIN ANG LETRANG{' '}
              <span className="text-primary">{currentLetter.uppercase}</span>!
            </h2>
            <p className="text-lg text-muted-foreground mb-8 text-center">
              Pindutin ang pindutan para mag simula!
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setCurrentPhase('instruction')}
                style={{ background: '#FF9F43', boxShadow: '0 6px 0 #c97a2a', borderRadius: '18px', border: 'none', height: '64px', padding: '0 40px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '22px', color: '#fff', cursor: 'pointer' }}
                {...press('#c97a2a')}
              >
                Magsimula
              </button>
              <button
                onClick={() => { setShowMarungkoStartPicker(true); playChooseSound(); }}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '14px', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Pumili ng ibang titik
              </button>
            </div>
          </div>
        )}

        {currentPhase === 'instruction' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <LetterInstruction onNext={() => setCurrentPhase('guided')} />
          </div>
        )}

        {currentPhase === 'guided' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <StructuredActivity
              onNext={() => setCurrentPhase('independent')}
              learnerCompletedLetters={activeLearner?.completedLetters || []}
            />
          </div>
        )}

        {currentPhase === 'independent' && (
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
            <StructuredActivity
              mode="independent"
              onNext={() => setCurrentPhase('assessment')}
              learnerCompletedLetters={activeLearner?.completedLetters || []}
            />
          </div>
        )}

        {currentPhase === 'assessment' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <Assessment
              onNext={() => {
                if (currentLetter) {
                  markLetterComplete(currentLetter.letter);
                }
                const currentIndex = allLetters.findIndex((l) => l.letter === currentLetter.letter);
                if (currentIndex < allLetters.length - 1) {
                  setCurrentLetter(allLetters[currentIndex + 1]);
                  setCurrentPhase('anticipatory');
                } else {
                  setShowLanding(true);
                }
              }}
              learnerCompletedLetters={activeLearner?.completedLetters || []}
            />
          </div>
        )}
      </div>
    </div>
  );
}