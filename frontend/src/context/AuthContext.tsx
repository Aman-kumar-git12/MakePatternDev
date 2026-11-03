import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isNetworkError } from '../services/api';
import type { User } from '../types/dsa';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<User>;
  logout: () => void;
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
          if (isNetworkError(err) && cached) {
            // Offline or the server is waking up: keep the session; requests retry later.
            console.warn('Server unreachable; continuing with the saved session.', err);
            setUser(cached);
            setIsLoading(false);
            return;
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

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem(AUTH_TOKEN_KEY, res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.register(email, password, fullName);
      localStorage.setItem(AUTH_TOKEN_KEY, res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    api.clearToken();
    setToken(null);
    setUser(null);
  }, []);

  // Any authenticated 401 (expired/revoked token) logs the user out.
  useEffect(() => {
    api.onUnauthorized(() => logout());
    return () => api.onUnauthorized(null);
  }, [logout]);

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
      if (!isNetworkError(err)) logout();
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
