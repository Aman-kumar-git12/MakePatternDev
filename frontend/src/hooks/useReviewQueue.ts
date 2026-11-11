import { useCallback, useEffect, useState } from 'react';
import { api, isNetworkError } from '../services/api';
import type { QuestionListItem, ReviewQueue, ReviewRating } from '../types/dsa';
import { enqueueReview, loadDueCache, queuedFor, saveDueCache, userKeyFromToken } from '../offline/offlineStore';

const EMPTY: ReviewQueue = { due: [], upcoming: [], due_count: 0, reviewed_today: 0 };

/** Spaced-repetition queue state, shared by the sidebar badge and the review page. Works offline. */
export function useReviewQueue() {
  const [queue, setQueue] = useState<ReviewQueue>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True when the queue shown comes from the offline cache. */
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const user = userKeyFromToken(api.getToken());
    try {
      const data = await api.getDueReviews();
      const next: ReviewQueue = {
        due: data.due || [],
        upcoming: data.upcoming || [],
        due_count: data.due_count ?? (data.due || []).length,
        reviewed_today: data.reviewed_today ?? 0,
      };
      if (user) saveDueCache(user, next);
      // Cards rated offline whose rating hasn't synced yet stay hidden, so they can't be rated twice.
      const pending = new Set(queuedFor(user).map((r) => r.question_id));
      const due = next.due.filter((q) => !pending.has(q.id));
      setQueue({ ...next, due, due_count: Math.max(0, next.due_count - (next.due.length - due.length)) });
      setOffline(false);
      setCachedAt(null);
      setError(null);
    } catch (err) {
      const cached = user && isNetworkError(err) ? loadDueCache(user) : null;
      if (cached) {
        setQueue(cached.queue);
        setOffline(true);
        setCachedAt(cached.saved_at);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load reviews');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removeLocally = (questionId: string) =>
    setQueue((prev) => {
      const due = prev.due.filter((q) => q.id !== questionId);
      return {
        ...prev,
        due,
        due_count: Math.max(0, prev.due_count - (due.length < prev.due.length ? 1 : 0)),
        reviewed_today: prev.reviewed_today + 1,
      };
    });

  /**
   * Rate a review; optimistically removes the card from the due list.
   * Offline (or when the request can't reach the server) the rating is queued and
   * synced later; the returned item then has `queued: true` and no new schedule yet.
   */
  const rate = useCallback(
    async (questionId: string, rating: ReviewRating): Promise<QuestionListItem & { queued?: boolean }> => {
      const user = userKeyFromToken(api.getToken());
      const current = queue.due.find((q) => q.id === questionId);
      const queueOffline = () => {
        if (!user) throw new Error('Sign in again to save reviews.');
        enqueueReview(user, questionId, rating, current?.title);
        removeLocally(questionId);
        return { ...(current as QuestionListItem), id: questionId, next_review_at: null, queued: true };
      };
      if (typeof navigator !== 'undefined' && !navigator.onLine) return queueOffline();
      try {
        const updated = await api.submitReview(questionId, rating);
        removeLocally(questionId);
        // Re-sync in the background ("again" may keep a card due today).
        void refresh();
        return updated;
      } catch (err) {
        if (isNetworkError(err)) return queueOffline();
        throw err;
      }
    },
    [refresh, queue.due]
  );

  return { queue, loading, error, refresh, rate, offline, cachedAt };
}

export type ReviewQueueState = ReturnType<typeof useReviewQueue>;
