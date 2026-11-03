/**
 * User display/accessibility preferences: types, defaults, storage and DOM application.
 * Pure module (no React) so it can be shared by the context, the API client and tests.
 */

export type ThemePreference = 'dark' | 'light' | 'system';
export type EditorThemePreference = 'vs-dark' | 'vs' | 'hc-black' | 'hc-light';
export type UiScale = 'sm' | 'md' | 'lg';
export type FontFamilyPreference = 'default' | 'readable' | 'dyslexic';

export interface Preferences {
  theme: ThemePreference;
  editor_theme: EditorThemePreference;
  editor_font_size: number;
  ui_scale: UiScale;
  font_family: FontFamilyPreference;
  high_contrast: boolean;
  reduced_motion: boolean;
  focus_mode: boolean;
  shortcuts_enabled: boolean;
}

export const PREFS_STORAGE_KEY = 'mp-prefs';
/** Set when local prefs changed but have not reached the server yet. */
export const PREFS_DIRTY_KEY = 'mp-prefs-dirty';
/** Legacy key read by older code / the pre-paint script in index.html. */
export const LEGACY_THEME_KEY = 'mp-theme';

export const FONT_URLS: Record<Exclude<FontFamilyPreference, 'default'>, string[]> = {
  readable: ['https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap'],
  dyslexic: [
    'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.2.5/400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.2.5/700.css',
  ],
};

function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

export function defaultPreferences(): Preferences {
  return {
    theme: 'dark',
    editor_theme: 'vs-dark',
    editor_font_size: 14,
    ui_scale: 'md',
    font_family: 'default',
    high_contrast: false,
    reduced_motion: systemPrefersReducedMotion(),
    focus_mode: false,
    shortcuts_enabled: true,
  };
}

const THEMES: ThemePreference[] = ['dark', 'light', 'system'];
const EDITOR_THEMES: EditorThemePreference[] = ['vs-dark', 'vs', 'hc-black', 'hc-light'];
const SCALES: UiScale[] = ['sm', 'md', 'lg'];
const FONTS: FontFamilyPreference[] = ['default', 'readable', 'dyslexic'];

/** Merge an untrusted partial object onto a base, keeping only valid values. */
export function sanitizePreferences(raw: unknown, base: Preferences = defaultPreferences()): Preferences {
  const out: Preferences = { ...base };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (THEMES.includes(r.theme as ThemePreference)) out.theme = r.theme as ThemePreference;
  if (EDITOR_THEMES.includes(r.editor_theme as EditorThemePreference)) out.editor_theme = r.editor_theme as EditorThemePreference;
  if (typeof r.editor_font_size === 'number' && Number.isFinite(r.editor_font_size)) {
    out.editor_font_size = Math.min(28, Math.max(10, Math.round(r.editor_font_size)));
  }
  if (SCALES.includes(r.ui_scale as UiScale)) out.ui_scale = r.ui_scale as UiScale;
  if (FONTS.includes(r.font_family as FontFamilyPreference)) out.font_family = r.font_family as FontFamilyPreference;
  for (const key of ['high_contrast', 'reduced_motion', 'focus_mode', 'shortcuts_enabled'] as const) {
    if (typeof r[key] === 'boolean') out[key] = r[key] as boolean;
  }
  return out;
}

export function loadLocalPreferences(): Preferences {
  const base = defaultPreferences();
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) return sanitizePreferences(JSON.parse(stored), base);
    // Migrate the old single-key theme setting.
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') return { ...base, theme: legacy };
  } catch {
    // storage unavailable (private mode) — defaults
  }
  return base;
}

export function saveLocalPreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem(LEGACY_THEME_KEY, resolveTheme(prefs.theme) ? 'dark' : 'light');
  } catch {
    // ignore
  }
}

export function setDirty(dirty: boolean): void {
  try {
    if (dirty) localStorage.setItem(PREFS_DIRTY_KEY, '1');
    else localStorage.removeItem(PREFS_DIRTY_KEY);
  } catch {
    // ignore
  }
}

export function isDirty(): boolean {
  try {
    return localStorage.getItem(PREFS_DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

/** true = dark. */
export function resolveTheme(theme: ThemePreference): boolean {
  if (theme === 'system') return systemPrefersDark();
  return theme === 'dark';
}

function ensureFontLoaded(family: FontFamilyPreference): void {
  if (family === 'default') return;
  for (const href of FONT_URLS[family]) {
    if (document.querySelector(`link[data-mp-font][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-mp-font', family);
    document.head.appendChild(link);
  }
}

/** Reflect preferences onto <html> classes/attributes. Idempotent. */
export function applyPreferencesToDocument(prefs: Preferences): void {
  const root = document.documentElement;
  const dark = resolveTheme(prefs.theme);
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.classList.toggle('mp-hc', prefs.high_contrast);
  root.classList.toggle('mp-reduce-motion', prefs.reduced_motion);
  root.classList.toggle('mp-font-readable', prefs.font_family === 'readable');
  root.classList.toggle('mp-font-dyslexic', prefs.font_family === 'dyslexic');
  root.setAttribute('data-mp-scale', prefs.ui_scale);
  ensureFontLoaded(prefs.font_family);
}

/** Monaco theme to use. "vs-dark" is the default and follows the app's light/dark mode. */
export function resolveEditorTheme(prefs: Preferences, appIsDark: boolean): string {
  if (prefs.editor_theme === 'vs-dark') {
    if (prefs.high_contrast) return appIsDark ? 'hc-black' : 'hc-light';
    return appIsDark ? 'vs-dark' : 'light';
  }
  return prefs.editor_theme;
}
