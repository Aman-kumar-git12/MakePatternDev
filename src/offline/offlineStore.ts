/**
 * Offline persistence for the review queue.
 *
 * - The last successful GET /reviews/due is cached per user so the Reviews page works offline.
 * - Ratings made while offline are queued and later flushed with POST /reviews/batch
 *   (idempotent per client_id, so a retried flush never double-counts).
 *
 * Everything is scoped to the user id inside the JWT so two accounts on one device never mix.
 * localStorage is enough here: the queue is capped and the cached due list is small.
 */
import type { QuestionListItem, ReviewQueue, ReviewRating } from '../types/dsa';

export interface QueuedReview {
  client_id: string;
  question_id: string;
  rating: ReviewRating;
  reviewed_at: string;
  user: string;
  title?: string;
}

const QUEUE_KEY = 'mp-offline-reviews-v1';
const DUE_KEY_PREFIX = 'mp-offline-due-v1:';
const MAX_QUEUE = 500;
export const OFFLINE_EVENT = 'mp-offline-queue-changed';

/** User id ("sub") from a JWT without verifying it — only used to scope local storage. */
export function userKeyFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = JSON.parse(json)?.sub;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full / disabled: offline support degrades gracefully.
  }
}

function notify(): void {
  window.dispatchEvent(new Event(OFFLINE_EVENT));
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Queued (unsynced) reviews
// ---------------------------------------------------------------------------

function allQueued(): QueuedReview[] {
  const items = read<QueuedReview[]>(QUEUE_KEY, []);
  return Array.isArray(items) ? items : [];
}

export function queuedFor(user: string | null): QueuedReview[] {
  if (!user) return [];
  return allQueued().filter((r) => r.user === user);
}

export function enqueueReview(user: string, questionId: string, rating: ReviewRating, title?: string): QueuedReview {
  const item: QueuedReview = {
    client_id: newClientId(),
    question_id: questionId,
    rating,
    reviewed_at: new Date().toISOString(),
    user,
    title,
  };
  const items = [...allQueued(), item].slice(-MAX_QUEUE);
  write(QUEUE_KEY, items);
  removeFromCachedDue(user, questionId);
  notify();
  return item;
}

export function removeQueued(clientIds: string[]): void {
  if (!clientIds.length) return;
  const drop = new Set(clientIds);
  write(QUEUE_KEY, allQueued().filter((r) => !drop.has(r.client_id)));
  notify();
}

// ---------------------------------------------------------------------------
// Cached due queue
// ---------------------------------------------------------------------------

interface CachedDue {
  saved_at: string;
  queue: ReviewQueue;
}

export function saveDueCache(user: string, queue: ReviewQueue): void {
  write(DUE_KEY_PREFIX + user, { saved_at: new Date().toISOString(), queue } satisfies CachedDue);
}

/** Cached queue minus anything already rated offline (so it never reappears). */
export function loadDueCache(user: string): (CachedDue & { queue: ReviewQueue }) | null {
  const cached = read<CachedDue | null>(DUE_KEY_PREFIX + user, null);
  if (!cached?.queue) return null;
  const pending = new Set(queuedFor(user).map((r) => r.question_id));
  const due = (cached.queue.due || []).filter((q: QuestionListItem) => !pending.has(q.id));
  return {
    saved_at: cached.saved_at,
    queue: {
      ...cached.queue,
      due,
      due_count: Math.max(0, (cached.queue.due_count ?? due.length) - ((cached.queue.due || []).length - due.length)),
    },
  };
}

function removeFromCachedDue(user: string, questionId: string): void {
  const cached = read<CachedDue | null>(DUE_KEY_PREFIX + user, null);
  if (!cached?.queue) return;
  const before = cached.queue.due || [];
  const due = before.filter((q) => q.id !== questionId);
  if (due.length === before.length) return;
  write(DUE_KEY_PREFIX + user, {
    ...cached,
    queue: {
      ...cached.queue,
      due,
      due_count: Math.max(0, (cached.queue.due_count ?? before.length) - 1),
      reviewed_today: (cached.queue.reviewed_today ?? 0) + 1,
    },
  });
}

/** Clear cached data for a user (e.g. on logout); the unsynced queue is kept until next login. */
export function clearDueCache(user: string | null): void {
  if (!user) return;
  try {
    localStorage.removeItem(DUE_KEY_PREFIX + user);
  } catch {
    // ignore
  }
}
