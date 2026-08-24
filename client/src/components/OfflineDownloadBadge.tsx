import { useOfflineCache } from '../hooks/useOfflineCache';

export default function OfflineDownloadBadge() {
  const { done, total, complete } = useOfflineCache();

  // Nothing to show yet, or already finished downloading
  if (total === 0 || complete) return null;

  const percent = Math.round((done / total) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 16px',
        fontSize: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <span
        style={{
          height: 8,
          width: 8,
          borderRadius: '50%',
          backgroundColor: '#4ade80',
        }}
      />
      Downloading offline content… {percent}%
    </div>
  );
}