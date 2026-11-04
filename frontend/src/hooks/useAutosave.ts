import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { registerPendingWrites } from '../services/pendingWrites';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface Pending<T> {
  id: string;
  updates: Partial<T>;
}

/**
 * Debounced, field-merging, serialized autosave.
 *
 * - Edits to different fields within the debounce window are merged into one payload.
 * - Saves for the same entity are serialized, so an older request can never land on the
 *   server after a newer one.
 * - If a save fails, only fields that no later save has taken are re-queued, so a failure
 *   can never resurrect older text over newer text.
 * - `flush()` sends whatever is pending immediately; it runs on unmount and when the tab is
 *   hidden. On `pagehide` (tab close) the edits go out with `fetch keepalive`.
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
  /** Monotonic flush counter, and the latest flush that took each `${id}:${field}`. */
  const seqRef = useRef(0);
  const takenRef = useRef(new Map<string, number>());

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

    const seq = ++seqRef.current;
    const fields = Object.keys(pending.updates);
    for (const f of fields) takenRef.current.set(`${pending.id}:${f}`, seq);

    setStatusSafe('saving');
    const next = chainRef.current
      .catch(() => undefined)
      .then(() => saveRef.current(pending.id, pending.updates))
      .then(() => {
        if (!pendingRef.current) setStatusSafe('saved');
      })
      .catch((err) => {
        console.error('Autosave failed:', err);
        // Re-queue only the fields no later flush has taken (those carry newer values), and
        // never over newer edits that are still waiting.
        const newer = pendingRef.current;
        if (newer && newer.id !== pending.id) {
          setStatusSafe('error');
          return;
        }
        const retry: Record<string, unknown> = {};
        const src = pending.updates as Record<string, unknown>;
        for (const f of fields) {
          const stillOurs = takenRef.current.get(`${pending.id}:${f}`) === seq;
          const hasNewer = newer ? f in (newer.updates as Record<string, unknown>) : false;
          if (stillOurs && !hasNewer) retry[f] = src[f];
        }
        if (Object.keys(retry).length || newer) {
          pendingRef.current = {
            id: pending.id,
            updates: { ...(retry as Partial<T>), ...(newer?.updates || {}) },
          };
          setStatusSafe('error');
        }
        // Otherwise a later save already carries newer values for every field; its result decides the status.
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

  useEffect(() => {
    // Tab hidden: the page is still alive, so use the normal ordered save (with retry on failure).
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    // Tab closing: the page is going away, so only a keepalive request can still be delivered.
    const flushOnUnload = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      api.flushKeepalive(endpointRef.current(pending.id), pending.updates);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('beforeunload', flushOnUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushOnUnload);
      window.removeEventListener('beforeunload', flushOnUnload);
    };
  }, [flush]);

  // Register for logout, and flush on unmount (navigating away from the workspace, etc.).
  useEffect(() => {
    mountedRef.current = true;
    const unregister = registerPendingWrites(flush);
    return () => {
      unregister();
      mountedRef.current = false;
      void flush();
    };
  }, [flush]);

  const hasPending = useCallback(() => pendingRef.current !== null, []);

  return { queue, flush, status, hasPending };
}
