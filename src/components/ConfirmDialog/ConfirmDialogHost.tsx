import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import { registerConfirmHost, type ConfirmRequest } from './confirm';

/** Renders the dialog for confirmAction(). Mount once, near the app root. */
export const ConfirmDialogHost: React.FC = () => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerConfirmHost(setRequest);
    return () => registerConfirmHost(null);
  }, []);

  const close = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(null);
  };

  useEffect(() => {
    if (!request) return;
    // Cancel has focus, so a stray Enter never deletes anything.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Capture phase + stop: Escape closes only this dialog, not whatever is open underneath.
        e.preventDefault();
        e.stopImmediatePropagation();
        request.resolve(false);
        setRequest(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [request]);

  if (!request) return null;
  const Icon = request.danger ? AlertTriangle : HelpCircle;

  return (
    <div
      className="mp-modal-overlay fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={() => close(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="mp-card w-full max-w-md p-6 relative rounded-b-none sm:rounded-2xl"
        style={{ boxShadow: 'var(--shadow-dropdown)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => close(false)}
          className="absolute right-3 top-3 h-9 w-9 inline-flex items-center justify-center rounded-lg mp-faint hover:bg-[var(--bg-hover)] transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div
            className={`p-2.5 rounded-xl shrink-0 border ${
              request.danger ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-yellow-400/15 text-yellow-500 border-yellow-400/30'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-bold break-words" style={{ color: 'var(--text-primary)' }}>
              {request.title}
            </h2>
            <p id="confirm-dialog-message" className="text-xs mp-muted mt-1.5 leading-relaxed">
              {request.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button ref={cancelRef} type="button" className="mp-btn justify-center py-2.5 sm:py-2" onClick={() => close(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={
              request.danger
                ? 'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 sm:py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 border border-rose-500 transition active:scale-[0.97]'
                : 'mp-btn mp-btn-primary justify-center py-2.5 sm:py-2'
            }
            onClick={() => close(true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
