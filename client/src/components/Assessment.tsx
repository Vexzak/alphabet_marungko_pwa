import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { useState, useMemo } from 'react';

interface AssessmentProps {
  onNext: () => void;
  learnerCompletedLetters: string[];
}

export default function Assessment({ onNext, learnerCompletedLetters }: AssessmentProps) {
  const { currentLetter, allLetters, updateLetterProgress } = useApp();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const correctAnswer = currentLetter
    ? `${currentLetter.uppercase}${currentLetter.lowercase}`
    : '';

  // useMemo prevents options from reshuffling on every re-render
  const options = useMemo(() => {
    if (!currentLetter) return [];

    const availableLetters = learnerCompletedLetters.length > 0
      ? allLetters.filter(l => learnerCompletedLetters.includes(l.letter.toLowerCase()))
      : allLetters.slice(0, 3);

    const correct = `${currentLetter.uppercase}${currentLetter.lowercase}`;
    const distractors = availableLetters
      .filter(l => l.letter.toLowerCase() !== currentLetter.letter.toLowerCase())
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(l => `${l.uppercase}${l.lowercase}`);

    return [correct, ...distractors].sort(() => Math.random() - 0.5);
  }, [currentLetter, allLetters, learnerCompletedLetters]);

  const handleSelectAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    const correct = answer === correctAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      const newScore = score + 1;
      setScore(newScore);
      if (currentLetter) {
        updateLetterProgress(currentLetter.letter, {
          assessmentScore: newScore,
          completed: newScore >= 3,
        });
      }
    }
  };

  const handleContinue = () => {
    if (score >= 3) {
      if (currentLetter) {
        updateLetterProgress(currentLetter.letter, { completed: true });
      }
      onNext();
    } else {
      setSelectedAnswer(null);
      setShowFeedback(false);
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'clamp(12px, 3vh, 32px)', padding: 'clamp(8px, 2vh, 16px) 0' }}>
      <div className="text-center">
        <h2 className="font-fredoka font-bold text-foreground mb-2" style={{ fontSize: 'clamp(24px, 6vmin, 36px)', lineHeight: 1.1 }}>
          📝 Assessment
        </h2>
        <p className="text-muted-foreground mb-4" style={{ fontSize: 'clamp(15px, 3.5vmin, 20px)' }}>
          Can you identify the letter{' '}
          <span className="font-fredoka font-bold text-primary">
            {currentLetter?.uppercase}{currentLetter?.lowercase}
          </span>?
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-base font-quicksand font-semibold text-foreground">Progress:</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full ${i < score ? 'bg-primary' : 'bg-gray-300'}`}
              />
            ))}
          </div>
          <span className="text-base font-quicksand font-bold text-primary">{score}/3</span>
        </div>
      </div>

      <div className="grid grid-cols-3 max-w-md mx-auto" style={{ gap: 'clamp(8px, 2.5vw, 16px)', width: 'min(92vw, 448px)' }}>
        {options.map((option, idx) => (
          <Button
            key={idx}
            onClick={() => handleSelectAnswer(option)}
            disabled={showFeedback}
            className={`font-fredoka font-bold rounded-2xl transition-all ${
              selectedAnswer === option
                ? isCorrect
                  ? 'bg-green-500 hover:bg-green-500 text-white'
                  : 'bg-red-500 hover:bg-red-500 text-white'
                : 'bg-muted hover:bg-accent text-foreground'
            }`}
            style={{ height: 'clamp(64px, 17vmin, 96px)', fontSize: 'clamp(28px, 8vmin, 36px)' }}
          >
            {option}
          </Button>
        ))}
      </div>

      {showFeedback && (
        <div className={`text-center rounded-2xl ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`} style={{ padding: 'clamp(10px, 3vmin, 24px)' }}>
          {isCorrect ? (
            <div>
              <p className="text-4xl mb-2">✨</p>
              <p className="text-2xl font-fredoka font-bold text-green-700">Great Job!</p>
              <p className="text-lg text-green-600">You got it right!</p>
            </div>
          ) : (
            <div>
              <p className="text-4xl mb-2">💪</p>
              <p className="text-2xl font-fredoka font-bold text-red-700">Keep Trying!</p>
              <p className="text-lg text-red-600">
                The correct letter is {correctAnswer}
              </p>
            </div>
          )}
        </div>
      )}

      {showFeedback && (
        <div className="flex justify-center">
          <Button
            onClick={handleContinue}
            className={`px-8 font-fredoka font-bold rounded-2xl ${
              score >= 3
                ? 'bg-primary hover:bg-primary/90 text-white'
                : 'bg-secondary hover:bg-secondary/90 text-white'
            }`}
            style={{ height: 'clamp(44px, 9vmin, 56px)', fontSize: 'clamp(15px, 3.5vmin, 20px)' }}
          >
            {score >= 3 ? '🎓 Letter Mastered!' : 'Try Again'}
          </Button>
        </div>
      )}
    </div>
  );
}
