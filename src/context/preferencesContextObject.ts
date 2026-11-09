import { createContext } from 'react';
import type { Preferences } from './preferencesCore';

export interface PreferencesContextType {
  prefs: Preferences;
  /** Resolved app theme (system preference applied). */
  isDark: boolean;
  setPrefs: (updates: Partial<Preferences>) => void;
  resetPrefs: () => void;
}

export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);
