import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../services/api';
import { flushPendingWrites } from '../services/pendingWrites';
import { clearDueCache, userKeyFromToken } from '../offline/offlineStore';
import { clearToasts } from '../hooks/useUndoToasts';
import { setDirty } from './preferencesCore';

/** Only a 401 means the stored session is invalid; outages, 429s and 5xx keep the user signed in. */
const isAuthRejection = (err: unknown) => err instanceof ApiError && err.status === 401;
import type { User } from '../types/dsa';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Replace the cached user after a profile update. */
  setCurrentUser: (user: User) => void;
  /** Persist a newly issued token (e.g. after password change revokes the old one). */
  replaceToken: (token: string) => void;
}

const AUTH_TOKEN_KEY = 'mp_auth_token';
/** Last known user, so the app (and offline reviews) still open when the server is unreachable. */
const AUTH_USER_KEY = 'mp_auth_user';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify authentication on app load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (storedToken) {
        api.setToken(storedToken);
        setToken(storedToken);
        try {
          const currentUser = await api.getMe();
          setUser(currentUser);
        } catch (err) {
          const cached = readCachedUser();
          if (!isAuthRejection(err)) {
            if (cached) {
              // Offline, the server is waking up, or a transient server error: keep the session.
              console.warn('Could not verify the session; continuing with the saved one.', err);
              setUser(cached);
              setIsLoading(false);
              return;
            }
            try {
              await new Promise((r) => setTimeout(r, 1500));
              setUser(await api.getMe());
              setIsLoading(false);
              return;
            } catch (retryErr) {
              if (!isAuthRejection(retryErr)) {
                // Still unreachable and nothing cached to show: keep the token for next time.
                console.warn('Server unavailable; please retry shortly.', retryErr);
                api.clearToken();
                setToken(null);
                setUser(null);
                setIsLoading(false);
                return;
              }
            }
          }
          console.warn('Stored auth token invalid or expired. Logging out...', err);
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          api.clearToken();
          setToken(null);
          setUser(null);
        }
      } else {
        api.clearToken();
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // These deliberately don't toggle the global isLoading: PublicRoute would swap the page for a
  // spinner, unmounting the form and losing the error message. The pages track their own submit state.
  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.login(email, password);
    localStorage.setItem(AUTH_TOKEN_KEY, res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (email: string, password: string, fullName: string): Promise<User> => {
    const res = await api.register(email, password, fullName);
    localStorage.setItem(AUTH_TOKEN_KEY, res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  /** Drops the session and everything tied to this user on this device. */
  const clearSession = useCallback(() => {
    // Cached due-review titles, the other user's undo toasts and an unsynced preferences flag
    // must not leak to whoever signs in next on a shared device.
    clearDueCache(userKeyFromToken(api.getToken()));
    clearToasts();
    setDirty(false);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    api.clearToken();
    setToken(null);
    setUser(null);
  }, []);

  /** User-initiated logout: send edits still waiting to autosave before dropping the token. */
  const logout = useCallback(async () => {
    await flushPendingWrites();
    clearSession();
  }, [clearSession]);

  // Any authenticated 401 (expired/revoked token): the token is already invalid, so don't wait.
  useEffect(() => {
    api.onUnauthorized(() => clearSession());
    return () => api.onUnauthorized(null);
  }, [clearSession]);

  const setCurrentUser = useCallback((next: User) => setUser(next), []);

  // Remember the signed-in user for offline starts.
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
  }, [user]);

  const replaceToken = useCallback((next: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, next);
    api.setToken(next);
    setToken(next);
  }, []);

  const refreshUser = async () => {
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
    } catch (err) {
      if (isAuthRejection(err)) clearSession();
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    refreshUser,
    setCurrentUser,
    replaceToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
