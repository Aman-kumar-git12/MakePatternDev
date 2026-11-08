/**
 * Where the signed-in session lives on this device.
 *
 * The access token is kept in a first-party cookie that expires 30 days after sign-in (the backend
 * issues 30-day tokens to match). When the cookie expires the browser drops it and the user signs
 * in again. Older builds kept the token in localStorage; it is moved into the cookie once.
 */

const TOKEN_COOKIE = 'mp_auth_token';
/** Legacy localStorage key, read once for migration. */
const LEGACY_TOKEN_KEY = 'mp_auth_token';

export const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

function cookieAttributes(maxAgeSeconds: number): string {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  return `; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      const value = decodeURIComponent(entry.slice(prefix.length));
      return value || null;
    }
  }
  return null;
}

/** Seconds left on a JWT, or null when it can't be read. */
function secondsUntilExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? Math.floor(payload.exp - Date.now() / 1000) : null;
  } catch {
    return null;
  }
}

/** Save a freshly issued token for 30 days. */
export function saveToken(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}${cookieAttributes(SESSION_SECONDS)}`;
}

/** The saved token, or null when signed out or the 30 days have passed. */
export function loadToken(): string | null {
  const fromCookie = readCookie(TOKEN_COOKIE);
  if (fromCookie) return fromCookie;

  // One-time migration from localStorage. Keep the token's own expiry rather than restarting 30 days.
  try {
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacy) return null;
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    const left = secondsUntilExpiry(legacy);
    if (left !== null && left <= 0) return null;
    const maxAge = left === null ? SESSION_SECONDS : Math.min(left, SESSION_SECONDS);
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(legacy)}${cookieAttributes(maxAge)}`;
    return legacy;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${TOKEN_COOKIE}=${cookieAttributes(0)}`;
  }
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

/**
 * Something a guest tried to do before signing in (e.g. add a question). Kept for the tab's
 * lifetime so the action can resume right after sign-in or registration.
 */
export type PendingIntent = 'new-question';
const INTENT_KEY = 'mp_after_sign_in';

export function setPendingIntent(intent: PendingIntent): void {
  try {
    sessionStorage.setItem(INTENT_KEY, intent);
  } catch {
    // ignore storage errors
  }
}

export function takePendingIntent(): PendingIntent | null {
  try {
    const value = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    return value === 'new-question' ? value : null;
  } catch {
    return null;
  }
}
