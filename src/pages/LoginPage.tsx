import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Layers,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Code2,
  Cpu,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleDemoFill = () => {
    setEmail('aman@makepattern.dev');
    setPassword('password123');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid credentials. Please verify your email and password.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            className="relative rounded-3xl backdrop-blur-xl p-8 sm:p-10"
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

            {/* Error Alert */}
            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Quick Demo Credentials Pill */}
            <div
              className="mb-6 p-3 rounded-2xl flex items-center justify-between text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-6 h-6 rounded-lg bg-yellow-400/20 flex items-center justify-center text-yellow-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Demo Account</div>
                  <div className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>aman@makepattern.dev</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemoFill}
                className="px-2.5 py-1 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/30 text-yellow-300 hover:text-white text-[11px] font-semibold transition"
              >
                Auto Fill
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="login-email">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }} htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
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
