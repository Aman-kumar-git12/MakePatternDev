import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface SheetAction {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/**
 * Touch-friendly replacement for hover-only row controls.
 * Bottom sheet on phones, centered menu on larger screens. Esc / backdrop closes it.
 */
export function ActionSheet({ open, title, subtitle, actions, onClose }: ActionSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>('button[data-sheet-action]:not([disabled])')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    // Stop clicks from bubbling through the React tree into the row that opened the sheet.
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm mp-sheet-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mp-sheet w-full sm:w-[360px] max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 px-4 pt-3 pb-2 border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
          <div className="min-w-0">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-600/60 sm:hidden" aria-hidden="true" />
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
            {subtitle && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 h-10 w-10 -mr-2 inline-flex items-center justify-center rounded-lg hover:bg-slate-500/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="py-1">
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                data-sheet-action
                disabled={a.disabled}
                onClick={() => {
                  onClose();
                  a.onSelect();
                }}
                className={`w-full min-h-[48px] px-4 flex items-center gap-3 text-sm text-left transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-500/10 focus-visible:bg-slate-500/10 ${
                  a.danger ? 'text-rose-400' : ''
                }`}
                style={a.danger ? undefined : { color: 'var(--text-primary)' }}
              >
                <span className="w-5 h-5 inline-flex items-center justify-center shrink-0" aria-hidden="true">{a.icon}</span>
                <span className="truncate">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
