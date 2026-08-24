import { useApp } from '@/contexts/AppContext';
import { stopCurrentAudio, playAudio } from '@/lib/audio';
import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import LetterInstruction from '@/components/LetterInstruction';
import StructuredActivity from '@/components/StructuredActivity';
import Assessment from '@/components/Assessment';
import AssessCanvas from '@/components/AssessCanvas';
import ReviewRelearn from '@/components/Reviewrelearn';
import { LETTER_DAY_GROUPS, MARUNGKO_ORDER, getDayIndex, getLettersForDay, getPreviousDayLetters, isLastLetterOfDay } from '@/lib/letterDays';

// ── Day groups: each entry is the NEW letters introduced that day ─────────────
// Day 1 = m,s,a  |  Day 2 = i,o,b  |  Day 3 = e,u,t  …
/**
 * Returns which day (1-indexed) just finished after `letterKey` was completed,
 * given the full list of completed letters BEFORE this completion.
 * Returns null if this letter is not the last letter of any day.
 */
// ── Week/Day Mapping ─────────────────────────────────────────────────────────
function calculateWeekDay(completedLetters: string[]): { week: number; day: number; label: string } {
  if (completedLetters.length === 0) {
    return { week: 0, day: 0, label: 'Hindi pa nagsimula' };
  }
  // Find the first letter (in curriculum order) the learner hasn't finished
  // yet — that letter's day IS the day currently being worked on. This
  // matches the orange "next to study" tile on the letter-selection screen.
  const nextLetter = MARUNGKO_ORDER.find((letter) => !completedLetters.includes(letter));

  // No incomplete letter left — every letter (through Z) is done, so the
  // learner has graduated past the last practice day into the assessment day.
  if (!nextLetter) {
    const dayNumber = LETTER_DAY_GROUPS.length + 1;
    return { week: 1, day: dayNumber, label: `Day ${dayNumber}` };
  }

  const dayNumber = getDayIndex(nextLetter) + 1;
  return { week: 1, day: dayNumber, label: `Day ${dayNumber}` };
}

// ── Lock/unlock helper ────────────────────────────────────────────────────────
function isLetterUnlocked(letterKey: string, completedLetters: string[], forceUnlock?: boolean): boolean {
  if (forceUnlock === true) return true;
  const idx = MARUNGKO_ORDER.indexOf(letterKey.toLowerCase());
  if (idx === -1) return false;
  if (idx === 0) return true;
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
  unlockedLetters?: boolean;
  currentDay?: number;
  day10AssessmentCompletedLetters?: string[];
  day20AssessmentCompletedLetters?: string[];
  dayPracticeCompletedLetters?: Record<string, string[]>;
}

const STORAGE_KEY = 'alpabetitik_learners';

