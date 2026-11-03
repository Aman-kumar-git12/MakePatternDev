import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate, onUpdateAvailable } from '../../pwa/registerServiceWorker';

/** "New version available — Reload" prompt for the installed / cached app. */
export function UpdateToast() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => onUpdateAvailable(setAvailable), []);

  if (!available || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed z-[90] left-3 right-3 sm:left-auto sm:right-5 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:w-80 rounded-xl border shadow-2xl px-3 py-2.5 flex items-center gap-3 text-sm"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
    >
      <RefreshCw className="w-4 h-4 shrink-0 text-yellow-300" />
      <span className="flex-1 min-w-0">New version available</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="h-9 px-3 rounded-lg bg-[#fef08a] text-[#18181b] text-xs font-semibold hover:bg-[#fef9c3]"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notice"
        className="h-9 w-9 -mr-1 inline-flex items-center justify-center rounded-lg hover:bg-slate-500/10"
        style={{ color: 'var(--text-secondary)' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
