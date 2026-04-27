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
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-fredoka font-bold text-foreground mb-2">
          📝 Assessment
        </h2>
        <p className="text-xl text-muted-foreground mb-4">
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

      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
        {options.map((option, idx) => (
          <Button
            key={idx}
            onClick={() => handleSelectAnswer(option)}
            disabled={showFeedback}
            className={`h-24 text-4xl font-fredoka font-bold rounded-2xl transition-all ${
              selectedAnswer === option
                ? isCorrect
                  ? 'bg-green-500 hover:bg-green-500 text-white'
                  : 'bg-red-500 hover:bg-red-500 text-white'
                : 'bg-muted hover:bg-accent text-foreground'
            }`}
          >
            {option}
          </Button>
        ))}
      </div>

      {showFeedback && (
        <div className={`text-center p-6 rounded-2xl ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
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
            className={`h-14 px-8 text-xl font-fredoka font-bold rounded-2xl ${
              score >= 3
                ? 'bg-primary hover:bg-primary/90 text-white'
                : 'bg-secondary hover:bg-secondary/90 text-white'
            }`}
          >
            {score >= 3 ? '🎓 Letter Mastered!' : 'Try Again'}
          </Button>
        </div>
      )}
    </div>
  );
}