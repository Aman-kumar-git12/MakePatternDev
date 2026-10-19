import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ApiError } from '../services/api';
import {
  Layers,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  ServerCrash,
  Loader2,
  Code2,
  Cpu,
  UserPlus,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { isDark } = useTheme();

  // Support prefilling email from redirect (e.g. from register if email already exists)
  const prefillEmail = (location.state as { prefillEmail?: string; from?: { pathname: string } })?.prefillEmail || '';
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Error management
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [errorType, setErrorType] = useState<'auth_failed' | 'server_error' | 'validation' | 'general' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (fieldName: 'email' | 'password') => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
    if (error && Object.keys(fieldErrors).length <= 1) {
      setError(null);
      setErrorType(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof fieldErrors = {};
    const missing: string[] = [];

    if (!email.trim()) {
      errors.email = 'Email address is missing. Please enter your email.';
      missing.push('Email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Invalid email address format (e.g. name@example.com).';
      missing.push('Valid email');
    }

    if (!password) {
      errors.password = 'Password is missing. Please enter your password.';
      missing.push('Password');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorType('validation');
      setError(`Please provide all required fields: ${missing.join(', ')}.`);
      return;
    }

    setError(null);
    setFieldErrors({});
    setErrorType(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      let message = 'Invalid credentials. Please verify your email and password.';
      const newFieldErrors: typeof fieldErrors = {};
      let type: 'auth_failed' | 'server_error' | 'validation' | 'general' = 'general';

      if (err instanceof ApiError) {
        message = err.message;
        if (err.status === 401) {
          type = 'auth_failed';
          message = 'Invalid email or password. Please verify your credentials.';
          newFieldErrors.email = 'Check this email';
          newFieldErrors.password = 'Check this password';
        } else if (err.status >= 500 || err.status === 0 || /server error|connection failed|backend server/i.test(message)) {
          type = 'server_error';
        } else if (err.status === 422) {
          type = 'validation';
          if (err.fieldErrors) {
            if (err.fieldErrors.email) newFieldErrors.email = err.fieldErrors.email;
            if (err.fieldErrors.password) newFieldErrors.password = err.fieldErrors.password;
          }
        }
      } else if (err instanceof Error) {
        message = err.message;
        if (/invalid email or password|credentials/i.test(message)) {
          type = 'auth_failed';
        } else if (/server error|connect|fetch|500/i.test(message)) {
          type = 'server_error';
        }
      }

      setError(message);
      setFieldErrors(newFieldErrors);
      setErrorType(type);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = (hasError?: boolean) => {
    const base = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-xs transition shadow-inner focus:outline-none';
    if (hasError) {
      return `${base} border border-rose-500/80 ring-1 ring-rose-500/40 bg-rose-500/5 text-rose-100`;
    }
    return `${base} border focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50`;
  };

  const inputStyle = (hasError?: boolean) => ({
    backgroundColor: hasError ? 'rgba(244, 63, 94, 0.06)' : 'var(--bg-input)',
    borderColor: hasError ? 'rgba(244, 63, 94, 0.8)' : 'var(--border-primary)',
    color: 'var(--text-primary)',
  });

  return (
    <div className="min-h-screen w-full flex flex-col justify-between overflow-x-hidden selection:bg-yellow-400/30 font-sans" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Background Ambient Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] ${isDark ? 'bg-yellow-400/5' : 'bg-yellow-200/20'}`} />
        <div className={`absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full blur-[150px] ${isDark ? 'bg-yellow-500/5' : 'bg-yellow-100/20'}`} />
        <div className={`absolute -bottom-40 left-1/3 w-96 h-96 rounded-full blur-[140px] ${isDark ? 'bg-yellow-400/5' : 'bg-yellow-200/15'}`} />
        {isDark && <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />}
      </div>

      {/* Top Navigation Bar */}
      <header className="px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#fef08a] flex items-center justify-center shadow-md shadow-yellow-200/30 group-hover:scale-105 transition-transform duration-200">
            <Layers className="w-5 h-5 text-[#18181b]" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              MakePattern
            </span>
            <span className="block text-[10px] font-medium text-yellow-300 tracking-wider uppercase">
              DSA Curriculum
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-3">
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>Don't have an account?</span>
          <Link
            to="/register"
            className="px-4 py-2 rounded-xl text-xs font-semibold transition duration-200 shadow-sm"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 z-10">
        <div className="w-full max-w-md">
          {/* Main Card */}
          <div
            className="relative rounded-3xl backdrop-blur-xl p-8 sm:p-10 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            {/* Subtle Top Accent Glow */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />

            {/* Header */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pattern-Based Mastery</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Welcome back
              </h1>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                Enter your credentials to access your patterns and code solutions
              </p>
            </div>

            {/* Detailed Error Alert */}
            {error && (
              <div className="mb-5 animate-shake">
                {errorType === 'auth_failed' ? (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-2.5">
                    <div className="flex items-start space-x-2.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                      <div className="flex-1">
                        <div className="font-semibold text-rose-300 text-xs">Authentication Failed</div>
                        <p className="mt-0.5 leading-relaxed text-[11px] text-rose-200/90">{error}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                      <span className="text-[11px] text-rose-300/80">Need a new account?</span>
                      <Link
                        to="/register"
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Register Now</span>
                      </Link>
                    </div>
                  </div>
                ) : errorType === 'server_error' ? (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start space-x-3">
                    <ServerCrash className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <div className="font-semibold text-rose-300 text-xs">Server Error (500)</div>
                      <p className="mt-0.5 leading-relaxed text-[11px] text-rose-200/90">{error}</p>
                      <p className="mt-1 text-[10px] text-rose-300/70">
                        Please verify the backend server is running and reachable.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                    <div className="flex-1">
                      <div className="font-medium text-rose-200 text-xs">Notice</div>
                      <div className="leading-relaxed mt-0.5 text-[11px] text-rose-300/90">{error}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="login-email">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: fieldErrors.email ? '#f43f5e' : 'var(--text-tertiary)' }}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className={getInputClassName(Boolean(fieldErrors.email))}
                    style={inputStyle(Boolean(fieldErrors.email))}
                  />
                </div>
                {fieldErrors.email && (
                  <div className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }} htmlFor="login-password">
                    Password <span className="text-rose-400">*</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: fieldErrors.password ? '#f43f5e' : 'var(--text-tertiary)' }}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError('password');
                    }}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className={`${getInputClassName(Boolean(fieldErrors.password))} pr-10`}
                    style={inputStyle(Boolean(fieldErrors.password))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center transition"
                    style={{ color: 'var(--text-tertiary)' }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <div className="mt-1 flex items-center space-x-1.5 text-[11px] text-rose-400 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{fieldErrors.password}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-xs text-[#18181b] bg-[#fef08a] hover:bg-[#fef9c3] shadow-md shadow-yellow-200/30 flex items-center justify-center space-x-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#18181b]" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Card Footer */}
            <div className="mt-7 pt-5 text-center" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Don't have an account yet?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-yellow-300 hover:text-yellow-200 transition"
                >
                  Create one for free
                </Link>
              </p>
            </div>
          </div>

          {/* Quick Features Preview beneath */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div
              className="p-3 rounded-2xl backdrop-blur"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Layers className="w-4 h-4 text-yellow-300 mx-auto mb-1.5" />
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Tree Topics</div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Recursive structure</div>
            </div>
            <div
              className="p-3 rounded-2xl backdrop-blur"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Code2 className="w-4 h-4 text-yellow-300 mx-auto mb-1.5" />
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Monaco Editor</div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Multi-solution code</div>
            </div>
            <div
              className="p-3 rounded-2xl backdrop-blur"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Cpu className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Complexity</div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>O(n) comparisons</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs z-10" style={{ color: 'var(--text-muted)' }}>
        MakePattern &copy; {new Date().getFullYear()} &mdash; All Rights Reserved
      </footer>
    </div>
  );
};

