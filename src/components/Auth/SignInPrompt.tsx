import React, { useEffect } from 'react';
import { LogIn, UserPlus, X, Lock } from 'lucide-react';

export interface SignInPromptProps {
  /** What the guest tried to do, e.g. "add a question". Null hides the prompt. */
  action: string | null;
  onSignIn: () => void;
  onRegister: () => void;
  onClose: () => void;
}

/** Shown when a guest tries something that needs an account. */
export const SignInPrompt: React.FC<SignInPromptProps> = ({ action, onSignIn, onRegister, onClose }) => {
  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, onClose]);

  if (!action) return null;

  return (
    <div
      className="mp-modal-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-prompt-title"
        className="mp-card w-full max-w-sm p-6 relative rounded-b-none sm:rounded-2xl"
        style={{ boxShadow: 'var(--shadow-dropdown)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 h-9 w-9 inline-flex items-center justify-center rounded-lg mp-faint hover:bg-[var(--bg-hover)] transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-xl bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5" />
        </div>
        <h2 id="sign-in-prompt-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Sign in first
        </h2>
        <p className="text-xs mp-muted mt-1.5 leading-relaxed">
          You need an account to {action}. Sign in, or create a free account, and you'll come straight back here to
          carry on.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button type="button" autoFocus className="mp-btn mp-btn-primary justify-center py-2.5" onClick={onSignIn}>
            <LogIn className="w-4 h-4" /> Sign in
          </button>
          <button type="button" className="mp-btn justify-center py-2.5" onClick={onRegister}>
            <UserPlus className="w-4 h-4" /> Create a free account
          </button>
        </div>
      </div>
    </div>
  );
};
