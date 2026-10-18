import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    <div className="min-h-screen w-full bg-[#060911] text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-blue-500/30 font-sans">
      {/* Background Ambient Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[150px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-violet-600/15 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      {/* Top Navigation Bar */}
      <header className="px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-200">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              MakePattern
            </span>
            <span className="block text-[10px] font-medium text-blue-400 tracking-wider uppercase">
              DSA Curriculum
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400 hidden sm:inline">Don't have an account?</span>
          <Link
            to="/register"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0D1527] hover:bg-[#14203D] border border-slate-800 text-slate-200 hover:text-white transition duration-200 shadow-sm"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 z-10">
        <div className="w-full max-w-md">
          {/* Main Card */}
          <div className="relative rounded-3xl bg-[#090E1A]/85 backdrop-blur-xl border border-slate-800/80 p-8 sm:p-10 shadow-2xl shadow-black/80">
            {/* Subtle Top Accent Glow */}
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            {/* Header */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pattern-Based Mastery</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Welcome back
              </h1>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
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
            <div className="mb-6 p-3 rounded-2xl bg-[#0D172E] border border-blue-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Demo Account</div>
                  <div className="text-[11px] text-slate-400 font-mono">aman@makepattern.dev</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemoFill}
                className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 hover:text-white text-[11px] font-semibold transition"
              >
                Auto Fill
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-email">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0D1322] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300" htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    className="w-full pl-10 pr-10 py-2.5 bg-[#0D1322] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
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
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
            <div className="mt-7 pt-5 border-t border-slate-800/80 text-center">
              <p className="text-xs text-slate-400">
                Don't have an account yet?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-blue-400 hover:text-blue-300 transition"
                >
                  Create one for free
                </Link>
              </p>
            </div>
          </div>

          {/* Quick Features Preview beneath */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-[#090E1A]/40 border border-slate-800/50 backdrop-blur">
              <Layers className="w-4 h-4 text-blue-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-semibold text-slate-300">Tree Topics</div>
              <div className="text-[9px] text-slate-500">Recursive structure</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#090E1A]/40 border border-slate-800/50 backdrop-blur">
              <Code2 className="w-4 h-4 text-indigo-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-semibold text-slate-300">Monaco Editor</div>
              <div className="text-[9px] text-slate-500">Multi-solution code</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#090E1A]/40 border border-slate-800/50 backdrop-blur">
              <Cpu className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" />
              <div className="text-[11px] font-semibold text-slate-300">Complexity</div>
              <div className="text-[9px] text-slate-500">O(n) comparisons</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-600 z-10">
        MakePattern &copy; {new Date().getFullYear()} &mdash; All Rights Reserved
      </footer>
    </div>
  );
};
