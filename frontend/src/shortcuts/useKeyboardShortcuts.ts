import { useEffect, useRef } from 'react';
import { clearNavSelection, getNavSelection, moveNavSelection } from './navList';

export interface ShortcutHandlers {
  enabled: boolean;
  onSearch: () => void;
  onHelp: () => void;
  onGo: (target: 'dashboard' | 'patterns' | 'reviews' | 'bookmarks' | 'settings') => void;
  onOpenQuestion: (questionId: string) => void;
  onStartReview: () => void;
  onNewQuestion: () => void;
  onToggleFocus: () => void;
  /** Bookmark the open question, or the j/k-selected one if no question is open. */
  onBookmark: (selectedQuestionId: string | null) => void;
  /** Return true if Escape was handled (closed something). */
  onEscape: () => boolean;
}

/** Shortcut reference, also rendered by the help overlay. */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'General',
    items: [
      { keys: ['/'], label: 'Search' },
      { keys: ['⌘/Ctrl', 'K'], label: 'Search' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
      { keys: ['n'], label: 'New question' },
      { keys: ['Esc'], label: 'Close dialog / exit focus mode' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['g', 'd'], label: 'Dashboard' },
      { keys: ['g', 'p'], label: 'My patterns' },
      { keys: ['g', 'r'], label: 'Reviews' },
      { keys: ['g', 'b'], label: 'Bookmarks' },
      { keys: ['g', 's'], label: 'Settings' },
    ],
  },
  {
    title: 'Lists',
    items: [
      { keys: ['j'], label: 'Next question' },
      { keys: ['k'], label: 'Previous question' },
      { keys: ['Enter'], label: 'Open selected question' },
      { keys: ['o'], label: 'Open selected question' },
    ],
  },
  {
    title: 'Practice',
    items: [
      { keys: ['r'], label: 'Start review queue' },
      { keys: ['f'], label: 'Toggle focus mode (in a question)' },
      { keys: ['b'], label: 'Bookmark question' },
    ],
  },
];

type GoTarget = Parameters<ShortcutHandlers['onGo']>[0];

const GO_KEYS: Record<string, GoTarget> = {
  d: 'dashboard',
  p: 'patterns',
  r: 'reviews',
  b: 'bookmarks',
  s: 'settings',
};

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.closest('.monaco-editor')) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
  }
  return el.isContentEditable;
}

function isActivatable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('button, a[href], [role="button"], [role="menuitem"], summary');
}

/** Global keyboard shortcuts for the signed-in app. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    let pendingG = false;
    let gTimer: number | null = null;
    const resetG = () => {
      pendingG = false;
      if (gTimer) window.clearTimeout(gTimer);
      gTimer = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current;
      if (e.defaultPrevented) return;

      if (e.key === 'Escape') {
        if (e.target instanceof HTMLElement && e.target.closest('.monaco-editor')) return;
        if (h.onEscape()) e.preventDefault();
        resetG();
        return;
      }

      if (!h.enabled) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // Cmd/Ctrl+K is handled by the modal state hook
      if (isTypingTarget(e.target)) return;
      // Let open dialogs own the keyboard. Most modals use the shared overlay class rather than
      // aria-modal, so check both (otherwise `g d`, `n`, `b`… acted on the page underneath).
      if (document.querySelector('[role="dialog"][aria-modal="true"], .mp-modal-overlay, [data-modal-open]')) return;

      const key = e.key;

      if (pendingG) {
        const target = GO_KEYS[key.toLowerCase()];
        resetG();
        if (target) {
          e.preventDefault();
          clearNavSelection();
          h.onGo(target);
        }
        return;
      }

      switch (key) {
        case 'g':
          pendingG = true;
          gTimer = window.setTimeout(resetG, 1200);
          return;
        case '/':
          e.preventDefault();
          h.onSearch();
          return;
        case '?':
          e.preventDefault();
          h.onHelp();
          return;
        case 'j':
          e.preventDefault();
          moveNavSelection(1);
          return;
        case 'k':
          e.preventDefault();
          moveNavSelection(-1);
          return;
        case 'Enter':
        case 'o': {
          if (key === 'Enter' && isActivatable(e.target)) return; // Enter on a focused button keeps its meaning
          const id = getNavSelection();
          if (id) {
            e.preventDefault();
            h.onOpenQuestion(id);
          }
          return;
        }
        case 'r':
          e.preventDefault();
          h.onStartReview();
          return;
        case 'n':
          e.preventDefault();
          h.onNewQuestion();
          return;
        case 'f':
          e.preventDefault();
          h.onToggleFocus();
          return;
        case 'b':
          e.preventDefault();
          h.onBookmark(getNavSelection());
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      resetG();
    };
  }, []);
}
