import { useCallback, useContext, useEffect, useRef } from 'react';
import { api, ApiError } from '../services/api';
import { registerPendingWrites } from '../services/pendingWrites';
import { isDirty, sanitizePreferences, setDirty } from './preferencesCore';
import { PreferencesContext, type PreferencesContextType } from './preferencesContextObject';

const SYNC_DEBOUNCE_MS = 600;

export function usePreferences(): PreferencesContextType {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

/**
 * Server sync for the signed-in shell. Mount once inside the authenticated app.
 * - On mount: if there are local edits not yet saved, push them; otherwise pull the server copy.
 * - Afterwards: debounce-PUT every change (last write wins).
 * - If the endpoint doesn't exist (404) or fails, preferences simply stay local.
 */
export function usePreferencesServerSync(): void {
  const { prefs, setPrefs } = usePreferences();
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  const disabledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const applyingServerRef = useRef(false);

  const push = useCallback(async () => {
    if (disabledRef.current) return;
    try {
      await api.updatePreferences(prefsRef.current);
      setDirty(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) disabledRef.current = true;
      // keep dirty flag so the next session retries
    }
  }, []);

  // Initial reconcile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDirty()) {
        await push();
        return;
      }
      try {
        const server = await api.getPreferences();
        if (cancelled) return;
        applyingServerRef.current = true;
        setPrefs(sanitizePreferences(server, prefsRef.current));
        setDirty(false);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) disabledRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [push, setPrefs]);

  // Let logout send a change made inside the debounce window.
  useEffect(
    () =>
      registerPendingWrites(async () => {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (isDirty()) await push();
      }),
    [push]
  );

  // Debounced push on user changes.
  useEffect(() => {
    const onChanged = () => {
      if (applyingServerRef.current) {
        // This change came from the server pull; don't echo it back.
        applyingServerRef.current = false;
        setDirty(false);
        return;
      }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void push(), SYNC_DEBOUNCE_MS);
    };
    window.addEventListener('mp-prefs-changed', onChanged);
    return () => {
      window.removeEventListener('mp-prefs-changed', onChanged);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        if (isDirty()) void push();
      }
    };
  }, [push]);
}
