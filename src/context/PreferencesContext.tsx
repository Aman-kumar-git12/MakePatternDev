import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PreferencesContext } from './preferencesContextObject';
import {
  type Preferences,
  applyPreferencesToDocument,
  loadLocalPreferences,
  resolveTheme,
  sanitizePreferences,
  saveLocalPreferences,
  setDirty,
} from './preferencesCore';


export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefsState] = useState<Preferences>(loadLocalPreferences);
  const [systemDark, setSystemDark] = useState(() => resolveTheme('system'));

  // Apply to <html> and persist locally on every change (instant, no server round-trip).
  useEffect(() => {
    applyPreferencesToDocument(prefs);
    saveLocalPreferences(prefs);
  }, [prefs, systemDark]);

  // "system" theme follows the OS live.
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setPrefs = useCallback((updates: Partial<Preferences>) => {
    setPrefsState((prev) => sanitizePreferences(updates, prev));
    setDirty(true);
    window.dispatchEvent(new CustomEvent('mp-prefs-changed', { detail: updates }));
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState(sanitizePreferences({}, loadDefaultsOnly()));
    setDirty(true);
    window.dispatchEvent(new CustomEvent('mp-prefs-changed', { detail: null }));
  }, []);

  const isDark = prefs.theme === 'system' ? systemDark : prefs.theme === 'dark';

  const value = useMemo(() => ({ prefs, isDark, setPrefs, resetPrefs }), [prefs, isDark, setPrefs, resetPrefs]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

function loadDefaultsOnly(): Preferences {
  // sanitizePreferences({}) with no base returns defaults.
  return sanitizePreferences({});
}

