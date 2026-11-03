import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { OFFLINE_EVENT, queuedFor, userKeyFromToken } from './offlineStore';
import { flushQueuedReviews } from './syncReviews';

/** navigator.onLine, kept live. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Number of reviews waiting to sync for the signed-in user. */
export function usePendingReviewCount(): number {
  const read = () => queuedFor(userKeyFromToken(api.getToken())).length;
  const [count, setCount] = useState(read);
  useEffect(() => {
    const update = () => setCount(read());
    window.addEventListener(OFFLINE_EVENT, update);
    window.addEventListener('storage', update);
    update();
    return () => {
      window.removeEventListener(OFFLINE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return count;
}

/**
 * Flush queued offline reviews when the app starts / after login (mount), when the browser
 * comes back online, and when the tab becomes visible again. Calls onSynced after anything
 * was acknowledged so the due queue and summary refresh.
 */
export function useOfflineReviewSync(onSynced: () => void): void {
  const run = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const n = await flushQueuedReviews();
    if (n > 0) onSynced();
  }, [onSynced]);

  useEffect(() => {
    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const onOnline = () => void run();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run]);
}
