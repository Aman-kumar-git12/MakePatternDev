import { useSyncExternalStore } from 'react';

/**
 * Tiny module-level toast store (no provider needed, so hooks that run in the same component as
 * the toast stack can push toasts). Each toast optionally carries an async `onUndo` action.
 */
export interface UndoToast {
  id: number;
  message: string;
  /** Milliseconds the toast stays visible. */
  duration: number;
  createdAt: number;
  tone: 'default' | 'success' | 'error';
  undoLabel?: string;
  onUndo?: () => Promise<void> | void;
}

type Listener = () => void;

let toasts: UndoToast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const emit = () => listeners.forEach((l) => l());

export const UNDO_WINDOW_MS = 10_000;
const MAX_TOASTS = 4;

/** Removes every toast (e.g. on logout, so the next user never sees them). */
export function clearToasts() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  if (toasts.length) {
    toasts = [];
    emit();
  }
}

export function dismissToast(id: number) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  const before = toasts.length;
  toasts = toasts.filter((x) => x.id !== id);
  if (toasts.length !== before) emit();
}

export function pushToast(input: {
  message: string;
  onUndo?: () => Promise<void> | void;
  undoLabel?: string;
  duration?: number;
  tone?: UndoToast['tone'];
}): number {
  const id = nextId++;
  const toast: UndoToast = {
    id,
    message: input.message,
    onUndo: input.onUndo,
    undoLabel: input.undoLabel,
    duration: input.duration ?? (input.onUndo ? UNDO_WINDOW_MS : 4000),
    createdAt: Date.now(),
    tone: input.tone ?? 'default',
  };
  toasts = [...toasts, toast];
  // Keep the stack short: drop the oldest beyond the limit.
  while (toasts.length > MAX_TOASTS) dismissToast(toasts[0].id);
  timers.set(id, setTimeout(() => dismissToast(id), toast.duration));
  emit();
  return id;
}

/** Convenience for soft deletes: "Deleted X · Undo" for 10 seconds. */
export function pushUndoToast(message: string, onUndo: () => Promise<void> | void): number {
  return pushToast({ message, onUndo, undoLabel: 'Undo', duration: UNDO_WINDOW_MS });
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => toasts;

export function useUndoToasts(): UndoToast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
