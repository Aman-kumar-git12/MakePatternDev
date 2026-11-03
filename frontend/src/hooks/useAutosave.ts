import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface Pending<T> {
  id: string;
  updates: Partial<T>;
}

/**
 * Debounced, field-merging, serialized autosave.
 *
 * - Edits to different fields within the debounce window are merged into one
 *   payload (previously only the last field edited was sent, dropping the rest).
 * - Saves for the same entity are serialized, so an older request can never land
 *   on the server after a newer one.
 * - `flush()` sends whatever is pending immediately; it runs automatically on
 *   unmount, and on `pagehide` / tab hide it is sent with `fetch keepalive` so a
 *   tab close doesn't lose the last ~second of typing.
 */
export function useAutosave<T>(
  save: (id: string, updates: Partial<T>) => Promise<unknown>,
  keepaliveEndpoint: (id: string) => string,
  delayMs: number = 700
) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pendingRef = useRef<Pending<T> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveRef = useRef(save);
  const endpointRef = useRef(keepaliveEndpoint);
  const mountedRef = useRef(true);

  useEffect(() => {
    saveRef.current = save;
    endpointRef.current = keepaliveEndpoint;
  });

  const setStatusSafe = (s: SaveStatus) => {
    if (mountedRef.current) setStatus(s);
  };

  const flush = useCallback((): Promise<unknown> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return chainRef.current;
    pendingRef.current = null;

    setStatusSafe('saving');
    const next = chainRef.current
      .catch(() => undefined)
      .then(() => saveRef.current(pending.id, pending.updates))
      .then(() => {
        if (!pendingRef.current) setStatusSafe('saved');
      })
      .catch((err) => {
        console.error('Autosave failed:', err);
        // Re-queue the failed fields underneath any newer edits so they are retried on the next flush.
        const newer = pendingRef.current;
        if (!newer || newer.id === pending.id) {
          pendingRef.current = {
            id: pending.id,
            updates: { ...pending.updates, ...(newer?.updates || {}) },
          };
        }
        setStatusSafe('error');
      });
    chainRef.current = next;
    return next;
  }, []);

  const queue = useCallback(
    (id: string, updates: Partial<T>) => {
      // Switching entity with edits pending: send the old entity's edits first.
      if (pendingRef.current && pendingRef.current.id !== id) {
        void flush();
      }
      pendingRef.current = {
        id,
        updates: { ...(pendingRef.current?.updates || {}), ...updates },
      };
      setStatusSafe('unsaved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, delayMs);
    },
    [delayMs, flush]
  );

  // Unload / background flush using keepalive so the request outlives the page.
  useEffect(() => {
    const flushOnLeave = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      api.flushKeepalive(endpointRef.current(pending.id), pending.updates);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnLeave();
    };
    window.addEventListener('pagehide', flushOnLeave);
    window.addEventListener('beforeunload', flushOnLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushOnLeave);
      window.removeEventListener('beforeunload', flushOnLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Flush on unmount (navigating away from the workspace, switching tabs, etc.).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void flush();
    };
  }, [flush]);

  const hasPending = useCallback(() => pendingRef.current !== null, []);

  return { queue, flush, status, hasPending };
}
