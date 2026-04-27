import { useEffect, useRef } from 'react';

interface RewardFeedbackProps {
  show: boolean;
  type: 'correct' | 'incorrect' | 'mastered';
  message?: string;
}

export default function RewardFeedback({ show, type, message }: RewardFeedbackProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !containerRef.current) return;

    // Trigger confetti for correct/mastered
    if (type === 'correct' || type === 'mastered') {
      triggerConfetti();
    }

    // Play sound effect (placeholder)
    playRewardSound(type);
  }, [show, type]);

  const triggerConfetti = () => {
    if (!containerRef.current) return;

    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.left = Math.random() * window.innerWidth + 'px';
      confetti.style.top = '-10px';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.backgroundColor = ['#FF8C42', '#1DD1A1', '#FFD93D', '#FFB6C1'][
        Math.floor(Math.random() * 4)
      ];
      confetti.style.borderRadius = '50%';
      confetti.style.pointerEvents = 'none';
      confetti.style.zIndex = '9999';
      confetti.style.animation = `fall ${2 + Math.random() * 1}s linear forwards`;

      document.body.appendChild(confetti);

      setTimeout(() => confetti.remove(), 3000);
    }
  };

  const playRewardSound = (rewardType: string) => {
    // Placeholder for sound effects
    // In production, integrate Web Audio API or audio files
    console.log(`Playing ${rewardType} sound effect`);
  };

  if (!show) return null;

  const config = {
    correct: {
      emoji: '✨',
      title: 'Excellent!',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-300',
    },
    incorrect: {
      emoji: '💪',
      title: 'Keep Trying!',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      borderColor: 'border-red-300',
    },
    mastered: {
      emoji: '🏆',
      title: 'Letter Mastered!',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-300',
    },
  };

  const current = config[type];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
    >
      <div
        className={`${current.bgColor} border-4 ${current.borderColor} rounded-3xl p-8 max-w-sm text-center animate-bounce`}
        style={{
          animation: 'bounce 0.6s ease-in-out',
        }}
      >
        <div className="text-6xl mb-4">{current.emoji}</div>
        <h3 className={`text-3xl font-fredoka font-bold ${current.textColor} mb-2`}>
          {current.title}
        </h3>
        {message && (
          <p className={`text-lg ${current.textColor}`}>{message}</p>
        )}
      </div>

      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
