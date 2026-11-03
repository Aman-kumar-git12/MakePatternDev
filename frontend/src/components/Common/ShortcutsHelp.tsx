import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { SHORTCUT_GROUPS } from '../../shortcuts/useKeyboardShortcuts';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcutsEnabled: boolean;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Accessible "?" overlay listing every keyboard shortcut. */
export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose, shortcutsEnabled }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'var(--bg-overlay)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-shortcuts-title"
        className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 custom-scrollbar"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-elevated)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="mp-shortcuts-title" className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Keyboard className="w-5 h-5" aria-hidden="true" />
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-2 rounded-lg hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {!shortcutsEnabled && (
          <p className="mb-4 text-sm rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
            Single-key shortcuts are turned off. Enable them in Settings → Appearance.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label + item.keys.join('')} className="flex items-center justify-between gap-3 text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={k + i}>
                          {i > 0 && item.keys.length === 2 && group.title === 'Go to' && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>then</span>
                          )}
                          <kbd
                            className="min-w-[1.75rem] text-center px-1.5 py-0.5 rounded-md border text-xs font-mono"
                            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card-alt)', color: 'var(--text-primary)' }}
                          >
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Shortcuts are paused while you type in a text field or the code editor.
        </p>
      </div>
    </div>
  );
};
