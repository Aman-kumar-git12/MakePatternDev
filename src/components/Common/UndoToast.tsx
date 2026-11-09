import React, { useEffect, useState } from 'react';
import { Loader2, RotateCcw, X, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { dismissToast, pushToast, useUndoToasts, type UndoToast } from '../../hooks/useUndoToasts';

const ToastCard: React.FC<{ toast: UndoToast }> = ({ toast }) => {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!toast.onUndo) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [toast.onUndo]);

  const remainingMs = Math.max(0, toast.createdAt + toast.duration - now);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const pct = toast.duration > 0 ? (remainingMs / toast.duration) * 100 : 0;

  const handleUndo = async () => {
    if (!toast.onUndo || busy) return;
    setBusy(true);
    try {
      await toast.onUndo();
      dismissToast(toast.id);
      pushToast({ message: 'Restored', tone: 'success', duration: 2500 });
    } catch (err) {
      dismissToast(toast.id);
      const msg = err instanceof Error ? err.message : 'Could not undo';
      pushToast({ message: `Undo failed: ${msg}. You can still restore it from Trash.`, tone: 'error', duration: 6000 });
    }
  };

  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Trash2;
  const iconColor = toast.tone === 'success' ? 'text-emerald-400' : toast.tone === 'error' ? 'text-rose-400' : 'mp-muted';

  return (
    <div
      className="mp-card pointer-events-auto relative overflow-hidden shadow-2xl shadow-black/40 flex items-center gap-3 pl-3 pr-2 py-2.5 w-full sm:w-[360px] animate-fade-in"
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
    >
      <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} aria-hidden />
      <p className="text-xs flex-1 min-w-0 break-words">{toast.message}</p>
      {toast.onUndo && (
        <button
          type="button"
          onClick={handleUndo}
          disabled={busy}
          className="mp-btn mp-btn-primary !py-1 !px-2.5 shrink-0"
          aria-label={`${toast.undoLabel || 'Undo'} (${secondsLeft} seconds left)`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          {toast.undoLabel || 'Undo'}
          <span className="tabular-nums opacity-70">{secondsLeft}s</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="p-1 rounded-md mp-muted hover:opacity-80 shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {toast.onUndo && (
        <div
          className="absolute left-0 bottom-0 h-0.5 bg-[#fef08a] transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      )}
    </div>
  );
};

/** Bottom-of-screen stack of toasts (undo for deletes, confirmations, errors). */
export const UndoToastStack: React.FC = () => {
  const toasts = useUndoToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed z-[60] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
};
