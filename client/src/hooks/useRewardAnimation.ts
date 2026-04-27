import { useEffect, useRef } from 'react';

export function useRewardAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const triggerConfetti = () => {
    if (!containerRef.current) return;

    // Create confetti particles
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

  const triggerSparkles = () => {
    if (!containerRef.current) return;

    for (let i = 0; i < 15; i++) {
      const sparkle = document.createElement('div');
      sparkle.style.position = 'absolute';
      sparkle.style.left = Math.random() * 100 + '%';
      sparkle.style.top = Math.random() * 100 + '%';
      sparkle.style.width = '4px';
      sparkle.style.height = '4px';
      sparkle.style.backgroundColor = '#FFD93D';
      sparkle.style.borderRadius = '50%';
      sparkle.style.pointerEvents = 'none';
      sparkle.style.animation = 'sparkle 0.8s ease-out forwards';

      containerRef.current.appendChild(sparkle);

      setTimeout(() => sparkle.remove(), 800);
    }
  };

  useEffect(() => {
    // Add animation keyframes to document
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fall {
        to {
          transform: translateY(100vh) rotate(360deg);
          opacity: 0;
        }
      }
      @keyframes sparkle {
        0% {
          opacity: 1;
          transform: scale(1);
        }
        100% {
          opacity: 0;
          transform: scale(0);
        }
      }
      @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return {
    containerRef,
    triggerConfetti,
    triggerSparkles,
  };
}
