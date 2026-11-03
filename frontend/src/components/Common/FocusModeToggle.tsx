import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

/** Floating toggle for focus mode, shown while a question is open. */
export const FocusModeToggle: React.FC<{ active: boolean; onToggle: () => void }> = ({ active, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={active}
    aria-label={active ? 'Exit focus mode (Esc)' : 'Enter focus mode (F)'}
    title={active ? 'Exit focus mode (Esc)' : 'Focus mode (F)'}
    className="fixed z-40 bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium shadow-lg"
    style={{
      backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-card)',
      borderColor: active ? 'var(--accent-primary)' : 'var(--border-primary)',
      color: active ? '#18181b' : 'var(--text-secondary)',
      boxShadow: 'var(--shadow-elevated)',
    }}
  >
    {active ? <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />}
    <span className="hidden sm:inline">{active ? 'Exit focus' : 'Focus'}</span>
  </button>
);
