import React, { useCallback } from 'react';
import { PreferencesProvider } from './PreferencesContext';
import { usePreferences } from './usePreferences';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  /** Resolved theme currently shown. */
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

/**
 * Backwards-compatible theme API on top of the full preferences store
 * (which also supports "system", high contrast, fonts, scale, motion, …).
 */
export const useTheme = (): ThemeContextType => {
  const { isDark, setPrefs } = usePreferences();
  const toggleTheme = useCallback(() => {
    setPrefs({ theme: isDark ? 'light' : 'dark' });
  }, [isDark, setPrefs]);
  return { theme: isDark ? 'dark' : 'light', toggleTheme, isDark };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);
