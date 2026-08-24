let activeAudio: HTMLAudioElement | null = null;
let sequenceId = 0;

export function stopCurrentAudio() {
  sequenceId += 1;
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
}

export function playAudio(src: string, onEnded?: () => void) {
  stopCurrentAudio();
  const audio = new Audio(src);
  activeAudio = audio;
  audio.onended = () => {
    if (activeAudio === audio) activeAudio = null;
    onEnded?.();
  };
  void audio.play().catch(() => { if (activeAudio === audio) activeAudio = null; });
}

export function playSequence(sources: string[]) {
  stopCurrentAudio();
  const id = ++sequenceId;
  const next = (index: number) => {
    if (id !== sequenceId || index >= sources.length) return;
    const audio = new Audio(sources[index]);
    activeAudio = audio;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      next(index + 1);
    };
    void audio.play().catch(() => next(index + 1));
  };
  next(0);
}

export function getLetterSound(letter: string, day: number) {
  const upper = letter.toUpperCase();
  return day <= 10 ? `/letter_sounds/Sound-${upper}.mp3` : `/letter/Letter-${upper}.mp3`;
}
