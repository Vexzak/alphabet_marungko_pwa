import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface LetterProgress {
  letter: string;
  uppercase: string;
  lowercase: string;
  sound: string;
  exampleWord: string;
  completed: boolean;
  tracingCompleted: boolean;
  listeningCompleted: boolean;
  assessmentScore: number;
}

export interface LetterAsset {
  word: string;
  image: string;
  sound: string;
}

export interface AppContextType {
  currentLetter: LetterProgress | null;
  setCurrentLetter: (letter: LetterProgress | null) => void;
  letterProgress: Record<string, LetterProgress>;
  updateLetterProgress: (letter: string, progress: Partial<LetterProgress>) => void;
  currentPhase: 'anticipatory' | 'instruction' | 'guided' | 'independent' | 'assessment';
  setCurrentPhase: (phase: 'anticipatory' | 'instruction' | 'guided' | 'independent' | 'assessment') => void;
  allLetters: LetterProgress[];
  overallProgress: number;
  consumeNextAsset: () => LetterAsset | null;
  peekCurrentAsset: () => LetterAsset | null;
  advanceQueue: (steps?: number) => void;
  resetAssetQueue: () => void;
  // 🔧 FIX: expose a reset for new user sessions
  resetForNewUser: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LETTER_ASSETS: Record<string, LetterAsset[]> = {
  m: [
    { word: 'mango',    image: '/letters/M-mango.png',    sound: '/sounds/M_mango.mp3'    },
    { word: 'manok',    image: '/letters/M-manok.png',    sound: '/sounds/M_manok.mp3'    },
    { word: 'motor',    image: '/letters/M-motor.png',    sound: '/sounds/M_motor.mp3'    },
    { word: 'medyas',   image: '/letters/M-medyas.png',   sound: '/sounds/M_medyas.mp3'   },
    { word: 'malungay', image: '/letters/M-malungay.png', sound: '/sounds/M_malungay.mp3' },
  ],
  s: [
    { word: 'susi',    image: '/letters/S-susi.png',    sound: '/sounds/S_susi.mp3'    },
    { word: 'saging',    image: '/letters/S-saging.png',    sound: '/sounds/S_saging.mp3'    },
    { word: 'sarangola',    image: '/letters/S-sarangola.png',    sound: '/sounds/S_sarangola.mp3'    },
    { word: 'sapatos',   image: '/letters/S-sapatos.png',   sound: '/sounds/S_sapatos.mp3'   },
    { word: 'sandok', image: '/letters/S-sandok.png', sound: '/sounds/S_sandok.mp3' },
  ],
  a: [
    { word: 'agila',    image: '/letters/A-agila.png',    sound: '/sounds/A_agila.mp3'    },
    { word: 'apoy',    image: '/letters/A-apoy.png',    sound: '/sounds/A_apoy.mp3'    },
    { word: 'aso',    image: '/letters/A-aso.png',    sound: '/sounds/A_aso.mp3'    },
    { word: 'aklat',   image: '/letters/A-aklat.png',   sound: '/sounds/A_aklat.mp3'   },
    { word: 'araw', image: '/letters/A-araw.png', sound: '/sounds/A_araw.mp3' },
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(letter: string): LetterAsset[] {
  const assets = LETTER_ASSETS[letter.toLowerCase()];
  if (!assets || assets.length === 0) return [];
  return shuffle(assets);
}

const MARUNGKO_LETTERS: LetterProgress[] = [
  { letter: 'm', uppercase: 'M', lowercase: 'm', sound: '/m/', exampleWord: 'mesa',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 's', uppercase: 'S', lowercase: 's', sound: '/s/', exampleWord: 'araw',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'a', uppercase: 'A', lowercase: 'a', sound: '/a/', exampleWord: 'araw',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'i', uppercase: 'I', lowercase: 'i', sound: '/i/', exampleWord: 'ibon',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'o', uppercase: 'O', lowercase: 'o', sound: '/o/', exampleWord: 'oras',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'b', uppercase: 'B', lowercase: 'b', sound: '/b/', exampleWord: 'bahay',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'e', uppercase: 'E', lowercase: 'e', sound: '/e/', exampleWord: 'espesyal',  completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'u', uppercase: 'U', lowercase: 'u', sound: '/u/', exampleWord: 'ulo',       completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 't', uppercase: 'T', lowercase: 't', sound: '/t/', exampleWord: 'tao',       completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'k', uppercase: 'K', lowercase: 'k', sound: '/k/', exampleWord: 'kain',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'l', uppercase: 'L', lowercase: 'l', sound: '/l/', exampleWord: 'laya',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'y', uppercase: 'Y', lowercase: 'y', sound: '/y/', exampleWord: 'yaya',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'n', uppercase: 'N', lowercase: 'n', sound: '/n/', exampleWord: 'niyog',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'g', uppercase: 'G', lowercase: 'g', sound: '/g/', exampleWord: 'gabi',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'h', uppercase: 'H', lowercase: 'h', sound: '/h/', exampleWord: 'halika',    completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'p', uppercase: 'P', lowercase: 'p', sound: '/p/', exampleWord: 'puso',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'r', uppercase: 'R', lowercase: 'r', sound: '/r/', exampleWord: 'rosas',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'd', uppercase: 'D', lowercase: 'd', sound: '/d/', exampleWord: 'dalan',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'c', uppercase: 'C', lowercase: 'c', sound: '/k/', exampleWord: 'calamansi', completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'j', uppercase: 'J', lowercase: 'j', sound: '/j/', exampleWord: 'jusi',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'f', uppercase: 'F', lowercase: 'f', sound: '/f/', exampleWord: 'flan',      completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'v', uppercase: 'V', lowercase: 'v', sound: '/v/', exampleWord: 'violeta',   completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'z', uppercase: 'Z', lowercase: 'z', sound: '/z/', exampleWord: 'zapatos',   completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'q', uppercase: 'Q', lowercase: 'q', sound: '/k/', exampleWord: 'queen',     completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
  { letter: 'x', uppercase: 'X', lowercase: 'x', sound: '/ks/', exampleWord: 'xilofon', completed: false, tracingCompleted: false, listeningCompleted: false, assessmentScore: 0 },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentLetter, setCurrentLetter] = useState<LetterProgress | null>(MARUNGKO_LETTERS[0]);
  const [currentPhase, setCurrentPhase] = useState<'anticipatory' | 'instruction' | 'guided' | 'independent' | 'assessment'>('anticipatory');

  const [letterProgress, setLetterProgress] = useState<Record<string, LetterProgress>>(() => {
    const saved = localStorage.getItem('marungko-progress');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse saved progress:', e); }
    }
    const initial: Record<string, LetterProgress> = {};
    MARUNGKO_LETTERS.forEach((letter) => { initial[letter.letter] = letter; });
    return initial;
  });

  useEffect(() => {
    localStorage.setItem('marungko-progress', JSON.stringify(letterProgress));
  }, [letterProgress]);

  const updateLetterProgress = (letter: string, progress: Partial<LetterProgress>) => {
    setLetterProgress((prev) => ({ ...prev, [letter]: { ...prev[letter], ...progress } }));
  };

  // ── Shared asset queue ──────────────────────────────────────────────────────
  // Initialised eagerly from MARUNGKO_LETTERS[0] so the queue is ready on the
  // very first render — no useEffect delay.
  const queueRef      = useRef<LetterAsset[]>(buildQueue(MARUNGKO_LETTERS[0].letter));
  const queueIndexRef = useRef<number>(0);
  const queueLetterRef = useRef<string>(MARUNGKO_LETTERS[0].letter);

  const rebuildAssetQueue = useCallback((letter: string) => {
    queueLetterRef.current = letter;
    queueRef.current = buildQueue(letter);
    queueIndexRef.current = 0;
  }, []);

  const setCurrentLetterAndQueue = useCallback((letter: LetterProgress | null) => {
    if (letter) {
      rebuildAssetQueue(letter.letter);
    } else {
      queueLetterRef.current = '';
      queueRef.current = [];
      queueIndexRef.current = 0;
    }
    setCurrentLetter(letter);
  }, [rebuildAssetQueue]);

  // 🔧 FIX: depend on the whole currentLetter object (not just .letter string).
  // When a new user is created, currentLetter may be replaced with a *new object*
  // that has the same .letter value ('m'). The old dep [currentLetter?.letter]
  // saw no change and skipped — leaving the queue stale. Depending on the full
  // object reference catches that case.
  useEffect(() => {
    if (!currentLetter) return;
    if (queueLetterRef.current !== currentLetter.letter) {
      rebuildAssetQueue(currentLetter.letter);
    }
  }, [currentLetter]); // 🔧 whole object, not currentLetter?.letter

  // 🔧 FIX: resetForNewUser — called right after a new kid profile is created.
  // Resets letter, phase, AND the queue atomically so nothing is stale.
  const resetForNewUser = useCallback(() => {
    const first = MARUNGKO_LETTERS[0];
    // Reset queue first (synchronous, ref-based — no race)
    rebuildAssetQueue(first.letter);
    // Then update React state (triggers re-render with clean data)
    setCurrentLetter({ ...first }); // spread → new object reference → useEffect above also fires as a safety net
    setCurrentPhase('anticipatory');
  }, [rebuildAssetQueue]);

  const resetAssetQueue = useCallback(() => {
    if (!currentLetter) return;
    rebuildAssetQueue(currentLetter.letter);
  }, [currentLetter, rebuildAssetQueue]);

  const peekCurrentAsset = useCallback((): LetterAsset | null => {
    const q = queueRef.current;
    if (!q.length) return null;
    return q[queueIndexRef.current % q.length];
  }, []);

  const consumeNextAsset = useCallback((): LetterAsset | null => {
    const q = queueRef.current;
    if (!q.length) return null;

    const asset = q[queueIndexRef.current % q.length];
    queueIndexRef.current += 1;

    if (queueIndexRef.current >= q.length) {
      queueRef.current      = buildQueue(queueLetterRef.current);
      queueIndexRef.current = 0;
    }

    return asset;
  }, []);

  const advanceQueue = useCallback((steps = 1) => {
    const q = queueRef.current;
    if (!q.length) return;
    queueIndexRef.current = (queueIndexRef.current + steps) % q.length;
    if (queueIndexRef.current === 0) {
      queueRef.current = buildQueue(queueLetterRef.current);
    }
  }, []);

  const allLetters        = MARUNGKO_LETTERS;
  const completedLetters  = Object.values(letterProgress).filter((l) => l.completed).length;
  const overallProgress   = (completedLetters / allLetters.length) * 100;

  return (
    <AppContext.Provider
      value={{
        currentLetter,
        setCurrentLetter: setCurrentLetterAndQueue,
        letterProgress,
        updateLetterProgress,
        currentPhase,
        setCurrentPhase,
        allLetters,
        overallProgress,
        consumeNextAsset,
        peekCurrentAsset,
        advanceQueue,
        resetAssetQueue,
        resetForNewUser, // 🔧 FIX: expose to consumers
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
