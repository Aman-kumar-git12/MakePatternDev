import { CloudOff, CloudUpload } from 'lucide-react';
import { useOnlineStatus, usePendingReviewCount } from '../../offline/useOffline';

/** Subtle app-wide connectivity strip: offline notice and unsynced review count. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const pending = usePendingReviewCount();
  if (online && pending === 0) return null;

  const reviews = `${pending} ${pending === 1 ? 'review' : 'reviews'}`;
  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 px-3 sm:px-6 py-1.5 text-[11px] sm:text-xs flex items-center gap-2 border-b"
      style={{
        backgroundColor: online ? 'rgba(56,189,248,0.08)' : 'rgba(250,204,21,0.10)',
        borderColor: 'var(--border-primary)',
        color: 'var(--text-secondary)',
      }}
    >
      {online ? (
        <>
          <CloudUpload className="w-3.5 h-3.5 shrink-0 text-sky-400" />
          <span className="truncate">Syncing {reviews} saved offline…</span>
        </>
      ) : (
        <>
          <CloudOff className="w-3.5 h-3.5 shrink-0 text-yellow-300" />
          <span className="truncate">
            You're offline. Reviews still work and will sync later; other edits need a connection.
            {pending > 0 ? ` ${reviews} waiting to sync.` : ''}
          </span>
        </>
      )}
    </div>
  );
}
