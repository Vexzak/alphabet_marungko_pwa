import { useEffect, useState } from 'react';

interface CacheProgress {
  done: number;
  total: number;
  complete: boolean;
}

export function useOfflineCache(): CacheProgress {
  const [progress, setProgress] = useState<CacheProgress>({
    done: 0,
    total: 0,
    complete: false,
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (data?.type === 'CACHE_PROGRESS') {
        setProgress({ done: data.done, total: data.total, complete: false });
      } else if (data?.type === 'CACHE_COMPLETE') {
        setProgress((p) => ({ ...p, complete: true }));
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  return progress;
}