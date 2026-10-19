import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
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
}

const AUTH_TOKEN_KEY = 'mp_auth_token';

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
          console.warn('Stored auth token invalid or expired. Logging out...', err);
          localStorage.removeItem(AUTH_TOKEN_KEY);
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
    api.clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = async () => {
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
    } catch {
      logout();
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
