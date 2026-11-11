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
/** Waits before each retry of a failed save (about a minute in total). */
const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];

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

  /** Failed saves waiting to be retried, by timer, so a closing tab can still send them. */
  const retriesRef = useRef(new Map<ReturnType<typeof setTimeout>, Pending<T>>());

  /** Send one payload after every earlier save; on failure, retry it on its own with backoff. */
  const send = useCallback((pending: Pending<T>, attempt: number): Promise<unknown> => {
    const seq = ++seqRef.current;
    const fields = Object.keys(pending.updates);
    for (const f of fields) takenRef.current.set(`${pending.id}:${f}`, seq);

    setStatusSafe('saving');
    const next = chainRef.current
      .catch(() => undefined)
      .then(() => saveRef.current(pending.id, pending.updates))
      .then(() => {
        if (!pendingRef.current && retriesRef.current.size === 0) setStatusSafe('saved');
      })
      .catch((err) => {
        console.error('Autosave failed:', err);
        setStatusSafe('error');
        if (attempt >= RETRY_DELAYS_MS.length) return;
        // Retried separately (not merged into whatever is pending now, which may be another
        // question), so switching questions can never drop these edits.
        const timer = setTimeout(() => {
          retriesRef.current.delete(timer);
          // Only fields no later save has taken and no waiting edit replaces: never resurrect
          // older text over newer text.
          const newer = pendingRef.current;
          const src = pending.updates as Record<string, unknown>;
          const retry: Record<string, unknown> = {};
          for (const f of fields) {
            const stillOurs = takenRef.current.get(`${pending.id}:${f}`) === seq;
            const hasNewer = newer?.id === pending.id && f in (newer.updates as Record<string, unknown>);
            if (stillOurs && !hasNewer) retry[f] = src[f];
          }
          if (Object.keys(retry).length) void send({ id: pending.id, updates: retry as Partial<T> }, attempt + 1);
        }, RETRY_DELAYS_MS[attempt]);
        retriesRef.current.set(timer, pending);
      });
    chainRef.current = next;
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback((): Promise<unknown> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return chainRef.current;
    pendingRef.current = null;
    return send(pending, 0);
  }, [send]);

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
      // Failed saves still waiting for their retry go out now too.
      for (const [timer, failed] of retriesRef.current) {
        clearTimeout(timer);
        api.flushKeepalive(endpointRef.current(failed.id), failed.updates);
      }
      retriesRef.current.clear();
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