function loadLearners(): Learner[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const learners = raw ? JSON.parse(raw) : [];
    return learners.map((l: Learner) => ({
      ...l,
      completedLetters: l.completedLetters || [],
      weekDay: calculateWeekDay(l.completedLetters || []),
      currentDay: l.currentDay ?? ((l.completedLetters || []).length >= MARUNGKO_ORDER.length ? 10 : Math.max(1, calculateWeekDay(l.completedLetters || []).day || 1)),
      day10AssessmentCompletedLetters: l.day10AssessmentCompletedLetters || [],
      day20AssessmentCompletedLetters: l.day20AssessmentCompletedLetters || [],
      dayPracticeCompletedLetters: l.dayPracticeCompletedLetters || {},
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
    weekDay: { week: 0, day: 0, label: 'Hindi pa nagsimula' },
    unlockedLetters: false,
    currentDay: 1,
    day10AssessmentCompletedLetters: [],
    day20AssessmentCompletedLetters: [],
    dayPracticeCompletedLetters: {},
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
  const { currentLetter, setCurrentLetter, currentPhase, setCurrentPhase, currentDay, setCurrentDay, allLetters } = useApp();

  const [showLanding, setShowLanding] = useState(true);
  const [showLetterPicker, setShowLetterPicker] = useState(false);
  const [showMarungkoStartPicker, setShowMarungkoStartPicker] = useState(false);

  // ── Review/Relearn gate state ─────────────────────────────────────────────
  // Stores the day number that just finished — set right before switching to 'review-relearn'
  const [reviewDayNumber, setReviewDayNumber] = useState(1);
  // Discovered letters at the moment the gate triggers (all letters completed up to that point)
  const [reviewDiscoveredLetters, setReviewDiscoveredLetters] = useState<string[]>([]);
  // The next letter to go to after the review passes
  const [pendingNextLetterIdx, setPendingNextLetterIdx] = useState<number | null>(null);

  // Learner modal state
  const [showLearnersModal, setShowLearnersModal] = useState(false);
  const [learners, setLearners] = useState<Learner[]>(loadLearners);
  const [activeLearner, setActiveLearner] = useState<Learner | null>(null);
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Locked-tile tooltip
  const [lockedTooltipIdx, setLockedTooltipIdx] = useState<number | null>(null);

  // Hidden feature: track clicks on SAME locked letter within 2 seconds
  const [lockedLetterClicks, setLockedLetterClicks] = useState(0);
  const [lockedLetterClickTime, setLockedLetterClickTime] = useState<number | null>(null);
  const [lastClickedLockedLetter, setLastClickedLockedLetter] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showDay20CompleteModal, setShowDay20CompleteModal] = useState(false);
  const [showDay10CompleteModal, setShowDay10CompleteModal] = useState(false);

  // Days 11-19 return to normal gameplay with ALL letters unlocked.
  // Day 10 and Day 20 are assessment-only days and should not auto-unlock letters.
  const allLettersUnlocked = activeLearner?.unlockedLetters === true || (currentDay >= 11 && currentDay <= 19);
  const isAdminUnlocked = activeLearner?.unlockedLetters === true;
  const isAssessmentDay = currentDay === 10 || currentDay === 20;

  // Tile label logic:
  // - Day 10 or Day 20 (assessment days): every tile shows the current day, since all 26 letters are being assessed together.
  // - Day 11-19 (replay days): each letter's original day (1-9) is shifted by +10, so Day 1's letters (m,s,a) show "Day 11", Day 2's letters (i,o,b) show "Day 12", etc.
  // - Day 1-9 (first pass): each tile shows its own original day, unchanged.
  const getTileDayLabel = (letterKey: string) => {
    if (isAssessmentDay) return `Day ${currentDay}`;
    if (currentDay >= 11 && currentDay <= 19) return `Day ${getDayIndex(letterKey) + 11}`;
    return `Day ${getDayIndex(letterKey) + 1}`;
  };

  useEffect(() => { setCurrentDay(activeLearner?.currentDay ?? 1); }, [activeLearner?.id, activeLearner?.currentDay, setCurrentDay]);

  const [showAdminGamePicker, setShowAdminGamePicker] = useState(false);
  const [adminGameLetterKey, setAdminGameLetterKey] = useState<string | null>(null);

  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const chooseAudioRef = useRef<HTMLAudioElement | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const introPlayedRef = useRef(false);
  const tingAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    saveLearners(learners);
  }, [learners]);

  // Play the short anticipatory instruction when entering the intro phase
  useEffect(() => {
    if (currentPhase === 'anticipatory') {
      stopCurrentAudio();
      playAudio('/instructions/Instruction_10.mp3');
    }
    return () => { /* no-op */ };
  }, [currentPhase]);

  useEffect(() => {
    tingAudioRef.current = new Audio('/ting.mp3');
    tingAudioRef.current.volume = 1;
    return () => { tingAudioRef.current?.pause(); };
  }, []);

  const playTing = () => {
    const audio = tingAudioRef.current;
    if (!audio) return;
    audio.pause(); audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const stopTing = () => {
    const audio = tingAudioRef.current;
    if (!audio) return;
    audio.pause(); audio.currentTime = 0;
  };

  // ── Mark letter complete, then check if a review gate should trigger ──────
  const markLetterComplete = (letterKey: string) => {
    if (!activeLearner) return null;

    // Snapshot of completedLetters BEFORE this letter
    const completedBefore = activeLearner.completedLetters;
    const isReplayDay = currentDay >= 11 && currentDay <= 19;
    const dayKey = String(currentDay);

    const updatedLearners = learners.map(l => {
      if (l.id === activeLearner.id) {
        const newCompletedLetters = Array.from(new Set([...l.completedLetters, letterKey.toLowerCase()]));
        const weekDay = calculateWeekDay(newCompletedLetters);
        const newDayPractice = isReplayDay
          ? {
              ...(l.dayPracticeCompletedLetters || {}),
              [dayKey]: Array.from(new Set([...(l.dayPracticeCompletedLetters?.[dayKey] || []), letterKey.toLowerCase()])),
            }
          : (l.dayPracticeCompletedLetters || {});
        const updated = {
          ...l,
          completedLetters: newCompletedLetters,
          overallProgress: Math.round((newCompletedLetters.length / MARUNGKO_ORDER.length) * 100),
          weekDay,
          dayPracticeCompletedLetters: newDayPractice,
        };
        setActiveLearner(updated);
        return updated;
      }
      return l;
    });
    setLearners(updatedLearners);

    // Return the day that just finished (null if not a day-end letter)
    return isLastLetterOfDay(letterKey) ? getDayIndex(letterKey) + 1 : null;
  };

  // ── Master unlock all letters via password ──
  const unlockAllLetters = () => {
    if (!activeLearner) return;
    const updatedLearner = { ...activeLearner, unlockedLetters: true };
    const updatedLearners = learners.map(l =>
      l.id === activeLearner.id ? updatedLearner : l
    );
    setLearners(updatedLearners);
    setActiveLearner(updatedLearner);
    const winAudio = new Audio('/win.mp3');
    winAudio.volume = 0.8;
    winAudio.play().catch(console.error);
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError(false);
  };

  const stopSfx = (ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; }
  };

  const playBackgroundMusic = () => {
    if (!backgroundAudioRef.current) {
      backgroundAudioRef.current = new Audio('/Home_bg.mp3');
      backgroundAudioRef.current.loop = true;
      backgroundAudioRef.current.volume = 0.5;
    }
    if (!backgroundAudioRef.current.paused) return;
    backgroundAudioRef.current.play().catch((err) => { console.log('Background music playback failed:', err); });
  };

  const playChooseSound = () => {
    stopSfx(introAudioRef);
    if (!chooseAudioRef.current) {
      chooseAudioRef.current = new Audio('/Choose.mp3');
      chooseAudioRef.current.volume = 1;
    }
    chooseAudioRef.current.currentTime = 0;
    chooseAudioRef.current.play().catch((err) => { console.log('Choose sound playback failed:', err); });
  };

  const playIntroSound = () => {
    if (introPlayedRef.current) return;
    introPlayedRef.current = true;
    stopSfx(chooseAudioRef);
    if (!introAudioRef.current) {
      introAudioRef.current = new Audio('/intro.mp3');
      introAudioRef.current.volume = 1;
    }
    introAudioRef.current.currentTime = 0;
    introAudioRef.current.play().catch((err) => { console.log('Intro sound playback failed:', err); });
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
    stopCurrentAudio();
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
    stopCurrentAudio();
    if (isAssessmentDay) {
      setCurrentLetter(letter);
      setCurrentPhase('independent');
      setShowLetterPicker(false);
      return;
    }
    if (isAdminUnlocked) {
      if (letter?.letter) {
        setCurrentLetter(letter);
        setAdminGameLetterKey(letter.letter);
        setShowAdminGamePicker(true);
        setShowLetterPicker(false);
      }
      return;
    }
    if (!isLetterUnlocked(letter.letter, activeLearner?.completedLetters ?? [], allLettersUnlocked)) return;
    setCurrentLetter(letter);
    setCurrentPhase('anticipatory');
    setShowLetterPicker(false);
  };

  const startAdminGameForLetter = (
    game: 'tracing' | 'draw' | 'listen' | 'look' | 'assessment',
    letter: (typeof allLetters)[number],
  ) => {
    setCurrentLetter(letter);
    switch (game) {
      case 'listen':      setCurrentPhase('guided');          break;
      case 'look':        setCurrentPhase('independent');     break;
      case 'tracing':     setCurrentPhase('assessment');      break;
      case 'draw':        setCurrentPhase('assessment');      break;
      case 'assessment':  setCurrentPhase('drag-assessment'); break;
      default:            setCurrentPhase('instruction');
    }
    setShowAdminGamePicker(false);
    setAdminGameLetterKey(null);
  };

  const handleMarungkoStart = (letter: (typeof allLetters)[number]) => {
    stopCurrentAudio();
    if (!isLetterUnlocked(letter.letter, activeLearner?.completedLetters ?? [], allLettersUnlocked)) return;
    if (isAdminUnlocked) {
      setAdminGameLetterKey(letter.letter);
      setShowAdminGamePicker(true);
      setShowMarungkoStartPicker(false);
      return;
    }
    setCurrentLetter(letter);
    setCurrentPhase(isAssessmentDay ? 'independent' : 'instruction');
    setShowMarungkoStartPicker(false);
  };

  const getCurrentLetterIndex = () => {
    if (!currentLetter) return -1;
    return allLetters.findIndex((l) => l.letter === currentLetter.letter);
  };

  // ── Back navigation ──────────────────────────────────────────────────────
  const handleBack = () => {
    stopCurrentAudio();
    switch (currentPhase) {
      case 'review-relearn':  setCurrentPhase('drag-assessment'); return;
      case 'drag-assessment': setCurrentPhase('assessment');      return;
      case 'assessment':      setCurrentPhase('independent');     return;
      case 'independent':     setCurrentPhase('guided');          return;
      case 'guided':          setCurrentPhase('instruction');     return;
      case 'instruction':     setCurrentPhase('anticipatory');    return;
      case 'anticipatory': {
        if (!showMarungkoStartPicker) {
          setShowMarungkoStartPicker(true);
          playChooseSound();
          return;
        }
        const currentIndex = getCurrentLetterIndex();
        if (currentIndex > 0) {
          setCurrentLetter(allLetters[currentIndex - 1]);
          setCurrentPhase('drag-assessment');
        } else {
          setShowLanding(true);
        }
        return;
      }
      default: return;
    }
  };

  // ── What happens after drag-assessment completes ─────────────────────────
  const completePracticeLetter = (letterKey: string) => {
    if (!activeLearner) return;
    const key = String(currentDay);
    const completed = activeLearner.dayPracticeCompletedLetters?.[key] || [];
    const nextCompleted = Array.from(new Set([...completed, letterKey.toLowerCase()]));
    const done = nextCompleted.length === MARUNGKO_ORDER.length;
    const nextDay = done ? Math.min(currentDay + 1, 20) : currentDay;
    const updated = { ...activeLearner, currentDay: nextDay, dayPracticeCompletedLetters: { ...(activeLearner.dayPracticeCompletedLetters || {}), [key]: nextCompleted } };
    setActiveLearner(updated); setLearners(learners.map(l => l.id === updated.id ? updated : l)); setCurrentDay(nextDay);
    setCurrentLetter(done ? allLetters[0] : allLetters.find(l => !nextCompleted.includes(l.letter)) || allLetters[0]);
    setCurrentPhase('anticipatory');
  };

  const completeAssessmentLetter = (letterKey: string) => {
    if (!activeLearner || !isAssessmentDay) return;
    const field = currentDay === 10 ? 'day10AssessmentCompletedLetters' : 'day20AssessmentCompletedLetters';
    const completed = activeLearner[field] || [];
    const nextCompleted = Array.from(new Set([...completed, letterKey.toLowerCase()]));
    const done = MARUNGKO_ORDER.every((l) => nextCompleted.includes(l));
    const nextDay = currentDay === 10 && done ? 11 : currentDay;
    console.log('[DAY10→11 DEBUG]', {
      letterKey, nextCompletedCount: nextCompleted.length,
      need: MARUNGKO_ORDER.length, missing: MARUNGKO_ORDER.filter(l => !nextCompleted.includes(l)),
      done, currentDay, nextDay,
    });
    const updated = { ...activeLearner, currentDay: nextDay, [field]: nextCompleted };
    setActiveLearner(updated); setLearners(learners.map(l => l.id === updated.id ? updated : l)); setCurrentDay(nextDay);
    if (currentDay === 20 && done) { setShowDay20CompleteModal(true); return; }
    if (currentDay === 10 && done) { setShowDay10CompleteModal(true); return; }
    setCurrentLetter(allLetters.find(l => !nextCompleted.includes(l.letter)) || allLetters[0]);
    // Always show the anticipatory intro for the next letter, whether we're
    // still mid-Day-10/20 or have just advanced to Day 11. The intro screen's
    // "Magsimula" button already knows to route into 'independent' (Look &
    // Circle) on assessment days, so this just adds the missing intro step
    // instead of silently chaining straight into the next letter's game.
    setCurrentPhase('anticipatory');
  };

  const handleDragAssessmentComplete = () => {
    console.log('[REVIEW DEBUG] Assessment complete', { currentLetter: currentLetter?.letter });
    if (!currentLetter) return;
    // If this is an official assessment day (Day 10 or Day 20) record the
    // result in the separate assessment progress list instead of marking the
    // letter as normally completed. This keeps assessment completion distinct
    // from regular practice completion.
    if (isAssessmentDay) {
      completeAssessmentLetter(currentLetter.letter);
      return;
    }
    
    // Snapshot completed letters BEFORE we call markLetterComplete so we can
    // deterministically compute the list of discovered letters (avoids stale
    // reads from `activeLearner` after setState).
    const completedBefore = activeLearner?.completedLetters ?? [];
    const dayJustFinished = markLetterComplete(currentLetter.letter);
    const currentIndex = allLetters.findIndex((l) => l.letter === currentLetter.letter);
    const nextIndex = currentIndex + 1;
    const currentCompleted = Array.from(new Set([...completedBefore, currentLetter.letter.toLowerCase()]));

    // Admin mode: skip the review gate
    if (isAdminUnlocked) {
      if (nextIndex < allLetters.length) {
        setCurrentLetter(allLetters[nextIndex]);
        setCurrentPhase('anticipatory');
      } else {
        // Last letter (z) finished — advance to the correct next day.
        // Day 1-9 (first pass) -> Day 10 (assessment).
        // Day 11-19 (replay) -> next replay day, capped at Day 20 (assessment).
        const nextDayAfterAll = (currentDay >= 11 && currentDay <= 19) ? Math.min(currentDay + 1, 20) : 10;
        if (activeLearner) {
          const updated = { ...activeLearner, currentDay: nextDayAfterAll, completedLetters: currentCompleted, weekDay: calculateWeekDay(currentCompleted) };
          const updatedLearners = learners.map(l => l.id === activeLearner.id ? updated : l);
          setLearners(updatedLearners);
          setActiveLearner(updated);
          setCurrentDay(nextDayAfterAll);
        }
        setShowMarungkoStartPicker(true);
      }
      return;
    }

    // Assessments happen only at day end, so the next letter is necessarily
    // the first of a new day. Review every completed prior day once here.
    if (nextIndex < allLetters.length) {
      console.log('[REVIEW DEBUG] Review gate created', { pendingNextLetterIdx: nextIndex, reviewDiscoveredLetters: currentCompleted, dayJustFinished });
      setReviewDayNumber((dayJustFinished ?? 0) + 1);
      setReviewDiscoveredLetters(getPreviousDayLetters(allLetters[nextIndex].letter));
      setPendingNextLetterIdx(nextIndex);
      // Set the current letter to the next one so the anticipatory intro shows
      setCurrentLetter(allLetters[nextIndex]);
      setCurrentPhase('anticipatory');
      console.log('[REVIEW DEBUG] Next letter intro', { pendingNextLetterIdx: nextIndex });
    } else {
      // No gate — advance normally
      if (nextIndex < allLetters.length) {
        setCurrentLetter(allLetters[nextIndex]);
        setCurrentPhase('anticipatory');
      } else {
        // This was the very last letter (z) — all 26 letters are now
        // completed. Advance the learner into the correct next day.
        // Day 1-9 (first pass) -> Day 10 (assessment).
        // Day 11-19 (replay) -> next replay day, capped at Day 20 (assessment).
        const nextDayAfterAll = (currentDay >= 11 && currentDay <= 19) ? Math.min(currentDay + 1, 20) : 10;
        if (activeLearner) {
          const updated = { ...activeLearner, currentDay: nextDayAfterAll, completedLetters: currentCompleted, weekDay: calculateWeekDay(currentCompleted) };
          const updatedLearners = learners.map(l => l.id === activeLearner.id ? updated : l);
          setLearners(updatedLearners);
          setActiveLearner(updated);
          setCurrentDay(nextDayAfterAll);
        }
        setShowMarungkoStartPicker(true);
      }
    }
  };

  // Called after the independent drawing activity. Non-final letters advance
  // directly; only the last letter of a day enters that day's assessment.
  const handleLetterActivitiesComplete = () => {
    if (!currentLetter) return;
    if (isLastLetterOfDay(currentLetter.letter)) {
      setCurrentPhase('drag-assessment');
      return;
    }

    markLetterComplete(currentLetter.letter);
    const nextIndex = allLetters.findIndex((l) => l.letter === currentLetter.letter) + 1;
    if (nextIndex < allLetters.length) {
      setCurrentLetter(allLetters[nextIndex]);
      setCurrentPhase('anticipatory');
    } else {
      setShowLanding(true);
    }
  };

  // ── Called when learner passes the review gate ───────────────────────────
  const handleReviewComplete = () => {
    if (pendingNextLetterIdx !== null && pendingNextLetterIdx < allLetters.length) {
      setCurrentLetter(allLetters[pendingNextLetterIdx]);
      setPendingNextLetterIdx(null);
      // After finishing the review, proceed directly to the instruction
      // phase for the pending (new or replay) letter so the learner can
      // start the letter games.
      setCurrentPhase('instruction');
    } else {
      setShowLanding(true);
    }
  };

  // Log every change to the currentPhase for debugging
  useEffect(() => {
    console.log('[REVIEW DEBUG] currentPhase:', currentPhase);
  }, [currentPhase]);

  // ── Reusable Password Modal ───────────────────────────────────────────────
  const PasswordModal = () => {
    if (!showPasswordModal || !activeLearner) return null;
    return (
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 60, padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowPasswordModal(false); setPasswordInput(''); setPasswordError(false);
          }
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '28px', padding: '32px 28px',
            width: '100%', maxWidth: '380px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800, fontSize: '24px',
              background: 'linear-gradient(135deg, #fff 0%, #f0f8ff 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              🔓 Unlock All Letters
            </span>
            <button
              onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(false); }}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '16px', color: 'rgba(255,255,255,0.95)', lineHeight: 1.4, textAlign: 'center' }}>
            Enter password to unlock <strong>ALL</strong> letters for {activeLearner.name}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              autoFocus type="password" value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); if (passwordError) setPasswordError(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (passwordInput === 'essak123') unlockAllLetters();
                  else { setPasswordError(true); setTimeout(() => setPasswordError(false), 2000); }
                }
              }}
              placeholder="Password..." maxLength={20}
              style={{
                border: passwordError ? '3px solid #FF6B6B' : '3px solid rgba(255,255,255,0.4)',
                borderRadius: '16px', padding: '16px 20px', fontSize: '18px',
                fontFamily: 'var(--font-fredoka, sans-serif)', background: 'rgba(255,255,255,0.95)',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            {passwordError && (
              <div style={{ background: 'rgba(255,107,107,0.2)', border: '1px solid #FF6B6B', borderRadius: '12px', padding: '12px 16px', color: '#FF6B6B', fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '14px', fontWeight: 600, textAlign: 'center' }}>
                ❌ Wrong password!
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                if (passwordInput === 'essak123') unlockAllLetters();
                else { setPasswordError(true); setTimeout(() => setPasswordError(false), 2000); }
              }}
              disabled={passwordInput.length < 6}
              style={{
                flex: 1,
                background: passwordInput === 'essak123' ? 'linear-gradient(135deg, #1DD1A1, #00B894)' : 'rgba(255,255,255,0.25)',
                boxShadow: passwordInput === 'essak123' ? '0 6px 0 #13a077' : '0 4px 0 rgba(0,0,0,0.2)',
                borderRadius: '16px', border: 'none', height: '52px',
                fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800, fontSize: '18px', color: '#fff',
                cursor: passwordInput.length >= 6 ? 'pointer' : 'not-allowed',
              }}
              {...(passwordInput.length >= 6 ? pressSmall(passwordInput === 'essak123' ? '#13a077' : 'rgba(0,0,0,0.2)') : {})}
            >
              {passwordInput === 'essak123' ? '🎉 Unlock All!' : 'Unlock'}
            </button>
            <button
              onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(false); }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.2)', boxShadow: '0 4px 0 rgba(0,0,0,0.2)', borderRadius: '16px', border: 'none', height: '52px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }}
              {...pressSmall('rgba(0,0,0,0.2)')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Admin Game Picker (modal) ──────────────────────────────────────────────
  const AdminGamePickerModal = () => {
    if (!showAdminGamePicker || !adminGameLetterKey) return null;
    const letterObj = allLetters.find((l) => l.letter === adminGameLetterKey);
    if (!letterObj) return null;

    const ButtonLike = ({ children, onClick, bg, shadow }: { children: React.ReactNode; onClick: () => void; bg: string; shadow: string; }) => (
      <button
        onClick={onClick}
        style={{ flex: 1, background: bg, boxShadow: `0 6px 0 ${shadow}`, border: 'none', borderRadius: 16, height: 54, fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800, fontSize: 18, color: '#fff', cursor: 'pointer' }}
        {...pressSmall(shadow)}
      >
        {children}
      </button>
    );

    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}
        onClick={(e) => { if (e.target === e.currentTarget) { setShowAdminGamePicker(false); setAdminGameLetterKey(null); } }}
      >
        <div style={{ background: 'white', borderRadius: 28, padding: '22px 20px', width: '100%', maxWidth: 720, boxShadow: '0 25px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 900, fontSize: 22, color: '#111' }}>
                Admin Debug: Pick a game for <span style={{ color: '#1DD1A1' }}>{letterObj.uppercase}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: 14, color: '#666', marginTop: 4 }}>
                Pumili ng mini-laro para simulan (puwede laktawan ang iba).
              </div>
            </div>
            <button onClick={() => { setShowAdminGamePicker(false); setAdminGameLetterKey(null); }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 9999, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <ButtonLike bg="#1DD1A1" shadow="#13a077" onClick={() => startAdminGameForLetter('listen', letterObj)}>Pakinggan at Ulitin</ButtonLike>
            <ButtonLike bg="#A29BFE" shadow="#6c63d4" onClick={() => startAdminGameForLetter('look', letterObj)}>Tingnan at Bilugan</ButtonLike>
            <ButtonLike bg="#FF9F43" shadow="#c97a2a" onClick={() => startAdminGameForLetter('tracing', letterObj)}>Larong Sundan</ButtonLike>
            <ButtonLike bg="#48DBFB" shadow="#28a7c9" onClick={() => startAdminGameForLetter('draw', letterObj)}>Guhit (walang gabay)</ButtonLike>
            <ButtonLike bg="#6366f1" shadow="#4f46e5" onClick={() => startAdminGameForLetter('assessment', letterObj)}>Pagsusulit</ButtonLike>
            <button
              onClick={() => { setShowAdminGamePicker(false); setAdminGameLetterKey(null); }}
              style={{ flex: 1, background: 'rgba(0,0,0,0.08)', boxShadow: '0 6px 0 rgba(0,0,0,0.18)', border: 'none', borderRadius: 16, height: 54, fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800, fontSize: 18, color: '#111', cursor: 'pointer' }}
              {...pressSmall('rgba(0,0,0,0.18)')}
            >
              Kanselahin
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Day 20 Complete Modal (Certificate) ───────────────────────────────────
  const Day20CompleteModal = () => {
    if (!showDay20CompleteModal) return null;
    const today = new Date().toLocaleDateString('fil-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 80, padding: '16px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #FFF9E8 0%, #FFF3D6 100%)',
            borderRadius: '24px', padding: '10px',
            width: '100%', maxWidth: '480px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              border: '4px solid #FF9F43', borderRadius: '18px', padding: '30px 26px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              textAlign: 'center', position: 'relative', overflow: 'hidden',
              backgroundImage: 'radial-gradient(circle at top left, rgba(255,159,67,0.08), transparent 60%), radial-gradient(circle at bottom right, rgba(29,209,161,0.08), transparent 60%)',
            }}
          >
            {/* Corner stars */}
            <span style={{ position: 'absolute', top: '10px', left: '14px', fontSize: '20px' }}>⭐</span>
            <span style={{ position: 'absolute', top: '10px', right: '14px', fontSize: '20px' }}>⭐</span>
            <span style={{ position: 'absolute', bottom: '10px', left: '14px', fontSize: '20px' }}>⭐</span>
            <span style={{ position: 'absolute', bottom: '10px', right: '14px', fontSize: '20px' }}>⭐</span>

            <span style={{ fontSize: '48px', lineHeight: 1 }}>🏆</span>

            <p style={{
              margin: 0, fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
              fontSize: '13px', letterSpacing: '2px', color: '#c97a2a', textTransform: 'uppercase',
            }}>
              Sertipiko ng Pagtatapos
            </p>

            <p style={{
              margin: '4px 0 0', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800,
              fontSize: '20px', color: '#333', lineHeight: 1.3,
            }}>
              Ipinagmamalaki naming ipahayag na si
            </p>

            <p style={{
              margin: '2px 0', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800,
              fontSize: 'clamp(26px, 6vw, 34px)', color: '#1DD1A1', lineHeight: 1.2,
              borderBottom: '3px dashed #FF9F43', padding: '4px 18px 10px',
            }}>
              {activeLearner?.name || 'Bata'}
            </p>

            <p style={{
              margin: '6px 0 0', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
              fontSize: '20px', color: '#333', lineHeight: 1.4,
            }}>
              ay natapos ang lahat ng 26 letra ng Marungko sa loob ng 20 araw! 🎉
            </p>

            <p style={{
              margin: '4px 0 12px', fontFamily: 'var(--font-quicksand, sans-serif)', fontWeight: 600,
              fontSize: '13px', color: '#888',
            }}>
              {today}
            </p>

            <button
              onClick={() => { setShowDay20CompleteModal(false); setShowLanding(true); }}
              style={{
                background: '#FF9F43', boxShadow: '0 6px 0 #c97a2a', borderRadius: '18px',
                border: 'none', height: '56px', padding: '0 36px',
                fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800, fontSize: '20px',
                color: '#fff', cursor: 'pointer',
              }}
              {...press('#c97a2a')}
            >
              Yehey! 🎈
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Day 10 Complete Modal (Certificate) ───────────────────────────────────
  const Day10CompleteModal = () => {
    if (!showDay10CompleteModal) return null;
    const today = new Date().toLocaleDateString('fil-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 80, padding: '16px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #FFF9E8 0%, #FFF3D6 100%)',
            borderRadius: '24px', padding: '10px',
            width: '100%', maxWidth: '480px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              border: '4px solid #1DD1A1', borderRadius: '18px', padding: '30px 26px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              textAlign: 'center', position: 'relative', overflow: 'hidden',
              backgroundImage: 'radial-gradient(circle at top left, rgba(29,209,161,0.08), transparent 60%), radial-gradient(circle at bottom right, rgba(72,219,251,0.08), transparent 60%)',
            }}
          >
            <span style={{ position: 'absolute', top: '10px', left: '14px', fontSize: '20px' }}>⭐</span>
            <span style={{ position: 'absolute', top: '10px', right: '14px', fontSize: '20px' }}>⭐</span>
            <span style={{ position: 'absolute', bottom: '10px', left: '14px', fontSize: '20px' }}>⭐</span>
            <span style={{ position: 'absolute', bottom: '10px', right: '14px', fontSize: '20px' }}>⭐</span>

            <span style={{ fontSize: '48px', lineHeight: 1 }}>🏆</span>

            <p style={{
              margin: 0, fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
              fontSize: '13px', letterSpacing: '2px', color: '#13a077', textTransform: 'uppercase',
            }}>
              Sertipiko ng Pagsusulit
            </p>

            <p style={{
              margin: '4px 0 0', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800,
              fontSize: '20px', color: '#333', lineHeight: 1.3,
            }}>
              Ipinagmamalaki naming ipahayag na si
            </p>

            <p style={{
              margin: '2px 0', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800,
              fontSize: 'clamp(26px, 6vw, 34px)', color: '#1DD1A1', lineHeight: 1.2,
              borderBottom: '3px dashed #1DD1A1', padding: '4px 18px 10px',
            }}>
              {activeLearner?.name || 'Bata'}
            </p>

            <p style={{
              margin: '6px 0 0', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700,
              fontSize: '20px', color: '#333', lineHeight: 1.4,
            }}>
              ay natapos ang lahat ng 26 letra hanggang sa Araw 10! 🎉
            </p>

            <p style={{
              margin: '4px 0 12px', fontFamily: 'var(--font-quicksand, sans-serif)', fontWeight: 600,
              fontSize: '13px', color: '#888',
            }}>
              {today}
            </p>

            <button
              onClick={() => {
                setShowDay10CompleteModal(false);
                setCurrentLetter(allLetters[0]);
                setCurrentPhase('anticipatory');
              }}
              style={{
                background: '#1DD1A1', boxShadow: '0 6px 0 #13a077', borderRadius: '18px',
                border: 'none', height: '56px', padding: '0 36px',
                fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 800, fontSize: '20px',
                color: '#fff', cursor: 'pointer',
              }}
              {...press('#13a077')}
            >
              Magpatuloy! 🎈
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Landing screen ───────────────────────────────────────────────────────
  if (showLanding) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center p-4"
        style={{ position: 'relative', backgroundImage: "url('/intro_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 'clamp(24px, 7vh, 72px)',
            transform: 'translateX(-50%)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 'clamp(18px, 5vw, 46px)', width: 'min(96vw, 760px)',
          }}
        >
          <button
            className="landing-btn"
            onClick={() => { playBackgroundMusic(); playIntroSound(); setShowLearnersModal(true); setShowAddForm(true); }}
            aria-label="Simulang Matuto"
            style={{
              width: 'clamp(100px, 32vw, 270px)', border: 'none', background: 'transparent',
              padding: 0, cursor: 'pointer', transition: 'transform 0.1s', fontSize: 0,
              filter: 'drop-shadow(0 0 10px #FFE65A) drop-shadow(0 0 22px rgba(255, 213, 0, 0.8))',
              animation: 'playButtonPulse 1.15s ease-in-out infinite',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(4px) scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(4px) scale(0.98)'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = ''; }}
          >
            <img src="/play_button.png" alt="Simulang Matuto" style={{ display: 'block', width: '100%', height: 'auto' }} />
          </button>
          <button
            className="landing-btn"
            onClick={() => { playBackgroundMusic(); playIntroSound(); setShowLearnersModal(true); setShowAddForm(false); }}
            aria-label="Mga Mag-aaral"
            style={{
              width: 'clamp(150px, 32vw, 270px)', border: 'none', background: 'transparent',
              padding: 0, cursor: 'pointer', transition: 'transform 0.1s', fontSize: 0,
              filter: 'drop-shadow(0 18px 18px rgba(0, 0, 0, 0.38))',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(4px) scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = ''; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            onTouchStart={(e) => { e.currentTarget.style.transform = 'translateY(4px) scale(0.98)'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = ''; }}
          >
            <img src="/acc_button.png" alt="Mga Mag-aaral" style={{ display: 'block', width: '100%', height: 'auto' }} />
          </button>
        </div>

        <style>{`
          @keyframes playButtonPulse {
            0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 10px #FFE65A) drop-shadow(0 0 22px rgba(255, 213, 0, 0.8)); }
            50% { transform: translateY(-8px) scale(1.08); filter: drop-shadow(0 0 16px #FFF27A) drop-shadow(0 0 34px rgba(255, 213, 0, 1)); }
          }
          @media (max-height: 500px) {
            .landing-btn { width: clamp(90px, 18vw, 160px) !important; }
          }
        `}</style>

        {/* ── Learners Modal ── */}
        {showLearnersModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowLearnersModal(false); setShowAddForm(false); setNewName(''); } }}
          >
            <div style={{ background: '#fff', borderRadius: '28px', padding: '28px 24px', width: '100%', maxWidth: '420px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '22px', color: '#FF6B6B' }}>Anong Pangalan Mo?</span>
                <button onClick={() => { setShowLearnersModal(false); setShowAddForm(false); setNewName(''); }} style={{ background: '#f0f0f0', border: 'none', borderRadius: '50%', width: '34px', height: '34px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              {showAddForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '15px', color: '#555', margin: 0 }}>Ilagay ang iyong pangalan:</p>
                  <input
                    autoFocus type="text" value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddLearner(); }}
                    placeholder="Pangalan mo..." maxLength={30}
                    style={{ border: '3px solid #FF6B6B', borderRadius: '14px', padding: '12px 16px', fontSize: '18px', fontFamily: 'var(--font-fredoka, sans-serif)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleAddLearner} disabled={!newName.trim()}
                      style={{ flex: 1, background: newName.trim() ? '#FF6B6B' : '#ccc', boxShadow: newName.trim() ? '0 5px 0 #c94b4b' : 'none', borderRadius: '14px', border: 'none', height: '48px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '17px', color: '#fff', cursor: newName.trim() ? 'pointer' : 'not-allowed' }}
                      {...(newName.trim() ? pressSmall('#c94b4b') : {})}
                    >
                      Maglaro!
                    </button>
                    {learners.length > 0 && (
                      <button
                        onClick={() => { setShowAddForm(false); setNewName(''); }}
                        style={{ background: '#48DBFB', boxShadow: '0 5px 0 #28a7c9', borderRadius: '14px', border: 'none', height: '48px', padding: '0 16px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '15px', color: '#004d6b', cursor: 'pointer' }}
                        {...pressSmall('#28a7c9')}
                      >
                        ← Bumalik
                      </button>
                    )}
                  </div>
                  {learners.length > 0 && (
                    <button
                      onClick={() => { setShowAddForm(false); setNewName(''); }}
                      style={{ width: '100%', background: '#A29BFE', boxShadow: '0 5px 0 #6c63d4', borderRadius: '14px', border: 'none', height: '48px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                      {...pressSmall('#6c63d4')}
                    >
                      May Pangalan na
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {learners.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#999', fontFamily: 'var(--font-quicksand, sans-serif)', padding: '20px 0' }}>Wala pang mag-aaral. Magdagdag na!</p>
                    )}
                    {learners.map((learner) => {
                      const color = getAvatarColor(learner.id);
                      return (
                        <div key={learner.id}>
                          {confirmDeleteId === learner.id ? (
                            <div style={{ background: '#fff3f3', borderRadius: '16px', padding: '14px 16px', border: '2px solid #FF6B6B', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <p style={{ margin: 0, fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '14px', color: '#c94b4b', fontWeight: 700 }}>Tanggalin si {learner.name}? Mawawala ang lahat ng progreso niya.</p>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleDeleteLearner(learner.id)} style={{ flex: 1, background: '#FF6B6B', boxShadow: '0 4px 0 #c94b4b', borderRadius: '10px', border: 'none', height: '36px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '14px', color: '#fff', cursor: 'pointer' }}>Oo, tanggalin</button>
                                <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: '#f0f0f0', boxShadow: '0 4px 0 #ccc', borderRadius: '10px', border: 'none', height: '36px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '14px', color: '#555', cursor: 'pointer' }}>Hindi</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                onClick={() => handleSelectLearner(learner)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px', background: '#f9f9f9', border: '2px solid #eee', borderRadius: '16px', padding: '12px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#f9f9f9')}
                              >
                                <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: color.bg, boxShadow: `0 4px 0 ${color.shadow}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '18px', color: '#fff' }}>{getInitials(learner.name)}</span>
                                </div>
                                <div style={{ textAlign: 'left', flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <p style={{ margin: 0, fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '18px', color: '#333' }}>{learner.name}</p>
                                    {learner.unlockedLetters && (
                                      <span style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-quicksand, sans-serif)', borderRadius: '6px', padding: '2px 6px', lineHeight: 1.4 }}>ADMIN</span>
                                    )}
                                  </div>
                                  <div style={{ marginTop: '4px', marginBottom: '2px', width: '100%', height: '6px', background: '#e8e8e8', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${learner.overallProgress ?? 0}%`, background: `linear-gradient(90deg, ${color.bg}, ${color.shadow})`, borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                  </div>
                                  <p style={{ margin: 0, fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: '#999' }}>
                                    {learner.completedLetters?.length > 0 ? `Day ${learner.currentDay ?? 1}` : 'Hindi pa nagsimula'} · {learner.completedLetters?.length ?? 0}/{MARUNGKO_ORDER.length} titik
                                  </p>
                                </div>
                                <span style={{ marginLeft: 'auto', fontSize: '20px' }}>▶️</span>
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(learner.id)}
                                style={{ background: '#ffe4e4', borderRadius: '12px', width: '38px', height: '38px', cursor: 'pointer', fontSize: '16px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >🗑️</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{ width: '100%', background: '#A29BFE', boxShadow: '0 5px 0 #6c63d4', borderRadius: '14px', border: 'none', height: '48px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '17px', color: '#fff', cursor: 'pointer' }}
                    {...pressSmall('#6c63d4')}
                  >
                    + Bagong Mag-aaral
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <PasswordModal />
      </div>
    );
  }

  // ── Marungko Start Letter Picker ──────────────────────────────────────────
  if (showMarungkoStartPicker) {
    const completedLetters = activeLearner?.completedLetters ?? [];
    const marungkoSorted = MARUNGKO_ORDER.map((ltr) => allLetters.find((l) => l.letter === ltr)).filter(Boolean) as (typeof allLetters);

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
      const col = i % COLS, row = Math.floor(i / COLS);
      const forbidden = new Set<number>();
      if (col > 0) forbidden.add(colorGrid[i - 1]);
      if (row > 0) forbidden.add(colorGrid[i - COLS]);
      let pick = (i * 3 + row * 2 + col * 7) % tileColors.length;
      let tries = 0;
      while (forbidden.has(pick) && tries < tileColors.length) { pick = (pick + 1) % tileColors.length; tries++; }
      colorGrid.push(pick);
    }

    return (
      <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundImage: "url('/land_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
        <div className="flex-shrink-0 px-4 pt-4 flex items-center justify-between">
          <button onClick={handleGoHome} style={{ background: '#FF6B6B', boxShadow: '0 5px 0 #c94b4b', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }} {...pressSmall('#c94b4b')}>Home</button>
          {activeLearner && (
            <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: '50px', padding: '6px 14px 6px 8px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 3px 0 rgba(0,0,0,0.1)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getAvatarColor(activeLearner.id).bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '11px', color: '#fff' }}>{getInitials(activeLearner.name)}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '14px', color: '#333' }}>{activeLearner.name}</span>
              {activeLearner.unlockedLetters && <span style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-quicksand, sans-serif)', borderRadius: '6px', padding: '2px 6px', lineHeight: 1.4 }}>ADMIN</span>}
              <span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '11px', color: '#666', marginLeft: '2px' }}>(Day {currentDay})</span>
            </div>
          )}
        </div>

        <style>{`
          .marungko-grid::-webkit-scrollbar { display: none; }
          @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 3px rgba(255,159,67,0.5); }
            50% { box-shadow: 0 0 0 7px rgba(255,159,67,0.15); }
          }
          .letter-tile-unlocked { transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, filter 0.15s ease !important; }
          .letter-tile-unlocked:hover { transform: translateY(-4px) scale(1.08) !important; filter: brightness(1.12) saturate(1.2); }
          @media (max-height: 500px) {
            .letter-tile-btn { width: 68px !important; height: 68px !important; }
            .letter-tile-grid { grid-template-columns: repeat(7, 68px) !important; }
            .letter-tile-day-label { font-size: 8px !important; }
            .letter-tile-upper { font-size: 22px !important; }
            .letter-tile-lower { font-size: 16px !important; }
          }
        `}</style>

        <div className="marungko-grid" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 'clamp(8px, 2vh, 16px)', gap: 'clamp(8px, 2vh, 14px)' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {currentDay < 10 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#1DD1A1' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Natapos na ✓</span></div>
            )}
            {currentDay < 10 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FF9F43' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Susunod na pag-aralan</span></div>
            )}
            {currentDay < 10 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#ccc' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Naka-lock 🔒</span></div>
            )}
            {(currentDay === 10 || currentDay === 20) && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#1DD1A1' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Susunod na susuriin</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#3B82F6' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Naisagawa na ang pagsusulit</span></div>
              </>
            )}
            {currentDay >= 11 && currentDay <= 19 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#A29BFE' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Puwedeng laruin</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#FD79A8' }} /><span style={{ fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: '12px', color: 'rgba(0,0,0,0.6)', fontWeight: 600 }}>Natapos ngayong araw ✓</span></div>
              </>
            )}
          </div>

          <div className="letter-tile-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(58px, 15vmin, 110px), clamp(58px, 15vmin, 110px)))', gap: 'clamp(8px, 2vmin, 14px)', justifyContent: 'center', width: 'min(96vw, 760px)' }}>
            {marungkoSorted.map((letter, idx) => {
              const color = tileColors[colorGrid[idx]];
              const isCompleted = completedLetters.includes(letter.letter.toLowerCase());
              const isUnlocked = isLetterUnlocked(letter.letter, completedLetters, allLettersUnlocked);
              const isLocked = !isUnlocked;
              const isNext = isUnlocked && !isCompleted;

              // On Day 10 / Day 20, all letters are already unlocked+green
              // from prior progression — so we need a separate signal for
              // "has this letter's Look & Circle assessment specifically
              // been passed today" to show blue instead of green.
              const assessmentCompletedList = currentDay === 10
                ? (activeLearner?.day10AssessmentCompletedLetters ?? [])
                : currentDay === 20
                  ? (activeLearner?.day20AssessmentCompletedLetters ?? [])
                  : [];
              const isAssessedToday = isAssessmentDay && assessmentCompletedList.includes(letter.letter.toLowerCase());

              const isReplayDayRange = currentDay >= 11 && currentDay <= 19;
              const replayCompletedList = isReplayDayRange
                ? (activeLearner?.dayPracticeCompletedLetters?.[String(currentDay)] ?? [])
                : [];
              const isReplayedToday = isReplayDayRange && replayCompletedList.includes(letter.letter.toLowerCase());

              const tileBg = isLocked ? '#d0d0d0' : isAssessedToday ? '#3B82F6' : isAssessmentDay ? '#1DD1A1' : isReplayedToday ? '#FD79A8' : isReplayDayRange ? '#A29BFE' : isCompleted ? '#1DD1A1' : isNext ? '#FF9F43' : color.bg;
              const tileShadow = isLocked ? '#aaa' : isAssessedToday ? '#1D4ED8' : isAssessmentDay ? '#13a077' : isReplayedToday ? '#c94d7a' : isReplayDayRange ? '#6c63d4' : isCompleted ? '#13a077' : isNext ? '#c97a2a' : color.shadow;
              const tileText = isLocked ? '#999' : isAssessedToday ? '#fff' : isAssessmentDay ? '#fff' : isReplayedToday ? '#fff' : isReplayDayRange ? '#fff' : isCompleted ? '#fff' : isNext ? '#fff' : color.text;
              return (
                <div key={letter.letter} style={{ position: 'relative' }}>
                  <button
                    className={`letter-tile-btn${!isLocked ? ' letter-tile-unlocked' : ''}`}
                    onClick={() => {
                      if (isLocked) {
                        const now = Date.now();
                        setLockedTooltipIdx(idx);
                        setTimeout(() => setLockedTooltipIdx(null), 1500);
                        if (lastClickedLockedLetter === letter.letter && lockedLetterClickTime !== null && now - lockedLetterClickTime <= 2000) {
                          const newCount = lockedLetterClicks + 1;
                          setLockedLetterClickTime(now);
                          setLockedLetterClicks(newCount);
                          if (newCount >= 4) { setShowPasswordModal(true); setLockedLetterClicks(0); setLastClickedLockedLetter(null); setLockedLetterClickTime(null); }
                        } else { setLockedLetterClicks(1); setLastClickedLockedLetter(letter.letter); setLockedLetterClickTime(now); }
                        return;
                      }
                      handleMarungkoStart(letter);
                    }}
                    onMouseEnter={(e) => { if (isLocked) return; playTing(); e.currentTarget.style.boxShadow = `0 8px 0 ${tileShadow}, 0 0 18px 4px ${tileBg}99`; }}
                    onMouseLeave={(e) => { if (isLocked) return; stopTing(); e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 5px 0 ${tileShadow}`; e.currentTarget.style.filter = ''; }}
                    onMouseDown={(e) => { if (isLocked) return; e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 2px 0 ${tileShadow}`; }}
                    onMouseUp={(e) => { if (isLocked) return; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 5px 0 ${tileShadow}`; }}
                    onTouchStart={(e) => { if (isLocked) return; playTing(); e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 2px 0 ${tileShadow}`; }}
                    onTouchEnd={(e) => { if (isLocked) return; stopTing(); e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 5px 0 ${tileShadow}`; }}
                    style={{ background: tileBg, boxShadow: `0 5px 0 ${tileShadow}`, borderRadius: '16px', border: isCompleted ? '3px solid rgba(255,255,255,0.5)' : isNext ? '3px solid rgba(255,255,255,0.6)' : 'none', width: 'clamp(58px, 15vmin, 110px)', height: 'clamp(58px, 15vmin, 110px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: isLocked ? 'not-allowed' : 'pointer', position: 'relative', overflow: 'hidden', flexShrink: 0, opacity: isLocked ? 0.7 : 1 }}
                  >
                    <span className="letter-tile-day-label" style={{ position: 'absolute', top: '5px', left: '7px', fontSize: '9px', fontFamily: 'var(--font-quicksand, sans-serif)', fontWeight: 700, color: tileText, opacity: 0.7 }}>{getTileDayLabel(letter.letter)}</span>
                    {isCompleted && <span style={{ position: 'absolute', top: '4px', right: '5px', fontSize: '11px', lineHeight: 1 }}>✓</span>}
                    {isLocked && <span style={{ position: 'absolute', top: '4px', right: '5px', fontSize: '11px', lineHeight: 1 }}>🔒</span>}
                    {isLocked ? (
                      <span style={{ fontSize: '26px', lineHeight: 1 }}>🔒</span>
                    ) : (
                      <>
                        <span className="letter-tile-upper" style={{ fontSize: 'clamp(26px, 6.2vmin, 46px)', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, color: tileText, lineHeight: 1 }}>{letter.uppercase}</span>
                        <span className="letter-tile-lower" style={{ fontSize: 'clamp(20px, 5vmin, 36px)', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 600, color: tileText, opacity: 0.85, lineHeight: 1 }}>{letter.lowercase}</span>
                      </>
                    )}
                    {isNext && <span style={{ position: 'absolute', inset: 0, borderRadius: '16px', boxShadow: '0 0 0 3px rgba(255,159,67,0.5)', animation: 'pulse 1.5s ease-in-out infinite', pointerEvents: 'none' }} />}
                  </button>
                  {lockedTooltipIdx === idx && (
                    <div style={{ position: 'absolute', bottom: 'calc(clamp(58px, 15vmin, 110px) - 22px)', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.78)', color: '#fff', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', fontFamily: 'var(--font-quicksand, sans-serif)', fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
                      Tapusin muna ang naunang titik!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <PasswordModal />
        <AdminGamePickerModal />
      </div>
    );
  }

  if (!currentLetter) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  // ── Main game screen ──────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundImage: "url('/land_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
      <div className="max-w-4xl w-full mx-auto px-4 pt-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button onClick={handleGoHome} style={{ background: '#FF6B6B', boxShadow: '0 5px 0 #c94b4b', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }} {...pressSmall('#c94b4b')}>Home</button>
            <button onClick={handleBack} style={{ background: '#A29BFE', boxShadow: '0 5px 0 #6c63d4', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer' }} {...pressSmall('#6c63d4')}>← Back</button>
          </div>

          <div className="relative flex items-center gap-2">
            {activeLearner && (
              <div style={{ background: 'rgba(255,255,255,0.88)', borderRadius: '50px', padding: '4px 10px 4px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: getAvatarColor(activeLearner.id).bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '10px', color: '#fff' }}>{getInitials(activeLearner.name)}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '13px', color: '#333' }}>{activeLearner.name}</span>
                {activeLearner.unlockedLetters && <span style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-quicksand, sans-serif)', borderRadius: '6px', padding: '2px 6px', lineHeight: 1.4 }}>ADMIN</span>}
              </div>
            )}
            <div className="text-right">
              {/* Hide letter label during review so it doesn't confuse */}
              {currentPhase !== 'review-relearn' && (
                <>
                  <p className="text-xs text-foreground/80 leading-none">Titik {allLetters.findIndex((l) => l.letter === currentLetter.letter) + 1} sa {allLetters.length}</p>
                  <p className="font-fredoka font-bold text-xl text-foreground leading-tight">{currentLetter.uppercase} / {currentLetter.lowercase}</p>
                </>
              )}
              {currentPhase === 'review-relearn' && (
                <p className="font-fredoka font-bold text-foreground leading-tight" style={{ fontSize: 'clamp(13px,3vmin,18px)' }}>Review at Relearn 🔁</p>
              )}
            </div>
            <button onClick={() => setShowLetterPicker((prev) => !prev)} style={{ background: '#1DD1A1', boxShadow: '0 5px 0 #13a077', borderRadius: '14px', border: 'none', padding: '0 18px', height: '42px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '16px', color: '#fff', cursor: 'pointer', flexShrink: 0 }} {...pressSmall('#13a077')}>A-Z</button>
            {showLetterPicker && (
              <div className="absolute top-11 right-0 w-64 rounded-2xl bg-white text-foreground shadow-2xl p-3 z-20">
                <p className="text-sm font-fredoka font-bold mb-2 text-primary">Pumili ng titik</p>
                <div className="grid grid-cols-5 gap-2">
                  {allLetters.map((letter) => {
                    const unlocked = isLetterUnlocked(letter.letter, activeLearner?.completedLetters ?? [], allLettersUnlocked);
                    const completed = activeLearner?.completedLetters?.includes(letter.letter.toLowerCase());
                    return (
                      <button
                        key={letter.letter}
                        onClick={() => handleSelectLetter(letter)}
                        onMouseEnter={() => { if (unlocked) playTing(); }}
                        onMouseLeave={() => { if (unlocked) stopTing(); }}
                        title={!unlocked ? 'Tapusin muna ang naunang titik!' : ''}
                        className={`h-10 rounded-lg font-fredoka font-bold transition relative ${!unlocked ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : currentLetter.letter === letter.letter ? 'bg-primary text-white' : completed ? 'bg-green-400 text-white' : 'bg-muted hover:bg-accent hover:scale-110 text-foreground'}`}
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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', width: '100%', display: 'flex', flexDirection: 'column' }}>

        {currentPhase === 'anticipatory' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(8px, 2vh, 16px)' }}>
            <h2 className="font-fredoka font-bold text-foreground mb-4 text-center" style={{ fontSize: 'clamp(20px, 5vmin, 30px)', lineHeight: 1.15 }}>
              HALI NA'T PAG-ARALAN NATIN ANG LETRANG <span className="text-primary">{currentLetter.uppercase}</span>!
            </h2>
            <p className="text-foreground mb-8 text-center guide-text small" style={{ fontSize: 'clamp(18px, 4vmin, 24px)' }}>Pindutin ang pindutan para magsimula!</p>
            <div className="flex flex-col items-center gap-3">
                <button onClick={() => {
                // If there's a pending next letter guarded by review, start review first
                console.log('Magsimula pressed — pendingNextLetterIdx:', pendingNextLetterIdx, 'reviewDiscoveredLetters:', reviewDiscoveredLetters);
                if (pendingNextLetterIdx !== null && (reviewDiscoveredLetters?.length ?? 0) > 0) {
                  console.log('[REVIEW DEBUG] ENTERING REVIEW & RELEARN');
                  setCurrentPhase('review-relearn');
                } else if (isAssessmentDay) {
                  // On assessment days (Day 10 & 20) jump straight to the independent
                  // Listen & Circle assessment (no instruction/guided phases).
                  setCurrentPhase('independent');
                } else {
                  setCurrentPhase('instruction');
                }
              }} style={{ background: '#FF9F43', boxShadow: '0 6px 0 #c97a2a', borderRadius: '18px', border: 'none', height: '64px', padding: '0 40px', fontFamily: 'var(--font-fredoka, sans-serif)', fontWeight: 700, fontSize: '22px', color: '#fff', cursor: 'pointer' }} {...press('#c97a2a')}>Magsimula</button>
              <button onClick={() => { setShowMarungkoStartPicker(true); playChooseSound(); }} className="guide-text small" style={{ background: 'none', border: 'none', fontFamily: 'var(--font-quicksand, sans-serif)', fontSize: 'clamp(16px, 3.5vmin, 20px)', color: '#000', cursor: 'pointer', textDecoration: 'underline' }}>← Pumili ng ibang titik</button>
            </div>
          </div>
        )}

        {currentPhase === 'instruction' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 clamp(8px, 2vw, 16px) clamp(8px, 2vh, 16px)', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <LetterInstruction onNext={() => setCurrentPhase('guided')} />
          </div>
        )}

        {currentPhase === 'guided' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 clamp(8px, 2vw, 16px) clamp(8px, 2vh, 16px)', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <StructuredActivity onNext={() => setCurrentPhase('independent')} learnerCompletedLetters={activeLearner?.completedLetters || []} />
          </div>
        )}

        {currentPhase === 'independent' && (
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
            <StructuredActivity
              mode="independent"
              onNext={() => {
                // Day 10 & Day 20 are assessment-only days — Look & Circle IS the
                // whole assessment. Skip the free-draw game and record this
                // letter's assessment result directly instead of routing through
                // the normal 'assessment' (AssessCanvas) phase.
                if (isAssessmentDay && currentLetter) {
                  completeAssessmentLetter(currentLetter.letter);
                } else {
                  setCurrentPhase('assessment');
                }
              }}
              learnerCompletedLetters={activeLearner?.completedLetters || []}
            />
          </div>
        )}  

        {currentPhase === 'assessment' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 clamp(8px, 2vw, 16px) clamp(8px, 2vh, 16px)', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <AssessCanvas onNext={handleLetterActivitiesComplete} learnerCompletedLetters={activeLearner?.completedLetters || []} />
          </div>
        )}

        {currentPhase === 'drag-assessment' && (
          <div style={{ flex: 1, minHeight: 0, padding: '0 clamp(8px, 2vw, 16px) clamp(8px, 2vh, 16px)', maxWidth: '56rem', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
            <Assessment
              learnerCompletedLetters={activeLearner?.completedLetters || []}
              assessmentLetters={currentLetter ? getLettersForDay(currentLetter.letter) : []}
              onNext={handleDragAssessmentComplete}
            />
          </div>
        )}

        {/* ── Review & Relearn gate ─────────────────────────────────────── */}
        {currentPhase === 'review-relearn' && (
          <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
            <ReviewRelearn
              discoveredLetters={reviewDiscoveredLetters}
              allLetters={allLetters}
              dayNumber={reviewDayNumber}
              onComplete={handleReviewComplete}
            />
          </div>
        )}

      </div>

      <PasswordModal />
      <AdminGamePickerModal />
      <Day20CompleteModal />
      <Day10CompleteModal />
    </div>
  );
}
